import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const sql = readFileSync(new URL('../supabase/hopla.sql', import.meta.url), 'utf8')
let db: PGlite

beforeAll(async () => {
  db = new PGlite()
  await db.exec('create role anon; create role authenticated; create role service_role;')
  // MESELE kurulumu üzerine uygulanır ve iki kez çalıştırmak zararsızdır.
  await db.exec(readFileSync(new URL('../supabase/kurulum.sql', import.meta.url), 'utf8'))
  await db.exec(sql)
  await db.exec(sql)
})

afterAll(async () => {
  await db.close()
})

let n = 0
async function player(name: string, country: string, best: number, bestAt: string | null, banned = false) {
  n++
  await db.query(
    `insert into hopla_players (name, name_key, country, token_hash, best_score, best_at, banned)
     values ($1, $2, $3, $4, $5, $6, $7)`,
    [name, name.toLowerCase(), country, String(n).padStart(64, '0'), best, bestAt, banned],
  )
}

describe('hopla.sql', () => {
  it('MESELE tablolarına dokunmaz, istemci rollerine yetki vermez, RLS açıktır', async () => {
    const tables = await db.query<{ n: number }>("select count(*)::int as n from pg_tables where schemaname='public'")
    expect(tables.rows[0]!.n).toBe(14)
    const grants = await db.query(
      `select grantee from information_schema.role_table_grants
       where table_name = 'hopla_players' and grantee in ('anon', 'authenticated')`,
    )
    expect(grants.rows).toEqual([])
    const rls = await db.query<{ relrowsecurity: boolean }>(
      "select relrowsecurity from pg_class where relname = 'hopla_players'",
    )
    expect(rls.rows[0]!.relrowsecurity).toBe(true)
  })

  it('isim anahtarı ve cihaz anahtarı benzersizdir', async () => {
    await player('Ali', 'TR', 0, null)
    await expect(player('ALI', 'DE', 0, null)).rejects.toThrow(/duplicate key/)
  })

  it('sıra ve ülkeler sıralaması', async () => {
    await player('A1', 'TR', 50, '2026-10-01T10:00:00Z')
    await player('A2', 'TR', 50, '2026-10-01T09:00:00Z') // aynı skora daha önce ulaştı
    await player('A3', 'TR', 10, '2026-10-01T09:00:00Z')
    await player('B1', 'DE', 70, '2026-10-01T09:00:00Z')
    await player('B2', 'DE', 5, '2026-10-01T09:00:00Z')
    await player('X1', 'DE', 999, '2026-10-01T09:00:00Z', true) // yasaklı: görünmez

    const rank = async (score: number, at: string, country: string | null) =>
      Number(
        (await db.query<{ r: string }>('select public.hopla_rank($1, $2, $3) as r', [score, at, country])).rows[0]!.r,
      )

    expect(await rank(70, '2026-10-01T09:00:00Z', null)).toBe(1)
    expect(await rank(50, '2026-10-01T09:00:00Z', null)).toBe(2)
    expect(await rank(50, '2026-10-01T10:00:00Z', null)).toBe(3)
    expect(await rank(50, '2026-10-01T10:00:00Z', 'TR')).toBe(2)
    expect(await rank(5, '2026-10-01T09:00:00Z', 'DE')).toBe(2)

    const c = await db.query<{ country: string; score: string; players: string }>(
      'select * from public.hopla_country_ranking(10)',
    )
    expect(c.rows.map((r) => [r.country, Number(r.score), Number(r.players)])).toEqual([
      ['TR', 110, 3],
      ['DE', 75, 2],
    ])
  })
})
