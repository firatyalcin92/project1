import '@tanstack/react-start/server-only'
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { z } from 'zod'
import { API_PREFIX, checkNameShape, cleanName, type ErrorCode, type Profile } from '../../../hopla/core/api'
import { isCountryCode } from '../../../hopla/core/countries'
import { MAX_HOLD_MS, MAX_JUMPS, SIM_VERSION, replayRun } from '../../../hopla/core/sim'
import { moderateWithAI, nameKey, screenName } from './names.server'
import { SetupRequired, getHoplaStore, type HoplaStore, type PlayerRow, type ProfilePatch } from './store.server'

/**
 * Hopla sıralama API'si (mevcut MESELE sunucusunda, /api/hopla/v1 altında).
 *
 *  GET   /health           Depo türü ve kurulum durumu (gizli bilgi yok)
 *  POST  /challenge        İsim kaydı için iş kanıtı (proof-of-work) bilmecesi
 *  POST  /players          İsim + ülke ile kayıt → cihaz anahtarı (yalnızca bir kez döner)
 *  GET   /players/me       Profil, rekor, dünya/ülke sırası          (Authorization: Bearer)
 *  PATCH /players/me       İsim/ülke değiştir (24 saatte en fazla 3) (Authorization: Bearer)
 *  POST  /runs             Oyun bileti: {seed} imzalanır, başlangıç zamanı kaydedilir
 *  POST  /scores           {ticket, holds, score} → sunucu oyunu yeniden oynatıp doğrular
 *  GET   /leaderboard      ?scope=world|country&country=TR&limit=50
 *  GET   /countries        Ülkeler: en iyi 10 oyuncunun rekor toplamı
 *  POST  /admin/ban        {name, banned} — x-admin-password başlığıyla isim kapatma
 *
 * Toplu isim almaya karşı: iş kanıtı, IP başına günlük kayıt sınırı (IP yalnızca tuzlu
 * özetiyle saklanır), cihaz başına tek isim (değiştirince eskisi serbest kalır), 24 saatte en
 * fazla 3 değişiklik ve 7 gün içinde hiç skor göndermeyen kayıtların silinmesi.
 * Hile karşı: skor, imzalı biletteki seed ve basılı tutma sürelerinden yeniden hesaplanır;
 * oyunun gerçek zamanda sürebileceği en kısa süre dolmadan gönderilen skor reddedilir.
 */

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message?: string,
  ) {
    super(message ?? code)
  }
}

const CORS: Record<string, string> = {
  // Kimlik çerez değil Bearer anahtarı olduğundan her köken güvenle izinlidir (uygulama, web).
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, PATCH, OPTIONS',
  'access-control-allow-headers': 'content-type, authorization, x-admin-password',
  'access-control-max-age': '86400',
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...CORS },
  })
}

// ------------------------------------------------------------------ ayarlar

function envInt(name: string, fallback: number, min: number, max: number) {
  const n = Number(process.env[name])
  return Number.isInteger(n) && n >= min && n <= max ? n : fallback
}
const powBits = () => envInt('HOPLA_POW_BITS', 17, 0, 26)
const maxPlayersPerIp = () => envInt('HOPLA_MAX_PLAYERS_PER_IP', 10, 1, 10_000)
const RENAMES_PER_DAY = 3
const TICKET_MAX_AGE = 3 * DAY
const STALE_AFTER = 7 * DAY

let secretCache: Buffer | null = null
/** İmza anahtarı: HOPLA_SECRET, yoksa sunucudaki mevcut gizli değerlerden türetilir. */
function secret() {
  if (secretCache) return secretCache
  const base =
    process.env.HOPLA_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.MESELE_HASH_SALT?.trim()
  if (base) {
    secretCache = createHmac('sha256', base).update('hopla-v1').digest()
  } else {
    secretCache = randomBytes(32)
    console.warn('[hopla] HOPLA_SECRET yok: oyun biletleri sunucu yeniden başlayınca geçersiz olur.')
  }
  return secretCache
}

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')
const hashIp = (ip: string) => sha256(`${secret().toString('hex')}:ip:${ip}`)
const iso = (ms: number) => new Date(ms).toISOString()

