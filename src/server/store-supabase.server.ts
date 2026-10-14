import '@tanstack/react-start/server-only'
import { createClient, type PostgrestError } from '@supabase/supabase-js'
import type { DisputeStatus } from '~/lib/status'
import { MeseleError } from './errors.server'
import type {
  AnswerRow,
  CoupleRow,
  DisputeRow,
  EntryRow,
  Lock,
  MemberRow,
  ReconsiderationRow,
  RelationshipReportRow,
  ReportRow,
  Store,
} from './store.server'

const UNIQUE_VIOLATION = '23505'

function check(error: PostgrestError | null, context: string) {
  if (error) {
    console.error(`[mesele] supabase ${context}: [${error.code}] ${error.message}`)
    throw new MeseleError('INTERNAL', 'Kayıt sırasında bir sorun oluştu. Lütfen tekrar dene.')
  }
}

export function createSupabaseStore(url: string, serviceKey: string): Store {
  const db = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { 'x-application-name': 'mesele' } },
  })

  return {
    kind: 'supabase',

    async createCouple(input) {
      const { data, error } = await db.from('couples').insert(input).select().single()
      if (error?.code === UNIQUE_VIOLATION) return 'code_taken'
      check(error, 'createCouple')
      return data as CoupleRow
    },

    async getCouple(id) {
      const { data, error } = await db.from('couples').select().eq('id', id).maybeSingle()
      check(error, 'getCouple')
      return (data as CoupleRow | null) ?? null
    },

    async getCoupleByCode(code) {
      const { data, error } = await db.from('couples').select().eq('code', code).maybeSingle()
      check(error, 'getCoupleByCode')
      return (data as CoupleRow | null) ?? null
    },

    async listMembers(coupleId) {
      const { data, error } = await db.from('couple_members').select().eq('couple_id', coupleId).order('role')
      check(error, 'listMembers')
      return (data ?? []) as MemberRow[]
    },

    async addMember(input) {
      const { data, error } = await db.from('couple_members').insert(input).select().single()
      if (error?.code === UNIQUE_VIOLATION) return 'role_taken'
      check(error, 'addMember')
      return data as MemberRow
    },

    async getMemberByTokenHash(hash) {
      const { data, error } = await db.from('couple_members').select().eq('auth_token_hash', hash).maybeSingle()
      check(error, 'getMemberByTokenHash')
      return (data as MemberRow | null) ?? null
    },

    async listDisputes(coupleId) {
      const { data, error } = await db
        .from('disputes')
        .select()
        .eq('couple_id', coupleId)
        .order('created_at', { ascending: false })
      check(error, 'listDisputes')
      return (data ?? []) as DisputeRow[]
    },

    async getDispute(id) {
      const { data, error } = await db.from('disputes').select().eq('id', id).maybeSingle()
      check(error, 'getDispute')
      return (data as DisputeRow | null) ?? null
    },

    async createDispute(input) {
      const { data, error } = await db.from('disputes').insert(input).select().single()
      check(error, 'createDispute')
      return data as DisputeRow
    },

    async deleteDispute(id) {
      const { error } = await db.from('disputes').delete().eq('id', id).neq('status', 'completed')
      check(error, 'deleteDispute')
    },

    async setSharedApproval(id, role) {
      const patch = role === 'A' ? { shared_approved_a: true } : { shared_approved_b: true }
      const { data, error } = await db
        .from('disputes')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('status', 'completed')
        .select()
        .maybeSingle()
      check(error, 'setSharedApproval')
      return (data as DisputeRow | null) ?? null
    },

    async getEntries(disputeIds) {
      if (disputeIds.length === 0) return []
      const { data, error } = await db.from('dispute_entries').select().in('dispute_id', disputeIds)
      check(error, 'getEntries')
      return (data ?? []) as EntryRow[]
    },

    async upsertEntry(input) {
      const { error } = await db
        .from('dispute_entries')
        .upsert({ ...input, updated_at: new Date().toISOString() }, { onConflict: 'dispute_id,member_id' })
      check(error, 'upsertEntry')
    },

    async getAnswers(disputeIds) {
      if (disputeIds.length === 0) return []
      const { data, error } = await db.from('answers').select().in('dispute_id', disputeIds)
      check(error, 'getAnswers')
      return (data ?? []) as AnswerRow[]
    },

    async upsertAnswers(rows) {
      if (rows.length === 0) return
      const now = new Date().toISOString()
      const { error } = await db.from('answers').upsert(
        rows.map((r) => ({ ...r, updated_at: now })),
        { onConflict: 'dispute_id,member_id,question_id' },
      )
      check(error, 'upsertAnswers')
    },

    async getReconsiderations(disputeIds) {
      if (disputeIds.length === 0) return []
      const { data, error } = await db.from('reconsiderations').select().in('dispute_id', disputeIds)
      check(error, 'getReconsiderations')
      return (data ?? []) as ReconsiderationRow[]
    },

    async upsertReconsideration(input) {
      const { error } = await db
        .from('reconsiderations')
        .upsert({ ...input, updated_at: new Date().toISOString() }, { onConflict: 'dispute_id,member_id' })
      check(error, 'upsertReconsideration')
    },

    async getReports(disputeId) {
      const { data, error } = await db.from('reports').select().eq('dispute_id', disputeId)
      check(error, 'getReports')
      return (data ?? []) as ReportRow[]
    },

    async syncProgress(disputeId) {
      const { data, error } = await db.rpc('mesele_sync_progress', { p_dispute_id: disputeId })
      check(error, 'syncProgress')
      return (data as DisputeStatus | null) ?? null
    },

    async claimStatus(disputeId, from, to) {
      const { data, error } = await db.rpc('mesele_claim_status', {
        p_dispute_id: disputeId,
        p_from: from,
        p_to: to,
      })
      check(error, 'claimStatus')
      // Zaman damgası metin olarak saklanır: mikro saniye hassasiyeti korunmalı.
      return typeof data === 'string' ? { lockedAt: data } : null
    },

    async releaseStatus(disputeId, lock, backTo) {
      const { data, error } = await db.rpc('mesele_release_status', {
        p_dispute_id: disputeId,
        p_lock: lock.lockedAt,
        p_back_to: backTo,
      })
      check(error, 'releaseStatus')
      return data === true
    },

    async finishPerspectives(disputeId, lock: Lock, perspectives) {
      const { data, error } = await db.rpc('mesele_finish_perspectives', {
        p_dispute_id: disputeId,
        p_lock: lock.lockedAt,
        p_perspectives: perspectives,
      })
      check(error, 'finishPerspectives')
      return data === true
    },

    async finishReports(disputeId, lock, shared, reports) {
      const { data, error } = await db.rpc('mesele_finish_reports', {
        p_dispute_id: disputeId,
        p_lock: lock.lockedAt,
        p_shared: shared,
        p_reports: reports,
      })
      check(error, 'finishReports')
      return data === true
    },

    async countCompletedDisputes(coupleId) {
      const { count, error } = await db
        .from('disputes')
        .select('id', { count: 'exact', head: true })
        .eq('couple_id', coupleId)
        .eq('status', 'completed')
      check(error, 'countCompletedDisputes')
      return count ?? 0
    },

    async getLatestRelationshipReport(coupleId) {
      const { data, error } = await db
        .from('relationship_reports')
        .select()
        .eq('couple_id', coupleId)
        .order('dispute_count', { ascending: false })
        .limit(1)
        .maybeSingle()
      check(error, 'getLatestRelationshipReport')
      return (data as RelationshipReportRow | null) ?? null
    },

    async getReadyRelationshipReport(coupleId) {
      const { data, error } = await db
        .from('relationship_reports')
        .select()
        .eq('couple_id', coupleId)
        .eq('status', 'ready')
        .order('dispute_count', { ascending: false })
        .limit(1)
        .maybeSingle()
      check(error, 'getReadyRelationshipReport')
      return (data as RelationshipReportRow | null) ?? null
    },

    async claimRelationshipReport(coupleId, disputeCount) {
      const { data, error } = await db.rpc('mesele_claim_relationship_report', {
        p_couple_id: coupleId,
        p_dispute_count: disputeCount,
      })
      check(error, 'claimRelationshipReport')
      const row = (Array.isArray(data) ? data[0] : data) as { id: string; status_locked_at: string } | undefined
      return row ? { id: row.id, lock: { lockedAt: row.status_locked_at } } : null
    },

    async finishRelationshipReport(id, lock, analysis) {
      const { data, error } = await db.rpc('mesele_finish_relationship_report', {
        p_report_id: id,
        p_lock: lock.lockedAt,
        p_analysis: analysis,
      })
      check(error, 'finishRelationshipReport')
      return data === true
    },

    async failRelationshipReport(id, lock) {
      const { data, error } = await db.rpc('mesele_fail_relationship_report', {
        p_report_id: id,
        p_lock: lock.lockedAt,
      })
      check(error, 'failRelationshipReport')
      return data === true
    },
  }
}
