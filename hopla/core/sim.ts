/**
 * Hopla — deterministik oyun çekirdeği (oyun istemcisi ve sıralama sunucusu ortak kullanır).
 *
 * Bir oyun yalnızca (seed, basılı tutma süreleri) ikilisiyle tanımlanır: platformlar seed'den
 * üretilir, her zıplamanın sonucu basılı tutma süresinden analitik olarak hesaplanır (kare
 * hızından bağımsız). Sonucu belirleyen hesaplarda yalnızca + − × ÷ ve Math.sqrt kullanılır;
 * bunlar her JS motorunda IEEE-754'e göre birebir aynıdır. Böylece sunucu, gönderilen skoru
 * oyunu yeniden oynatarak doğrular (replayRun).
 *
 * Koordinatlar: y yukarı, platformlar y=0 zeminine oturur. Yeni platform ya +x ya da −z
 * yönünde çıkar (ekranda sağ-yukarı / sol-yukarı).
 */

/** Fizik ya da üretim kuralı değişirse artırılır; sunucu bilmediği sürümü kabul etmez. */
export const SIM_VERSION = 1

export const PHYSICS = {
  /** Yerçekimi (birim/s²) */
  gravity: 38,
  /** Dikey kalkış hızı: şarjsız ve tam şarjlı (birim/s) */
  vyMin: 7.4,
  vyMax: 9.8,
  /** Tam şarj süresi (ms); daha uzun basmak mesafeyi artırmaz */
  holdMaxMs: 1400,
  /** Tam şarjda yatay mesafe (birim). Mesafe basılı tutma süresiyle doğrusal artar. */
  distMax: 8.4,
  /** Kahramanın taban yarıçapı: merkez dışarıda ama taban kenara değiyorsa devrilir */
  heroRadius: 0.31,
  /** Merkeze bu kadar yakın iniş "tam isabet" sayılır */
  perfectRadius: 0.25,
} as const

/** Bir oyunda en fazla zıplama (sunucu doğrulamasında sınır) */
export const MAX_JUMPS = 20_000
/** Tek bir basılı tutmanın kabul edilen en uzun süresi (ms) */
export const MAX_HOLD_MS = 60_000

export type Shape = 'box' | 'cyl'
/** Önceki platformdan yön: '+x' ya da '−z' */
export type Dir = 'x' | 'z'

export interface Platform {
  i: number
  shape: Shape
  x: number
  z: number
  /** Kutuda kenar uzunluğu, silindirde çap */
  size: number
  height: number
  dir: Dir
  /** Renk sırası (yalnızca görünüm) */
  tone: number
}

/** Görünümdeki renk sayısı; tone 0..TONES-1 */
export const TONES = 7

/** Küçük, hızlı ve her motorda aynı sonucu veren PRNG (32 bit tamsayı işlemleri). */
export function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Seed'den platform dizisi. Zorluk platform sırasına bağlıdır (oyuncunun puanına değil). */
export class Level {
  readonly platforms: Platform[] = []
  private readonly rng: () => number

  constructor(readonly seed: number) {
    this.rng = mulberry32(seed)
    this.platforms.push({ i: 0, shape: 'box', x: 0, z: 0, size: 2.6, height: 1.25, dir: 'x', tone: 0 })
  }

  get(i: number): Platform {
    while (this.platforms.length <= i) this.generate()
    return this.platforms[i]!
  }