function sign(payload: object) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const mac = createHmac('sha256', secret()).update(body).digest('base64url')
  return `${body}.${mac}`
}

function verify<T>(token: unknown): T | null {
  if (typeof token !== 'string' || token.length > 600) return null
  const parts = token.split('.')
  if (parts.length !== 2) return null
  const [body, mac] = parts as [string, string]
  const expected = createHmac('sha256', secret()).update(body).digest()
  const given = Buffer.from(mac, 'base64url')
  // Yalnızca kanonik yazım: aynı imzanın farklı base64 yazımları kabul edilmez.
  if (given.toString('base64url') !== mac) return null
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null
  try {
    return JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as T
  } catch {
    return null
  }
}

function safeEqual(a: string, b: string) {
  const x = createHash('sha256').update(a).digest()
  const y = createHash('sha256').update(b).digest()
  return timingSafeEqual(x, y)
}

// ------------------------------------------------------------------ hız sınırı ve önbellek (tek süreç)

const buckets = new Map<string, { n: number; reset: number }>()
function limit(key: string, max: number, windowMs: number) {
  const now = Date.now()
  const b = buckets.get(key)
  if (!b || b.reset <= now) {
    buckets.set(key, { n: 1, reset: now + windowMs })
    if (buckets.size > 20_000) for (const [k, v] of buckets) if (v.reset <= now) buckets.delete(k)
    return
  }
  b.n += 1
  if (b.n > max) throw new ApiError(429, 'RATE_LIMITED')
}

const cache = new Map<string, { until: number; value: unknown }>()
async function cached<T>(key: string, ttl: number, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key)
  if (hit && hit.until > Date.now()) return hit.value as T
  const value = await fn()
  if (cache.size > 500) cache.clear()
  cache.set(key, { until: Date.now() + ttl, value })
  return value
}

const usedChallenges = new Map<string, number>()
let lastCleanup = 0

/** Testler için: bellek içi durumu sıfırlar */
export function __resetHoplaApiForTests() {
  buckets.clear()
  cache.clear()
  usedChallenges.clear()
  secretCache = null
  lastCleanup = 0
}

// ------------------------------------------------------------------ doğrulama

const RegisterBody = z.object({
  name: z.string().max(80),
  country: z.string().max(4),
  challenge: z.string().max(600),
  nonce: z.string().max(16),
})
const UpdateBody = z.object({ name: z.string().max(80).optional(), country: z.string().max(4).optional() })
const RunBody = z.object({ seed: z.number().int().min(0).max(0xffffffff) })
const ScoreBody = z.object({
  ticket: z.string().max(600),
  holds: z.array(z.number().int().min(0).max(MAX_HOLD_MS)).min(1).max(MAX_JUMPS),
  score: z.number().int().min(0).max(100_000_000),
})
const BanBody = z.object({ name: z.string().max(80), banned: z.boolean().optional() })

async function body<T>(request: Request, schema: z.ZodType<T>, max = 8 * 1024): Promise<T> {
  if (Number(request.headers.get('content-length') ?? 0) > max) throw new ApiError(413, 'BAD_REQUEST')
  const text = await request.text()
  if (text.length > max) throw new ApiError(413, 'BAD_REQUEST')
  let data: unknown
  try {
    data = JSON.parse(text || 'null')
  } catch {
    throw new ApiError(400, 'BAD_REQUEST')
  }
  const parsed = schema.safeParse(data)
  if (!parsed.success) throw new ApiError(400, 'BAD_REQUEST')
  return parsed.data
}

interface PowPayload {
  k: 'pow'
  i: number
  n: string
  b: number
}

