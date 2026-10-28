import { Quaternion, Vector3, type Mesh } from 'three'
import { PHYSICS, jumpPosition, newRun, step, type Jump, type Platform, type RunState } from '../../core/sim'
import { Effects, clamp01, ease, spring, timed } from './anim'
import { HERO, SQUASH } from './config'
import { Hero, Ripple, createPlatform, disposePlatform } from './meshes'
import type { World } from './world'

export type Phase = 'intro' | 'idle' | 'charging' | 'flying' | 'falling' | 'over'

export interface RunResult {
  seed: number
  holds: number[]
  score: number
  jumps: number
  perfects: number
  durationMs: number
}

export interface GameEvents {
  /** Yeni oyun hazırlandı (bilet bu seed için istenir) */
  prepared(seed: number): void
  /** Oyunun ilk basışı */
  started(): void
  charge(on: boolean): void
  landed(info: { points: number; perfect: boolean; score: number; screen: { x: number; y: number } }): void
  fell(): void
  over(result: RunResult): void
}

interface Flight {
  jump: Jump
  time: number
  axis: Vector3
  flip: number
  flipT: number
  /** Ezilmiş platform yüzeyinden kalkış farkı */
  depth: number
  sx: number
  sy: number
  points: number
  from: Platform
  to: Platform
}

const UP = new Vector3(0, 1, 0)
const P = { x: 0, y: 0, z: 0 }
const V = new Vector3()
const W = new Vector3()
const Q = new Quaternion()
const SCREEN = { x: 0, y: 0 }

/**
 * Oyun akışı: başlık → bekle → şarj → uçuş → (iniş | düşüş) → bitti.
 * Sonuçlar core/sim'den gelir; burada yalnızca animasyon ve sahne yönetimi var.
 */
export class Game {
  phase: Phase = 'intro'
  private run!: RunState
  private holds: number[] = []
  private readonly meshes = new Map<number, Mesh>()
  private readonly hero = new Hero()
  private readonly ripple = new Ripple()
  private readonly effects = new Effects()
  private flight: Flight | null = null
  private pressAt = 0
  private pointerDown = false
  private startedAt = 0
  private loop = 0
  private last = 0
  private idle = 0

  constructor(
    private readonly world: World,
    private readonly events: GameEvents,
    private readonly nextSeed: () => number,
  ) {
    world.scene.add(this.hero.root, this.ripple.mesh)
    this.setup('intro')
  }

  get score() {
    return this.run.score
  }

  // ---------------------------------------------------------------- girdi

  press(time: number) {
    this.pointerDown = true
    if (this.phase === 'intro') {
      this.phase = 'idle'
      this.events.started()
      this.startedAt = time
    }
    if (this.phase === 'idle') this.beginCharge(time)
    this.wake()
  }

  release(time: number) {
    this.pointerDown = false
    if (this.phase !== 'charging') return
    this.jump(Math.max(0, Math.round(time - this.pressAt)))
  }

  /** Uygulama arka plana geçti ya da dokunuş iptal oldu: zıplamadan bırak. */
  cancel() {
    this.pointerDown = false
    if (this.phase !== 'charging') return
    this.phase = 'idle'
    this.events.charge(false)
    const p = this.run.level.get(this.run.cur)
    const mesh = this.meshes.get(p.i)
    if (mesh) mesh.scale.y = 1
    this.hero.squash.scale.set(1, 1, 1)
    this.hero.root.position.y = p.height
    this.wake()
  }

  /** Bitti ekranından yeni oyun. */
  restart() {
    this.setup('idle')
    this.wake()
  }

  // ---------------------------------------------------------------- kurulum

