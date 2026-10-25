import '@tanstack/react-start/server-only'
import { fail } from './errors.server'
import { getStore } from './store.server'

/**
 * Ücretsiz test sürümü (varsayılan açık; MESELE_BETA=0 ile kapanır).
 * - Ödeme ve teklif ekranları gizlenir, her şey ücretsizdir.
 * - Her çift yalnızca bir mesele açabilir.
 * - Tüm uygulamada günde en fazla MESELE_DAILY_LIMIT (varsayılan 3) yeni mesele açılır;
 *   gün İstanbul saatiyle gece yarısı yenilenir. Böylece yapay zekâ harcaması sınırlı kalır.
 */

export const betaMode = (env: NodeJS.ProcessEnv = process.env) => env.MESELE_BETA?.trim() !== '0'

export function dailyLimit(env: NodeJS.ProcessEnv = process.env) {
  const n = Number(env.MESELE_DAILY_LIMIT ?? 3)
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 3
}

/** İstanbul saatiyle bugünün başlangıcı (UTC+3, yaz saati yok). */
export function istanbulDayStart(now = Date.now()) {
  const offset = 3 * 60 * 60 * 1000
  const day = Math.floor((now + offset) / 86_400_000) * 86_400_000
  return new Date(day - offset).toISOString()
}

export type BetaStatus = { beta: boolean; limit: number; remaining: number; open: boolean }

export async function betaStatus(): Promise<BetaStatus> {
  if (!betaMode()) return { beta: false, limit: 0, remaining: 0, open: true }
  const store = await getStore()
  const used = await store.countDisputesSince(istanbulDayStart())
  const limit = dailyLimit()
  const remaining = Math.max(0, limit - used)
  return { beta: true, limit, remaining, open: remaining > 0 }
}

export const QUOTA_MESSAGE =
  'Test sürümünde günlük kontenjan doldu. Yarın tekrar deneyebilirsiniz; ilginiz için teşekkürler.'
export const ONE_PER_COUPLE_MESSAGE = 'Test sürümünde her çift bir mesele açabilir. İlginiz için teşekkür ederiz.'

/** Test sürümünde yeni mesele açılabilir mi? */
export async function assertBetaCanCreate(coupleId: string) {
  if (!betaMode()) return
  const store = await getStore()
  if ((await store.listDisputes(coupleId)).length >= 1) fail('CONFLICT', ONE_PER_COUPLE_MESSAGE)
  if (!(await betaStatus()).open) fail('QUOTA_FULL', QUOTA_MESSAGE)
}
