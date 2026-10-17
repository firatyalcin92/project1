import '@tanstack/react-start/server-only'
import {
  DEFAULT_PRICES,
  FREE_DISPUTES,
  PLAN_PERIODS,
  TRIAL_DAYS,
  addDays,
  addPeriod,
  parsePrice,
  type PaymentMode,
  type SalePeriod,
} from '~/lib/plans'
import type { DeletionView, MembershipView } from '~/lib/views'
import type { AuthedMember } from './auth.server'
import { CODE_ALPHABET, hashMemberToken } from './crypto.server'
import { fail } from './errors.server'
import { getStore, type DisputeRow, type SubscriptionRow } from './store.server'

/**
 * Üyelik (çift düzeyinde), üyelik aktarımı ve "tüm verileri sil" talebi.
 *
 * - Bir mesele ücretsizdir. Sonraki meseleler açılabilir, ama 1. sorudan sonrası için aktif
 *   üyelik gerekir (teklif o noktada gösterilir).
 * - Yıllık üyelik çift başına bir kez 3 gün ücretsiz denenebilir (provider = 'trial').
 * - Çiftlerden birinin satın alması ikisine de yeter.
 * - Veriler silinse bile üyelik satırı kalır; satın alan kişi bir aktarım koduyla
 *   kalan süreyi yeni bir çifte ya da bireysel hesaba taşıyabilir.
 */

const nowIso = () => new Date().toISOString()

export function paymentMode(env: NodeJS.ProcessEnv = process.env): PaymentMode {
  return env.MESELE_PAYMENTS?.trim().toLowerCase() === 'test' ? 'test' : 'none'
}

export function prices(env: NodeJS.ProcessEnv = process.env): Record<SalePeriod, number | null> {
  return {
    monthly: parsePrice(env.MESELE_PRICE_MONTHLY) ?? DEFAULT_PRICES.monthly,
    yearly: parsePrice(env.MESELE_PRICE_YEARLY) ?? DEFAULT_PRICES.yearly,
  }
}

const TRIAL_PROVIDER = 'trial'

/** Ücretsiz hakla açılan meseleler: çiftin en eski FREE_DISPUTES meselesi. */
export function isFreeDispute(d: Pick<DisputeRow, 'id'>, all: Pick<DisputeRow, 'id' | 'created_at'>[]) {
  const oldest = [...all].sort((a, b) => a.created_at.localeCompare(b.created_at)).slice(0, FREE_DISPUTES)
  return oldest.some((x) => x.id === d.id)
}

/** Bu meselede 1. sorudan sonrası için üyelik gerekiyor mu? */
export async function disputeAccess(d: DisputeRow) {
  const store = await getStore()
  const [sub, all] = await Promise.all([
    store.getActiveSubscription(d.couple_id, nowIso()),
    store.listDisputes(d.couple_id),
  ])
  const free = isFreeDispute(d, all)
  return { free, paywall: !free && !sub }
}

export const PAYWALL_MESSAGE =
  'Ücretsiz meselenizi kullandınız. Bu meseleye devam etmek için aylık ya da yıllık üyeliğinizi başlatın; anlattıklarınız kayıtlı.'

/** Okunaklı tek kullanımlık kod: XXXX-XXXX(-XXXX). Karışan karakterler yok. */
export function generateReadableCode(length: number) {
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  const raw = Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('')
  return raw.match(/.{1,4}/g)!.join('-')
}

export const normalizeReadableCode = (raw: string) => raw.replace(/[\s-]/g, '').toUpperCase()

export const hashReadableCode = (raw: string) => hashMemberToken(`mesele:${normalizeReadableCode(raw)}`)

export async function membershipFor(coupleId: string, memberId: string): Promise<MembershipView> {
  const store = await getStore()
  const [sub, disputes, everSubscribed] = await Promise.all([
    store.getActiveSubscription(coupleId, nowIso()),
    store.listDisputes(coupleId),
    store.hasAnySubscription(coupleId),
  ])
  return {
    active: Boolean(sub),
    period: sub?.period ?? null,
    expiresAt: sub?.expires_at ?? null,
    purchasedByMe: Boolean(sub && sub.member_id === memberId),
    trial: sub?.provider === TRIAL_PROVIDER,
    trialAvailable: !everSubscribed,
    trialDays: TRIAL_DAYS,
    freeLimit: FREE_DISPUTES,
    disputesUsed: disputes.length,
    nextDisputeFree: Boolean(sub) || disputes.length < FREE_DISPUTES,
    payments: paymentMode(),
    prices: prices(),
  }
}