function verifyPow(challenge: string, nonce: string) {
  const p = verify<PowPayload>(challenge)
  const now = Date.now()
  if (!p || p.k !== 'pow' || now - p.i > 10 * MINUTE || p.i > now + MINUTE) throw new ApiError(400, 'POW_INVALID')
  if (!/^\d{1,15}$/.test(nonce) || usedChallenges.has(challenge)) throw new ApiError(400, 'POW_INVALID')
  const first = createHash('sha256').update(`${challenge}:${nonce}`).digest().readUInt32BE(0)
  if (p.b > 0 && first >>> (32 - p.b) !== 0) throw new ApiError(400, 'POW_INVALID')
  usedChallenges.set(challenge, p.i + 10 * MINUTE)
  if (usedChallenges.size > 5000) for (const [k, until] of usedChallenges) if (until < now) usedChallenges.delete(k)
}

/** İsim ve ülkeyi temizler ve denetler. */
async function checkProfile(
  store: HoplaStore,
  rawName: string | undefined,
  rawCountry: string | undefined,
  self: PlayerRow | null,
) {
  const out: { name?: string; name_key?: string; country?: string } = {}
  if (rawCountry !== undefined) {
    if (!isCountryCode(rawCountry)) throw new ApiError(400, 'COUNTRY')
    out.country = rawCountry
  }
  if (rawName !== undefined) {
    const name = cleanName(rawName)
    const shape = checkNameShape(name)
    if (shape !== 'ok') throw new ApiError(400, shape)
    if (!screenName(name).ok) throw new ApiError(422, 'NAME_BLOCKED')
    const key = nameKey(name)
    if (key.length < 2) throw new ApiError(400, 'NAME_CHARS')
    const owner = await store.playerByNameKey(key)
    if (owner && owner.id !== self?.id) throw new ApiError(409, 'NAME_TAKEN')
    if (!self || self.name_key !== key) {
      if ((await moderateWithAI(name)) === 'flagged') throw new ApiError(422, 'NAME_BLOCKED')
    }
    out.name = name
    out.name_key = key
  }
  return out
}

async function authed(request: Request, store: HoplaStore): Promise<PlayerRow | null> {
  const m = /^Bearer ([A-Za-z0-9_-]{20,128})$/.exec(request.headers.get('authorization') ?? '')
  if (!m) return null
  return store.playerByToken(sha256(m[1]!))
}

async function requirePlayer(request: Request, store: HoplaStore) {
  const p = await authed(request, store)
  if (!p) throw new ApiError(401, 'UNAUTHORIZED')
  return p
}

async function profileOf(store: HoplaStore, p: PlayerRow): Promise<Profile> {
  const ranked = p.best_score > 0 && !!p.best_at && !p.banned
  return {
    name: p.name,
    country: p.country,
    best: p.best_score,
    rank: ranked
      ? {
          world: await store.rank(p.best_score, p.best_at!, null),
          country: await store.rank(p.best_score, p.best_at!, p.country),
        }
      : null,
  }
}

/** Hiç skor göndermemiş eski kayıtları saatte en fazla bir kez temizler. */
async function cleanup(store: HoplaStore) {
  const now = Date.now()
  if (now - lastCleanup < HOUR) return
  lastCleanup = now
  try {
    const n = await store.deleteStale(iso(now - STALE_AFTER))
    if (n) console.info(`[hopla] ${n} kullanılmayan isim serbest bırakıldı`)
  } catch (e) {
    console.warn('[hopla] temizlik yapılamadı', e)
  }
}

interface RunTicket {
  k: 'run'
  v: number
  s: number
  i: number
  p: string | null
}

// ------------------------------------------------------------------ uç noktalar