  private setup(phase: 'intro' | 'idle') {
    for (const mesh of this.meshes.values()) disposePlatform(mesh)
    this.meshes.clear()
    this.effects.clear()
    this.flight = null
    this.pointerDown = false
    this.ripple.mesh.visible = false

    const seed = this.nextSeed()
    this.run = newRun(seed)
    this.holds = []
    this.phase = phase
    this.startedAt = performance.now()

    this.addPlatform(0, false)
    this.addPlatform(1, false)
    const p0 = this.run.level.get(0)
    this.hero.reset()
    this.hero.root.position.set(p0.x, p0.height, p0.z)
    this.aimCamera()
    this.world.snap()
    this.events.prepared(seed)
    this.render()
  }

  private addPlatform(i: number, pop: boolean) {
    if (this.meshes.has(i)) return
    const p = this.run.level.get(i)
    const mesh = createPlatform(p)
    this.meshes.set(i, mesh)
    this.world.scene.add(mesh)
    if (pop) {
      mesh.scale.y = 0.001
      this.effects.add(timed(0.42, (t) => (mesh.scale.y = Math.max(0.001, ease.outBack(t)))))
    }
  }

  private aimCamera() {
    const a = this.run.level.get(this.run.cur)
    const b = this.run.level.get(this.run.cur + 1)
    this.world.goal.set((a.x + b.x) / 2, 1, (a.z + b.z) / 2)
  }

  /** Geride kalan platformları sahneden çıkar (bellek sabit kalır). */
  private prune() {
    for (const [i, mesh] of this.meshes) {
      if (i < this.run.cur - 5) {
        disposePlatform(mesh)
        this.meshes.delete(i)
      }
    }
  }

  // ---------------------------------------------------------------- şarj ve zıplama

  private beginCharge(time: number) {
    this.phase = 'charging'
    this.pressAt = time
    this.events.charge(true)
  }

  private applyCharge(c: number) {
    const p = this.run.level.get(this.run.cur)
    const s = 1 - SQUASH.platform * c
    const mesh = this.meshes.get(p.i)
    if (mesh) mesh.scale.y = s
    this.hero.squash.scale.set(1 + SQUASH.heroXZ * c, 1 - SQUASH.heroY * c, 1 + SQUASH.heroXZ * c)
    this.hero.root.position.y = p.height * s
  }

  private jump(hold: number) {
    const c = clamp01(hold / PHYSICS.holdMaxMs)
    this.applyCharge(c)
    this.events.charge(false)
    const res = step(this.run, hold)
    this.holds.push(hold)

    const fromMesh = this.meshes.get(res.from.i)
    if (fromMesh) this.bounce(fromMesh, -SQUASH.platform * c, 0.7)

    const j = res.jump
    const axis = new Vector3(j.uz, 0, -j.ux).normalize()
    const big = c > 0.12
    // Düşüşte takla, planlanan iniş anında biter; sonra dik düşer.
    const planned = (j.vy + Math.sqrt(j.vy * j.vy + 2 * j.g * (j.oy - res.to.height))) / j.g
    this.flight = {
      jump: j,
      time: 0,
      axis,
      flip: big ? Math.PI * 2 : 0,
      // Takla uçuşun ilk %80'inde tamamlanır: iniş anında kahraman hep dik.
      flipT: (j.outcome.kind === 'fall' ? Math.min(planned, j.t) : j.t) * 0.8,
      depth: res.from.height * SQUASH.platform * c,
      sx: this.hero.squash.scale.x,
      sy: this.hero.squash.scale.y,
      points: res.points,
      from: res.from,
      to: res.to,
    }
    this.phase = 'flying'
  }

  private updateFlight(dt: number, now: number) {
    const f = this.flight!
    f.time += dt
    const j = f.jump
    const t = Math.min(f.time, j.t)
    jumpPosition(j, t, P)
    const lift = f.depth * Math.max(0, 1 - t / 0.06)
    this.hero.root.position.set(P.x, P.y - lift, P.z)
    const sy = 1 + spring(f.sy - 1, t, 3.4, 0.42)
    const sx = 1 + spring(f.sx - 1, t, 3.4, 0.42)
    this.hero.squash.scale.set(sx, sy, sx)
    if (f.flip) {
      const a = f.flip * ease.inOutSine(clamp01(t / f.flipT))
      this.hero.spin.quaternion.setFromAxisAngle(f.axis, a)
    }
    if (f.time >= j.t) this.touchdown(now)
  }

