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
import { fail } from './errors.server'
import { getStore, type DisputeRow } from './store.server'

/**
 * Üyelik (çift düzeyinde), üyelik aktarımı ve "tüm verileri sil" talebi.
 *
 * - Bir mesele ücretsizdir. Sonraki meseleler açılabilir, ama 1. sorudan sonrası için aktif
 *   üyelik gerekir (teklif o noktada gösterilir).
 * - Yıllık üyelik çift başına bir kez 3 gün ücretsiz denenebilir (provider = 'trial').
 * - Çiftlerden birinin satın alması ikisine de yeter.
 * - Üyelik satın alanın hesabına bağlıdır (owner_user_id). Veriler silinse bile satır kalır;
 *   aynı hesapla yeni bir çift ya da bireysel kullanım başlatılınca kendiliğinden bağlanır.
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
  input: { period: SalePeriod; trial?: boolean },
): Promise<MembershipView> {
  if (!PLAN_PERIODS.includes(input.period)) fail('VALIDATION', 'Geçersiz üyelik süresi.')
  if (input.trial && input.period !== 'yearly') fail('VALIDATION', 'Ücretsiz deneme yalnızca yıllık üyelikte var.')
  const store = await getStore()
  const me = (await store.listMembers(member.coupleId)).find((m) => m.id === member.id)
  if (!me) return fail('UNAUTHORIZED', 'Hesap bulunamadı.')

  // Üyelik hesaba bağlanır: telefon değişse ya da veriler silinse de kaybolmaz.
  if (!me.auth_user_id) fail('ACCOUNT_REQUIRED', 'Üyelik almadan önce hesabınızı kaydedin.')

  if (paymentMode() !== 'test') {
    fail('CONFIG', 'Ödeme altyapısı henüz bağlanmadı. Üyelik çok yakında açılacak; o zamana kadar bekleriz.')
  }

  const base = { couple_id: member.coupleId, member_id: member.id, provider_ref: null, owner_user_id: me.auth_user_id }
  const active = await store.getActiveSubscription(member.coupleId, nowIso())
  if (input.trial) {
    if (await store.hasAnySubscription(member.coupleId))
      fail('CONFLICT', 'Ücretsiz deneme hakkınızı kullandınız; aylık ya da yıllık üyelik seçebilirsiniz.')
    await store.createSubscription({
      ...base,
      period: 'yearly',
      provider: TRIAL_PROVIDER,
      expires_at: addDays(nowIso(), TRIAL_DAYS),
    })
  } else if (active?.provider === TRIAL_PROVIDER) {
    // Deneme sırasında satın alma: kalan deneme günleri korunur, üyelik onun üstüne başlar.
    await store.createSubscription({
      ...base,
      period: input.period,
      provider: 'test',
      expires_at: addPeriod(active.expires_at, input.period),
    })
  } else if (active) {
    await store.extendSubscription(active.id, addPeriod(active.expires_at, input.period))
  } else {
    await store.createSubscription({
      ...base,
      period: input.period,
      provider: 'test',
      expires_at: addPeriod(nowIso(), input.period),
    })
  }
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

/** membershipKept: açık üyelik bir hesaba bağlı; aynı hesapla yeniden başlayınca devam eder. */
export type DeletionResult = { deleted: boolean; membershipKept: boolean }

async function keptMembership(coupleId: string) {
  const store = await getStore()
  const sub = await store.getActiveSubscription(coupleId, nowIso())
  return Boolean(sub && sub.owner_user_id && sub.provider !== TRIAL_PROVIDER)
}

async function execute(member: AuthedMember): Promise<DeletionResult> {
  const store = await getStore()
  const membershipKept = await keptMembership(member.coupleId)
  await store.deleteCouple(member.coupleId)
  return { deleted: true, membershipKept }
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
  return { deleted: false, membershipKept: await keptMembership(member.coupleId) }
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
