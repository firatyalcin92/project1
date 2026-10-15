import '@tanstack/react-start/server-only'
import { FREE_DISPUTES, PLAN_PERIODS, addPeriod, type PaymentMode, type PlanPeriod } from '~/lib/plans'
import type { DeletionView, MembershipView } from '~/lib/views'
import type { AuthedMember } from './auth.server'
import { CODE_ALPHABET, hashMemberToken } from './crypto.server'
import { fail } from './errors.server'
import { getStore, type SubscriptionRow } from './store.server'

/**
 * Üyelik (çift düzeyinde), üyelik aktarımı ve "tüm verileri sil" talebi.
 *
 * - Bir mesele ücretsizdir; sonrası için aktif üyelik gerekir.
 * - Çiftlerden birinin satın alması ikisine de yeter.
 * - Veriler silinse bile üyelik satırı kalır; satın alan kişi bir aktarım koduyla
 *   kalan süreyi yeni bir çifte ya da bireysel hesaba taşıyabilir.
 */

const nowIso = () => new Date().toISOString()

export function paymentMode(env: NodeJS.ProcessEnv = process.env): PaymentMode {
  return env.MESELE_PAYMENTS?.trim().toLowerCase() === 'test' ? 'test' : 'none'
}

function prices(env: NodeJS.ProcessEnv = process.env): Record<PlanPeriod, string | null> {
  const read = (v: string | undefined) => (v && v.trim() ? v.trim().slice(0, 40) : null)
  return {
    weekly: read(env.MESELE_PRICE_WEEKLY),
    monthly: read(env.MESELE_PRICE_MONTHLY),
    yearly: read(env.MESELE_PRICE_YEARLY),
  }
}

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
  const [sub, disputes] = await Promise.all([
    store.getActiveSubscription(coupleId, nowIso()),
    store.listDisputes(coupleId),
  ])
  return {
    active: Boolean(sub),
    period: sub?.period ?? null,
    expiresAt: sub?.expires_at ?? null,
    purchasedByMe: Boolean(sub && sub.member_id === memberId),
    freeLimit: FREE_DISPUTES,
    disputesUsed: disputes.length,
    canCreateDispute: Boolean(sub) || disputes.length < FREE_DISPUTES,
    payments: paymentMode(),
    prices: prices(),
  }
}

/** Yeni mesele açmadan önce: ücretsiz hak bittiyse üyelik gerekir. */
export async function assertCanCreateDispute(member: AuthedMember) {
  const m = await membershipFor(member.coupleId, member.id)
  if (!m.canCreateDispute) {
    fail(
      'PAYMENT_REQUIRED',
      `İlk meseleniz ücretsizdi. Yeni bir mesele açmak için üyeliğinizi başlatın; çiftlerden birinin alması ikiniz için de yeterli.`,
    )
  }
}

export async function purchase(
  member: AuthedMember,
  input: { period: PlanPeriod; keyBackedUp: boolean; codeSaved: boolean },
): Promise<MembershipView> {
  if (!PLAN_PERIODS.includes(input.period)) fail('VALIDATION', 'Geçersiz üyelik süresi.')
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
  if (active) {
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
  if (!sub || sub.member_id !== memberId) return null
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
