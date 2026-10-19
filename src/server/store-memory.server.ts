import '@tanstack/react-start/server-only'
import { GENERATION_LOCK_MS } from '~/lib/status'
import type {
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
 * Yalnızca yerel geliştirme ve testler için. Supabase'deki SQL fonksiyonlarının
 * (mesele_claim_status vb.) anlamını birebir taklit eder. Node tek iş parçacıklı
 * olduğundan her metot kendi içinde atomiktir.
 */

type Tables = {
  couples: Map<string, CoupleRow>
  members: Map<string, MemberRow>
  disputes: Map<string, DisputeRow>
  entries: Map<string, EntryRow>
  answers: Map<string, AnswerRow>
  reconsiderations: Map<string, ReconsiderationRow>
  reports: Map<string, ReportRow>
  relationship: Map<string, RelationshipReportRow>
  subscriptions: Map<string, SubscriptionRow>
  deletions: Map<string, DeletionRequestRow>
}

const now = () => new Date().toISOString()
const clone = <T>(v: T): T => structuredClone(v)

// Kilit zaman damgaları benzersiz olmalı (SQL'de clock_timestamp mikro saniye hassasiyetindedir).
let lastLockMs = 0
function lockStamp() {
  const ms = Math.max(Date.now(), lastLockMs + 1)
  lastLockMs = ms
  return new Date(ms).toISOString()
}

function isStale(lockedAt: string | null) {
  return lockedAt === null || Date.parse(lockedAt) < Date.now() - GENERATION_LOCK_MS
}

export function createMemoryStore(): Store {
  const t: Tables = {
    couples: new Map(),
    members: new Map(),
    disputes: new Map(),
    entries: new Map(),
    answers: new Map(),
    reconsiderations: new Map(),
    reports: new Map(),
    relationship: new Map(),
    subscriptions: new Map(),
    deletions: new Map(),
  }

  const byDispute = <T extends { dispute_id: string }>(m: Map<string, T>, ids: string[]) =>
    [...m.values()].filter((r) => ids.includes(r.dispute_id)).map(clone)

  return {
    kind: 'memory',

    async createCouple({ code, name, mode, partner_name }) {
      if ([...t.couples.values()].some((c) => c.code === code)) return 'code_taken'
      const row: CoupleRow = { id: crypto.randomUUID(), code, name, mode, partner_name, created_at: now() }
      t.couples.set(row.id, row)
      return clone(row)
    },

    async getCouple(id) {
      const c = t.couples.get(id)
      return c ? clone(c) : null
    },

    async getCoupleByCode(code) {
      const c = [...t.couples.values()].find((x) => x.code === code)
      return c ? clone(c) : null
    },

    async listMembers(coupleId) {
      return [...t.members.values()]
        .filter((m) => m.couple_id === coupleId)
        .sort((a, b) => a.role.localeCompare(b.role))
        .map(clone)
    },

    async addMember(input) {
      const members = [...t.members.values()]
      if (members.some((m) => m.couple_id === input.couple_id && m.role === input.role)) return 'role_taken'
      if (members.some((m) => m.auth_token_hash === input.auth_token_hash)) return 'role_taken'
      if (input.auth_user_id && members.some((m) => m.auth_user_id === input.auth_user_id)) return 'role_taken'
      const row: MemberRow = {
        auth_user_id: null,
        email: null,
        ...input,
        id: crypto.randomUUID(),
        joined_at: now(),
      }
      t.members.set(row.id, row)
      return clone(row)
    },

    async getMemberByTokenHash(hash) {
      const m = [...t.members.values()].find((x) => x.auth_token_hash === hash)
      return m ? clone(m) : null
    },

    async getMemberByAuthUser(userId) {
      const m = [...t.members.values()].find((x) => x.auth_user_id === userId)
      return m ? clone(m) : null
    },

    async linkMemberAuth(memberId, userId, email) {
      if ([...t.members.values()].some((x) => x.auth_user_id === userId && x.id !== memberId)) return 'taken'
      const m = t.members.get(memberId)
      if (m) {
        m.auth_user_id = userId
        m.email = email
      }
      return 'ok'
    },

    async listDisputes(coupleId) {
      return [...t.disputes.values()]
        .filter((d) => d.couple_id === coupleId)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map(clone)
    },

    async getDispute(id) {
      const d = t.disputes.get(id)
      return d ? clone(d) : null
    },

    async createDispute(input) {
      const ts = now()
      const row: DisputeRow = {
        id: crypto.randomUUID(),
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
      t.disputes.set(row.id, row)
      return clone(row)
    },

    async setDisputeTitle(id, title) {
      const d = t.disputes.get(id)
      if (d) d.title = title
    },

    async deleteDispute(id) {
      const d = t.disputes.get(id)
      if (!d || d.status === 'completed') return
      t.disputes.delete(id)
      for (const m of [t.entries, t.answers, t.reconsiderations, t.reports] as Map<string, { dispute_id: string }>[]) {
        for (const [k, v] of m) if (v.dispute_id === id) m.delete(k)
      }
    },

    async setSharedApproval(id, role) {
      const d = t.disputes.get(id)
      if (!d || d.status !== 'completed') return null
      if (role === 'A') d.shared_approved_a = true
      else d.shared_approved_b = true
      d.updated_at = now()
      return clone(d)
    },

    async getEntries(ids) {
      return byDispute(t.entries, ids)
    },

    async upsertEntry(input) {
      const key = `${input.dispute_id}:${input.member_id}`
      const prev = t.entries.get(key)
      const ts = now()
      t.entries.set(key, {
        id: prev?.id ?? crypto.randomUUID(),
        perspective: prev?.perspective ?? null,
        created_at: prev?.created_at ?? ts,
        ...input,
        submitted_at: input.submitted_at ?? prev?.submitted_at ?? null,
        updated_at: ts,
      })
    },

    async getAnswers(ids) {
      return byDispute(t.answers, ids)
    },

    async upsertAnswers(rows) {
      const ts = now()
      for (const r of rows) {
        const key = `${r.dispute_id}:${r.member_id}:${r.question_id}`
        const prev = t.answers.get(key)
        t.answers.set(key, { id: prev?.id ?? crypto.randomUUID(), ...clone(r), updated_at: ts })
      }
    },

    async getReconsiderations(ids) {
      return byDispute(t.reconsiderations, ids)
    },

    async upsertReconsideration(input) {
      const key = `${input.dispute_id}:${input.member_id}`
      const prev = t.reconsiderations.get(key)
      t.reconsiderations.set(key, {
        id: prev?.id ?? crypto.randomUUID(),
        ...clone(input),
        submitted_at: input.submitted_at ?? prev?.submitted_at ?? null,
        updated_at: now(),
      })
    },

    async getReports(disputeId) {
      return byDispute(t.reports, [disputeId])
    },

    async syncProgress(disputeId) {
      const d = t.disputes.get(disputeId)
      if (!d) return null
      let next = d.status
      if (d.status === 'draft' || d.status === 'answers_in_progress') {
        const entries = [...t.entries.values()].filter((e) => e.dispute_id === disputeId)
        const answers = [...t.answers.values()].filter((a) => a.dispute_id === disputeId)
        const solo = t.couples.get(d.couple_id)?.mode === 'solo'
        const submitted = entries.filter((e) => e.submitted_at).length
        if (solo && submitted >= 1) next = 'reconsideration_completed'
        else if (submitted >= 2) next = 'both_answers_completed'
        else if (entries.length > 0 || answers.length > 0) next = 'answers_in_progress'
      } else if (d.status === 'perspectives_ready' || d.status === 'reconsideration_in_progress') {
        const recs = [...t.reconsiderations.values()].filter((r) => r.dispute_id === disputeId)
        if (recs.filter((r) => r.submitted_at).length >= 2) next = 'reconsideration_completed'
        else if (recs.length > 0) next = 'reconsideration_in_progress'
      }
      if (next !== d.status) {
        d.status = next
        d.updated_at = now()
      }
      return next
    },

    async claimStatus(disputeId, from, to) {
      const d = t.disputes.get(disputeId)
      if (!d) return null
      if (d.status === from || (d.status === to && isStale(d.status_locked_at))) {
        d.status = to
        d.status_locked_at = lockStamp()
        d.updated_at = now()
        return { lockedAt: d.status_locked_at }
      }
      return null
    },

    async releaseStatus(disputeId, lock, backTo) {
      const d = t.disputes.get(disputeId)
      if (!d || d.status_locked_at !== lock.lockedAt) return false
      d.status = backTo
      d.status_locked_at = null
      d.updated_at = now()
      return true
    },

    async finishPerspectives(disputeId, lock, perspectives) {
      const d = t.disputes.get(disputeId)
      if (!d || d.status !== 'generating_perspectives' || d.status_locked_at !== lock.lockedAt) return false
      for (const e of t.entries.values()) {
        if (e.dispute_id === disputeId && e.member_id in perspectives) {
          e.perspective = clone(perspectives[e.member_id])
          e.updated_at = now()
        }
      }
      d.status = 'perspectives_ready'
      d.status_locked_at = null
      d.updated_at = now()
      return true
    },

    async finishReports(disputeId, lock, shared, reports) {
      const d = t.disputes.get(disputeId)
      if (!d || d.status !== 'generating_reports' || d.status_locked_at !== lock.lockedAt) return false
      for (const [memberId, report] of Object.entries(reports)) {
        const key = `${disputeId}:${memberId}`
        t.reports.set(key, {
          id: t.reports.get(key)?.id ?? crypto.randomUUID(),
          dispute_id: disputeId,
          member_id: memberId,
          my_report: clone(report),
          created_at: now(),
        })
      }
      d.shared_report = clone(shared)
      d.shared_approved_a = false
      d.shared_approved_b = false
      d.status = 'completed'
      d.completed_at = d.completed_at ?? now()
      d.status_locked_at = null
      d.updated_at = now()
      return true
    },

    async deleteCouple(coupleId) {
      const memberIds = [...t.members.values()].filter((m) => m.couple_id === coupleId).map((m) => m.id)
      const disputeIds = [...t.disputes.values()].filter((d) => d.couple_id === coupleId).map((d) => d.id)
      for (const id of disputeIds) t.disputes.delete(id)
      for (const m of [t.entries, t.answers, t.reconsiderations, t.reports] as Map<string, { dispute_id: string }>[]) {
        for (const [k, v] of m) if (disputeIds.includes(v.dispute_id)) m.delete(k)
      }
      for (const [k, r] of t.relationship) if (r.couple_id === coupleId) t.relationship.delete(k)
      t.deletions.delete(coupleId)
      for (const id of memberIds) t.members.delete(id)
      t.couples.delete(coupleId)
      // Üyelik satırı kalır, sahipsiz olur (on delete set null)
      for (const sub of t.subscriptions.values()) {
        if (sub.couple_id === coupleId) sub.couple_id = null
        if (sub.member_id && memberIds.includes(sub.member_id)) sub.member_id = null
      }
    },

    async setMemberTokenHash(memberId, hash) {
      const m = t.members.get(memberId)
      if (m) m.auth_token_hash = hash
    },

    async getActiveSubscription(coupleId, at) {
      const rows = [...t.subscriptions.values()]
        .filter((r) => r.couple_id === coupleId && r.expires_at > at)
        .sort((a, b) => b.expires_at.localeCompare(a.expires_at))
      return rows[0] ? clone(rows[0]) : null
    },

    async hasAnySubscription(coupleId) {
      return [...t.subscriptions.values()].some((r) => r.couple_id === coupleId)
    },

    async createSubscription(input) {
      const row: SubscriptionRow = { id: crypto.randomUUID(), ...input, started_at: now(), created_at: now() }
      t.subscriptions.set(row.id, row)
      return clone(row)
    },

    async extendSubscription(id, expiresAt) {
      const r = t.subscriptions.get(id)
      if (r) r.expires_at = expiresAt
    },

    async claimOrphanSubscriptions(userId, coupleId, memberId, at) {
      let n = 0
      for (const r of t.subscriptions.values()) {
        if (r.owner_user_id === userId && r.couple_id === null && r.expires_at > at) {
          r.couple_id = coupleId
          r.member_id = memberId
          n++
        }
      }
      return n
    },

    async getDeletionRequest(coupleId) {
      const r = t.deletions.get(coupleId)
      return r ? clone(r) : null
    },

    async createDeletionRequest(coupleId, memberId) {
      if (t.deletions.has(coupleId)) return 'exists'
      const row: DeletionRequestRow = {
        id: crypto.randomUUID(),
        couple_id: coupleId,
        requested_by: memberId,
        created_at: now(),
      }
      t.deletions.set(coupleId, row)
      return clone(row)
    },

    async deleteDeletionRequest(coupleId) {
      t.deletions.delete(coupleId)
    },

    async countCompletedDisputes(coupleId) {
      return [...t.disputes.values()].filter((d) => d.couple_id === coupleId && d.status === 'completed').length
    },

    async getLatestRelationshipReport(coupleId) {
      const rows = [...t.relationship.values()]
        .filter((r) => r.couple_id === coupleId)
        .sort((a, b) => b.dispute_count - a.dispute_count)
      return rows[0] ? clone(rows[0]) : null
    },

    async getReadyRelationshipReport(coupleId) {
      const rows = [...t.relationship.values()]
        .filter((r) => r.couple_id === coupleId && r.status === 'ready')
        .sort((a, b) => b.dispute_count - a.dispute_count)
      return rows[0] ? clone(rows[0]) : null
    },

    async claimRelationshipReport(coupleId, disputeCount) {
      const existing = [...t.relationship.values()].find(
        (r) => r.couple_id === coupleId && r.dispute_count === disputeCount,
      )
      if (existing) {
        if (existing.status === 'failed' || (existing.status === 'generating' && isStale(existing.status_locked_at))) {
          existing.status = 'generating'
          existing.status_locked_at = lockStamp()
          return { id: existing.id, lock: { lockedAt: existing.status_locked_at } }
        }
        return null
      }
      const row: RelationshipReportRow = {
        id: crypto.randomUUID(),
        couple_id: coupleId,
        overall_analysis: null,
        dispute_count: disputeCount,
        status: 'generating',
        status_locked_at: lockStamp(),
        unlocked_at: null,
        created_at: now(),
      }
      t.relationship.set(row.id, row)
      return { id: row.id, lock: { lockedAt: row.status_locked_at! } }
    },

    async finishRelationshipReport(id, lock, analysis) {
      const r = t.relationship.get(id)
      if (!r || r.status !== 'generating' || r.status_locked_at !== lock.lockedAt) return false
      r.overall_analysis = clone(analysis)
      r.status = 'ready'
      r.status_locked_at = null
      r.unlocked_at = r.unlocked_at ?? now()
      return true
    },

    async failRelationshipReport(id, lock) {
      const r = t.relationship.get(id)
      if (!r || r.status !== 'generating' || r.status_locked_at !== lock.lockedAt) return false
      r.status = 'failed'
      r.status_locked_at = null
      return true
    },
  }
}

const GLOBAL_KEY = Symbol.for('mesele.memoryStore')

/** HMR sırasında verinin kaybolmaması için tekil depo. */
export function getMemoryStore(): Store {
  const g = globalThis as unknown as Record<symbol, Store | undefined>
  g[GLOBAL_KEY] ??= createMemoryStore()
  return g[GLOBAL_KEY]!
}
