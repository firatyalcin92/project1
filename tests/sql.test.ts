import { PGlite } from '@electric-sql/pglite'
import { createHash, randomBytes } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const migrationsDir = join(import.meta.dirname, '../supabase/migrations')
const migrations = readdirSync(migrationsDir)
  .filter((f) => f.endsWith('.sql'))
  .sort()
  .map((f) => readFileSync(join(migrationsDir, f), 'utf8'))

let db: PGlite

async function one<T>(sql: string, params: unknown[] = []): Promise<T> {
  const r = await db.query<T>(sql, params)
  return r.rows[0] as T
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const uniqueCode = () => Array.from(randomBytes(6), (b) => CODE_ALPHABET[b % 32]).join('')
const uniqueHash = () => createHash('sha256').update(randomBytes(32)).digest('hex')

async function seedDispute() {
  const couple = await one<{ id: string }>(`insert into couples (code, name) values ($1, 'Biz') returning id`, [
    uniqueCode(),
  ])
  const a = await one<{ id: string }>(
    `insert into couple_members (couple_id, role, display_name, auth_token_hash) values ($1, 'A', 'Fırat', $2) returning id`,
    [couple.id, uniqueHash()],
  )
  const b = await one<{ id: string }>(
    `insert into couple_members (couple_id, role, display_name, auth_token_hash) values ($1, 'B', 'Ayşe', $2) returning id`,
    [couple.id, uniqueHash()],
  )
  const d = await one<{ id: string }>(
    `insert into disputes (couple_id, created_by, title) values ($1, $2, 'Cumartesi planı') returning id`,
    [couple.id, a.id],
  )
  return { coupleId: couple.id, a: a.id, b: b.id, disputeId: d.id }
}

beforeAll(async () => {
  db = new PGlite()
  // Supabase'in hazır getirdiği rolleri taklit et.
  await db.exec(`create role anon; create role authenticated; create role service_role;`)
  for (const m of migrations) await db.exec(m)
})

afterAll(async () => {
  await db.close()
})

describe('şema ve RLS', () => {
  it('istemci rollerine hiçbir tablo yetkisi vermez', async () => {
    const r = await db.query<{ grantee: string; table_name: string }>(
      `select grantee, table_name from information_schema.role_table_grants
        where table_schema = 'public' and grantee in ('anon', 'authenticated')`,
    )
    expect(r.rows).toEqual([])
  })

  it('tüm tablolarda RLS açıktır ve hiçbir politika yoktur', async () => {
    const tables = await db.query<{ relname: string; relrowsecurity: boolean }>(
      `select c.relname, c.relrowsecurity from pg_class c
         join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r'`,
    )
    expect(tables.rows.length).toBe(13)
    for (const t of tables.rows) expect(t.relrowsecurity, t.relname).toBe(true)
    const policies = await db.query(`select * from pg_policies where schemaname = 'public'`)
    expect(policies.rows).toEqual([])
  })

  it('anon rolü veri okuyamaz', async () => {
    await seedDispute()
    await db.exec('set role anon')
    await expect(db.query('select * from couples')).rejects.toThrow(/permission denied/)
    await expect(db.query('select public.mesele_sync_progress(gen_random_uuid())')).rejects.toThrow(/permission denied/)
    await db.exec('reset role')
  })

  it('çift kodu biçimini zorlar ve aynı rolde ikinci üyeyi reddeder', async () => {
    await expect(db.query(`insert into couples (code, name) values ('abc', 'x')`)).rejects.toThrow()
    const { coupleId } = await seedDispute()
    await expect(
      db.query(
        `insert into couple_members (couple_id, role, display_name, auth_token_hash) values ($1, 'B', 'Üçüncü', $2)`,
        [coupleId, uniqueHash()],
      ),
    ).rejects.toThrow(/duplicate key/)
  })
})

describe('mesele_sync_progress', () => {
  it('iki gönderimle both_answers_completed durumuna geçer', async () => {
    const { disputeId, a, b } = await seedDispute()
    const s0 = await one<{ s: string }>('select mesele_sync_progress($1) as s', [disputeId])
    expect(s0.s).toBe('draft')

    await db.query(`insert into dispute_entries (dispute_id, member_id, what_happened) values ($1, $2, 'x')`, [
      disputeId,
      a,
    ])
    expect((await one<{ s: string }>('select mesele_sync_progress($1) as s', [disputeId])).s).toBe(
      'answers_in_progress',
    )

    await db.query(`update dispute_entries set submitted_at = now() where dispute_id = $1 and member_id = $2`, [
      disputeId,
      a,
    ])
    expect((await one<{ s: string }>('select mesele_sync_progress($1) as s', [disputeId])).s).toBe(
      'answers_in_progress',
    )

    await db.query(
      `insert into dispute_entries (dispute_id, member_id, what_happened, submitted_at) values ($1, $2, 'y', now())`,
      [disputeId, b],
    )
    expect((await one<{ s: string }>('select mesele_sync_progress($1) as s', [disputeId])).s).toBe(
      'both_answers_completed',
    )
  })
})

describe('bireysel (solo) mod', () => {
  it('tek gönderimle doğrudan rapor aşamasına geçer', async () => {
    const couple = await one<{ id: string }>(
      `insert into couples (code, name, mode, partner_name) values ($1, 'Fırat', 'solo', 'Ayşe') returning id`,
      [uniqueCode()],
    )
    const m = await one<{ id: string }>(
      `insert into couple_members (couple_id, role, display_name, auth_token_hash) values ($1, 'A', 'Fırat', $2) returning id`,
      [couple.id, uniqueHash()],
    )
    const d = await one<{ id: string }>(
      `insert into disputes (couple_id, created_by, title) values ($1, $2, 'x') returning id`,
      [couple.id, m.id],
    )
    await db.query(
      `insert into dispute_entries (dispute_id, member_id, what_happened, submitted_at) values ($1, $2, 'y', now())`,
      [d.id, m.id],
    )
    expect((await one<{ s: string }>('select mesele_sync_progress($1) as s', [d.id])).s).toBe(
      'reconsideration_completed',
    )
  })

  it('mod alanı yalnızca couple / solo kabul eder', async () => {
    await expect(
      db.query(`insert into couples (code, name, mode) values ($1, 'x', 'grup')`, [uniqueCode()]),
    ).rejects.toThrow()
  })
})

describe('mesele_claim_status (eşzamanlılık kilidi)', () => {
  it('aynı geçişi yalnızca bir kez verir', async () => {
    const { disputeId } = await seedDispute()
    await db.query(`update disputes set status = 'both_answers_completed' where id = $1`, [disputeId])
    const first = await one<{ l: string | null }>(
      `select mesele_claim_status($1, 'both_answers_completed', 'generating_perspectives') as l`,
      [disputeId],
    )
    const second = await one<{ l: string | null }>(
      `select mesele_claim_status($1, 'both_answers_completed', 'generating_perspectives') as l`,
      [disputeId],
    )
    expect(first.l).not.toBeNull()
    expect(second.l).toBeNull()
  })

  it('4 dakikadan eski kilidi bayat sayar ve yeniden verir', async () => {
    const { disputeId } = await seedDispute()
    await db.query(
      `update disputes set status = 'generating_perspectives', status_locked_at = now() - interval '5 minutes' where id = $1`,
      [disputeId],
    )
    const reclaimed = await one<{ l: string | null }>(
      `select mesele_claim_status($1, 'both_answers_completed', 'generating_perspectives') as l`,
      [disputeId],
    )
    expect(reclaimed.l).not.toBeNull()

    await db.query(`update disputes set status_locked_at = now() - interval '3 minutes' where id = $1`, [disputeId])
    const fresh = await one<{ l: string | null }>(
      `select mesele_claim_status($1, 'both_answers_completed', 'generating_perspectives') as l`,
      [disputeId],
    )
    expect(fresh.l).toBeNull()
  })

  it('perspektifleri yalnızca kilit sahibi yazabilir; bayat yazıcı reddedilir', async () => {
    const { disputeId, a, b } = await seedDispute()
    for (const m of [a, b]) {
      await db.query(
        `insert into dispute_entries (dispute_id, member_id, what_happened, submitted_at) values ($1, $2, 'x', now())`,
        [disputeId, m],
      )
    }
    await db.query(`update disputes set status = 'both_answers_completed' where id = $1`, [disputeId])
    const lock = (
      await one<{ l: string }>(
        `select mesele_claim_status($1, 'both_answers_completed', 'generating_perspectives') as l`,
        [disputeId],
      )
    ).l

    const stale = await one<{ ok: boolean }>(
      `select mesele_finish_perspectives($1, now() - interval '1 hour', $2::jsonb) as ok`,
      [disputeId, JSON.stringify({ [a]: { headline: 'eski' } })],
    )
    expect(stale.ok).toBe(false)

    const ok = await one<{ ok: boolean }>(`select mesele_finish_perspectives($1, $2, $3::jsonb) as ok`, [
      disputeId,
      lock,
      JSON.stringify({ [a]: { headline: 'A' }, [b]: { headline: 'B' } }),
    ])
    expect(ok.ok).toBe(true)
    const d = await one<{ status: string; status_locked_at: string | null }>(
      'select status, status_locked_at from disputes where id = $1',
      [disputeId],
    )
    expect(d.status).toBe('perspectives_ready')
    expect(d.status_locked_at).toBeNull()
    const persp = await db.query<{ member_id: string; perspective: { headline: string } }>(
      'select member_id, perspective from dispute_entries where dispute_id = $1',
      [disputeId],
    )
    const byMember = Object.fromEntries(persp.rows.map((r) => [r.member_id, r.perspective.headline]))
    expect(byMember).toEqual({ [a]: 'A', [b]: 'B' })
  })

  it('başarısızlıkta kilidi bırakıp durumu geri alır', async () => {
    const { disputeId } = await seedDispute()
    await db.query(`update disputes set status = 'reconsideration_completed' where id = $1`, [disputeId])
    const lock = (
      await one<{ l: string }>(
        `select mesele_claim_status($1, 'reconsideration_completed', 'generating_reports') as l`,
        [disputeId],
      )
    ).l
    const released = await one<{ ok: boolean }>(
      `select mesele_release_status($1, $2, 'reconsideration_completed') as ok`,
      [disputeId, lock],
    )
    expect(released.ok).toBe(true)
    const d = await one<{ status: string }>('select status from disputes where id = $1', [disputeId])
    expect(d.status).toBe('reconsideration_completed')
  })

  it('raporları ve completed durumunu atomik yazar, onayları sıfırlar', async () => {
    const { disputeId, a, b } = await seedDispute()
    await db.query(`update disputes set status = 'reconsideration_completed', shared_approved_a = true where id = $1`, [
      disputeId,
    ])
    const lock = (
      await one<{ l: string }>(
        `select mesele_claim_status($1, 'reconsideration_completed', 'generating_reports') as l`,
        [disputeId],
      )
    ).l
    const ok = await one<{ ok: boolean }>(`select mesele_finish_reports($1, $2, $3::jsonb, $4::jsonb) as ok`, [
      disputeId,
      lock,
      JSON.stringify({ opening: 'ortak' }),
      JSON.stringify({ [a]: { greeting: 'A' }, [b]: { greeting: 'B' } }),
    ])
    expect(ok.ok).toBe(true)
    const d = await one<{ status: string; completed_at: string | null; shared_approved_a: boolean }>(
      'select status, completed_at, shared_approved_a from disputes where id = $1',
      [disputeId],
    )
    expect(d.status).toBe('completed')
    expect(d.completed_at).not.toBeNull()
    expect(d.shared_approved_a).toBe(false)
    const reports = await db.query('select * from reports where dispute_id = $1', [disputeId])
    expect(reports.rows.length).toBe(2)
  })
})

describe('Genel Görüş kilidi', () => {
  it('aynı sayım için yalnızca bir üretim talebi verir, başarısız olanı yeniden açar', async () => {
    const { coupleId } = await seedDispute()
    const first = await db.query<{ id: string; status_locked_at: string }>(
      'select * from mesele_claim_relationship_report($1, 10)',
      [coupleId],
    )
    const second = await db.query('select * from mesele_claim_relationship_report($1, 10)', [coupleId])
    expect(first.rows.length).toBe(1)
    expect(second.rows.length).toBe(0)

    const row = first.rows[0]!
    const failed = await one<{ ok: boolean }>('select mesele_fail_relationship_report($1, $2) as ok', [
      row.id,
      row.status_locked_at,
    ])
    expect(failed.ok).toBe(true)
    const retry = await db.query<{ id: string; status_locked_at: string }>(
      'select * from mesele_claim_relationship_report($1, 10)',
      [coupleId],
    )
    expect(retry.rows.length).toBe(1)
    const done = await one<{ ok: boolean }>(
      `select mesele_finish_relationship_report($1, $2, '{"title":"x"}'::jsonb) as ok`,
      [retry.rows[0]!.id, retry.rows[0]!.status_locked_at],
    )
    expect(done.ok).toBe(true)
    const final = await one<{ status: string; unlocked_at: string | null }>(
      'select status, unlocked_at from relationship_reports where id = $1',
      [retry.rows[0]!.id],
    )
    expect(final.status).toBe('ready')
    expect(final.unlocked_at).not.toBeNull()
  })
})