  private generate() {
    const r = this.rng
    const prev = this.platforms[this.platforms.length - 1]!
    const i = prev.i + 1
    const t = Math.min(i, 80) / 80

    const shape: Shape = r() < 0.38 ? 'cyl' : 'box'
    const sizeLo = 2.0 - 0.85 * t
    const sizeHi = 2.8 - 0.95 * t
    let size = sizeLo + r() * (sizeHi - sizeLo)
    // Daire aynı çaptaki kareden küçük bir alan kaplar; biraz büyüterek dengele.
    if (shape === 'cyl') size *= 1.08
    const height = 1.1 + r() * 0.3
    const gapLo = 0.6 + 0.6 * t
    const gapHi = 1.8 + 1.8 * t
    const gap = gapLo + r() * (gapHi - gapLo)
    const dir: Dir = r() < 0.5 ? 'x' : 'z'
    const dist = prev.size / 2 + gap + size / 2
    // Aynı rengin üst üste gelmemesi için önceki tonu atla.
    let tone = Math.floor(r() * (TONES - 1))
    if (tone >= prev.tone) tone += 1

    this.platforms.push({
      i,
      shape,
      x: prev.x + (dir === 'x' ? dist : 0),
      z: prev.z - (dir === 'z' ? dist : 0),
      size,
      height,
      dir,
      tone,
    })
  }
}

/** Nokta platformun üst yüzeyinin içinde mi? (kahramanın merkezi) */
export function insideTop(p: Platform, x: number, z: number) {
  const dx = x - p.x
  const dz = z - p.z
  const h = p.size / 2
  if (p.shape === 'cyl') return dx * dx + dz * dz <= h * h
  return dx <= h && dx >= -h && dz <= h && dz >= -h
}

/** Merkez dışarıda ama taban (yarıçap r) üst yüzeye değiyor mu? */
export function touchesEdge(p: Platform, x: number, z: number, r: number) {
  const dx = x - p.x
  const dz = z - p.z
  const h = p.size / 2
  if (p.shape === 'cyl') {
    const R = h + r
    return dx * dx + dz * dz <= R * R
  }
  const ex = Math.max((dx < 0 ? -dx : dx) - h, 0)
  const ez = Math.max((dz < 0 ? -dz : dz) - h, 0)
  return ex * ex + ez * ez <= r * r
}

/**
 * Başlangıç noktasından u yönündeki ışının, yarıçap kadar genişletilmiş platform
 * izdüşümüne girdiği mesafe (girmiyorsa null). Kısa düşüşte duvara çarpmayı bulur.
 */
export function rayEntry(p: Platform, ox: number, oz: number, ux: number, uz: number, r: number): number | null {
  const h = p.size / 2 + r
  if (p.shape === 'cyl') {
    const fx = ox - p.x
    const fz = oz - p.z
    const b = fx * ux + fz * uz
    const c = fx * fx + fz * fz - h * h
    const disc = b * b - c
    if (disc < 0) return null
    const s = -b - Math.sqrt(disc)
    return s >= 0 ? s : null
  }
  let tMin = -Infinity
  let tMax = Infinity
  const axes: [number, number, number][] = [
    [ox, ux, p.x],
    [oz, uz, p.z],
  ]
  for (const [o, d, c] of axes) {
    if (d === 0) {
      if (o < c - h || o > c + h) return null
      continue
    }
    let t1 = (c - h - o) / d
    let t2 = (c + h - o) / d
    if (t1 > t2) [t1, t2] = [t2, t1]
    if (t1 > tMin) tMin = t1
    if (t2 < tMax) tMax = t2
  }
  if (tMax < tMin || tMax < 0) return null
  return tMin >= 0 ? tMin : null
}

export type Outcome =
  /** Hedef platforma indi */
  | { kind: 'land'; x: number; z: number; perfect: boolean }
  /** Kısa zıpladı, bulunduğu platforma geri indi (puan yok, oyun sürer) */
  | { kind: 'stay'; x: number; z: number }
  /** Merkez dışarıda, taban kenarda: kenardan devrilir */
  | { kind: 'edge'; x: number; z: number; on: 'current' | 'target' }
  /** Zemine düştü */
  | { kind: 'fall'; x: number; z: number }