export async function purchase(
  member: AuthedMember,
  input: { period: SalePeriod; keyBackedUp: boolean; codeSaved: boolean; trial?: boolean },
): Promise<MembershipView> {
  if (!PLAN_PERIODS.includes(input.period)) fail('VALIDATION', 'Geçersiz üyelik süresi.')
  if (input.trial && input.period !== 'yearly') fail('VALIDATION', 'Ücretsiz deneme yalnızca yıllık üyelikte var.')
  const store = await getStore()
  const [couple, members] = await Promise.all([store.getCouple(member.coupleId), store.listMembers(member.coupleId)])
  if (!couple) return fail('UNAUTHORIZED', 'Çift bulunamadı.')

  // Kayıtlarınızı kaybetmemeniz için: anahtar yedeği ve çift kodu güvende olmalı.
  if (!input.keyBackedUp) fail('VALIDATION', 'Üyelik almadan önce cihaz anahtarınızı yedekleyin.')
  const partnerJoined = members.length > 1
  if (couple.mode === 'couple' && !partnerJoined && !input.codeSaved) {
    fail('VALIDATION', 'Çift kodunuzu partnerinizle paylaşın ya da güvenli bir yere kaydettiğinizi onaylayın.')
  }

  if (paymentMode() !== 'test') {
    fail('CONFIG', 'Ödeme altyapısı henüz bağlanmadı. Üyelik çok yakında açılacak; o zamana kadar bekleriz.')
  }

  const active = await store.getActiveSubscription(member.coupleId, nowIso())
  if (input.trial) {
    if (await store.hasAnySubscription(member.coupleId))
      fail('CONFLICT', 'Ücretsiz deneme hakkınızı kullandınız; aylık ya da yıllık üyelik seçebilirsiniz.')
    await store.createSubscription({
      couple_id: member.coupleId,
      member_id: member.id,
      period: 'yearly',
      provider: TRIAL_PROVIDER,
      provider_ref: null,
      expires_at: addDays(nowIso(), TRIAL_DAYS),
    })
  } else if (active?.provider === TRIAL_PROVIDER) {
    // Deneme sırasında satın alma: kalan deneme günleri korunur, üyelik onun üstüne başlar.
    await store.createSubscription({
      couple_id: member.coupleId,
      member_id: member.id,
      period: input.period,
      provider: 'test',
      provider_ref: null,
      expires_at: addPeriod(active.expires_at, input.period),
    })
  } else if (active) {
    await store.extendSubscription(active.id, addPeriod(active.expires_at, input.period))
  } else {
    await store.createSubscription({
      couple_id: member.coupleId,
      member_id: member.id,
      period: input.period,
      provider: 'test',
      provider_ref: null,
      expires_at: addPeriod(nowIso(), input.period),
    })
  }
  return membershipFor(member.coupleId, member.id)
}

/** Satın alan kişiye, kalan süreyi taşıyabilmesi için tek seferlik aktarım kodu üretir. */
async function issueTransferCode(sub: SubscriptionRow | null, memberId: string) {
  // Ücretsiz deneme aktarılmaz.
  if (!sub || sub.member_id !== memberId || sub.provider === TRIAL_PROVIDER) return null
  const code = generateReadableCode(12)
  const store = await getStore()
  await store.setSubscriptionTransfer(sub.id, await hashReadableCode(code))
  return code
}

/** Silinen bir çiftten kalan üyeliği bu çifte bağlar. */
export async function claimTransfer(member: AuthedMember, code: string): Promise<MembershipView> {
  const clean = normalizeReadableCode(code)
  if (!/^[A-HJ-NP-Z2-9]{12}$/.test(clean)) fail('VALIDATION', 'Aktarım kodu 12 karakterdir (ör. ABCD-EFGH-JKLM).')
  const store = await getStore()
  const claimed = await store.claimSubscription(await hashReadableCode(clean), member.coupleId, member.id, nowIso())
  if (!claimed) fail('NOT_FOUND', 'Bu kodla aktarılabilecek bir üyelik bulunamadı ya da süresi dolmuş.')
  return membershipFor(member.coupleId, member.id)
}

// ---------------------------------------------------------------------------
// Tüm verileri sil
// ---------------------------------------------------------------------------

export async function deletionFor(coupleId: string, memberId: string): Promise<DeletionView> {
  const store = await getStore()
  const req = await store.getDeletionRequest(coupleId)
  if (!req) return null
  const requester = (await store.listMembers(coupleId)).find((m) => m.id === req.requested_by)
  return {
    requestedByMe: req.requested_by === memberId,
    requesterName: requester?.display_name ?? null,
    requestedAt: req.created_at,
  }
}

export type DeletionResult = { deleted: boolean; transferCode: string | null }

async function execute(member: AuthedMember): Promise<DeletionResult> {
  const store = await getStore()
  const sub = await store.getActiveSubscription(member.coupleId, nowIso())
  const transferCode = await issueTransferCode(sub, member.id)
  await store.deleteCouple(member.coupleId)
  return { deleted: true, transferCode }
}

/**
 * Bireysel modda ya da partner henüz katılmadıysa hemen silinir. Çift modunda
 * partnerin onayı beklenir.
 */
export async function requestDeletion(member: AuthedMember): Promise<DeletionResult> {
  const store = await getStore()
  const [couple, members] = await Promise.all([store.getCouple(member.coupleId), store.listMembers(member.coupleId)])
  if (!couple) return fail('UNAUTHORIZED', 'Çift bulunamadı.')
  if (couple.mode === 'solo' || members.length < 2) return execute(member)

  const created = await store.createDeletionRequest(member.coupleId, member.id)
  if (created === 'exists') fail('CONFLICT', 'Zaten bekleyen bir silme talebi var.')
  // Satın alan talep ediyorsa aktarım kodunu şimdi alır (silme partner onaylayınca olur).
  const sub = await store.getActiveSubscription(member.coupleId, nowIso())
  return { deleted: false, transferCode: await issueTransferCode(sub, member.id) }
}

/** Partner onaylarsa tüm veriler silinir. */
export async function approveDeletion(member: AuthedMember): Promise<DeletionResult> {
  const store = await getStore()
  const req = await store.getDeletionRequest(member.coupleId)
  if (!req) return fail('NOT_FOUND', 'Bekleyen bir silme talebi yok.')
  if (req.requested_by === member.id) fail('CONFLICT', 'Silme talebini partnerinizin onaylaması gerekiyor.')
  return execute(member)
}

/** Talep eden vazgeçer ya da partner onaylamaz. */
export async function dismissDeletion(member: AuthedMember): Promise<DeletionView> {
  const store = await getStore()
  await store.deleteDeletionRequest(member.coupleId)
  return null
}
