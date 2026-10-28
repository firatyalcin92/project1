import '@tanstack/react-start/server-only'
import { randomUUID } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { ahead, type HoplaStore, type PlayerRow } from './store.server'

/**
 * Tek dosyalık SQLite deposu (cPanel gibi Supabase'siz kurulumlar). MESELE veritabanından
 * ayrı bir dosyadır (hopla.db); şema ilk açılışta kendiliğinden kurulur.
 */

const SCHEMA = `
create table if not exists hopla_players (
  id text primary key,
  name text not null,
  name_key text not null unique,
  country text not null,
  token_hash text not null unique,
  best_score integer not null default 0,
  best_at text,
  best_jumps integer not null default 0,
  best_perfects integer not null default 0,
  last_run_iat integer not null default 0,
  created_ip_hash text,
  rename_count integer not null default 0,
  rename_window text,
  banned integer not null default 0,
  created_at text not null
);
create index if not exists hopla_players_board_idx on hopla_players (best_score desc, best_at asc);
create index if not exists hopla_players_country_idx on hopla_players (country, best_score desc, best_at asc);
create index if not exists hopla_players_ip_idx on hopla_players (created_ip_hash, created_at);
`

type Row = Record<string, unknown>

function toPlayer(r: Row): PlayerRow {
  return { ...(r as unknown as PlayerRow), banned: !!r.banned, last_run_iat: Number(r.last_run_iat) }
}

export function createSqliteHoplaStore(path: string): HoplaStore {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })
  const db = new DatabaseSync(path)
  db.exec('pragma journal_mode = wal; pragma busy_timeout = 5000;')
  db.exec(SCHEMA)

  const one = (sql: string, ...p: unknown[]) => (db.prepare(sql).get(...(p as never[])) as Row | undefined) ?? null
  const all = (sql: string, ...p: unknown[]) => db.prepare(sql).all(...(p as never[])) as Row[]
  const run = (sql: string, ...p: unknown[]) => db.prepare(sql).run(...(p as never[]))
  const isUnique = (e: unknown) => e instanceof Error && /UNIQUE constraint failed/.test(e.message)
  const RANKED = 'banned = 0 and best_score > 0'

  return {
    kind: 'sqlite',

    async check() {
      return { ready: true }
    },

    async createPlayer(p) {
      const id = randomUUID()
      try {
        run(
          `insert into hopla_players (id, name, name_key, country, token_hash, created_ip_hash, created_at)
           values (?, ?, ?, ?, ?, ?, ?)`,
          id,
          p.name,
          p.name_key,
          p.country,
          p.token_hash,
          p.created_ip_hash,
          new Date().toISOString(),
        )
      } catch (e) {
        if (isUnique(e) && String(e).includes('name_key')) return 'name_taken'
        throw e
      }
      return toPlayer(one('select * from hopla_players where id = ?', id)!)
    },

    async playerByToken(hash) {
      const r = one('select * from hopla_players where token_hash = ?', hash)
      return r ? toPlayer(r) : null
    },

    async playerByNameKey(key) {
      const r = one('select * from hopla_players where name_key = ?', key)
      return r ? toPlayer(r) : null
    },

    async updateProfile(id, patch) {
      const fields = Object.entries(patch).filter(([, v]) => v !== undefined)
      try {
        run(
          `update hopla_players set ${fields.map(([k]) => `${k} = ?`).join(', ')} where id = ?`,
          ...fields.map(([, v]) => v),
          id,
        )
      } catch (e) {
        if (isUnique(e)) return 'name_taken'
        throw e
      }
      return toPlayer(one('select * from hopla_players where id = ?', id)!)
    },

    async countRecentByIp(ipHash, since) {
      const r = one(
        'select count(*) as n from hopla_players where created_ip_hash = ? and created_at >= ?',
        ipHash,
        since,
      )
      return Number(r?.n ?? 0)
    },

    async submitBest(id, run_) {
      const r = run(
        `update hopla_players set best_score = ?, best_at = ?, best_jumps = ?, best_perfects = ?, last_run_iat = ?
         where id = ? and best_score < ? and last_run_iat < ?`,
        run_.score,
        run_.at,
        run_.jumps,
        run_.perfects,
        run_.iat,
        id,
        run_.score,
        run_.iat,
      )
      return Number(r.changes) > 0
    },

    async rank(score, bestAt, country) {
      const r = one(
        `select count(*) as n from hopla_players where ${RANKED} and (? is null or country = ?)
           and (best_score > ? or (best_score = ? and best_at < ?))`,
        country,
        country,
        score,
        score,
        bestAt,
      )
      return Number(r?.n ?? 0) + 1
    },

    async top(limit, country) {
      return all(
        `select name, country, best_score from hopla_players where ${RANKED} and (? is null or country = ?)
         order by best_score desc, best_at asc limit ?`,
        country,
        country,
        limit,
      ).map((r) => ({ name: String(r.name), country: String(r.country), score: Number(r.best_score) }))
    },

    async countRanked(country) {
      const r = one(
        `select count(*) as n from hopla_players where ${RANKED} and (? is null or country = ?)`,
        country,
        country,
      )
      return Number(r?.n ?? 0)
    },

    async countryRanking(limit) {
      const rows = all(`select country, best_score, best_at from hopla_players where ${RANKED}`) as unknown as Pick<
        PlayerRow,
        'country' | 'best_score' | 'best_at'
      >[]
      const groups = new Map<string, typeof rows>()
      for (const r of rows) groups.set(r.country, [...(groups.get(r.country) ?? []), r])
      return [...groups.entries()]
        .map(([country, list]) => {
          list.sort((a, b) => (ahead(a, b.best_score, b.best_at ?? '') ? -1 : 1))
          return {
            country,
            score: list.slice(0, 10).reduce((s, p) => s + Number(p.best_score), 0),
            players: list.length,
          }
        })
        .sort((a, b) => b.score - a.score || b.players - a.players || a.country.localeCompare(b.country))
        .slice(0, limit)
    },

    async deleteStale(before) {
      return Number(run('delete from hopla_players where best_score = 0 and created_at < ?', before).changes)
    },

    async setBanned(id, banned) {
      run('update hopla_players set banned = ? where id = ?', banned ? 1 : 0, id)
    },
  }
}
