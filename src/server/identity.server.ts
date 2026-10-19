import '@tanstack/react-start/server-only'
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { fail } from './errors.server'

/**
 * Hesap doğrulama: Apple, Google ya da e-postaya gelen 6 haneli kod.
 *
 * Üretimde Supabase Auth kullanılır (SUPABASE_URL + anahtar). Uygulama kendi oturumunu
 * (cihaz token'ı) yönetmeye devam eder; Supabase yalnızca "bu kişi gerçekten bu hesabın
 * sahibi" doğrulamasını yapar ve kalıcı bir kullanıcı kimliği (auth_user_id) verir.
 *
 * Supabase tanımlı değilse (yerel geliştirme / testler) sahte sağlayıcı çalışır:
 * e-posta kodu her zaman 123456'dır ve Apple/Google girişi tek tıkla tamamlanır.
 * Üretimde Supabase her zaman tanımlı olduğundan sahte sağlayıcı orada çalışmaz.
 */

export type Identity = { userId: string; email: string | null }
export type OAuthProvider = 'google' | 'apple'

export const MOCK_EMAIL_CODE = '123456'

function supabase() {
  const url = process.env.SUPABASE_URL?.trim().replace(/\/+$/, '')
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  return url && key ? { url, key } : null
}

export const authMode = () => (supabase() ? 'supabase' : 'mock')

