import '@tanstack/react-start/server-only'
import type { Visibility } from '~/lib/questions'
import type { DisputeStatus } from '~/lib/status'
import { MeseleError } from './errors.server'

/**
 * Veri erişim katmanı. Üretimde Supabase (service role), yerel geliştirme ve
 * testlerde bellek içi depo kullanılır. Atomik durum geçişleri her iki
 * uygulamada da aynı anlamı taşır (bkz. supabase/migrations).
 */

export type Role = 'A' | 'B'

export type CoupleRow = { id: string; code: string; name: string; created_at: string }

export type MemberRow = {
  id: string
  couple_id: string
  role: Role
  display_name: string
  auth_token_hash: string
  joined_at: string
}

export type DisputeRow = {
  id: string
  couple_id: string
  created_by: string | null
  title: string
  status: DisputeStatus
  shared_report: unknown | null
  shared_approved_a: boolean
  shared_approved_b: boolean
  created_at: string
  updated_at: string
  completed_at: string | null
  status_locked_at: string | null
}

export type EntryRow = {
  id: string
  dispute_id: string
  member_id: string
  what_happened: string
  event_visibility: Visibility
  perspective: unknown | null
  submitted_at: string | null
  created_at: string
  updated_at: string
}

export type AnswerRow = {
  id: string
  dispute_id: string
  member_id: string
  question_id: string
  text_answer: string
  selected_tags: string[]
  visibility: Visibility
  updated_at: string
}

export type Reflections = {
  items: Record<string, { text: string; visibility: Visibility }>
  closeness: number | null
}

export type ReconsiderationRow = {
  id: string
  dispute_id: string
  member_id: string
  reflections: Reflections
  submitted_at: string | null
  updated_at: string
}

export type ReportRow = {
  id: string
  dispute_id: string
  member_id: string
  my_report: unknown
  created_at: string
}

export type RelationshipReportRow = {
  id: string
  couple_id: string
  overall_analysis: unknown | null
  dispute_count: number
  status: 'generating' | 'ready' | 'failed'
  status_locked_at: string | null
  unlocked_at: string | null
  created_at: string
}

export type Lock = { lockedAt: string }

export interface Store {
  readonly kind: 'supabase' | 'memory'

  createCouple(input: { code: string; name: string }): Promise<CoupleRow | 'code_taken'>
  getCouple(id: string): Promise<CoupleRow | null>
  getCoupleByCode(code: string): Promise<CoupleRow | null>
  listMembers(coupleId: string): Promise<MemberRow[]>
  addMember(input: Omit<MemberRow, 'id' | 'joined_at'>): Promise<MemberRow | 'role_taken'>
  getMemberByTokenHash(hash: string): Promise<MemberRow | null>

  listDisputes(coupleId: string): Promise<DisputeRow[]>
  getDispute(id: string): Promise<DisputeRow | null>
  createDispute(input: { couple_id: string; created_by: string; title: string }): Promise<DisputeRow>
  deleteDispute(id: string): Promise<void>
  setSharedApproval(id: string, role: Role): Promise<DisputeRow | null>

  getEntries(disputeIds: string[]): Promise<EntryRow[]>
  /** submitted_at verilmezse mevcut gönderim damgası korunur (taslak kaydı gönderimi geri alamaz). */
  upsertEntry(input: {
    dispute_id: string
    member_id: string
    what_happened: string
    event_visibility: Visibility
    submitted_at?: string
  }): Promise<void>
  getAnswers(disputeIds: string[]): Promise<AnswerRow[]>
  upsertAnswers(
    rows: Array<
      Pick<AnswerRow, 'dispute_id' | 'member_id' | 'question_id' | 'text_answer' | 'selected_tags' | 'visibility'>
    >,
  ): Promise<void>
  getReconsiderations(disputeIds: string[]): Promise<ReconsiderationRow[]>
  upsertReconsideration(input: {
    dispute_id: string
    member_id: string
    reflections: Reflections
    submitted_at?: string
  }): Promise<void>
  getReports(disputeId: string): Promise<ReportRow[]>

  /** Gönderimlere bakıp durumu ileri taşır (mesele_sync_progress). */
  syncProgress(disputeId: string): Promise<DisputeStatus | null>
  /** Atomik durum talebi (mesele_claim_status). Başarısızsa null. */
  claimStatus(disputeId: string, from: DisputeStatus, to: DisputeStatus): Promise<Lock | null>
  releaseStatus(disputeId: string, lock: Lock, backTo: DisputeStatus): Promise<boolean>
  finishPerspectives(disputeId: string, lock: Lock, perspectives: Record<string, unknown>): Promise<boolean>
  finishReports(disputeId: string, lock: Lock, shared: unknown, reports: Record<string, unknown>): Promise<boolean>

  countCompletedDisputes(coupleId: string): Promise<number>
  getLatestRelationshipReport(coupleId: string): Promise<RelationshipReportRow | null>
  getReadyRelationshipReport(coupleId: string): Promise<RelationshipReportRow | null>
  claimRelationshipReport(coupleId: string, disputeCount: number): Promise<{ id: string; lock: Lock } | null>
  finishRelationshipReport(id: string, lock: Lock, analysis: unknown): Promise<boolean>
  failRelationshipReport(id: string, lock: Lock): Promise<boolean>
}

let cached: Store | null = null
let warned = false

export async function getStore(): Promise<Store> {
  if (cached) return cached

  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const forceMemory = process.env.MESELE_STORE === 'memory'

  if (url && serviceKey && !forceMemory) {
    const { createSupabaseStore } = await import('./store-supabase.server')
    cached = createSupabaseStore(url, serviceKey)
    return cached
  }

  if (forceMemory || process.env.NODE_ENV !== 'production') {
    if (!warned) {
      warned = true
      console.warn(
        '[mesele] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY tanımlı değil: bellek içi depo kullanılıyor. Veriler sunucu yeniden başlayınca silinir.',
      )
    }
    const { getMemoryStore } = await import('./store-memory.server')
    cached = getMemoryStore()
    return cached
  }

  throw new MeseleError('CONFIG', 'Sunucu yapılandırması eksik. Lütfen biraz sonra tekrar dene.')
}

/** Testler için. */
export function __setStoreForTests(store: Store | null) {
  cached = store
}
