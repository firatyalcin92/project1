import {
  API_PREFIX,
  type ApiError,
  type Challenge,
  type CountriesResponse,
  type Health,
  type LeaderboardResponse,
  type Profile,
  type RegisterResponse,
  type SubmitResponse,
  type Ticket,
  type UpdateRequest,
} from '../../core/api'
import type { RunResult } from './game'
import { storage } from './native'
import { solve } from './pow'

/**
 * Sıralama sunucusu istemcisi. Oyunun kendisi sunucuya hiç ihtiyaç duymaz: her istek
 * arka planda yapılır, başarısız olursa oyun sessizce çevrimdışı devam eder.
 * Sunucu adresi: aynı köken (web) ya da VITE_HOPLA_API (uygulama derlemesi).
 */
const ORIGIN = (window.__HOPLA_NATIVE__?.api ?? (import.meta.env.VITE_HOPLA_API as string | undefined) ?? '')
  .trim()
  .replace(/\/+$/, '')
const BASE = ORIGIN + API_PREFIX
/** Gizlilik ve destek sayfası (App Store için de bu adres verilir) */
export const PRIVACY_URL = `${ORIGIN}/hopla/privacy.html`

export class ApiFailure extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 0,
  ) {
    super(message)
  }
}

interface CallOptions {
  method?: string
  body?: unknown
  auth?: boolean
  timeout?: number
  signal?: AbortSignal
}

async function call<T>(path: string, token: string | null, o: CallOptions = {}): Promise<T> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), o.timeout ?? 15_000)
  const onAbort = () => ctrl.abort()
  o.signal?.addEventListener('abort', onAbort)
  try {
    let res: Response
    try {
      const headers: Record<string, string> = {}
      if (o.body !== undefined) headers['content-type'] = 'application/json'
      if (o.auth && token) headers.authorization = `Bearer ${token}`
      res = await fetch(BASE + path, {
        method: o.method ?? 'GET',
        headers,
        body: o.body !== undefined ? JSON.stringify(o.body) : undefined,
        signal: ctrl.signal,
        cache: 'no-store',
      })
    } catch (e) {
      if (o.signal?.aborted) throw e
      throw new ApiFailure('NETWORK', String(e))
    }
    let data: unknown = null
    try {
      data = await res.json()
    } catch {
      data = null
    }
    if (!res.ok) {
      const err = (data as ApiError | null)?.error
      throw new ApiFailure(
        err?.code ?? (res.status >= 500 || res.status === 404 ? 'NETWORK' : 'GENERIC'),
        err?.message ?? '',
        res.status,
      )
    }
    return data as T
  } finally {
    clearTimeout(timer)
    o.signal?.removeEventListener('abort', onAbort)
  }
}

function within<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([p, new Promise<null>((r) => setTimeout(() => r(null), ms))])
}

interface Pending {
  ticket: string
  holds: number[]
  score: number
}

export type SubmitStatus =
  | { kind: 'skipped' }
  | { kind: 'unranked' }
  | { kind: 'needsName' }
  | { kind: 'queued' }
  | { kind: 'sent'; improved: boolean; profile: Profile }
  | { kind: 'error'; code: string }

export class Net {
  token: string | null = storage.get('token')
  profile: Profile | null = storage.json<Profile>('profile')
  health: Health | null = null
  private readonly tickets = new Map<number, Promise<Ticket | null>>()

  get registered() {
    return !!this.token && !!this.profile
  }

  /** Sunucuyu uyandırır (ücretsiz barındırmada ilk istek ~1 dk sürebilir). */
  async wake() {
    try {
      this.health = await call<Health>('/health', null, { timeout: 75_000 })
    } catch {
      this.health = null
    }
    return this.health
  }

  /** Oyun hazırlanırken bilet ister; oyun bitince skorla birlikte geri gönderilir. */
  requestTicket(seed: number) {
    const p = call<Ticket>('/runs', this.token, { method: 'POST', body: { seed }, auth: true, timeout: 75_000 }).catch(
      () => null,
    )
    this.tickets.set(seed, p)
    while (this.tickets.size > 3) this.tickets.delete(this.tickets.keys().next().value!)
  }

  async submit(r: RunResult): Promise<SubmitStatus> {
    if (r.score <= 0) return { kind: 'skipped' }
    const pending = this.tickets.get(r.seed)
    this.tickets.delete(r.seed)
    const ticket = pending ? await within(pending, 25_000) : null
    if (!ticket || ticket.seed !== r.seed) return { kind: 'unranked' }
    const run: Pending = { ticket: ticket.ticket, holds: r.holds, score: r.score }
    if (!this.registered) {
      this.keepPending(run)
      return { kind: 'needsName' }
    }
    if (this.profile && r.score <= this.profile.best) return { kind: 'skipped' }
    return this.send(run)
  }

  /** Bekleyen (gönderilemeyen ya da isim seçilmeden oynanan) en iyi oyunu gönderir. */
  async flushPending(): Promise<SubmitStatus | null> {
    const run = storage.json<Pending>('pending')
    if (!run || !this.registered) return null
    if (this.profile && run.score <= this.profile.best) {
      storage.set('pending', null)
      return null
    }
    return this.send(run)
  }

