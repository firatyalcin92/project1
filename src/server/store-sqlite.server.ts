import '@tanstack/react-start/server-only'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { GENERATION_LOCK_MS } from '~/lib/status'
import type {
  AccessCodeRow,
  AnswerRow,
  CoupleRow,
  DeletionRequestRow,
  DisputeRow,
  EntryRow,
  MemberRow,
  ReconsiderationRow,
  RelationshipReportRow,
  ReportRow,
  Store,
  SubscriptionRow,
} from './store.server'

/**
 * Tek dosyalık SQLite veritabanı (Node'un yerleşik node:sqlite modülü). Ayrı bir veritabanı
 * sunucusu gerekmez; cPanel gibi paylaşımlı barındırmada dosya ev dizininde durur.
 *
 * Anlam, bellek içi depo ve Supabase'deki SQL fonksiyonlarıyla aynıdır. Birden fazla süreç
 * aynı dosyayı kullanabilir: okuma-değiştirme-yazma işlemleri BEGIN IMMEDIATE ile kilitlenir.
 */

const SCHEMA = `
create table if not exists couples (
  id text primary key,
  code text not null unique,
  name text not null,
  mode text not null default 'couple',
  partner_name text,
  created_at text not null
);
create table if not exists couple_members (
  id text primary key,
  couple_id text not null references couples(id) on delete cascade,
  role text not null,
  display_name text not null,
  auth_token_hash text not null unique,
  auth_user_id text unique,
  email text,
  joined_at text not null,
  unique (couple_id, role)
);
create table if not exists disputes (
  id text primary key,
  couple_id text not null references couples(id) on delete cascade,
  created_by text,
  title text not null,
  status text not null,
  shared_report text,
  shared_approved_a integer not null default 0,
  shared_approved_b integer not null default 0,
  created_at text not null,
  updated_at text not null,
  completed_at text,
  status_locked_at text
);
create index if not exists disputes_couple_idx on disputes (couple_id, created_at);
create table if not exists dispute_entries (
  id text primary key,
  dispute_id text not null references disputes(id) on delete cascade,
  member_id text not null,
  what_happened text not null default '',
  event_visibility text not null default 'partner',
  perspective text,
  submitted_at text,
  created_at text not null,
  updated_at text not null,
  unique (dispute_id, member_id)
);
create table if not exists answers (
  id text primary key,
  dispute_id text not null references disputes(id) on delete cascade,
  member_id text not null,
  question_id text not null,
  text_answer text not null default '',
  selected_tags text not null default '[]',
  visibility text not null default 'partner',
  updated_at text not null,
  unique (dispute_id, member_id, question_id)
);
create table if not exists reconsiderations (
  id text primary key,
  dispute_id text not null references disputes(id) on delete cascade,
  member_id text not null,
  reflections text not null,
  submitted_at text,
  updated_at text not null,
  unique (dispute_id, member_id)
);
create table if not exists reports (
  id text primary key,
  dispute_id text not null references disputes(id) on delete cascade,
  member_id text not null,
  my_report text not null,
  created_at text not null,
  unique (dispute_id, member_id)
);
create table if not exists relationship_reports (
  id text primary key,
  couple_id text not null references couples(id) on delete cascade,
  overall_analysis text,
  dispute_count integer not null,
  status text not null,
  status_locked_at text,
  unlocked_at text,
  created_at text not null,
  unique (couple_id, dispute_count)
);
create table if not exists subscriptions (
  id text primary key,
  couple_id text references couples(id) on delete set null,
  member_id text references couple_members(id) on delete set null,
  period text not null,
  provider text not null,
  provider_ref text,
  owner_user_id text,
  started_at text not null,
  expires_at text not null,
  created_at text not null
);
create table if not exists deletion_requests (
  id text primary key,
  couple_id text not null unique references couples(id) on delete cascade,
  requested_by text not null references couple_members(id) on delete cascade,
  created_at text not null
);
create table if not exists beta_claims (
  id integer primary key autoincrement,
  kind text not null,
  key_hash text,
  couple_id text,
  created_at text not null
);
create index if not exists beta_claims_lookup_idx on beta_claims (kind, key_hash, created_at);
create table if not exists access_codes (
  id text primary key,
  code_hash text not null unique,
  label text not null default '',
  uses_total integer not null,
  uses_left integer not null,
  couple_id text references couples(id) on delete set null,
  redeemed_at text,
  created_at text not null
);
create table if not exists waitlist (
  email text primary key,
  created_at text not null
);
create table if not exists email_codes (
  email text primary key,
  code_hash text not null,
  expires_at text not null,
  attempts integer not null default 0
);
`