export interface Jump {
  hold: number
  charge: number
  /** Kalkış noktası (kahramanın tabanı) */
  ox: number
  oy: number
  oz: number
  /** Yatay birim yön */
  ux: number
  uz: number
  /** Yatay ve dikey kalkış hızı, yerçekimi */
  vh: number
  vy: number
  g: number
  /** Sonucun gerçekleştiği an (s): yüzeye ya da zemine değme */
  t: number
  /** Düşüşte duvara çarpıp yatay hareketin durduğu an (s) */
  wallT: number | null
  /** Sonucun gerçekleştiği yükseklik */
  y: number
  outcome: Outcome
}

/** y0'dan kalkıp iniş kolunda y yüksekliğine ulaşma anı */
function descendTime(vy: number, g: number, y0: number, y: number) {
  return (vy + Math.sqrt(vy * vy + 2 * g * (y0 - y))) / g
}

/**
 * Tek bir zıplamanın sonucunu hesaplar. Mesafe basılı tutma süresiyle doğrusaldır;
 * yön, kahramanın bulunduğu noktadan hedef platformun merkezinedir.
 */
export function computeJump(hero: { x: number; z: number }, current: Platform, target: Platform, holdMs: number): Jump {
  const { gravity: g, vyMin, vyMax, holdMaxMs, distMax, heroRadius, perfectRadius } = PHYSICS
  const hold = holdMs < 0 ? 0 : holdMs
  const charge = (hold > holdMaxMs ? holdMaxMs : hold) / holdMaxMs
  const D = charge * distMax
  const vy = vyMin + charge * (vyMax - vyMin)
  const ox = hero.x
  const oz = hero.z
  const oy = current.height

  let dx = target.x - ox
  let dz = target.z - oz
  const len = Math.sqrt(dx * dx + dz * dz)
  if (len === 0) {
    dx = 1
    dz = 0
  } else {
    dx /= len
    dz /= len
  }
  const ux = dx
  const uz = dz

  // Yatay hız, hedefin üst yüzeyi hizasında tam D mesafeye varacak biçimde seçilir.
  const tRef = descendTime(vy, g, oy, target.height)
  const vh = D / tRef

  const base = { hold, charge, ox, oy, oz, ux, uz, vh, vy, g }

  // İniş kolunda önce yüksek yüzeye varılır.
  const surfaces =
    target.height >= current.height
      ? [
          { p: target, role: 'target' as const },
          { p: current, role: 'current' as const },
        ]
      : [
          { p: current, role: 'current' as const },
          { p: target, role: 'target' as const },
        ]

  for (const { p, role } of surfaces) {
    const t = descendTime(vy, g, oy, p.height)
    const x = ox + ux * vh * t
    const z = oz + uz * vh * t
    if (insideTop(p, x, z)) {
      if (role === 'target') {
        const cx = x - p.x
        const cz = z - p.z
        const perfect = cx * cx + cz * cz <= perfectRadius * perfectRadius
        return { ...base, t, wallT: null, y: p.height, outcome: { kind: 'land', x, z, perfect } }
      }
      return { ...base, t, wallT: null, y: p.height, outcome: { kind: 'stay', x, z } }
    }
    if (touchesEdge(p, x, z, heroRadius)) {
      return { ...base, t, wallT: null, y: p.height, outcome: { kind: 'edge', x, z, on: role } }
    }
  }

  // Zemine düşüş. Hedefin önüne düşüyorsa duvara çarpar ve dik iner.
  const t = descendTime(vy, g, oy, 0)
  let travel = vh * t
  let wallT: number | null = null
  const entry = rayEntry(target, ox, oz, ux, uz, heroRadius)
  if (entry !== null && entry < travel && vh > 0) {
    const tTop = descendTime(vy, g, oy, target.height)
    if (vh * tTop < entry) {
      wallT = entry / vh
      travel = entry
    }
  }
  return {
    ...base,
    t,
    wallT,
    y: 0,
    outcome: { kind: 'fall', x: ox + ux * travel, z: oz + uz * travel },
  }
}