  private touchdown(now: number) {
    const f = this.flight!
    const o = f.jump.outcome
    this.flight = null
    const hero = this.hero
    hero.reset()

    if (o.kind === 'land' || o.kind === 'stay') {
      const p = o.kind === 'land' ? f.to : f.from
      hero.root.position.set(o.x, p.height, o.z)
      this.landSquash()
      const mesh = this.meshes.get(p.i)
      if (mesh) this.bounce(mesh, -0.05, 0.5)
      if (o.kind === 'land') {
        if (o.perfect) this.rippleAt(p)
        this.addPlatform(this.run.cur + 1, true)
        this.aimCamera()
        this.prune()
        V.copy(hero.root.position).y += hero.height + 0.3
        this.events.landed({
          points: f.points,
          perfect: o.perfect,
          score: this.run.score,
          screen: this.world.toScreen(V, SCREEN),
        })
      }
      this.phase = 'idle'
      if (this.pointerDown) this.beginCharge(now)
      return
    }

    this.phase = 'falling'
    this.events.fell()
    if (o.kind === 'edge') {
      const p = o.on === 'target' ? f.to : f.from
      // Kenardaki dönme noktası ve dışarı yönü
      const pivot = nearestOnTop(p, o.x, o.z, W)
      const n = new Vector3(o.x - pivot.x, 0, o.z - pivot.z)
      if (n.lengthSq() < 1e-8) n.set(f.jump.ux, 0, f.jump.uz)
      n.normalize()
      hero.root.position.set(o.x, p.height, o.z)
      this.topple(new Vector3(pivot.x, p.height, pivot.z), n, true)
    } else {
      hero.root.position.set(o.x, 0, o.z)
      // Duvara çarptıysa geriye, değilse ileri devrilir.
      const sign = f.jump.wallT !== null ? -1 : 1
      const n = new Vector3(f.jump.ux * sign, 0, f.jump.uz * sign)
      const pivot = new Vector3(o.x, 0, o.z).addScaledVector(n, HERO.radius)
      this.topple(pivot, n, false)
    }
  }

  /** Kahramanı pivot çevresinde n yönüne devirir; kenardaysa ardından zemine düşer. */
  private topple(pivot: Vector3, n: Vector3, fromEdge: boolean) {
    const root = this.hero.root
    const axis = new Vector3().crossVectors(UP, n).normalize()
    const start = root.position.clone().sub(pivot)
    const tipTo = fromEdge ? (70 * Math.PI) / 180 : Math.PI / 2
    const apply = (theta: number) => {
      Q.setFromAxisAngle(axis, theta)
      root.quaternion.copy(Q)
      root.position.copy(start).applyQuaternion(Q).add(pivot)
    }
    const finish = () => {
      // Kısa bir duraklamadan sonra bitti ekranı
      this.effects.add(
        timed(
          0.55,
          () => {},
          () => this.over(),
        ),
      )
    }
    const tip = timed(
      fromEdge ? 0.3 : 0.36,
      (t) => apply(tipTo * ease.inQuad(t)),
      () => {
        if (!fromEdge) {
          finish()
          return
        }
        // Kenardan zemine serbest düşüş; düşerken yatay konuma gelir.
        const from = root.position.clone()
        const drop = from.y - HERO.radius
        const duration = Math.sqrt((2 * Math.max(drop, 0.05)) / 30)
        this.effects.add(
          timed(
            duration,
            (t) => {
              const theta = tipTo + (Math.PI / 2 - tipTo) * t
              root.quaternion.setFromAxisAngle(axis, theta)
              root.position.set(from.x + n.x * 0.45 * t, from.y - drop * t * t, from.z + n.z * 0.45 * t)
            },
            finish,
          ),
        )
      },
    )
    this.effects.add(tip)
  }