const now = () => new Date().toISOString()
const uuid = () => crypto.randomUUID()

let lastLockMs = 0
function lockStamp() {
  const ms = Math.max(Date.now(), lastLockMs + 1)
  lastLockMs = ms
  return new Date(ms).toISOString()
}
const staleBefore = () => new Date(Date.now() - GENERATION_LOCK_MS).toISOString()

type Row = Record<string, unknown>
const json = (v: unknown) => (v === null || v === undefined ? null : JSON.stringify(v))
const parse = (v: unknown) => (typeof v === 'string' ? JSON.parse(v) : null)

const dispute = (r: Row): DisputeRow => ({
  ...(r as unknown as DisputeRow),
  shared_report: parse(r.shared_report),
  shared_approved_a: Boolean(r.shared_approved_a),
  shared_approved_b: Boolean(r.shared_approved_b),
})
const entry = (r: Row): EntryRow => ({ ...(r as unknown as EntryRow), perspective: parse(r.perspective) })
const answer = (r: Row): AnswerRow => ({ ...(r as unknown as AnswerRow), selected_tags: parse(r.selected_tags) ?? [] })
const reconsideration = (r: Row): ReconsiderationRow => ({
  ...(r as unknown as ReconsiderationRow),
  reflections: parse(r.reflections),
})
const report = (r: Row): ReportRow => ({ ...(r as unknown as ReportRow), my_report: parse(r.my_report) })
const relationship = (r: Row): RelationshipReportRow => ({
  ...(r as unknown as RelationshipReportRow),
  overall_analysis: parse(r.overall_analysis),
})

export type SqliteStore = Store & {
  /** E-posta giriş kodları (kendi kimlik doğrulamamız) */
  saveEmailCode(email: string, codeHash: string, expiresAt: string): Promise<void>
  /** Kodu doğrular: doğruysa siler ve true döner; yanlışsa deneme sayısını artırır. */
  checkEmailCode(email: string, codeHash: string, maxAttempts: number): Promise<'ok' | 'wrong' | 'expired'>
  close(): void
}

