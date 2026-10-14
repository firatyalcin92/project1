import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
it('kurulum.sql tek seferde çalışır', async () => {
  const db = new PGlite()
  await db.exec('create role anon; create role authenticated; create role service_role;')
  await db.exec(readFileSync(new URL('../supabase/kurulum.sql', import.meta.url), 'utf8'))
  const r = await db.query("select count(*)::int as n from pg_tables where schemaname='public'")
  expect((r.rows[0] as { n: number }).n).toBe(8)
})
