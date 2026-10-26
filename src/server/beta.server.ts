import '@tanstack/react-start/server-only'
import { getRequestHeader, getRequestIP } from '@tanstack/react-start/server'
import { createHash } from 'node:crypto'
import { DEVICE_HEADER, DEVICE_PATTERN } from '~/lib/device'
import { CODE_ALPHABET } from './crypto.server'
import { fail } from './errors.server'
import { rateLimit } from './rate-limit.server'
import { getStore } from './store.server'

/**
 * Ücretsiz test sürümü (varsayılan açık; MESELE_BETA=0 ile kapanır).
 * - Ödeme ve teklif ekranları gizlenir, her şey ücretsizdir.
 * - Her çift yalnızca bir mesele açabilir.
 * - Tüm uygulamada günde en fazla MESELE_DAILY_LIMIT (varsayılan 3) yeni mesele açılır;
 *   gün İstanbul saatiyle gece yarısı yenilenir. Böylece yapay zekâ harcaması sınırlı kalır.
 * - Hak kişiye bağlıdır, çifte değil: ücretsiz mesele açan cihaz (ve 24 saat boyunca aynı IP
 *   adresi) yeniden çift kurup mesele açamaz; çıkış yapmak ya da verileri silmek hakkı yenilemez.
 *   Cihaz kimliği ve IP yalnızca hash'iyle saklanır (beta_claims).
 * - Erişim kodları: yönetici /yonetim'den N haklı kod üretir. Kod ilk kullanan çifte bağlanır;
 *   kodla açılan meseleler bu sınırlara ve günlük kontenjana takılmaz.
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
  const used = await store.countBetaClaims('free', istanbulDayStart())
  const limit = dailyLimit()
  const remaining = Math.max(0, limit - used)
  return { beta: true, limit, remaining, open: remaining > 0 }
}

export const QUOTA_MESSAGE =
  'Test sürümünde günlük kontenjan doldu. Yarın tekrar deneyebilirsiniz; ilginiz için teşekkürler.'
export const ONE_PER_COUPLE_MESSAGE = 'Test sürümünde her çift bir mesele açabilir. İlginiz için teşekkür ederiz.'
export const ALREADY_USED_MESSAGE =
  'Bu cihazdan ya da bağlantıdan ücretsiz test hakkı zaten kullanıldı. Bir erişim kodunuz varsa girerek devam edebilirsiniz.'

const IP_WINDOW_MS = 24 * 60 * 60 * 1000

function hashKey(kind: string, value: string) {
  const salt = process.env.MESELE_HASH_SALT?.trim() || 'mesele-test'
  return createHash('sha256').update(`${salt}:${kind}:${value}`).digest('hex')
}

/** İstekteki cihaz kimliği ve IP'nin hash'leri (istek bağlamı yoksa, ör. testlerde, null). */
export function requestKeys(): { device: string | null; ip: string | null } {
  let device: string | null = null
  let ip: string | null = null
  try {
    const raw = getRequestHeader(DEVICE_HEADER)
    if (raw && DEVICE_PATTERN.test(raw)) device = hashKey('device', raw)
  } catch {
    // istek bağlamı yok
  }
  try {
    const raw = getRequestIP({ xForwardedFor: true })
    if (raw) ip = hashKey('ip', raw)
  } catch {
    // istek bağlamı yok
  }
  return { device, ip }
}

export type Admission = 'free' | 'code' | 'open'

/**
 * Yeni mesele açılabilir mi? Açılabiliyorsa kullanım kaydını yazar.
 * Önce çiftin erişim kodundan hak düşülür; kod yoksa ücretsiz test hakkı denetlenir.
 */