/** Zıplama anındaki konum (görsel animasyon için; sonucu belirlemez). */
export function jumpPosition(j: Jump, time: number, out: { x: number; y: number; z: number }) {
  const t = time > j.t ? j.t : time
  const th = j.wallT !== null && t > j.wallT ? j.wallT : t
  out.x = j.ox + j.ux * j.vh * th
  out.z = j.oz + j.uz * j.vh * th
  out.y = j.oy + j.vy * t - 0.5 * j.g * t * t
  return out
}

/** Tam isabet serisinin puanı: 2, 3, 4 … en fazla 8 */
export function perfectPoints(streak: number) {
  return Math.min(1 + streak, 8)
}

export interface RunState {
  readonly seed: number
  readonly level: Level
  /** Kahramanın durduğu platformun sırası */
  cur: number
  x: number
  z: number
  score: number
  jumps: number
  perfects: number
  streak: number
  alive: boolean
  /** Oyunun gerçek zamanda en az sürebileceği süre (basılı tutmalar + uçuşlar, ms) */
  minMs: number
}

export function newRun(seed: number): RunState {
  const level = new Level(seed >>> 0)
  const p = level.get(0)
  return {
    seed: seed >>> 0,
    level,
    cur: 0,
    x: p.x,
    z: p.z,
    score: 0,
    jumps: 0,
    perfects: 0,
    streak: 0,
    alive: true,
    minMs: 0,
  }
}

export interface StepResult {
  jump: Jump
  points: number
  from: Platform
  to: Platform
}

/** Oyunu bir zıplama ilerletir (state'i değiştirir). */
export function step(state: RunState, holdMs: number): StepResult {
  if (!state.alive) throw new Error('run is over')
  const from = state.level.get(state.cur)
  const to = state.level.get(state.cur + 1)
  const jump = computeJump(state, from, to, holdMs)
  state.jumps += 1
  state.minMs += jump.hold + jump.t * 1000
  let points = 0
  const o = jump.outcome
  if (o.kind === 'land') {
    state.cur += 1
    state.x = o.x
    state.z = o.z
    if (o.perfect) {
      state.streak += 1
      state.perfects += 1
      points = perfectPoints(state.streak)
    } else {
      state.streak = 0
      points = 1
    }
    state.score += points
  } else if (o.kind === 'stay') {
    state.x = o.x
    state.z = o.z
  } else {
    state.alive = false
  }
  return { jump, points, from, to }
}

export interface ReplayResult {
  valid: boolean
  score: number
  jumps: number
  perfects: number
  minMs: number
  reason?: 'bad_hold' | 'too_long' | 'alive' | 'after_death'
}

/**
 * Sunucu doğrulaması: oyunu baştan oynatır. Geçerli bir oyun son basılı tutmayla
 * biter (kahraman düşer); ölümden sonra fazladan zıplama ya da yarım oyun geçersizdir.
 */
export function replayRun(seed: number, holds: readonly number[]): ReplayResult {
  const fail = (reason: ReplayResult['reason']): ReplayResult => ({
    valid: false,
    score: 0,
    jumps: 0,
    perfects: 0,
    minMs: 0,
    reason,
  })
  if (holds.length === 0 || holds.length > MAX_JUMPS) return fail('too_long')
  const s = newRun(seed)
  for (let k = 0; k < holds.length; k++) {
    const h = holds[k]
    if (typeof h !== 'number' || !Number.isInteger(h) || h < 0 || h > MAX_HOLD_MS) return fail('bad_hold')
    if (!s.alive) return fail('after_death')
    step(s, h)
  }
  if (s.alive) return fail('alive')
  return { valid: true, score: s.score, jumps: s.jumps, perfects: s.perfects, minMs: s.minMs }
}

/** Mesafeyi tam karşılayan basılı tutma süresi (testler ve ipucu için). */
export function holdForDistance(d: number) {
  return (d / PHYSICS.distMax) * PHYSICS.holdMaxMs
}
