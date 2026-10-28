import { describe, expect, it } from 'vitest'
import {
  Level,
  MAX_HOLD_MS,
  PHYSICS,
  computeJump,
  holdForDistance,
  insideTop,
  newRun,
  perfectPoints,
  replayRun,
  step,
  type Platform,
  type RunState,
} from '../hopla/core/sim'

/** Kahramandan hedef merkeze tam isabet için gereken basılı tutma süresi (ms, tamsayı). */
function aim(s: RunState, offset = 0) {
  const t = s.level.get(s.cur + 1)
  const d = Math.sqrt((t.x - s.x) ** 2 + (t.z - s.z) ** 2) + offset
  return Math.round(holdForDistance(d))
}

describe('hopla seviye üretimi', () => {
  it('aynı seed aynı platformları üretir', () => {
    const a = new Level(42)
    const b = new Level(42)
    for (let i = 0; i < 200; i++) expect(a.get(i)).toEqual(b.get(i))
    expect(new Level(43).get(5)).not.toEqual(a.get(5))
  })

  it('platformlar üst üste binmez ve hep ileri gider', () => {
    const level = new Level(7)
    for (let i = 1; i < 400; i++) {
      const p = level.get(i)
      const q = level.get(i - 1)
      expect(p.x).toBeGreaterThanOrEqual(q.x)
      expect(p.z).toBeLessThanOrEqual(q.z)
      const along = p.dir === 'x' ? p.x - q.x : q.z - p.z
      const gap = along - p.size / 2 - q.size / 2
      expect(gap).toBeGreaterThanOrEqual(0.6 - 1e-9)
      expect(p.size).toBeGreaterThan(1.1)
      expect(p.height).toBeGreaterThanOrEqual(1.1)
      expect(p.height).toBeLessThanOrEqual(1.4)
      expect(p.tone).not.toBe(q.tone)
    }
  })

  it('zorluk artar: platformlar küçülür, aralar açılır', () => {
    const level = new Level(99)
    const avg = (from: number, to: number, f: (p: Platform) => number) => {
      let sum = 0
      for (let i = from; i < to; i++) sum += f(level.get(i))
      return sum / (to - from)
    }
    expect(avg(1, 30, (p) => p.size)).toBeGreaterThan(avg(100, 160, (p) => p.size))
  })
})

describe('hopla zıplama fiziği', () => {
  const current: Platform = { i: 0, shape: 'box', x: 0, z: 0, size: 2.4, height: 1.2, dir: 'x', tone: 0 }
  const target: Platform = { i: 1, shape: 'cyl', x: 4, z: 0, size: 2, height: 1.3, dir: 'x', tone: 1 }

  it('merkeze tam mesafe: tam isabet', () => {
    const j = computeJump({ x: 0, z: 0 }, current, target, holdForDistance(4))
    expect(j.outcome.kind).toBe('land')
    expect(j.outcome.kind === 'land' && j.outcome.perfect).toBe(true)
    expect(j.outcome.x).toBeCloseTo(4, 9)
    expect(j.t).toBeGreaterThan(0.3)
    expect(j.t).toBeLessThan(0.7)
  })

  it('mesafe basılı tutma süresiyle doğrusal artar', () => {
    const wide: Platform = { ...target, shape: 'box', x: 6, size: 8 }
    const d1 = computeJump({ x: 0, z: 0 }, current, wide, 500).outcome
    const d2 = computeJump({ x: 0, z: 0 }, current, wide, 1000).outcome
    expect(d1.kind).toBe('land')
    expect(d2.kind).toBe('land')
    expect(d1.x / d2.x).toBeCloseTo(0.5, 9)
  })

  it('dokunup bırakınca aynı platformda kalır', () => {
    const j = computeJump({ x: 0, z: 0 }, current, target, 0)
    expect(j.outcome.kind).toBe('stay')
  })

  it('kısa zıplama: araya düşer, duvara çarpıp dik iner', () => {
    const j = computeJump({ x: 0, z: 0 }, current, target, holdForDistance(2.6))
    expect(j.outcome.kind).toBe('fall')
    expect(j.wallT).not.toBeNull()
    // Hedefin (yarıçapı + kahraman yarıçapı) önünde durur
    expect(j.outcome.x).toBeCloseTo(4 - 1 - PHYSICS.heroRadius, 6)
  })

  it('uzun zıplama: hedefin arkasına düşer', () => {
    const j = computeJump({ x: 0, z: 0 }, current, target, holdForDistance(6))
    expect(j.outcome.kind).toBe('fall')
    expect(j.wallT).toBeNull()
    expect(j.outcome.x).toBeGreaterThan(5)
  })

  it('merkez dışarıda, taban kenarda: devrilir', () => {
    const j = computeJump({ x: 0, z: 0 }, current, target, holdForDistance(4 - 1 - PHYSICS.heroRadius / 2))
    expect(j.outcome).toMatchObject({ kind: 'edge', on: 'target' })
  })

  it('kenara çok yakın ama merkez içeride: güvenli iniş', () => {
    const j = computeJump({ x: 0, z: 0 }, current, target, holdForDistance(3.02))
    expect(j.outcome.kind).toBe('land')
  })

  it('tam şarjdan uzun basmak mesafeyi artırmaz', () => {
    const a = computeJump({ x: 0, z: 0 }, current, target, PHYSICS.holdMaxMs).outcome
    const b = computeJump({ x: 0, z: 0 }, current, target, PHYSICS.holdMaxMs * 3).outcome
    expect(a).toEqual(b)
  })

  it('tam isabet serisi 2, 3, 4 … 8 puan verir', () => {
    expect([1, 2, 3, 6, 7, 8, 20].map(perfectPoints)).toEqual([2, 3, 4, 7, 8, 8, 8])
  })
})

