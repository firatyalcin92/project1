import '@tanstack/react-start/server-only'
import { createClient, type PostgrestError } from '@supabase/supabase-js'
import type { DisputeStatus } from '~/lib/status'
import { MeseleError } from './errors.server'
import type {
  AccessCodeRow,
  AdminSnapshot,
  AnswerRow,
  CoupleRow,
  DeletionRequestRow,
  DisputeRow,
  EntryRow,
  Lock,
  MemberRow,
  ReconsiderationRow,
  RelationshipReportRow,
  ReportRow,
  Store,
  SubscriptionRow,
} from './store.server'

const UNIQUE_VIOLATION = '23505'

/**
 * guncelleme-hesap.sql henüz çalıştırılmadıysa okuma tarafı uygulamayı
 * kilitlemesin: tablo yoksa "üyelik yok / talep yok" sayılır (yazmalar yine hata verir).
 */
let warnedMissing = false
function tableMissing(error: PostgrestError | null) {
  const missing = error?.code === 'PGRST205' || error?.code === '42P01'
  if (missing && !warnedMissing) {
    warnedMissing = true
    console.error('[mesele] Üyelik tabloları yok: supabase/guncelleme-hesap.sql dosyasını SQL Editor’de çalıştırın.')
  }
  return missing
}

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

    async getMemberByAuthUser(userId) {
      const { data, error } = await db.from('couple_members').select().eq('auth_user_id', userId).maybeSingle()
      check(error, 'getMemberByAuthUser')
      return (data as MemberRow | null) ?? null
    },

    async linkMemberAuth(memberId, userId, email) {
      const { error } = await db.from('couple_members').update({ auth_user_id: userId, email }).eq('id', memberId)
      if (error?.code === UNIQUE_VIOLATION) return 'taken'
      check(error, 'linkMemberAuth')
      return 'ok'
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

    async countDisputesSince(iso) {
      const { count, error } = await db
        .from('disputes')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', iso)
      check(error, 'countDisputesSince')
      return count ?? 0
    },

    // Test sürümü tabloları (guncelleme-test-surumu.sql) yoksa okuma tarafı uygulamayı kilitlemez.
    async addBetaClaims(rows) {
      if (!rows.length) return
      const { error } = await db.from('beta_claims').insert(rows)
      if (tableMissing(error)) return
      check(error, 'addBetaClaims')
    },

    async hasBetaClaim(kind, keyHash, opts = {}) {
      let q = db.from('beta_claims').select('id', { count: 'exact', head: true }).eq('kind', kind).eq('key_hash', keyHash)
      if (opts.since) q = q.gte('created_at', opts.since)
      // couple_id NULL olan (silinmiş çift) kayıtlar da sayılır.
      if (opts.exceptCouple) q = q.or(`couple_id.is.null,couple_id.neq.${opts.exceptCouple}`)
      const { count, error } = await q
      if (tableMissing(error)) return false
      check(error, 'hasBetaClaim')
      return (count ?? 0) > 0
    },

    async coupleHasClaim(coupleId, kind) {
      const { count, error } = await db
        .from('beta_claims')
        .select('id', { count: 'exact', head: true })
        .eq('kind', kind)
        .eq('couple_id', coupleId)
      if (tableMissing(error)) return false
      check(error, 'coupleHasClaim')
      return (count ?? 0) > 0
    },

    async countBetaClaims(kind, since) {
      const { count, error } = await db
        .from('beta_claims')
        .select('id', { count: 'exact', head: true })
        .eq('kind', kind)
        .gte('created_at', since)
      if (tableMissing(error)) return 0
      check(error, 'countBetaClaims')
      return count ?? 0
    },

    async createAccessCode(input) {
      const { data, error } = await db
        .from('access_codes')
        .insert({ ...input, uses_left: input.uses_total })
        .select()
        .single()
      check(error, 'createAccessCode')
      return data as AccessCodeRow
    },

    async listAccessCodes() {
      const { data, error } = await db
        .from('access_codes')
        .select()
        .order('created_at', { ascending: false })
        .limit(500)
      if (tableMissing(error)) return []
      check(error, 'listAccessCodes')
      return (data ?? []) as AccessCodeRow[]
    },

    async bindAccessCode(codeHash, coupleId) {
      const { data: found, error } = await db.from('access_codes').select().eq('code_hash', codeHash).maybeSingle()
      if (tableMissing(error)) return null
      check(error, 'bindAccessCode')
      const row = found as AccessCodeRow | null
      if (!row || (row.couple_id && row.couple_id !== coupleId)) return null
      if (row.couple_id === coupleId) return row
      // Yalnızca hâlâ boştaysa bağlanır (eşzamanlı iki çift aynı kodu alamaz).
      const { data, error: e2 } = await db
        .from('access_codes')
        .update({ couple_id: coupleId, redeemed_at: new Date().toISOString() })
        .eq('id', row.id)
        .is('couple_id', null)
        .select()
        .maybeSingle()
      check(e2, 'bindAccessCode')
      return (data as AccessCodeRow | null) ?? null
    },

    async codeUsesLeft(coupleId) {
      const { data, error } = await db.from('access_codes').select('uses_left').eq('couple_id', coupleId)
      if (tableMissing(error)) return 0
      check(error, 'codeUsesLeft')
      return ((data ?? []) as { uses_left: number }[]).reduce((n, r) => n + r.uses_left, 0)
    },

    async consumeAccessCode(coupleId) {
      const { data, error } = await db.rpc('mesele_consume_code', { p_couple_id: coupleId })
      check(error, 'consumeAccessCode')
      return typeof data === 'number' ? data : null
    },

    async addToWaitlist(email) {
      const { error } = await db.from('waitlist').upsert({ email }, { onConflict: 'email', ignoreDuplicates: true })
      check(error, 'addToWaitlist')
    },

    async countWaitlist() {
      const { data, count, error } = await db
        .from('waitlist')
        .select('email, created_at', { count: 'exact' })
        .order('created_at', { ascending: false })
        .limit(100)
      if (tableMissing(error)) return { count: 0, latest: [] }
      check(error, 'countWaitlist')
      return { count: count ?? 0, latest: (data ?? []) as { email: string; created_at: string }[] }
    },

    async adminSnapshot() {
      const [d, m, c, s] = await Promise.all([
        db
          .from('disputes')
          .select('id, couple_id, status, created_at')
          .order('created_at', { ascending: false })
          .limit(2000),
        db.from('couple_members').select('couple_id, role').limit(5000),
        db.from('couples').select('id, mode').limit(5000),
        db.from('answers').select('selected_tags, updated_at').eq('question_id', 'anket').limit(2000),
      ])
      check(d.error ?? m.error ?? c.error ?? s.error, 'adminSnapshot')
      return {
        disputes: (d.data ?? []) as AdminSnapshot['disputes'],
        members: (m.data ?? []) as AdminSnapshot['members'],
        couples: (c.data ?? []) as AdminSnapshot['couples'],
        surveys: (s.data ?? []) as AdminSnapshot['surveys'],
      }
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

    async setDisputeTitle(id, title) {
      const { error } = await db.from('disputes').update({ title }).eq('id', id)
      check(error, 'setDisputeTitle')
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

    async deleteCouple(coupleId) {
      // Meseleler, cevaplar, raporlar ve üyeler "on delete cascade" ile silinir; üyelik kalır.
      const { error } = await db.from('couples').delete().eq('id', coupleId)
      check(error, 'deleteCouple')
    },

    async setMemberTokenHash(memberId, hash) {
      const { error } = await db.from('couple_members').update({ auth_token_hash: hash }).eq('id', memberId)
      check(error, 'setMemberTokenHash')
    },

    async getActiveSubscription(coupleId, at) {
      const { data, error } = await db
        .from('subscriptions')
        .select()
        .eq('couple_id', coupleId)
        .gt('expires_at', at)
        .order('expires_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (tableMissing(error)) return null
      check(error, 'getActiveSubscription')
      return (data as SubscriptionRow | null) ?? null
    },

    async hasAnySubscription(coupleId) {
      const { data, error } = await db.from('subscriptions').select('id').eq('couple_id', coupleId).limit(1)
      if (tableMissing(error)) return false
      check(error, 'hasAnySubscription')
      return (data?.length ?? 0) > 0
    },

    async createSubscription(input) {
      const { data, error } = await db.from('subscriptions').insert(input).select().single()
      check(error, 'createSubscription')
      return data as SubscriptionRow
    },

    async extendSubscription(id, expiresAt) {
      const { error } = await db.from('subscriptions').update({ expires_at: expiresAt }).eq('id', id)
      check(error, 'extendSubscription')
    },

    async claimOrphanSubscriptions(userId, coupleId, memberId, at) {
      const { data, error } = await db
        .from('subscriptions')
        .update({ couple_id: coupleId, member_id: memberId })
        .eq('owner_user_id', userId)
        .is('couple_id', null)
        .gt('expires_at', at)
        .select('id')
      if (tableMissing(error)) return 0
      check(error, 'claimOrphanSubscriptions')
      return data?.length ?? 0
    },

    async getDeletionRequest(coupleId) {
      const { data, error } = await db.from('deletion_requests').select().eq('couple_id', coupleId).maybeSingle()
      if (tableMissing(error)) return null
      check(error, 'getDeletionRequest')
      return (data as DeletionRequestRow | null) ?? null
    },

    async createDeletionRequest(coupleId, memberId) {
      const { data, error } = await db
        .from('deletion_requests')
        .insert({ couple_id: coupleId, requested_by: memberId })
        .select()
        .single()
      if (error?.code === UNIQUE_VIOLATION) return 'exists'
      check(error, 'createDeletionRequest')
      return data as DeletionRequestRow
    },

    async deleteDeletionRequest(coupleId) {
      const { error } = await db.from('deletion_requests').delete().eq('couple_id', coupleId)
      check(error, 'deleteDeletionRequest')
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
