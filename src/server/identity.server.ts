import '@tanstack/react-start/server-only'
import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fail } from './errors.server'
import { sendMail, smtpConfig } from './mail.server'
import { dataDir, getStore } from './store.server'
import type { SqliteStore } from './store-sqlite.server'

/**
 * Hesap doğrulama: Apple, Google ya da e-postaya gelen 6 haneli kod.
 *
 * Üç kip:
 * - supabase: SUPABASE_URL + anahtar varsa Supabase Auth (e-posta kodu, Google, Apple).
 * - smtp: kendi sunucumuz (cPanel). Kod SQLite'ta (yalnızca hash'i, 10 dk, 5 deneme) tutulur ve
 *   SMTP ile e-postalanır. Yalnızca e-posta koduyla giriş vardır.
 * - mock: yerel geliştirme / testler. Kod her zaman 123456'dır, Google girişi tek tıkla biter.
 *   Üretimde (NODE_ENV=production) yalnızca MESELE_AUTH_MOCK=1 ile açılır; aksi hâlde giriş kapalıdır.
 *
 * Uygulama kendi oturumunu (cihaz token'ı) yönetir; burada yalnızca "bu kişi bu e-postanın
 * sahibi" doğrulanır ve kalıcı bir kullanıcı kimliği (auth_user_id) üretilir.
 */

export type Identity = { userId: string; email: string | null }
export type OAuthProvider = 'google' | 'apple'

export const MOCK_EMAIL_CODE = '123456'

function supabase() {
  const url = process.env.SUPABASE_URL?.trim().replace(/\/+$/, '')
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  return url && key ? { url, key } : null
}

export type AuthMode = 'supabase' | 'smtp' | 'mock' | 'off'

export function authMode(): AuthMode {
  if (supabase()) return 'supabase'
  if (smtpConfig()) return 'smtp'
  if (process.env.NODE_ENV !== 'production' || process.env.MESELE_AUTH_MOCK === '1') return 'mock'
  return 'off'
}

/** Arayüz için: hangi giriş yöntemleri açık? */
export const authOptions = () => {
  const mode = authMode()
  return { email: mode !== 'off', google: mode === 'supabase' || mode === 'mock' }
}

const OFF_MESSAGE = 'Hesapla giriş şu an kapalı. Uygulamayı hesapsız kullanmaya devam edebilirsiniz.'
const CODE_TTL_MS = 10 * 60 * 1000
const CODE_ATTEMPTS = 5

const codeHash = (email: string, code: string) =>
  createHash('sha256').update(`mesele-code:${email}:${code}`).digest('hex')