describe('hopla oyun akışı ve yeniden oynatma', () => {
  it('kusursuz oyuncu 500 zıplamada hiç düşmez (her hedef erişilebilir)', () => {
    const s = newRun(123456)
    for (let k = 0; k < 500; k++) {
      const r = step(s, aim(s))
      expect(r.jump.outcome.kind).toBe('land')
    }
    expect(s.alive).toBe(true)
    expect(s.perfects).toBe(500)
    // 2+3+4+5+6+7 ve sonrası hep 8
    expect(s.score).toBe(2 + 3 + 4 + 5 + 6 + 7 + 8 * 494)
  })

  it('istemcinin hesapladığı skor sunucudaki yeniden oynatmayla birebir aynıdır', () => {
    for (const seed of [1, 99, 2 ** 31 + 5, 4_000_000_000]) {
      const s = newRun(seed)
      const holds: number[] = []
      let k = 0
      // Bazen merkeze, bazen kenara yakın; sonunda bilerek kısa basıp düşer.
      while (s.alive && k < 300) {
        const h = k === 120 ? 0 : k > 200 ? 30 : aim(s, ((k * 37) % 9) * 0.07 - 0.28)
        holds.push(h)
        step(s, h)
        k++
      }
      const r = replayRun(seed, holds)
      expect(r.valid).toBe(true)
      expect(r.score).toBe(s.score)
      expect(r.jumps).toBe(s.jumps)
      expect(r.perfects).toBe(s.perfects)
      expect(r.minMs).toBe(s.minMs)
      const total = holds.reduce((a, b) => a + b, 0)
      expect(r.minMs).toBeGreaterThan(total)
    }
  })

  it('geçersiz oyunları reddeder', () => {
    const s = newRun(5)
    const holds = [aim(s)]
    step(s, holds[0]!)
    expect(replayRun(5, holds)).toMatchObject({ valid: false, reason: 'alive' })
    expect(replayRun(5, [...holds, 5000, 400])).toMatchObject({ valid: false, reason: 'after_death' })
    expect(replayRun(5, [12.5])).toMatchObject({ valid: false, reason: 'bad_hold' })
    expect(replayRun(5, [-1])).toMatchObject({ valid: false, reason: 'bad_hold' })
    expect(replayRun(5, [MAX_HOLD_MS + 1])).toMatchObject({ valid: false, reason: 'bad_hold' })
    expect(replayRun(5, [])).toMatchObject({ valid: false })
  })

  it('kenara inişte yeni konum merkezde değil, indiği yerdedir', () => {
    const s = newRun(77)
    step(s, aim(s, 0.4))
    const p = s.level.get(s.cur)
    expect(s.cur).toBe(1)
    expect(insideTop(p, s.x, s.z)).toBe(true)
    expect(Math.abs(s.x - p.x) + Math.abs(s.z - p.z)).toBeGreaterThan(0.3)
  })
})
