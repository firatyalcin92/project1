import '@tanstack/react-start/server-only'
import { randomUUID } from 'node:crypto'
import { ahead, type HoplaStore, type PlayerRow } from './store.server'

/** Geliştirme ve testler için bellek içi depo (sunucu yeniden başlayınca silinir). */
export function createMemoryHoplaStore(): HoplaStore {
  const players = new Map<string, PlayerRow>()
  const byToken = new Map<string, string>()
  const byKey = new Map<string, string>()

  const ranked = (country: string | null) =>
    [...players.values()].filter((p) => !p.banned && p.best_score > 0 && (!country || p.country === country))

  const sorted = (rows: PlayerRow[]) =>
    rows.sort((a, b) => b.best_score - a.best_score || (a.best_at ?? '').localeCompare(b.best_at ?? ''))

  return {
    kind: 'memory',

    async check() {
      return { ready: true }
    },

    async createPlayer(p) {
      if (byKey.has(p.name_key)) return 'name_taken'
      const row: PlayerRow = {
        id: randomUUID(),
        ...p,
        best_score: 0,
        best_at: null,
        best_jumps: 0,
        best_perfects: 0,
        last_run_iat: 0,
        rename_count: 0,
        rename_window: null,
        banned: false,
        created_at: new Date().toISOString(),
      }
      players.set(row.id, row)
      byToken.set(row.token_hash, row.id)
      byKey.set(row.name_key, row.id)
      return { ...row }
    },

    async playerByToken(hash) {
      const id = byToken.get(hash)
      const row = id ? players.get(id) : undefined
      return row ? { ...row } : null
    },

    async playerByNameKey(key) {
      const id = byKey.get(key)
      const row = id ? players.get(id) : undefined
      return row ? { ...row } : null
    },

    async updateProfile(id, patch) {
      const row = players.get(id)
      if (!row) throw new Error('player not found')
      if (patch.name_key && patch.name_key !== row.name_key) {
        const owner = byKey.get(patch.name_key)
        if (owner && owner !== id) return 'name_taken'
        byKey.delete(row.name_key)
        byKey.set(patch.name_key, id)
      }
      Object.assign(row, Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)))
      return { ...row }
    },

    async countRecentByIp(ipHash, since) {
      let n = 0
      for (const p of players.values()) if (p.created_ip_hash === ipHash && p.created_at >= since) n++
      return n
    },

    async submitBest(id, run) {
      const row = players.get(id)
      if (!row || row.best_score >= run.score || row.last_run_iat >= run.iat) return false
      row.best_score = run.score
      row.best_at = run.at
      row.best_jumps = run.jumps
      row.best_perfects = run.perfects
      row.last_run_iat = run.iat
      return true
    },

    async rank(score, bestAt, country) {
      return ranked(country).filter((p) => ahead(p, score, bestAt)).length + 1
    },

    async top(limit, country) {
      return sorted(ranked(country))
        .slice(0, limit)
        .map((p) => ({ name: p.name, country: p.country, score: p.best_score }))
    },

    async countRanked(country) {
      return ranked(country).length
    },

    async countryRanking(limit) {
      const groups = new Map<string, PlayerRow[]>()
      for (const p of ranked(null)) groups.set(p.country, [...(groups.get(p.country) ?? []), p])
      return [...groups.entries()]
        .map(([country, rows]) => ({
          country,
          score: sorted(rows)
            .slice(0, 10)
            .reduce((s, p) => s + p.best_score, 0),
          players: rows.length,
        }))
        .sort((a, b) => b.score - a.score || b.players - a.players || a.country.localeCompare(b.country))
        .slice(0, limit)
    },

    async deleteStale(before) {
      let n = 0
      for (const p of [...players.values()]) {
        if (p.best_score === 0 && p.created_at < before) {
          players.delete(p.id)
          byToken.delete(p.token_hash)
          byKey.delete(p.name_key)
          n++
        }
      }
      return n
    },

    async setBanned(id, banned) {
      const row = players.get(id)
      if (row) row.banned = banned
    },
  }
}