/** Kendi kipimizde e-postadan türeyen kalıcı kullanıcı kimliği. */
function emailUserId(email: string) {
  const h = createHash('sha256').update(`mesele-email:${email}`).digest('hex')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-b${h.slice(17, 20)}-${h.slice(20, 32)}`
}

async function sqlite(): Promise<SqliteStore> {
  const store = await getStore()
  if (store.kind !== 'sqlite') return fail('CONFIG', OFF_MESSAGE)
  return store as SqliteStore
}

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
  const mode = authMode()
  if (mode === 'off') fail('CONFIG', OFF_MESSAGE)
  if (mode === 'mock') {
    console.info(`[mesele] (geliştirme) ${email} için giriş kodu: ${MOCK_EMAIL_CODE}`)
    return { email }
  }
  if (mode === 'smtp') {
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0')
    await (await sqlite()).saveEmailCode(email, codeHash(email, code), new Date(Date.now() + CODE_TTL_MS).toISOString())
    try {
      await sendMail(smtpConfig()!, {
        to: email,
        subject: `MESELE giriş kodunuz: ${code}`,
        text: `Merhaba,\n\nMESELE giriş kodunuz: ${code}\n\nKod 10 dakika geçerlidir. Bu isteği siz yapmadıysanız bu e-postayı yok sayabilirsiniz.\n\nMESELE`,
      })
    } catch (e) {
      console.error('[mesele] e-posta gönderilemedi:', e instanceof Error ? e.message : e)
      fail('INTERNAL', 'Kod e-postası gönderilemedi. Lütfen biraz sonra tekrar deneyin.')
    }
    return { email }
  }
  await call('otp', { email, create_user: true })
  return { email }
}

export async function verifyEmailCode(rawEmail: string, rawCode: string): Promise<Identity> {
  const email = normalizeEmail(rawEmail)
  const code = rawCode.replace(/\D/g, '')
  if (code.length < 6) fail('VALIDATION', 'E-postanıza gelen 6 haneli kodu yazın.')
  const mode = authMode()
  if (mode === 'off') fail('CONFIG', OFF_MESSAGE)
  if (mode === 'mock') {
    if (code !== MOCK_EMAIL_CODE) fail('VALIDATION', 'Kod hatalı ya da süresi dolmuş. Yeni bir kod isteyebilirsiniz.')
    return { userId: mockUserId(email), email }
  }
  if (mode === 'smtp') {
    const r = await (await sqlite()).checkEmailCode(email, codeHash(email, code.slice(0, 6)), CODE_ATTEMPTS)
    if (r !== 'ok') fail('VALIDATION', 'Kod hatalı ya da süresi dolmuş. Yeni bir kod isteyebilirsiniz.')
    return { userId: emailUserId(email), email }
  }
  return identityFrom(await call<AuthResponse>('verify', { type: 'email', email, token: code }))
}

/**
 * Apple / Google girişini başlatan adres (PKCE). Kullanıcı sağlayıcıda onay verince
 * `redirectTo?code=...` adresine döner; istemci kodu ve doğrulayıcıyı bize gönderir.
 */
export function oauthUrl(provider: OAuthProvider, redirectTo: string, codeChallenge: string) {
  if (!/^[A-Za-z0-9_-]{43,128}$/.test(codeChallenge)) fail('VALIDATION', 'Geçersiz giriş isteği.')
  if (!authOptions().google) fail('CONFIG', 'Google ile giriş şu an kapalı; e-postanızla giriş yapabilirsiniz.')
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
  if (!authOptions().google) fail('CONFIG', 'Google ile giriş şu an kapalı; e-postanızla giriş yapabilirsiniz.')
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

/**
 * Bilet imza anahtarı: MESELE_SECRET ya da veri klasöründeki secret.key (ilk açılışta üretilir).
 * Böylece birden çok sunucu süreci (Passenger) ve yeniden başlatmalar aynı anahtarı kullanır.
 * İkisi de yoksa (testler) süreç başına rastgele anahtar.
 */
let secretCache: Buffer | null = null
function ticketKey(): Buffer {
  if (secretCache) return secretCache
  const env = process.env.MESELE_SECRET?.trim()
  if (env) return (secretCache = createHash('sha256').update(env).digest())
  if (process.env.NODE_ENV === 'production') {
    const file = join(dataDir(), 'secret.key')
    try {
      return (secretCache = Buffer.from(readFileSync(file, 'utf8').trim(), 'hex'))
    } catch {
      try {
        mkdirSync(dataDir(), { recursive: true })
        const fresh = randomBytes(32)
        writeFileSync(file, fresh.toString('hex'), { flag: 'wx', mode: 0o600 })
        return (secretCache = fresh)
      } catch {
        // Başka bir süreç aynı anda yazdıysa onu oku.
        try {
          return (secretCache = Buffer.from(readFileSync(file, 'utf8').trim(), 'hex'))
        } catch {
          // yazılamıyorsa süreç başına anahtar
        }
      }
    }
  }
  return (secretCache = randomBytes(32))
}

const b64 = (b: Buffer | string) => Buffer.from(b).toString('base64url')

export function issueTicket(identity: Identity) {
  const payload = b64(JSON.stringify({ u: identity.userId, e: identity.email, x: Date.now() + TICKET_TTL_MS }))
  const sig = b64(createHmac('sha256', ticketKey()).update(payload).digest())
  return `${payload}.${sig}`
}

export function readTicket(ticket: string | undefined | null): Identity | null {
  if (!ticket) return null
  const [payload, sig] = ticket.split('.')
  if (!payload || !sig) return null
  const expected = createHmac('sha256', ticketKey()).update(payload).digest()
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