export function createSqliteStore(path: string): SqliteStore {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })
  const db = new DatabaseSync(path)
  db.exec('pragma journal_mode = wal; pragma busy_timeout = 5000; pragma foreign_keys = on;')
  db.exec(SCHEMA)

  const one = (sql: string, ...params: unknown[]) =>
    (db.prepare(sql).get(...(params as never[])) as Row | undefined) ?? null
  const all = (sql: string, ...params: unknown[]) => db.prepare(sql).all(...(params as never[])) as Row[]
  const run = (sql: string, ...params: unknown[]) => db.prepare(sql).run(...(params as never[]))
  const tx = <T>(fn: () => T): T => {
    db.exec('begin immediate')
    try {
      const v = fn()
      db.exec('commit')
      return v
    } catch (e) {
      db.exec('rollback')
      throw e
    }
  }
  const inList = (ids: string[]) => ids.map(() => '?').join(',') || "''"
  const isUnique = (e: unknown) => e instanceof Error && /UNIQUE constraint failed/.test(e.message)

  return {
    kind: 'sqlite',

    close: () => db.close(),

    async createCouple({ code, name, mode, partner_name }) {
      const row: CoupleRow = { id: uuid(), code, name, mode, partner_name, created_at: now() }
      try {
        run(
          'insert into couples (id, code, name, mode, partner_name, created_at) values (?, ?, ?, ?, ?, ?)',
          row.id,
          code,
          name,
          mode,
          partner_name,
          row.created_at,
        )
      } catch (e) {
        if (isUnique(e)) return 'code_taken'
        throw e
      }
      return row
    },

    async getCouple(id) {
      return one('select * from couples where id = ?', id) as CoupleRow | null
    },

    async getCoupleByCode(code) {
      return one('select * from couples where code = ?', code) as CoupleRow | null
    },

    async listMembers(coupleId) {
      return all('select * from couple_members where couple_id = ? order by role', coupleId) as MemberRow[]
    },

    async addMember(input) {
      const row: MemberRow = { auth_user_id: null, email: null, ...input, id: uuid(), joined_at: now() }
      try {
        run(
          `insert into couple_members (id, couple_id, role, display_name, auth_token_hash, auth_user_id, email, joined_at)
           values (?, ?, ?, ?, ?, ?, ?, ?)`,
          row.id,
          row.couple_id,
          row.role,
          row.display_name,
          row.auth_token_hash,
          row.auth_user_id,
          row.email,
          row.joined_at,
        )
      } catch (e) {
        if (isUnique(e)) return 'role_taken'
        throw e
      }
      return row
    },

    async getMemberByTokenHash(hash) {
      return one('select * from couple_members where auth_token_hash = ?', hash) as MemberRow | null
    },

    async getMemberByAuthUser(userId) {
      return one('select * from couple_members where auth_user_id = ?', userId) as MemberRow | null
    },

    async linkMemberAuth(memberId, userId, email) {
      try {
        run('update couple_members set auth_user_id = ?, email = ? where id = ?', userId, email, memberId)
        return 'ok'
      } catch (e) {
        if (isUnique(e)) return 'taken'
        throw e
      }
    },

    async listDisputes(coupleId) {
      return all('select * from disputes where couple_id = ? order by created_at desc', coupleId).map(dispute)
    },

    async countDisputesSince(iso) {
      return Number(one('select count(*) n from disputes where created_at >= ?', iso)?.n ?? 0)
    },

    async adminSnapshot() {
      return {
        disputes: all(
          'select id, couple_id, status, created_at from disputes order by created_at desc limit 2000',
        ) as never,
        members: all('select couple_id, role from couple_members') as never,
        couples: all('select id, mode from couples') as never,
        surveys: all("select selected_tags, updated_at from answers where question_id = 'anket'").map((r) => ({
          selected_tags: parse(r.selected_tags) ?? [],
          updated_at: r.updated_at as string,
        })),
      }
    },

    async addBetaClaims(rows) {
      const at = now()
      tx(() => {
        for (const r of rows)
          run('insert into beta_claims (kind, key_hash, couple_id, created_at) values (?, ?, ?, ?)', r.kind, r.key_hash, r.couple_id, at)
      })
    },

    async hasBetaClaim(kind, keyHash, opts = {}) {
      return Boolean(
        one(
          `select 1 from beta_claims where kind = ? and key_hash = ? and created_at >= ?
             and (? is null or couple_id is null or couple_id <> ?) limit 1`,
          kind,
          keyHash,
          opts.since ?? '',
          opts.exceptCouple ?? null,
          opts.exceptCouple ?? null,
        ),
      )
    },

    async countBetaClaims(kind, since) {
      return Number(one('select count(*) n from beta_claims where kind = ? and created_at >= ?', kind, since)?.n ?? 0)
    },

    async coupleHasClaim(coupleId, kind) {
      return Boolean(one('select 1 from beta_claims where kind = ? and couple_id = ? limit 1', kind, coupleId))
    },

    async createAccessCode(input) {
      const row: AccessCodeRow = {
        id: uuid(),
        ...input,
        uses_left: input.uses_total,
        couple_id: null,
        redeemed_at: null,
        created_at: now(),
      }
      run(
        'insert into access_codes (id, code_hash, label, uses_total, uses_left, created_at) values (?, ?, ?, ?, ?, ?)',
        row.id,
        row.code_hash,
        row.label,
        row.uses_total,
        row.uses_left,
        row.created_at,
      )
      return row
    },

    async listAccessCodes() {
      return all('select * from access_codes order by created_at desc limit 500') as AccessCodeRow[]
    },

    async bindAccessCode(codeHash, coupleId) {
      return tx(() => {
        const row = one('select * from access_codes where code_hash = ?', codeHash) as AccessCodeRow | null
        if (!row || (row.couple_id && row.couple_id !== coupleId)) return null
        if (!row.couple_id) {
          row.couple_id = coupleId
          row.redeemed_at = now()
          run('update access_codes set couple_id = ?, redeemed_at = ? where id = ?', coupleId, row.redeemed_at, row.id)
        }
        return row
      })
    },

    async codeUsesLeft(coupleId) {
      return Number(one('select coalesce(sum(uses_left), 0) n from access_codes where couple_id = ?', coupleId)?.n ?? 0)
    },

    async consumeAccessCode(coupleId) {
      return tx(() => {
        const row = one(
          'select id, uses_left from access_codes where couple_id = ? and uses_left > 0 order by created_at limit 1',
          coupleId,
        )
        if (!row) return null
        run('update access_codes set uses_left = uses_left - 1 where id = ?', row.id)
        return Number(row.uses_left) - 1
      })
    },

    async addToWaitlist(email) {
      run('insert or ignore into waitlist (email, created_at) values (?, ?)', email, now())
    },

    async countWaitlist() {
      const count = Number(one('select count(*) n from waitlist')?.n ?? 0)
      const latest = all('select email, created_at from waitlist order by created_at desc limit 100') as {
        email: string
        created_at: string
      }[]
      return { count, latest }
    },

    async getDispute(id) {
      const r = one('select * from disputes where id = ?', id)
      return r ? dispute(r) : null
    },

    async createDispute(input) {
      const ts = now()
      const row: DisputeRow = {
        id: uuid(),
        ...input,
        status: 'draft',
        shared_report: null,
        shared_approved_a: false,
        shared_approved_b: false,
        created_at: ts,
        updated_at: ts,
        completed_at: null,
        status_locked_at: null,
      }
      run(
        `insert into disputes (id, couple_id, created_by, title, status, created_at, updated_at)
         values (?, ?, ?, ?, 'draft', ?, ?)`,
        row.id,
        row.couple_id,
        row.created_by,
        row.title,
        ts,
        ts,
      )
      return row
    },

    async setDisputeTitle(id, title) {
      run('update disputes set title = ? where id = ?', title, id)
    },

    async deleteDispute(id) {
      run("delete from disputes where id = ? and status <> 'completed'", id)
    },

    async setSharedApproval(id, role) {
      const col = role === 'A' ? 'shared_approved_a' : 'shared_approved_b'
      run(`update disputes set ${col} = 1, updated_at = ? where id = ? and status = 'completed'`, now(), id)
      const r = one("select * from disputes where id = ? and status = 'completed'", id)
      return r ? dispute(r) : null
    },

    async getEntries(ids) {
      return all(`select * from dispute_entries where dispute_id in (${inList(ids)})`, ...ids).map(entry)
    },

    async upsertEntry(input) {
      const ts = now()
      run(
        `insert into dispute_entries (id, dispute_id, member_id, what_happened, event_visibility, submitted_at, created_at, updated_at)
         values (?, ?, ?, ?, ?, ?, ?, ?)
         on conflict (dispute_id, member_id) do update set
           what_happened = excluded.what_happened,
           event_visibility = excluded.event_visibility,
           submitted_at = coalesce(excluded.submitted_at, dispute_entries.submitted_at),
           updated_at = excluded.updated_at`,
        uuid(),
        input.dispute_id,
        input.member_id,
        input.what_happened,
        input.event_visibility,
        input.submitted_at ?? null,
        ts,
        ts,
      )
    },

    async getAnswers(ids) {
      return all(`select * from answers where dispute_id in (${inList(ids)})`, ...ids).map(answer)
    },

    async upsertAnswers(rows) {
      const ts = now()
      tx(() => {
        for (const r of rows)
          run(
            `insert into answers (id, dispute_id, member_id, question_id, text_answer, selected_tags, visibility, updated_at)
             values (?, ?, ?, ?, ?, ?, ?, ?)
             on conflict (dispute_id, member_id, question_id) do update set
               text_answer = excluded.text_answer,
               selected_tags = excluded.selected_tags,
               visibility = excluded.visibility,
               updated_at = excluded.updated_at`,
            uuid(),
            r.dispute_id,
            r.member_id,
            r.question_id,
            r.text_answer,
            JSON.stringify(r.selected_tags),
            r.visibility,
            ts,
          )
      })
    },

    async getReconsiderations(ids) {
      return all(`select * from reconsiderations where dispute_id in (${inList(ids)})`, ...ids).map(reconsideration)
    },

    async upsertReconsideration(input) {
      run(
        `insert into reconsiderations (id, dispute_id, member_id, reflections, submitted_at, updated_at)
         values (?, ?, ?, ?, ?, ?)
         on conflict (dispute_id, member_id) do update set
           reflections = excluded.reflections,
           submitted_at = coalesce(excluded.submitted_at, reconsiderations.submitted_at),
           updated_at = excluded.updated_at`,
        uuid(),
        input.dispute_id,
        input.member_id,
        JSON.stringify(input.reflections),
        input.submitted_at ?? null,
        now(),
      )
    },

    async getReports(disputeId) {
      return all('select * from reports where dispute_id = ?', disputeId).map(report)
    },

    async syncProgress(disputeId) {
      return tx(() => {
        const d = one(
          'select d.status, c.mode from disputes d join couples c on c.id = d.couple_id where d.id = ?',
          disputeId,
        )
        if (!d) return null
        const status = d.status as DisputeRow['status']
        let next = status
        if (status === 'draft' || status === 'answers_in_progress') {
          const e = one(
            'select count(*) started, count(submitted_at) submitted from dispute_entries where dispute_id = ?',
            disputeId,
          )!
          const anyAnswer = one('select 1 from answers where dispute_id = ? limit 1', disputeId)
          const submitted = Number(e.submitted)
          if (d.mode === 'solo' && submitted >= 1) next = 'reconsideration_completed'
          else if (submitted >= 2) next = 'both_answers_completed'
          else if (Number(e.started) > 0 || anyAnswer) next = 'answers_in_progress'
        } else if (status === 'perspectives_ready' || status === 'reconsideration_in_progress') {
          const r = one(
            'select count(*) started, count(submitted_at) submitted from reconsiderations where dispute_id = ?',
            disputeId,
          )!
          if (Number(r.submitted) >= 2) next = 'reconsideration_completed'
          else if (Number(r.started) > 0) next = 'reconsideration_in_progress'
        }
        if (next !== status) run('update disputes set status = ?, updated_at = ? where id = ?', next, now(), disputeId)
        return next
      })
    },

    async claimStatus(disputeId, from, to) {
      const lockedAt = lockStamp()
      const res = run(
        `update disputes set status = ?, status_locked_at = ?, updated_at = ?
          where id = ? and (status = ? or (status = ? and (status_locked_at is null or status_locked_at < ?)))`,
        to,
        lockedAt,
        now(),
        disputeId,
        from,
        to,
        staleBefore(),
      )
      return Number(res.changes) > 0 ? { lockedAt } : null
    },

    async releaseStatus(disputeId, lock, backTo) {
      const res = run(
        'update disputes set status = ?, status_locked_at = null, updated_at = ? where id = ? and status_locked_at = ?',
        backTo,
        now(),
        disputeId,
        lock.lockedAt,
      )
      return Number(res.changes) > 0
    },

    async finishPerspectives(disputeId, lock, perspectives) {
      return tx(() => {
        const d = one(
          "select 1 from disputes where id = ? and status = 'generating_perspectives' and status_locked_at = ?",
          disputeId,
          lock.lockedAt,
        )
        if (!d) return false
        const ts = now()
        for (const [memberId, p] of Object.entries(perspectives))
          run(
            'update dispute_entries set perspective = ?, updated_at = ? where dispute_id = ? and member_id = ?',
            json(p),
            ts,
            disputeId,
            memberId,
          )
        run(
          "update disputes set status = 'perspectives_ready', status_locked_at = null, updated_at = ? where id = ?",
          ts,
          disputeId,
        )
        return true
      })
    },

    async finishReports(disputeId, lock, shared, reports) {
      return tx(() => {
        const d = one(
          "select 1 from disputes where id = ? and status = 'generating_reports' and status_locked_at = ?",
          disputeId,
          lock.lockedAt,
        )
        if (!d) return false
        const ts = now()
        for (const [memberId, r] of Object.entries(reports))
          run(
            `insert into reports (id, dispute_id, member_id, my_report, created_at) values (?, ?, ?, ?, ?)
             on conflict (dispute_id, member_id) do update set my_report = excluded.my_report, created_at = excluded.created_at`,
            uuid(),
            disputeId,
            memberId,
            json(r),
            ts,
          )
        run(
          `update disputes set shared_report = ?, shared_approved_a = 0, shared_approved_b = 0, status = 'completed',
             completed_at = coalesce(completed_at, ?), status_locked_at = null, updated_at = ? where id = ?`,
          json(shared),
          ts,
          ts,
          disputeId,
        )
        return true
      })
    },

    async deleteCouple(coupleId) {
      // Yabancı anahtarlar: üyeler, meseleler (ve cevaplar, raporlar), Genel Görüş ve silme talebi silinir;
      // üyelik ve erişim kodu satırları kalır, sahipsiz olur.
      run('delete from couples where id = ?', coupleId)
    },

    async setMemberTokenHash(memberId, hash) {
      run('update couple_members set auth_token_hash = ? where id = ?', hash, memberId)
    },

    async getActiveSubscription(coupleId, at) {
      return one(
        'select * from subscriptions where couple_id = ? and expires_at > ? order by expires_at desc limit 1',
        coupleId,
        at,
      ) as SubscriptionRow | null
    },

    async hasAnySubscription(coupleId) {
      return Boolean(one('select 1 from subscriptions where couple_id = ? limit 1', coupleId))
    },

    async createSubscription(input) {
      const ts = now()
      const row: SubscriptionRow = { id: uuid(), ...input, started_at: ts, created_at: ts }
      run(
        `insert into subscriptions (id, couple_id, member_id, period, provider, provider_ref, owner_user_id, started_at, expires_at, created_at)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        row.id,
        row.couple_id,
        row.member_id,
        row.period,
        row.provider,
        row.provider_ref,
        row.owner_user_id,
        ts,
        row.expires_at,
        ts,
      )
      return row
    },

    async extendSubscription(id, expiresAt) {
      run('update subscriptions set expires_at = ? where id = ?', expiresAt, id)
    },

    async claimOrphanSubscriptions(userId, coupleId, memberId, at) {
      const res = run(
        'update subscriptions set couple_id = ?, member_id = ? where owner_user_id = ? and couple_id is null and expires_at > ?',
        coupleId,
        memberId,
        userId,
        at,
      )
      return Number(res.changes)
    },

    async getDeletionRequest(coupleId) {
      return one('select * from deletion_requests where couple_id = ?', coupleId) as DeletionRequestRow | null
    },

    async createDeletionRequest(coupleId, memberId) {
      const row: DeletionRequestRow = { id: uuid(), couple_id: coupleId, requested_by: memberId, created_at: now() }
      try {
        run(
          'insert into deletion_requests (id, couple_id, requested_by, created_at) values (?, ?, ?, ?)',
          row.id,
          coupleId,
          memberId,
          row.created_at,
        )
      } catch (e) {
        if (isUnique(e)) return 'exists'
        throw e
      }
      return row
    },

    async deleteDeletionRequest(coupleId) {
      run('delete from deletion_requests where couple_id = ?', coupleId)
    },

    async countCompletedDisputes(coupleId) {
      return Number(
        one("select count(*) n from disputes where couple_id = ? and status = 'completed'", coupleId)?.n ?? 0,
      )
    },

    async getLatestRelationshipReport(coupleId) {
      const r = one(
        'select * from relationship_reports where couple_id = ? order by dispute_count desc limit 1',
        coupleId,
      )
      return r ? relationship(r) : null
    },

    async getReadyRelationshipReport(coupleId) {
      const r = one(
        "select * from relationship_reports where couple_id = ? and status = 'ready' order by dispute_count desc limit 1",
        coupleId,
      )
      return r ? relationship(r) : null
    },

    async claimRelationshipReport(coupleId, disputeCount) {
      return tx(() => {
        const lockedAt = lockStamp()
        const existing = one(
          'select id, status, status_locked_at from relationship_reports where couple_id = ? and dispute_count = ?',
          coupleId,
          disputeCount,
        )
        if (existing) {
          const stale = existing.status_locked_at === null || String(existing.status_locked_at) < staleBefore()
          if (existing.status === 'failed' || (existing.status === 'generating' && stale)) {
            run(
              "update relationship_reports set status = 'generating', status_locked_at = ? where id = ?",
              lockedAt,
              existing.id,
            )
            return { id: String(existing.id), lock: { lockedAt } }
          }
          return null
        }
        const id = uuid()
        run(
          `insert into relationship_reports (id, couple_id, dispute_count, status, status_locked_at, created_at)
           values (?, ?, ?, 'generating', ?, ?)`,
          id,
          coupleId,
          disputeCount,
          lockedAt,
          now(),
        )
        return { id, lock: { lockedAt } }
      })
    },

    async finishRelationshipReport(id, lock, analysis) {
      const res = run(
        `update relationship_reports set overall_analysis = ?, status = 'ready', status_locked_at = null,
           unlocked_at = coalesce(unlocked_at, ?)
         where id = ? and status = 'generating' and status_locked_at = ?`,
        json(analysis),
        now(),
        id,
        lock.lockedAt,
      )
      return Number(res.changes) > 0
    },

    async failRelationshipReport(id, lock) {
      const res = run(
        "update relationship_reports set status = 'failed', status_locked_at = null where id = ? and status = 'generating' and status_locked_at = ?",
        id,
        lock.lockedAt,
      )
      return Number(res.changes) > 0
    },

    async saveEmailCode(email, codeHash, expiresAt) {
      run(
        `insert into email_codes (email, code_hash, expires_at, attempts) values (?, ?, ?, 0)
         on conflict (email) do update set code_hash = excluded.code_hash, expires_at = excluded.expires_at, attempts = 0`,
        email,
        codeHash,
        expiresAt,
      )
    },

    async checkEmailCode(email, codeHash, maxAttempts) {
      return tx(() => {
        const r = one('select code_hash, expires_at, attempts from email_codes where email = ?', email)
        if (!r || String(r.expires_at) < now() || Number(r.attempts) >= maxAttempts) return 'expired' as const
        if (r.code_hash !== codeHash) {
          run('update email_codes set attempts = attempts + 1 where email = ?', email)
          return 'wrong' as const
        }
        run('delete from email_codes where email = ?', email)
        return 'ok' as const
      })
    },
  }
}