  private over() {
    this.phase = 'over'
    const s = this.run
    this.events.over({
      seed: s.seed,
      holds: this.holds.slice(),
      score: s.score,
      jumps: s.jumps,
      perfects: s.perfects,
      durationMs: Math.round(performance.now() - this.startedAt),
    })
  }

  // ---------------------------------------------------------------- küçük efektler

  private bounce(mesh: Mesh, x0: number, duration: number) {
    this.effects.add(
      timed(
        duration,
        (t) => (mesh.scale.y = 1 + spring(x0, t * duration, 4.4, 0.3)),
        () => (mesh.scale.y = 1),
      ),
    )
  }

  private landSquash() {
    const sq = this.hero.squash
    this.effects.add(
      timed(
        0.45,
        (t) => {
          const time = t * 0.45
          const y = 1 + spring(-0.24, time, 3.6, 0.38)
          const xz = 1 + spring(0.12, time, 3.6, 0.38)
          sq.scale.set(xz, y, xz)
        },
        () => sq.scale.set(1, 1, 1),
      ),
    )
  }

  private rippleAt(p: Platform) {
    const ring = this.ripple.mesh
    ring.visible = true
    ring.position.set(p.x, p.height + 0.015, p.z)
    const max = p.size * 0.62
    this.effects.add(
      timed(
        0.6,
        (t) => {
          const s = 0.25 + (max - 0.25) * ease.outCubic(t)
          ring.scale.set(s, s, s)
          ring.material.opacity = 0.9 * (1 - t)
        },
        () => (ring.visible = false),
      ),
    )
  }

  // ---------------------------------------------------------------- döngü

  private get busy() {
    return (
      this.phase === 'charging' ||
      this.phase === 'flying' ||
      this.phase === 'falling' ||
      this.effects.active ||
      !this.world.settled
    )
  }

  /** Çizim döngüsünü başlatır; her şey durunca kendiliğinden uyur (pil dostu). */
  wake() {
    if (this.loop) return
    this.last = performance.now()
    this.idle = 0
    this.loop = requestAnimationFrame(this.frame)
  }

  private readonly frame = (now: number) => {
    const dt = Math.min(0.05, Math.max(0, (now - this.last) / 1000))
    this.last = now
    if (this.phase === 'charging') this.applyCharge(clamp01((now - this.pressAt) / PHYSICS.holdMaxMs))
    if (this.phase === 'flying') this.updateFlight(dt, now)
    this.effects.update(dt)
    this.world.update(dt)
    this.world.render()
    this.idle = this.busy ? 0 : this.idle + dt
    this.loop = this.idle > 0.3 ? 0 : requestAnimationFrame(this.frame)
  }

  render() {
    this.world.render()
  }

  /** Testler ve hata ayıklama için durum özeti */
  debug() {
    const s = this.run
    return {
      phase: this.phase,
      score: s.score,
      cur: s.cur,
      x: s.x,
      z: s.z,
      jumps: s.jumps,
      alive: s.alive,
      seed: s.seed,
    }
  }

  /** Testler için: sonraki hedefin merkezine olan uzaklık */
  aimInfo() {
    const s = this.run
    const t = s.level.get(s.cur + 1)
    const d = Math.sqrt((t.x - s.x) ** 2 + (t.z - s.z) ** 2)
    return { distance: d, holdForCenter: (d / PHYSICS.distMax) * PHYSICS.holdMaxMs, target: t }
  }
}

/** Platform üst yüzeyinde noktaya en yakın kenar noktası */
function nearestOnTop(p: Platform, x: number, z: number, out: Vector3) {
  const h = p.size / 2
  if (p.shape === 'cyl') {
    const dx = x - p.x
    const dz = z - p.z
    const len = Math.sqrt(dx * dx + dz * dz) || 1
    return out.set(p.x + (dx / len) * h, p.height, p.z + (dz / len) * h)
  }
  return out.set(Math.min(Math.max(x, p.x - h), p.x + h), p.height, Math.min(Math.max(z, p.z - h), p.z + h))
}
