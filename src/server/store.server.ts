import '@tanstack/react-start/server-only'
import type { DisputeStatus } from '~/lib/status'
import { MeseleError } from './errors.server'

/**
 * Veri erişim katmanı. Üretimde Supabase (service role), yerel geliştirme ve
 * testlerde bellek içi depo kullanılır. Atomik durum geçişleri her iki
 * uygulamada da aynı anlamı taşır (bkz. supabase/migrations).
 */

export type Role = 'A' | 'B'

/** v1'den kalan sütun; v2'de her zaman 'partner' yazılır. */
export type Visibility = 'private' | 'partner'

export type CoupleMode = 'couple' | 'solo'

export type CoupleRow = {
  id: string
  code: string
  name: string
  mode: CoupleMode
  partner_name: string | null
  created_at: string
}

export type MemberRow = {
  id: string
  couple_id: string
  role: Role
  display_name: string
  /** Bu cihazdaki oturumun hash'i (kullanıcı görmez) */
  auth_token_hash: string
  /** Kaydedilmiş hesap (Supabase Auth kullanıcısı: Apple / Google / e-posta). Kaydedilmediyse null. */
  auth_user_id: string | null
  email: string | null
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

export type PlanPeriod = 'weekly' | 'monthly' | 'yearly'

export type SubscriptionRow = {
  id: string
  couple_id: string | null
  member_id: string | null
  period: PlanPeriod
  provider: string
  provider_ref: string | null
  /** Satın alanın hesabı: veriler silinse de üyelik bu hesapta kalır. */
  owner_user_id: string | null
  started_at: string
  expires_at: string
  created_at: string
}

export type AdminSnapshot = {
  disputes: Pick<DisputeRow, 'id' | 'couple_id' | 'status' | 'created_at'>[]
  members: Pick<MemberRow, 'couple_id' | 'role'>[]
  couples: Pick<CoupleRow, 'id' | 'mode'>[]
  surveys: Pick<AnswerRow, 'selected_tags' | 'updated_at'>[]
}

export type BetaClaimKind = 'free' | 'code' | 'device' | 'ip'

export type AccessCodeRow = {
  id: string
  code_hash: string
  label: string
  uses_total: number
  uses_left: number
  couple_id: string | null
  redeemed_at: string | null
  created_at: string
}

export type DeletionRequestRow = {
  id: string
  couple_id: string
  requested_by: string
  created_at: string
}

export interface Store {
  readonly kind: 'supabase' | 'memory'

  createCouple(input: {
    code: string
    name: string
    mode: CoupleMode
    partner_name: string | null
  }): Promise<CoupleRow | 'code_taken'>
  getCouple(id: string): Promise<CoupleRow | null>
  getCoupleByCode(code: string): Promise<CoupleRow | null>
  listMembers(coupleId: string): Promise<MemberRow[]>
  addMember(
    input: Omit<MemberRow, 'id' | 'joined_at' | 'auth_user_id' | 'email'> &
      Partial<Pick<MemberRow, 'auth_user_id' | 'email'>>,
  ): Promise<MemberRow | 'role_taken'>
  getMemberByTokenHash(hash: string): Promise<MemberRow | null>
  getMemberByAuthUser(userId: string): Promise<MemberRow | null>
  /** Üyeyi hesaba bağlar; hesap başka bir üyeye bağlıysa 'taken'. */
  linkMemberAuth(memberId: string, userId: string, email: string | null): Promise<'ok' | 'taken'>

  listDisputes(coupleId: string): Promise<DisputeRow[]>
  /** Tüm uygulamada bu andan sonra açılan mesele sayısı (test sürümü kontenjanı) */
  countDisputesSince(iso: string): Promise<number>
  /** Yönetim sayacı için özet veri */
  adminSnapshot(): Promise<AdminSnapshot>

  // Test sürümü: kullanım kayıtları (çiftten bağımsız), erişim kodları, bekleme listesi
  addBetaClaims(rows: { kind: BetaClaimKind; key_hash: string | null; couple_id: string | null }[]): Promise<void>
  /** since: yalnızca o andan sonraki kayıtlar; exceptCouple: o çiftin kendi kayıtları sayılmaz. */
  hasBetaClaim(kind: BetaClaimKind, keyHash: string, opts?: { since?: string; exceptCouple?: string }): Promise<boolean>
  countBetaClaims(kind: BetaClaimKind, since: string): Promise<number>
  coupleHasClaim(coupleId: string, kind: BetaClaimKind): Promise<boolean>
  createAccessCode(input: { code_hash: string; label: string; uses_total: number }): Promise<AccessCodeRow>
  listAccessCodes(): Promise<AccessCodeRow[]>
  /** Kodu çifte bağlar (kod boştaysa ya da zaten bu çiftinse). Bağlanamazsa null. */
  bindAccessCode(codeHash: string, coupleId: string): Promise<AccessCodeRow | null>
  /** Çiftin kodlarında kalan toplam hak */
  codeUsesLeft(coupleId: string): Promise<number>
  /** Bir hak düşer; kalan hak sayısı ya da hak yoksa null */
  consumeAccessCode(coupleId: string): Promise<number | null>
  addToWaitlist(email: string): Promise<void>
  countWaitlist(): Promise<{ count: number; latest: { email: string; created_at: string }[] }>
  getDispute(id: string): Promise<DisputeRow | null>
  createDispute(input: { couple_id: string; created_by: string; title: string }): Promise<DisputeRow>
  deleteDispute(id: string): Promise<void>
  setDisputeTitle(id: string, title: string): Promise<void>
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

  /** Tüm veriyi siler (meseleler, cevaplar, raporlar, üyeler). Üyelik satırı kalır. */
  deleteCouple(coupleId: string): Promise<void>
  setMemberTokenHash(memberId: string, hash: string): Promise<void>

  // Üyelik
  getActiveSubscription(coupleId: string, now: string): Promise<SubscriptionRow | null>
  /** Bu çift için (deneme dahil) hiç üyelik kaydı oluştu mu? */
  hasAnySubscription(coupleId: string): Promise<boolean>
  createSubscription(
    input: Pick<
      SubscriptionRow,
      'couple_id' | 'member_id' | 'period' | 'provider' | 'provider_ref' | 'expires_at' | 'owner_user_id'
    >,
  ): Promise<SubscriptionRow>
  extendSubscription(id: string, expiresAt: string): Promise<void>
  /** Çift silinince sahipsiz kalan, süresi dolmamış üyelikleri aynı hesabın yeni çiftine bağlar. */
  claimOrphanSubscriptions(userId: string, coupleId: string, memberId: string, now: string): Promise<number>

  // Silme talebi
  getDeletionRequest(coupleId: string): Promise<DeletionRequestRow | null>
  createDeletionRequest(coupleId: string, memberId: string): Promise<DeletionRequestRow | 'exists'>
  deleteDeletionRequest(coupleId: string): Promise<void>

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

  // Supabase bilgileri varsa her zaman Supabase kullanılır (MESELE_STORE=memory yalnızca Supabase yokken geçerli).
  if (url && serviceKey) {
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
