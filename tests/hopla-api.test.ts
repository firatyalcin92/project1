import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { API_PREFIX } from '../hopla/core/api'
import { holdForDistance, newRun, step } from '../hopla/core/sim'
import { solve } from '../hopla/web/src/pow'
import { __resetHoplaApiForTests, handleHopla } from '~/server/hopla/api.server'
import { createMemoryHoplaStore } from '~/server/hopla/store-memory.server'
import { createSqliteHoplaStore } from '~/server/hopla/store-sqlite.server'
import { SetupRequired, __setHoplaStoreForTests, type HoplaStore } from '~/server/hopla/store.server'

type Json = Record<string, any>

/** İmzanın ortasındaki bir karakteri değiştirir (base64 dolgu bitlerine denk gelmez). */
const tamper = (ticket: string) => {
  const i = ticket.length - 10
  return ticket.slice(0, i) + (ticket[i] === 'Q' ? 'R' : 'Q') + ticket.slice(i + 1)
}

async function call(
  method: string,
  path: string,
  opts: { body?: unknown; token?: string; ip?: string; headers?: Record<string, string> } = {},
) {
  const headers: Record<string, string> = { ...opts.headers }
  if (opts.body !== undefined) headers['content-type'] = 'application/json'
  if (opts.token) headers.authorization = `Bearer ${opts.token}`
  const res = await handleHopla(
    new Request(`http://localhost${API_PREFIX}${path}`, {
      method,
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    }),
    opts.ip ?? '10.0.0.1',
  )
  const text = await res.text()
  return { status: res.status, headers: res.headers, data: (text ? JSON.parse(text) : null) as Json }
}

async function register(name: string, country = 'TR', ip = '10.0.0.1') {
  const ch = await call('POST', '/challenge', { ip })
  const nonce = await solve(ch.data.challenge, ch.data.bits)
  return call('POST', '/players', { body: { name, country, challenge: ch.data.challenge, nonce }, ip })
}

/** Gerçek bir oyun: önce n kez merkeze, sonra bilerek kısa basıp düşer. */
function play(seed: number, landings: number) {
  const s = newRun(seed)
  const holds: number[] = []
  for (let k = 0; k < landings; k++) {
    const t = s.level.get(s.cur + 1)
    const h = Math.round(holdForDistance(Math.sqrt((t.x - s.x) ** 2 + (t.z - s.z) ** 2)))
    holds.push(h)
    step(s, h)
  }
  holds.push(0 + 1) // neredeyse yerinde zıplar…
  step(s, 1)
  while (s.alive) {
    holds.push(60)
    step(s, 60)
  }
  return { holds, score: s.score, minMs: s.minMs }
}

let clock = Date.parse('2026-10-28T12:00:00Z')
const advance = (ms: number) => {
  clock += ms
  vi.setSystemTime(clock)
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(clock)
  process.env.HOPLA_POW_BITS = '6'
  process.env.HOPLA_SECRET = 'test-secret'
  delete process.env.HOPLA_MAX_PLAYERS_PER_IP
  delete process.env.HOPLA_ADMIN_PASSWORD
  delete process.env.MESELE_ADMIN_PASSWORD
  delete process.env.OPENAI_API_KEY
  __resetHoplaApiForTests()
})

afterEach(() => {
  vi.useRealTimers()
  __setHoplaStoreForTests(null)
})

const STORES: [string, () => HoplaStore][] = [
  ['bellek', () => createMemoryHoplaStore()],
  ['SQLite', () => createSqliteHoplaStore(':memory:')],
]