export async function admitDispute(coupleId: string, keys = requestKeys()): Promise<Admission> {
  if (!betaMode()) return 'open'
  const store = await getStore()
  if ((await store.codeUsesLeft(coupleId)) > 0 && (await store.consumeAccessCode(coupleId)) !== null) {
    await store.addBetaClaims([{ kind: 'code', key_hash: null, couple_id: coupleId }])
    return 'code'
  }
  if ((await store.listDisputes(coupleId)).length >= 1) fail('CONFLICT', ONE_PER_COUPLE_MESSAGE)
  // Bu çift hakkını daha önce kullanıp meseleyi kapattıysa yeniden açabilir (yeni hak sayılmaz).
  if (await store.coupleHasClaim(coupleId, 'free')) return 'free'
  if (await usedElsewhere(coupleId, keys)) fail('BETA_USED', ALREADY_USED_MESSAGE)
  if (!(await betaStatus()).open) fail('QUOTA_FULL', QUOTA_MESSAGE)
  await store.addBetaClaims([
    { kind: 'free', key_hash: null, couple_id: coupleId },
    ...(keys.device ? [{ kind: 'device' as const, key_hash: keys.device, couple_id: coupleId }] : []),
    ...(keys.ip ? [{ kind: 'ip' as const, key_hash: keys.ip, couple_id: coupleId }] : []),
  ])
  return 'free'
}

/** Panel için: bu cihaz ya da bağlantı ücretsiz hakkı başka bir çiftte kullandı mı? */
export async function usedElsewhere(coupleId: string, keys = requestKeys()) {
  if (!betaMode()) return false
  const store = await getStore()
  if (await store.coupleHasClaim(coupleId, 'free')) return false
  // Bu çiftin kendi kayıtları (ör. partnerin katıldığı cihaz) sayılmaz.
  const exceptCouple = coupleId
  if (keys.device && (await store.hasBetaClaim('device', keys.device, { exceptCouple }))) return true
  const since = new Date(Date.now() - IP_WINDOW_MS).toISOString()
  return Boolean(keys.ip && (await store.hasBetaClaim('ip', keys.ip, { since, exceptCouple })))
}

/** Partnerin daveti kabul ettiği cihaz da test hakkını kullanmış sayılır. */
export async function claimJoinDevice(coupleId: string, keys = requestKeys()) {
  if (!betaMode() || !keys.device) return
  const store = await getStore()
  if (await store.hasBetaClaim('device', keys.device, { exceptCouple: coupleId })) return
  await store.addBetaClaims([{ kind: 'device', key_hash: keys.device, couple_id: coupleId }])
}

// ---------------------------------------------------------------------------
// Erişim kodları
// ---------------------------------------------------------------------------

/** MSL-XXXX-XXXX-XXXX: 12 karakter, 32 harfli alfabe → 60 bit; tahminle bulunamaz. */
export function generateAccessCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(12))
  const chars = Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('')
  return `MSL-${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8)}`
}

export function normalizeAccessCode(raw: string) {
  const v = raw.toUpperCase().replace(/[^A-Z0-9]/g, '')
  const body = v.startsWith('MSL') ? v.slice(3) : v
  return body.length === 12 ? `MSL-${body.slice(0, 4)}-${body.slice(4, 8)}-${body.slice(8)}` : null
}

export const accessCodeHash = (code: string) => createHash('sha256').update(`mesele-code:${code}`).digest('hex')

const BAD_CODE = 'Bu kod geçersiz ya da başka bir hesapta kullanılmış.'

/** Kodu bu çifte bağlar ve kalan hakkı döner. Deneme sayısı sınırlıdır. */
export async function redeemAccessCode(coupleId: string, raw: string): Promise<{ usesLeft: number }> {
  rateLimit('access-code', 8, 15 * 60_000)
  const code = normalizeAccessCode(raw)
  if (!code) fail('VALIDATION', BAD_CODE)
  const store = await getStore()
  const row = await store.bindAccessCode(accessCodeHash(code!), coupleId)
  if (!row) fail('VALIDATION', BAD_CODE)
  const usesLeft = await store.codeUsesLeft(coupleId)
  if (usesLeft <= 0) fail('VALIDATION', 'Bu kodun tüm hakları kullanılmış.')
  return { usesLeft }
}
