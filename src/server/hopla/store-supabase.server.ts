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

/** hopla-2.sql ile eklenen sütunlar (kurulmamışsa bu özellikler kapalı kalır) */
const EXTRA_COLUMNS = ',plays,push_token,push_lang,notify_day,notify_unseen'
const TARGET = 'id,name,best_score,push_token,push_lang,notify_day,notify_unseen'

function missingColumn(error: PostgrestError | null) {
  return (
    error?.code === '42703' ||
    error?.code === 'PGRST204' ||
    /column .* does not exist|could not find the .* column/i.test(error?.message ?? '')
  )
}

/** bigint sütunu PostgREST'ten metin olarak da gelebilir */
function normalize(row: Record<string, unknown>): PlayerRow {
  return {
    ...(row as unknown as PlayerRow),
    last_run_iat: Number(row.last_run_iat ?? 0),
    plays: Number(row.plays ?? 0),
    push_token: (row.push_token as string | null) ?? null,
    push_lang: (row.push_lang as string | null) ?? null,
    notify_day: (row.notify_day as string | null) ?? null,
    notify_unseen: Number(row.notify_unseen ?? 0),
  }
}

const toTarget = (r: Record<string, unknown>) => ({
  id: String(r.id),
  name: String(r.name),
  score: Number(r.best_score ?? 0),
  push_token: String(r.push_token),
  push_lang: (r.push_lang as string | null) ?? null,
  notify_day: (r.notify_day as string | null) ?? null,
  notify_unseen: Number(r.notify_unseen ?? 0),
})