describe.each(STORES)('%s deposu', (_kind, make) => {
  beforeEach(() => __setHoplaStoreForTests(make()))

  describe('hopla api: temel', () => {
    it('sağlık, CORS ön isteği ve bilinmeyen yol', async () => {
      const h = await call('GET', '/health')
      expect(h.data).toEqual({ ok: true, store: make().kind, ready: true, problem: null })
      expect(h.headers.get('access-control-allow-origin')).toBe('*')
      const pre = await call('OPTIONS', '/scores')
      expect(pre.status).toBe(204)
      expect(pre.headers.get('access-control-allow-headers')).toContain('authorization')
      expect((await call('GET', '/nope')).status).toBe(404)
    })

    it('tablolar kurulmamışsa 503 SETUP_REQUIRED döner', async () => {
      const broken = new Proxy({} as HoplaStore, {
        get: (_t, prop) =>
          prop === 'kind'
            ? 'supabase'
            : prop === 'then'
              ? undefined
              : async () => Promise.reject(new SetupRequired('yok')),
      })
      __setHoplaStoreForTests(broken)
      const r = await call('GET', '/leaderboard')
      expect(r.status).toBe(503)
      expect(r.data.error.code).toBe('SETUP_REQUIRED')
    })
  })

  describe('hopla api: isim kaydı', () => {
    it('iş kanıtıyla kayıt; anahtar yalnızca bir kez döner', async () => {
      const r = await register('Fırat', 'TR')
      expect(r.status).toBe(201)
      expect(r.data.token).toMatch(/^[A-Za-z0-9_-]{43}$/)
      expect(r.data.profile).toEqual({ name: 'Fırat', country: 'TR', best: 0, rank: null })
      const me = await call('GET', '/players/me', { token: r.data.token })
      expect(me.data.profile.name).toBe('Fırat')
      expect((await call('GET', '/players/me')).status).toBe(401)
      expect((await call('GET', '/players/me', { token: 'x'.repeat(43) })).status).toBe(401)
    })

    it('aynı isim (büyük/küçük harf, aksan, benzer harf farkıyla) ikinci kez alınamaz', async () => {
      expect((await register('Ali Veli')).status).toBe(201)
      for (const n of ['ALİ VELİ', 'ali.veli', 'Аli Veli']) {
        const r = await register(n, 'DE', '10.0.0.2')
        expect(r.status).toBe(409)
        expect(r.data.error.code).toBe('NAME_TAKEN')
      }
    })

    it('uygunsuz isim, biçim ve ülke hataları', async () => {
      expect((await register('Hitler')).data.error.code).toBe('NAME_BLOCKED')
      expect((await register('orospu çocuğu')).data.error.code).toBe('NAME_BLOCKED')
      expect((await register('ErdoğanHain')).data.error.code).toBe('NAME_BLOCKED')
      expect((await register('ab')).data.error.code).toBe('NAME_LENGTH')
      expect((await register('ali<script>')).data.error.code).toBe('NAME_CHARS')
      expect((await register('Ali', 'XX')).data.error.code).toBe('COUNTRY')
    })

    it('yapay zekâ moderasyonu işaretlerse engellenir', async () => {
      process.env.OPENAI_API_KEY = 'sk-test'
      const realFetch = globalThis.fetch
      globalThis.fetch = (async () =>
        new Response(JSON.stringify({ results: [{ flagged: true }] }))) as unknown as typeof fetch
      try {
        expect((await register('Kibar Ama Kötü')).data.error.code).toBe('NAME_BLOCKED')
      } finally {
        globalThis.fetch = realFetch
      }
    })

    it('iş kanıtı tekrar kullanılamaz, yanlış ya da sahte olamaz', async () => {
      const ch = await call('POST', '/challenge')
      const nonce = await solve(ch.data.challenge, ch.data.bits)
      const ok = await call('POST', '/players', {
        body: { name: 'Bir', country: 'TR', challenge: ch.data.challenge, nonce },
      })
      expect(ok.status).toBe(201)
      const again = await call('POST', '/players', {
        body: { name: 'Iki', country: 'TR', challenge: ch.data.challenge, nonce },
      })
      expect(again.data.error.code).toBe('POW_INVALID')

      const ch2 = await call('POST', '/challenge')
      let bad = 0
      while (true) {
        const { createHash } = await import('node:crypto')
        const first = createHash('sha256').update(`${ch2.data.challenge}:${bad}`).digest().readUInt32BE(0)
        if (first >>> (32 - ch2.data.bits) !== 0) break
        bad++
      }
      const wrong = await call('POST', '/players', {
        body: { name: 'Uc', country: 'TR', challenge: ch2.data.challenge, nonce: String(bad) },
      })
      expect(wrong.data.error.code).toBe('POW_INVALID')

      const forged =
        Buffer.from(JSON.stringify({ k: 'pow', i: Date.now(), n: 'x', b: 0 })).toString('base64url') + '.AAAA'
      const f = await call('POST', '/players', { body: { name: 'Dort', country: 'TR', challenge: forged, nonce: '1' } })
      expect(f.data.error.code).toBe('POW_INVALID')

      advance(11 * 60_000)
      const ch3Nonce = await solve(ch2.data.challenge, ch2.data.bits)
      const late = await call('POST', '/players', {
        body: { name: 'Bes', country: 'TR', challenge: ch2.data.challenge, nonce: ch3Nonce },
      })
      expect(late.data.error.code).toBe('POW_INVALID')
    })

    it('aynı IP adresinden günde sınırlı sayıda isim alınabilir', async () => {
      process.env.HOPLA_MAX_PLAYERS_PER_IP = '2'
      expect((await register('Birinci', 'TR', '1.2.3.4')).status).toBe(201)
      expect((await register('Ikinci', 'TR', '1.2.3.4')).status).toBe(201)
      const third = await register('Ucuncu', 'TR', '1.2.3.4')
      expect(third.status).toBe(429)
      expect((await register('Ucuncu', 'TR', '5.6.7.8')).status).toBe(201)
      advance(25 * 3600_000)
      expect((await register('Dorduncu', 'TR', '1.2.3.4')).status).toBe(201)
    })

    it('hiç skor göndermeyen eski isimler 7 gün sonra serbest kalır', async () => {
      expect((await register('Kapici', 'TR', '1.1.1.1')).status).toBe(201)
      advance(8 * 24 * 3600_000)
      // temizlik bir sonraki kayıtta çalışır
      expect((await register('Baskasi', 'TR', '2.2.2.2')).status).toBe(201)
      expect((await register('Kapici', 'DE', '3.3.3.3')).status).toBe(201)
    })

    it('isim değiştirme: alınmış isim, denetim ve günde en fazla 3 değişiklik', async () => {
      const a = await register('Ayse')
      await register('Mehmet', 'TR', '10.0.0.9')
      const token = a.data.token
      expect((await call('PATCH', '/players/me', { token, body: { name: 'Mehmet' } })).data.error.code).toBe(
        'NAME_TAKEN',
      )
      expect((await call('PATCH', '/players/me', { token, body: { name: 'f u c k' } })).data.error.code).toBe(
        'NAME_BLOCKED',
      )
      expect((await call('PATCH', '/players/me', { token, body: { name: 'Ayse 1' } })).data.profile.name).toBe('Ayse 1')
      expect((await call('PATCH', '/players/me', { token, body: { country: 'DE' } })).data.profile.country).toBe('DE')
      expect((await call('PATCH', '/players/me', { token, body: { name: 'Ayse 2' } })).status).toBe(200)
      expect((await call('PATCH', '/players/me', { token, body: { name: 'Ayse 3' } })).data.error.code).toBe(
        'RENAME_LIMIT',
      )
      // eski isim serbest kaldı
      expect((await register('Ayse', 'TR', '10.0.0.10')).status).toBe(201)
      advance(24 * 3600_000 + 1000)
      expect((await call('PATCH', '/players/me', { token, body: { name: 'Ayse 3' } })).status).toBe(200)
    })
  })

  describe('hopla api: skor doğrulama', () => {
    async function ticket(seed: number, token?: string) {
      return (await call('POST', '/runs', { body: { seed }, token })).data
    }

    it('gerçek oyun kabul edilir; süre dolmadan, değiştirilmiş ya da başkasının oyunu reddedilir', async () => {
      const a = (await register('Oyuncu')).data.token
      const b = (await register('Diger', 'DE', '10.0.0.7')).data.token
      const t = await ticket(424242, a)
      expect(t).toMatchObject({ seed: 424242, v: 1 })
      const run = play(424242, 12)
      expect(run.score).toBeGreaterThan(12)

      const tooFast = await call('POST', '/scores', {
        token: a,
        body: { ticket: t.ticket, holds: run.holds, score: run.score },
      })
      expect(tooFast.data.error.code).toBe('RUN_TOO_FAST')

      advance(run.minMs + 500)
      const cheat = await call('POST', '/scores', {
        token: a,
        body: { ticket: t.ticket, holds: run.holds, score: run.score + 1 },
      })
      expect(cheat.data.error.code).toBe('RUN_INVALID')
      const edited = [...run.holds]
      edited[3] = edited[3]! + 400
      const cheat2 = await call('POST', '/scores', {
        token: a,
        body: { ticket: t.ticket, holds: edited, score: run.score },
      })
      expect(cheat2.data.error.code).toBe('RUN_INVALID')
      const stolen = await call('POST', '/scores', {
        token: b,
        body: { ticket: t.ticket, holds: run.holds, score: run.score },
      })
      expect(stolen.data.error.code).toBe('RUN_INVALID')
      const forged = await call('POST', '/scores', {
        token: a,
        body: { ticket: tamper(t.ticket), holds: run.holds, score: run.score },
      })
      expect(forged.data.error.code).toBe('RUN_INVALID')

      const ok = await call('POST', '/scores', {
        token: a,
        body: { ticket: t.ticket, holds: run.holds, score: run.score },
      })
      expect(ok.status).toBe(200)
      expect(ok.data.improved).toBe(true)
      expect(ok.data.profile).toMatchObject({ best: run.score, rank: { world: 1, country: 1 } })

      // aynı bilet ikinci kez rekor yazamaz
      const again = await call('POST', '/scores', {
        token: a,
        body: { ticket: t.ticket, holds: run.holds, score: run.score },
      })
      expect(again.data.improved).toBe(false)
    })

    it('isim seçmeden oynanan oyun, oyundan sonra kaydolan oyuncuya yazılabilir', async () => {
      const t = await ticket(777)
      const run = play(777, 5)
      advance(run.minMs + 2000)
      const fresh = (await register('Yeni Gelen')).data.token
      const ok = await call('POST', '/scores', {
        token: fresh,
        body: { ticket: t.ticket, holds: run.holds, score: run.score },
      })
      expect(ok.data.improved).toBe(true)

      // oyundan önce kayıtlı oyuncu sahipsiz bileti kullanamaz
      advance(5 * 60_000)
      const t2 = await ticket(778)
      const run2 = play(778, 8)
      advance(run2.minMs)
      const old = await call('POST', '/scores', {
        token: fresh,
        body: { ticket: t2.ticket, holds: run2.holds, score: run2.score },
      })
      expect(old.data.error.code).toBe('RUN_INVALID')
    })

    it('süresi geçmiş bilet', async () => {
      const a = (await register('Gec Kalan')).data.token
      const t = await ticket(9, a)
      const run = play(9, 3)
      advance(4 * 24 * 3600_000)
      const r = await call('POST', '/scores', {
        token: a,
        body: { ticket: t.ticket, holds: run.holds, score: run.score },
      })
      expect(r.data.error.code).toBe('RUN_EXPIRED')
    })
  })

  describe('hopla api: sıralamalar ve yönetim', () => {
    async function scored(name: string, country: string, seed: number, landings: number, ip: string) {
      const token = (await register(name, country, ip)).data.token as string
      const t = (await call('POST', '/runs', { body: { seed }, token })).data
      const run = play(seed, landings)
      advance(run.minMs + 1000)
      const r = await call('POST', '/scores', { token, body: { ticket: t.ticket, holds: run.holds, score: run.score } })
      expect(r.data.improved).toBe(true)
      return { token, score: run.score }
    }

    it('dünya, ülke ve ülkeler sıralaması; yasaklanan isim listeden çıkar', async () => {
      const a = await scored('Ankara', 'TR', 1, 10, '1.0.0.1')
      const b = await scored('Berlin', 'DE', 2, 14, '1.0.0.2')
      const c = await scored('Izmir', 'TR', 3, 4, '1.0.0.3')

      const world = await call('GET', '/leaderboard?scope=world', { token: c.token })
      expect(world.data.entries.map((e: Json) => e.name)).toEqual(['Berlin', 'Ankara', 'Izmir'])
      expect(world.data.entries[0]).toMatchObject({ rank: 1, country: 'DE', score: b.score })
      expect(world.data.total).toBe(3)
      expect(world.data.me).toMatchObject({ rank: 3, name: 'Izmir' })

      const tr = await call('GET', '/leaderboard?scope=country&country=TR')
      expect(tr.data.entries.map((e: Json) => e.name)).toEqual(['Ankara', 'Izmir'])
      expect((await call('GET', '/leaderboard?scope=country&country=ZZ')).data.error.code).toBe('COUNTRY')

      const countries = await call('GET', '/countries')
      expect(countries.data.entries).toEqual(
        [
          { rank: 1, country: 'TR', score: a.score + c.score, players: 2 },
          { rank: 2, country: 'DE', score: b.score, players: 1 },
        ]
          .sort((x, y) => y.score - x.score)
          .map((e, i) => ({ ...e, rank: i + 1 })),
      )

      // yönetici: şifre yoksa uç kapalı, yanlış şifre reddedilir
      expect((await call('POST', '/admin/ban', { body: { name: 'Berlin' } })).status).toBe(404)
      process.env.HOPLA_ADMIN_PASSWORD = 'gizli-sifre'
      expect(
        (await call('POST', '/admin/ban', { body: { name: 'Berlin' }, headers: { 'x-admin-password': 'yanlis' } }))
          .status,
      ).toBe(401)
      const ban = await call('POST', '/admin/ban', {
        body: { name: 'berlin' },
        headers: { 'x-admin-password': 'gizli-sifre' },
      })
      expect(ban.data).toEqual({ ok: true, name: 'Berlin', banned: true })
      const after = await call('GET', '/leaderboard?scope=world')
      expect(after.data.entries.map((e: Json) => e.name)).toEqual(['Ankara', 'Izmir'])
      expect((await call('PATCH', '/players/me', { token: b.token, body: { name: 'Berlin2' } })).status).toBe(403)
      // yasaklı isim yeniden alınamaz
      expect((await register('Berlin', 'DE', '9.9.9.9')).data.error.code).toBe('NAME_TAKEN')
    })

    it('kötüye kullanımda hız sınırı', async () => {
      let last = 0
      for (let i = 0; i < 32; i++) last = (await call('POST', '/challenge', { ip: '7.7.7.7' })).status
      expect(last).toBe(429)
    })
  })
})
