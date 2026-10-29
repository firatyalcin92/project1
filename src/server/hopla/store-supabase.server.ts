import '@tanstack/react-start/server-only'
import { createClient, type PostgrestError } from '@supabase/supabase-js'
import { SetupRequired, type HoplaStore, type PlayerRow } from './store.server'

/**
 * Supabase (Postgres) deposu: supabase/hopla.sql ile kurulan hopla_players tablosu.
 * Yalnızca sunucuda, service role anahtarıyla çalışır.
 */

const UNIQUE_VIOLATION = '23505'
const COLUMNS =
  'id,name,name_key,country,token_hash,best_score,best_at,best_jumps,best_perfects,last_run_iat,created_ip_hash,rename_count,rename_window,banned,created_at'

function missing(error: PostgrestError | null) {
  return (
    error?.code === 'PGRST205' ||
    error?.code === '42P01' ||
    error?.code === 'PGRST202' ||
    /could not find the (table|function)/i.test(error?.message ?? '')
  )
}

function check(error: PostgrestError | null, context: string) {
  if (!error) return
  if (missing(error)) throw new SetupRequired(`hopla tabloları yok (${context})`)
  console.error(`[hopla] supabase ${context}: [${error.code}] ${error.message}`)
  throw new Error(`supabase ${context} failed`)
}

/** bigint sütunu PostgREST'ten metin olarak da gelebilir */
function normalize(row: Record<string, unknown>): PlayerRow {
  return { ...(row as unknown as PlayerRow), last_run_iat: Number(row.last_run_iat ?? 0) }
}

export function createSupabaseHoplaStore(url: string, serviceKey: string): HoplaStore {
  const db = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { 'x-application-name': 'hopla' } },
  })
  const players = () => db.from('hopla_players')

  return {
    kind: 'supabase',

    async check() {
      const t = await players().select('id', { head: true, count: 'exact' }).limit(1)
      if (missing(t.error)) return { ready: false, problem: 'tables_missing' }
      if (t.error) return { ready: false, problem: `error_${t.error.code || 'unknown'}` }
      const f = await db.rpc('hopla_country_ranking', { p_limit: 1 })
      if (missing(f.error)) return { ready: false, problem: 'functions_missing' }
      if (f.error) return { ready: false, problem: `error_${f.error.code || 'unknown'}` }
      return { ready: true }
    },

    async createPlayer(p) {
      const { data, error } = await players().insert(p).select(COLUMNS).single()
      if (error?.code === UNIQUE_VIOLATION) return 'name_taken'
      check(error, 'createPlayer')
      return normalize(data as Record<string, unknown>)
    },

    async playerByToken(hash) {
      const { data, error } = await players().select(COLUMNS).eq('token_hash', hash).maybeSingle()
      check(error, 'playerByToken')
      return data ? normalize(data as Record<string, unknown>) : null
    },

    async playerByNameKey(key) {
      const { data, error } = await players().select(COLUMNS).eq('name_key', key).maybeSingle()
      check(error, 'playerByNameKey')
      return data ? normalize(data as Record<string, unknown>) : null
    },

    async updateProfile(id, patch) {
      const clean = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined))
      const { data, error } = await players().update(clean).eq('id', id).select(COLUMNS).single()
      if (error?.code === UNIQUE_VIOLATION) return 'name_taken'
      check(error, 'updateProfile')
      return normalize(data as Record<string, unknown>)
    },

    async countRecentByIp(ipHash, since) {
      const { count, error } = await players()
        .select('id', { head: true, count: 'exact' })
        .eq('created_ip_hash', ipHash)
        .gte('created_at', since)
      check(error, 'countRecentByIp')
      return count ?? 0
    },

    async submitBest(id, run) {
      const { data, error } = await players()
        .update({
          best_score: run.score,
          best_at: run.at,
          best_jumps: run.jumps,
          best_perfects: run.perfects,
          last_run_iat: run.iat,
        })
        .eq('id', id)
        .lt('best_score', run.score)
        .lt('last_run_iat', run.iat)
        .select('id')
      check(error, 'submitBest')
      return (data?.length ?? 0) > 0
    },

    async rank(score, bestAt, country) {
      const { data, error } = await db.rpc('hopla_rank', { p_score: score, p_best_at: bestAt, p_country: country })
      check(error, 'rank')
      return Number(data ?? 1)
    },

    async top(limit, country) {
      let q = players().select('name,country,best_score').eq('banned', false).gt('best_score', 0)
      if (country) q = q.eq('country', country)
      const { data, error } = await q
        .order('best_score', { ascending: false })
        .order('best_at', { ascending: true })
        .limit(limit)
      check(error, 'top')
      return (data ?? []).map((r) => ({
        name: r.name as string,
        country: r.country as string,
        score: r.best_score as number,
      }))
    },

    async countRanked(country) {
      let q = players().select('id', { head: true, count: 'exact' }).eq('banned', false).gt('best_score', 0)
      if (country) q = q.eq('country', country)
      const { count, error } = await q
      check(error, 'countRanked')
      return count ?? 0
    },

    async countryRanking(limit) {
      const { data, error } = await db.rpc('hopla_country_ranking', { p_limit: limit })
      check(error, 'countryRanking')
      return ((data ?? []) as { country: string; score: number | string; players: number | string }[]).map((r) => ({
        country: r.country,
        score: Number(r.score),
        players: Number(r.players),
      }))
    },

    async deleteStale(before) {
      const { count, error } = await players()
        .delete({ count: 'exact' })
        .eq('best_score', 0)
        .eq('banned', false)
        .lt('created_at', before)
      check(error, 'deleteStale')
      return count ?? 0
    },

    async setBanned(id, banned) {
      const { error } = await players().update({ banned }).eq('id', id)
      check(error, 'setBanned')
    },
    async retirePlayer(id, retiredKey, deadTokenHash) {
      const { error } = await players()
        .update({
          name: '-',
          name_key: retiredKey,
          country: 'ZZ',
          token_hash: deadTokenHash,
          best_score: 0,
          best_at: null,
          best_jumps: 0,
          best_perfects: 0,
          last_run_iat: 0,
          created_ip_hash: null,
          banned: true,
        })
        .eq('id', id)
      check(error, 'retirePlayer')
    },
    async deletePlayer(id) {
      const { error } = await players().delete().eq('id', id)
      check(error, 'deletePlayer')
    },
  }
}
