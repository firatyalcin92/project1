import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
it('kurulum.sql tek seferde çalışır', async () => {
  const db = new PGlite()
  await db.exec('create role anon; create role authenticated; create role service_role;')
  await db.exec(readFileSync(new URL('../supabase/kurulum.sql', import.meta.url), 'utf8'))
  const r = await db.query("select count(*)::int as n from pg_tables where schemaname='public'")
  expect((r.rows[0] as { n: number }).n).toBe(13)
})

it('guncelleme-hesap.sql eski kuruluma (üyelik tabloları olsa da olmasa da) iki kez uygulanabilir', async () => {
  const db = new PGlite()
  await db.exec('create role anon; create role authenticated; create role service_role;')
  for (const f of ['20261013000000_mesele_init.sql', '20261014000000_mesele_solo_mode.sql'])
    await db.exec(readFileSync(new URL(`../supabase/migrations/${f}`, import.meta.url), 'utf8'))
  await db.exec(`insert into couples (code, name) values ('ABCDEF', 'Biz')`)
  const update = readFileSync(new URL('../supabase/guncelleme-hesap.sql', import.meta.url), 'utf8')
  await db.exec(update)
  await db.exec(update)
  const r = await db.query("select count(*)::int as n from pg_tables where schemaname='public'")
  expect((r.rows[0] as { n: number }).n).toBe(10)
  const cols = await db.query(
    "select column_name from information_schema.columns where table_name='couple_members' and column_name in ('auth_user_id','email')",
  )
  expect(cols.rows).toHaveLength(2)
  const c = await db.query('select count(*)::int as n from couples')
  expect((c.rows[0] as { n: number }).n).toBe(1)
  const grants = await db.query(
    `select count(*)::int as n from information_schema.role_table_grants
     where table_name in ('subscriptions','deletion_requests') and grantee in ('anon','authenticated')`,
  )
  expect((grants.rows[0] as { n: number }).n).toBe(0)
})

it('çift silinince üyelik satırı kalır ve sahipsiz olur', async () => {
  const db = new PGlite()
  await db.exec('create role anon; create role authenticated; create role service_role;')
  await db.exec(readFileSync(new URL('../supabase/kurulum.sql', import.meta.url), 'utf8'))
  const couple = (
    await db.query<{ id: string }>(`insert into couples (code, name) values ('ABCDEF', 'Biz') returning id`)
  ).rows[0]!
  const m = (
    await db.query<{ id: string }>(
      `insert into couple_members (couple_id, role, display_name, auth_token_hash) values ($1, 'A', 'Fırat', $2) returning id`,
      [couple.id, 'a'.repeat(64)],
    )
  ).rows[0]!
  await db.query(
    `insert into subscriptions (couple_id, member_id, period, provider, expires_at) values ($1, $2, 'monthly', 'test', now() + interval '30 days')`,
    [couple.id, m.id],
  )
  await db.query(`insert into deletion_requests (couple_id, requested_by) values ($1, $2)`, [couple.id, m.id])
  await db.query('delete from couples where id = $1', [couple.id])
  const s = await db.query<{ couple_id: string | null; member_id: string | null }>(
    'select couple_id, member_id from subscriptions',
  )
  expect(s.rows).toEqual([{ couple_id: null, member_id: null }])
  const d = await db.query('select count(*)::int as n from deletion_requests')
  expect((d.rows[0] as { n: number }).n).toBe(0)
})

it('guncelleme-test-surumu.sql iki kez uygulanabilir ve kod hakkı eksiye düşmez', async () => {
  const db = new PGlite()
  await db.exec('create role anon; create role authenticated; create role service_role;')
  await db.exec(readFileSync(new URL('../supabase/kurulum.sql', import.meta.url), 'utf8'))
  const update = readFileSync(new URL('../supabase/guncelleme-test-surumu.sql', import.meta.url), 'utf8')
  await db.exec(update)
  await db.exec(update)
  const couple = (
    await db.query<{ id: string }>(`insert into couples (code, name) values ('ABCDEF', 'Biz') returning id`)
  ).rows[0]!
  await db.query(`insert into access_codes (code_hash, uses_total, uses_left, couple_id) values ($1, 2, 2, $2)`, [
    'b'.repeat(64),
    couple.id,
  ])
  const use = async () =>
    (await db.query<{ n: number | null }>('select public.mesele_consume_code($1) as n', [couple.id])).rows[0]!.n
  expect(await use()).toBe(1)
  expect(await use()).toBe(0)
  expect(await use()).toBeNull()
  const grants = await db.query(
    `select count(*)::int as n from information_schema.role_table_grants
     where table_name in ('beta_claims','access_codes','waitlist') and grantee in ('anon','authenticated')`,
  )
  expect((grants.rows[0] as { n: number }).n).toBe(0)
})