export function createSupabaseHoplaStore(url: string, serviceKey: string): HoplaStore {
  const db = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { 'x-application-name': 'hopla' } },
  })
  const players = () => db.from('hopla_players')

  // hopla-2.sql çalıştırıldı mı? Evetse kalıcı olarak, hayırsa 5 dakikada bir yeniden bakılır.
  let extrasOk: boolean | null = null
  let extrasAt = 0
  async function extras() {
    if (extrasOk || (extrasOk === false && Date.now() - extrasAt < 5 * 60_000)) return extrasOk
    const { error } = await players().select('plays').limit(1)
    extrasAt = Date.now()
    extrasOk = !error
    if (error && !missingColumn(error)) console.error(`[hopla] supabase extras: [${error.code}] ${error.message}`)
    return extrasOk
  }
  const cols = async (): Promise<string> => COLUMNS + ((await extras()) ? EXTRA_COLUMNS : '')

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
      const { data, error } = await players()
        .insert(p)
        .select(await cols())
        .single()
      if (error?.code === UNIQUE_VIOLATION) return 'name_taken'
      check(error, 'createPlayer')
      return normalize(data as unknown as Record<string, unknown>)
    },

    async playerByToken(hash) {
      const { data, error } = await players()
        .select(await cols())
        .eq('token_hash', hash)
        .maybeSingle()
      check(error, 'playerByToken')
      return data ? normalize(data as unknown as Record<string, unknown>) : null
    },

    async playerByNameKey(key) {
      const { data, error } = await players()
        .select(await cols())
        .eq('name_key', key)
        .maybeSingle()
      check(error, 'playerByNameKey')
      return data ? normalize(data as unknown as Record<string, unknown>) : null
    },

    async updateProfile(id, patch) {
      const clean = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined))
      const { data, error } = await players()
        .update(clean)
        .eq('id', id)
        .select(await cols())
        .single()
      if (error?.code === UNIQUE_VIOLATION) return 'name_taken'
      check(error, 'updateProfile')
      return normalize(data as unknown as Record<string, unknown>)
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
      const withPlays = await extras()
      let q = players()
        .select((withPlays ? 'name,country,best_score,plays' : 'name,country,best_score') as string)
        .eq('banned', false)
        .gt('best_score', 0)
      if (country) q = q.eq('country', country)
      const { data, error } = await q
        .order('best_score', { ascending: false })
        .order('best_at', { ascending: true })
        .limit(limit)
      check(error, 'top')
      return ((data ?? []) as unknown as Record<string, unknown>[]).map((r) => ({
        name: r.name as string,
        country: r.country as string,
        score: r.best_score as number,
        plays: Number(r.plays ?? 0),
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
          ...((await extras()) ? { plays: 0, push_token: null, push_lang: null } : {}),
        })
        .eq('id', id)
      check(error, 'retirePlayer')
    },
    async recordRun(id, run, count) {
      if (!(await extras())) return this.submitBest(id, run)
      const { data, error } = await db.rpc('hopla_record_run', {
        p_id: id,
        p_score: run.score,
        p_jumps: run.jumps,
        p_perfects: run.perfects,
        p_iat: run.iat,
        p_at: run.at,
        p_count: count,
      })
      check(error, 'recordRun')
      return data === null ? null : Boolean(data)
    },

    extras,

    async setPush(id, token, lang) {
      if (!(await extras())) return
      if (token) await players().update({ push_token: null }).eq('push_token', token).neq('id', id)
      const { error } = await players().update({ push_token: token, push_lang: lang }).eq('id', id)
      check(error, 'setPush')
    },

    async clearPushToken(token) {
      if (!(await extras())) return
      const { error } = await players().update({ push_token: null }).eq('push_token', token)
      check(error, 'clearPushToken')
    },

    async markSeen(id) {
      if (!(await extras())) return
      const { error } = await players().update({ notify_unseen: 0 }).eq('id', id).gt('notify_unseen', 0)
      check(error, 'markSeen')
    },

    async markNotified(id, day, unseen) {
      if (!(await extras())) return
      const { error } = await players().update({ notify_day: day, notify_unseen: unseen }).eq('id', id)
      check(error, 'markNotified')
    },

    async leader(country) {
      if (!(await extras())) return null
      let q = players().select(TARGET).eq('banned', false).gt('best_score', 0)
      if (country) q = q.eq('country', country)
      const { data, error } = await q
        .order('best_score', { ascending: false })
        .order('best_at', { ascending: true })
        .limit(1)
      check(error, 'leader')
      const r = data?.[0] as Record<string, unknown> | undefined
      return r?.push_token ? toTarget(r) : null
    },

    async passedBy(country, newScore, oldBest, selfId) {
      if (!(await extras())) return null
      const { data, error } = await players()
        .select(TARGET)
        .eq('banned', false)
        .eq('country', country)
        .neq('id', selfId)
        .lt('best_score', newScore)
        .gte('best_score', Math.max(1, oldBest))
        .order('best_score', { ascending: false })
        .order('best_at', { ascending: true })
        .limit(1)
      check(error, 'passedBy')
      const r = data?.[0] as Record<string, unknown> | undefined
      return r?.push_token ? toTarget(r) : null
    },

    async weeklyLeaders(since) {
      if (!(await extras())) return []
      const { data, error } = await players()
        .select('id,country,name,best_score,plays')
        .eq('banned', false)
        .gt('best_score', 0)
        .gte('best_at', since)
        .order('best_score', { ascending: false })
        .order('best_at', { ascending: true })
        .limit(5000)
      check(error, 'weeklyLeaders')
      const seen = new Set<string>()
      const out = []
      for (const r of (data ?? []) as Record<string, unknown>[]) {
        const c = String(r.country)
        if (seen.has(c)) continue
        seen.add(c)
        out.push({
          id: String(r.id),
          country: c,
          name: String(r.name),
          score: Number(r.best_score),
          plays: Number(r.plays ?? 0),
        })
      }
      return out
    },

    async pushTargets(country) {
      if (!(await extras())) return []
      const { data, error } = await players()
        .select(TARGET)
        .eq('country', country)
        .eq('banned', false)
        .not('push_token', 'is', null)
        .limit(10000)
      check(error, 'pushTargets')
      return ((data ?? []) as Record<string, unknown>[]).map(toTarget)
    },

    async deletePlayer(id) {
      const { error } = await players().delete().eq('id', id)
      check(error, 'deletePlayer')
    },
  }
}