async function route(request: Request, ip: string): Promise<Response> {
  const url = new URL(request.url)
  const path = url.pathname.slice(API_PREFIX.length).replace(/\/+$/, '') || '/'
  const key = `${request.method} ${path}`

  if (key === 'GET /health') {
    const store = await getHoplaStore()
    const c = await cached('health', 30_000, () => store.check())
    if (!c.ready) cache.delete('health')
    return json(200, { ok: true, store: store.kind, ready: c.ready, problem: c.ready ? null : c.problem })
  }

  if (key === 'POST /challenge') {
    limit(`challenge:${ip}`, 30, 10 * MINUTE)
    const bits = powBits()
    const challenge = sign({ k: 'pow', i: Date.now(), n: randomBytes(9).toString('base64url'), b: bits })
    return json(200, { challenge, bits })
  }

  if (key === 'POST /players') {
    limit(`register:${ip}`, 8, HOUR)
    const b = await body(request, RegisterBody)
    verifyPow(b.challenge, b.nonce)
    try {
      const store = await getHoplaStore()
      const profile = await checkProfile(store, b.name, b.country, null)
      await cleanup(store)
      const ipHash = hashIp(ip)
      if ((await store.countRecentByIp(ipHash, iso(Date.now() - DAY))) >= maxPlayersPerIp()) {
        throw new ApiError(429, 'RATE_LIMITED')
      }
      const token = randomBytes(32).toString('base64url')
      const row = await store.createPlayer({
        name: profile.name!,
        name_key: profile.name_key!,
        country: profile.country!,
        token_hash: sha256(token),
        created_ip_hash: ipHash,
      })
      if (row === 'name_taken') throw new ApiError(409, 'NAME_TAKEN')
      return json(201, { token, profile: await profileOf(store, row) })
    } catch (e) {
      // Kayıt olmadıysa (isim alınmış, uygunsuz…) aynı iş kanıtı başka bir isimle yeniden denenebilir;
      // bir iş kanıtıyla en fazla bir isim alınır.
      usedChallenges.delete(b.challenge)
      throw e
    }
  }

  if (key === 'GET /players/me') {
    limit(`me:${ip}`, 120, MINUTE)
    const store = await getHoplaStore()
    const p = await requirePlayer(request, store)
    return json(200, { profile: await profileOf(store, p) })
  }

  if (key === 'PATCH /players/me') {
    limit(`update:${ip}`, 20, HOUR)
    const store = await getHoplaStore()
    const p = await requirePlayer(request, store)
    if (p.banned) throw new ApiError(403, 'NAME_BLOCKED')
    const b = await body(request, UpdateBody)
    const name = b.name !== undefined && cleanName(b.name) !== p.name ? b.name : undefined
    const country = b.country !== undefined && b.country !== p.country ? b.country : undefined
    if (name === undefined && country === undefined) return json(200, { profile: await profileOf(store, p) })
    const now = Date.now()
    const fresh = !p.rename_window || now - Date.parse(p.rename_window) >= DAY
    const count = fresh ? 0 : p.rename_count
    if (count >= RENAMES_PER_DAY) throw new ApiError(429, 'RENAME_LIMIT')
    const changes = await checkProfile(store, name, country, p)
    const patch: ProfilePatch = {
      ...changes,
      rename_count: count + 1,
      rename_window: fresh ? iso(now) : p.rename_window!,
    }
    const row = await store.updateProfile(p.id, patch)
    if (row === 'name_taken') throw new ApiError(409, 'NAME_TAKEN')
    cache.clear()
    return json(200, { profile: await profileOf(store, row) })
  }

  if (key === 'POST /runs') {
    limit(`runs:${ip}`, 240, HOUR)
    const b = await body(request, RunBody)
    let player: PlayerRow | null = null
    try {
      player = await authed(request, await getHoplaStore())
    } catch {
      // depo hazır değilse bilet yine verilir (oyuncuya bağlanmadan)
    }
    const iat = Date.now()
    const ticket = sign({ k: 'run', v: SIM_VERSION, s: b.seed, i: iat, p: player?.id ?? null } satisfies RunTicket)
    return json(200, { ticket, seed: b.seed, iat, v: SIM_VERSION })
  }

  if (key === 'POST /scores') {
    const store = await getHoplaStore()
    const p = await requirePlayer(request, store)
    limit(`scores:${p.id}`, 30, 10 * MINUTE)
    const b = await body(request, ScoreBody, 400 * 1024)
    const t = verify<RunTicket>(b.ticket)
    const now = Date.now()
    if (!t || t.k !== 'run' || !Number.isInteger(t.s)) throw new ApiError(422, 'RUN_INVALID')
    if (t.v !== SIM_VERSION) throw new ApiError(400, 'OUTDATED')
    if (now - t.i > TICKET_MAX_AGE) throw new ApiError(410, 'RUN_EXPIRED')
    // Bilet başka bir oyuncuya aitse ya da (oyuncusuz bilette) oyuncu oyundan önce kayıtlıysa geçersiz.
    if (t.p ? t.p !== p.id : Date.parse(p.created_at) < t.i - MINUTE) throw new ApiError(422, 'RUN_INVALID')
    const r = replayRun(t.s, b.holds)
    if (!r.valid || r.score !== b.score) throw new ApiError(422, 'RUN_INVALID')
    if (now - t.i < r.minMs * 0.85 - 1500) throw new ApiError(422, 'RUN_TOO_FAST')

    let improved = false
    if (b.score > p.best_score) {
      improved = await store.submitBest(p.id, {
        score: b.score,
        jumps: r.jumps,
        perfects: r.perfects,
        iat: t.i,
        at: iso(now),
      })
    }
    if (improved) cache.clear()
    const fresh = improved ? ((await store.playerByToken(p.token_hash)) ?? p) : p
    return json(200, { improved, profile: await profileOf(store, fresh) })
  }

  if (key === 'GET /leaderboard') {
    limit(`board:${ip}`, 120, MINUTE)
    const scope = url.searchParams.get('scope') === 'country' ? 'country' : 'world'
    const country = scope === 'country' ? url.searchParams.get('country') : null
    if (scope === 'country' && !isCountryCode(country)) throw new ApiError(400, 'COUNTRY')
    const n = Math.min(100, Math.max(1, Number(url.searchParams.get('limit')) || 50))
    const store = await getHoplaStore()
    const board = await cached(`board:${scope}:${country}:${n}`, 10_000, async () => ({
      entries: (await store.top(n, country)).map((e, i) => ({ rank: i + 1, ...e })),
      total: await store.countRanked(country),
    }))
    const p = await authed(request, store)
    const me =
      p && p.best_score > 0 && p.best_at && !p.banned && (!country || p.country === country)
        ? {
            rank: await store.rank(p.best_score, p.best_at, country),
            score: p.best_score,
            name: p.name,
            country: p.country,
          }
        : null
    return json(200, { scope, country, total: board.total, entries: board.entries, me })
  }

  if (key === 'GET /countries') {
    limit(`countries:${ip}`, 120, MINUTE)
    const n = Math.min(250, Math.max(1, Number(url.searchParams.get('limit')) || 50))
    const store = await getHoplaStore()
    const rows = await cached(`countries:${n}`, 60_000, () => store.countryRanking(n))
    return json(200, { entries: rows.map((r, i) => ({ rank: i + 1, ...r })) })
  }

  if (key === 'POST /admin/ban') {
    limit(`admin:${ip}`, 10, HOUR)
    const pass = process.env.HOPLA_ADMIN_PASSWORD?.trim() || process.env.MESELE_ADMIN_PASSWORD?.trim()
    if (!pass) throw new ApiError(404, 'NOT_FOUND')
    if (!safeEqual(request.headers.get('x-admin-password') ?? '', pass)) throw new ApiError(401, 'UNAUTHORIZED')
    const b = await body(request, BanBody)
    const store = await getHoplaStore()
    const p = await store.playerByNameKey(nameKey(cleanName(b.name)))
    if (!p) throw new ApiError(404, 'NOT_FOUND')
    const banned = b.banned ?? true
    await store.setBanned(p.id, banned)
    cache.clear()
    return json(200, { ok: true, name: p.name, banned })
  }

  throw new ApiError(404, 'NOT_FOUND')
}

export async function handleHopla(request: Request, ip = 'unknown'): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  try {
    return await route(request, ip)
  } catch (e) {
    if (e instanceof ApiError) return json(e.status, { error: { code: e.code, message: e.message } })
    if (e instanceof SetupRequired) {
      return json(503, { error: { code: 'SETUP_REQUIRED', message: 'Leaderboard database is not set up' } })
    }
    console.error('[hopla] api error', e)
    return json(500, { error: { code: 'INTERNAL', message: 'Internal error' } })
  }
}