/** Sahte sağlayıcı için kalıcı kullanıcı kimliği (aynı e-posta → aynı kimlik). */
function mockUserId(seed: string) {
  const h = createHash('sha256').update(`mesele-mock:${seed}`).digest('hex')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`
}

async function call<T>(path: string, body: unknown): Promise<T> {
  const s = supabase()!
  let res: Response
  try {
    res = await fetch(`${s.url}/auth/v1/${path}`, {
      method: 'POST',
      headers: { apikey: s.key, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    return fail('INTERNAL', 'Giriş hizmetine ulaşılamadı. Lütfen tekrar deneyin.')
  }
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) {
    const code = String(data.error_code ?? data.code ?? res.status)
    console.error(
      `[mesele] auth ${path}: [${code}] ${String(data.msg ?? data.message ?? data.error_description ?? '')}`,
    )
    if (res.status === 429 || code === 'over_email_send_rate_limit')
      fail('RATE_LIMITED', 'Çok sık deneme yapıldı. Birkaç dakika sonra tekrar deneyin.')
    if (code === 'otp_expired' || code === 'invalid_credentials' || res.status === 403)
      fail('VALIDATION', 'Kod hatalı ya da süresi dolmuş. Yeni bir kod isteyebilirsiniz.')
    if (code === 'email_provider_disabled' || code === 'provider_disabled' || code === 'validation_failed')
      fail('CONFIG', 'Bu giriş yöntemi henüz açılmadı.')
    fail('INTERNAL', 'Giriş tamamlanamadı. Lütfen tekrar deneyin.')
  }
  return data as T
}

type AuthResponse = { user?: { id?: string; email?: string | null } }

function identityFrom(r: AuthResponse): Identity {
  const id = r.user?.id
  if (!id) return fail('INTERNAL', 'Giriş tamamlanamadı. Lütfen tekrar deneyin.')
  return { userId: id, email: r.user?.email?.toLowerCase() ?? null }
}

export function normalizeEmail(raw: string) {
  const email = raw.trim().toLowerCase()
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email))
    fail('VALIDATION', 'Geçerli bir e-posta adresi yazar mısınız?')
  return email
}

/** E-postaya 6 haneli giriş kodu gönderir. */
export async function sendEmailCode(rawEmail: string) {
  const email = normalizeEmail(rawEmail)
  if (authMode() === 'mock') {
    console.info(`[mesele] (geliştirme) ${email} için giriş kodu: ${MOCK_EMAIL_CODE}`)
    return { email }
  }
  await call('otp', { email, create_user: true })
  return { email }
}

export async function verifyEmailCode(rawEmail: string, rawCode: string): Promise<Identity> {
  const email = normalizeEmail(rawEmail)
  const code = rawCode.replace(/\D/g, '')
  if (code.length < 6) fail('VALIDATION', 'E-postanıza gelen 6 haneli kodu yazın.')
  if (authMode() === 'mock') {
    if (code !== MOCK_EMAIL_CODE) fail('VALIDATION', 'Kod hatalı ya da süresi dolmuş. Yeni bir kod isteyebilirsiniz.')
    return { userId: mockUserId(email), email }
  }
  return identityFrom(await call<AuthResponse>('verify', { type: 'email', email, token: code }))
}

/**
 * Apple / Google girişini başlatan adres (PKCE). Kullanıcı sağlayıcıda onay verince
 * `redirectTo?code=...` adresine döner; istemci kodu ve doğrulayıcıyı bize gönderir.
 */
export function oauthUrl(provider: OAuthProvider, redirectTo: string, codeChallenge: string) {
  if (!/^[A-Za-z0-9_-]{43,128}$/.test(codeChallenge)) fail('VALIDATION', 'Geçersiz giriş isteği.')
  const s = supabase()
  if (!s) {
    // Sahte sağlayıcı: onay ekranı yok, doğrudan geri dönüş.
    const u = new URL(redirectTo)
    u.searchParams.set('code', `mock-${provider}`)
    return u.toString()
  }
  const u = new URL(`${s.url}/auth/v1/authorize`)
  u.searchParams.set('provider', provider)
  u.searchParams.set('redirect_to', redirectTo)
  u.searchParams.set('code_challenge', codeChallenge)
  u.searchParams.set('code_challenge_method', 's256')
  return u.toString()
}

export async function finishOAuth(code: string, verifier: string): Promise<Identity> {
  if (authMode() === 'mock') {
    const m = /^mock-(google|apple)$/.exec(code)
    if (!m) fail('VALIDATION', 'Giriş tamamlanamadı. Lütfen tekrar deneyin.')
    const email = `deneme-${m![1]}@ornek.com`
    return { userId: mockUserId(email), email }
  }
  if (!/^[A-Za-z0-9_-]{43,128}$/.test(verifier)) fail('VALIDATION', 'Giriş tamamlanamadı. Lütfen tekrar deneyin.')
  return identityFrom(await call<AuthResponse>('token?grant_type=pkce', { auth_code: code, code_verifier: verifier }))
}

// ---------------------------------------------------------------------------
// Hesabı doğrulanmış ama henüz bir çifti olmayan kişi için kısa ömürlü bilet:
// "Bu hesapla kayıt yok" → adlarını yazıp başladığında hesap kendiliğinden bağlanır.
// ---------------------------------------------------------------------------

const TICKET_TTL_MS = 30 * 60 * 1000
// Sunucu yeniden başlayınca biletler geçersiz olur (30 dakikalık bir köprü için yeterli).
const ticketSecret = randomBytes(32)

const b64 = (b: Buffer | string) => Buffer.from(b).toString('base64url')

export function issueTicket(identity: Identity) {
  const payload = b64(JSON.stringify({ u: identity.userId, e: identity.email, x: Date.now() + TICKET_TTL_MS }))
  const sig = b64(createHmac('sha256', ticketSecret).update(payload).digest())
  return `${payload}.${sig}`
}

export function readTicket(ticket: string | undefined | null): Identity | null {
  if (!ticket) return null
  const [payload, sig] = ticket.split('.')
  if (!payload || !sig) return null
  const expected = createHmac('sha256', ticketSecret).update(payload).digest()
  const given = Buffer.from(sig, 'base64url')
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null
  try {
    const p = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { u: string; e: string | null; x: number }
    if (typeof p.u !== 'string' || p.x < Date.now()) return null
    return { userId: p.u, email: p.e ?? null }
  } catch {
    return null
  }
}