  get pendingScore() {
    return storage.json<Pending>('pending')?.score ?? 0
  }

  private async send(run: Pending, retried = false): Promise<SubmitStatus> {
    try {
      const res = await call<SubmitResponse>('/scores', this.token, {
        method: 'POST',
        body: run,
        auth: true,
        timeout: 40_000,
      })
      this.setProfile(res.profile)
      this.clearPending(run)
      return { kind: 'sent', improved: res.improved, profile: res.profile }
    } catch (e) {
      const code = e instanceof ApiFailure ? e.code : 'NETWORK'
      if (code === 'NETWORK' || code === 'RATE_LIMITED' || code === 'SETUP_REQUIRED') {
        this.keepPending(run)
        return { kind: 'queued' }
      }
      if (code === 'UNAUTHORIZED' && !retried && (await this.recover())) return this.send(run, true)
      this.clearPending(run)
      return { kind: 'error', code }
    }
  }

  private keepPending(run: Pending) {
    const cur = storage.json<Pending>('pending')
    if (!cur || run.score >= cur.score) storage.set('pending', JSON.stringify(run))
  }

  private clearPending(run: Pending) {
    const cur = storage.json<Pending>('pending')
    if (cur && cur.ticket === run.ticket) storage.set('pending', null)
  }

  private pow: Promise<{ challenge: string; nonce: string }> | null = null
  private powAt = 0

  /** İş kanıtını isim penceresi açılır açılmaz arka planda çözer (kaydet'e basınca beklenmez). */
  prepareRegistration() {
    if (this.pow && Date.now() - this.powAt < 8 * 60_000) return this.pow
    this.powAt = Date.now()
    const p = (async () => {
      const ch = await call<Challenge>('/challenge', null, { method: 'POST', timeout: 75_000 })
      return { challenge: ch.challenge, nonce: await solve(ch.challenge, ch.bits) }
    })()
    this.pow = p
    p.catch(() => {
      if (this.pow === p) this.pow = null
    })
    return p
  }

  async register(name: string, country: string, signal?: AbortSignal): Promise<Profile> {
    for (let attempt = 0; ; attempt++) {
      const pow = await this.prepareRegistration()
      if (signal?.aborted) throw new DOMException('aborted', 'AbortError')
      try {
        const res = await call<RegisterResponse>('/players', null, {
          method: 'POST',
          body: { name, country, ...pow },
          timeout: 30_000,
          signal,
        })
        this.pow = null
        this.token = res.token
        storage.set('token', res.token)
        this.setProfile(res.profile)
        return res.profile
      } catch (e) {
        // Süresi geçmiş ya da kullanılmış bilmece: bir kez yenisiyle dene.
        if (e instanceof ApiFailure && e.code === 'POW_INVALID' && attempt === 0) {
          this.pow = null
          continue
        }
        throw e
      }
    }
  }

  async update(body: UpdateRequest): Promise<Profile> {
    const res = await call<{ profile: Profile }>('/players/me', this.token, { method: 'PATCH', body, auth: true })
    this.setProfile(res.profile)
    return res.profile
  }

  async refresh(): Promise<Profile | null> {
    if (!this.token) return null
    try {
      const res = await call<{ profile: Profile }>('/players/me', this.token, { auth: true, timeout: 75_000 })
      this.setProfile(res.profile)
      return res.profile
    } catch (e) {
      if (e instanceof ApiFailure && e.code === 'UNAUTHORIZED' && (await this.recover())) return this.profile
      return null
    }
  }

  /**
   * Sunucu oyuncuyu tanımıyorsa (ör. deneme modunda sunucu verisi sıfırlandı) aynı isimle
   * sessizce yeniden kaydolmayı dener; olmazsa yerel kaydı unutur.
   */
  private async recover(): Promise<boolean> {
    const old = this.profile
    this.token = null
    storage.set('token', null)
    if (!old) return false
    try {
      await this.register(old.name, old.country)
      return true
    } catch {
      this.forget()
      return false
    }
  }

  /** İsmi ve skoru sunucudan tamamen siler, bu cihazdaki kaydı unutur. */
  async deleteMe() {
    if (this.token)
      await call<{ ok: true }>('/players/me', this.token, { method: 'DELETE', auth: true, timeout: 75_000 })
    this.forget()
    storage.set('pending', null)
  }

  /** Uygunsuz bir ismi bildirir */
  report(name: string) {
    return call<{ ok: true }>('/reports', this.token, { method: 'POST', body: { name }, auth: true, timeout: 75_000 })
  }

  leaderboard(scope: 'world' | 'country', country?: string) {
    const q = new URLSearchParams({ scope, limit: '50' })
    if (country) q.set('country', country)
    return call<LeaderboardResponse>(`/leaderboard?${q}`, this.token, { auth: true, timeout: 75_000 })
  }

  countries() {
    return call<CountriesResponse>('/countries?limit=50', null, { timeout: 75_000 })
  }

  private setProfile(p: Profile) {
    this.profile = p
    storage.set('profile', JSON.stringify(p))
  }

  forget() {
    this.token = null
    this.profile = null
    storage.set('token', null)
    storage.set('profile', null)
  }
}
