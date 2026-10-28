import {
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  Group,
  LatheGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  SphereGeometry,
  Vector2,
  Vector3,
  type Material,
} from 'three'
import { clamp01 } from './anim'

/**
 * Sosisin yüzü: kaş, göz, ağız, yanak ve ter damlası. Hepsi gövdenin yüzeyine oturan gerçek
 * 3B parçalar (doku yok). İfade sayısal değerlerden oluşur ve hedefe yumuşakça geçer.
 */
export interface Expr {
  /** Göz açıklığı (1 normal, ~0.2 kısık) */
  eyeOpen: number
  eyeSize: number
  /** Kaşların yukarı kayması */
  browLift: number
  /** + iç uçlar aşağı (kararlı/kızgın), − iç uçlar yukarı (endişeli) */
  browTilt: number
  mouthW: number
  mouthOpen: number
  /** + gülümseme, − somurtma */
  mouthCurve: number
  blush: number
  sweat: number
  eyes: 'open' | 'happy' | 'x'
}

type Num = Exclude<keyof Expr, 'eyes'>
const KEYS: Num[] = [
  'eyeOpen',
  'eyeSize',
  'browLift',
  'browTilt',
  'mouthW',
  'mouthOpen',
  'mouthCurve',
  'blush',
  'sweat',
]

const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a))
  return t * t * (3 - 2 * t)
}

export const EXPR = {
  idle: {
    eyeOpen: 1,
    eyeSize: 1,
    browLift: 0.008,
    browTilt: 0,
    mouthW: 0.1,
    mouthOpen: 0,
    mouthCurve: 0.022,
    blush: 0.25,
    sweat: 0,
    eyes: 'open',
  } satisfies Expr,
  /** Basma şiddetine göre: kararlı → zorlanan → kıpkırmızı, terlemiş */
  charge(c: number): Expr {
    const strain = smooth(0.45, 1, c)
    return {
      eyeOpen: 1 - 0.72 * strain,
      eyeSize: 1 - 0.08 * c,
      browLift: -0.03 * smooth(0, 0.5, c),
      browTilt: 0.12 + 0.42 * smooth(0, 0.7, c),
      mouthW: 0.085 + 0.08 * c,
      mouthOpen: 0.05 * strain,
      mouthCurve: 0.01 - 0.05 * smooth(0.15, 0.9, c),
      blush: 0.25 + 0.75 * c,
      sweat: smooth(0.62, 0.9, c),
      eyes: 'open',
    }
  },
  /** Havada: gözler kocaman, ağız açık */
  flying(big: number): Expr {
    return {
      eyeOpen: 1.08,
      eyeSize: 1 + 0.18 * big,
      browLift: 0.03 + 0.02 * big,
      browTilt: -0.18,
      mouthW: 0.08,
      mouthOpen: 0.03 + 0.045 * big,
      mouthCurve: 0.025,
      blush: 0.35,
      sweat: 0,
      eyes: 'open',
    }
  },
  /** Tam isabet: gözler gülerek kapanır */
  happy: {
    eyeOpen: 1,
    eyeSize: 1,
    browLift: 0.025,
    browTilt: -0.12,
    mouthW: 0.13,
    mouthOpen: 0.045,
    mouthCurve: 0.045,
    blush: 0.7,
    sweat: 0,
    eyes: 'happy',
  } satisfies Expr,
  /** Kenarda/havada düşerken: şaşkın */
  shocked: {
    eyeOpen: 1.12,
    eyeSize: 1.22,
    browLift: 0.05,
    browTilt: -0.35,
    mouthW: 0.065,
    mouthOpen: 0.075,
    mouthCurve: 0,
    blush: 0.2,
    sweat: 0.6,
    eyes: 'open',
  } satisfies Expr,
  /** Yere düştü: çarpı gözler, "o" ağız */
  dizzy: {
    eyeOpen: 1,
    eyeSize: 1,
    browLift: 0.035,
    browTilt: -0.3,
    mouthW: 0.075,
    mouthOpen: 0.075,
    mouthCurve: 0,
    blush: 0.15,
    sweat: 0,
    eyes: 'x',
  } satisfies Expr,
}

// ---------------------------------------------------------------- tüp çizgi (kaş, ağız, çarpı)

const RAD = 6

/** Sabit nokta sayılı ince tüp; noktalar değiştikçe aynı tampon yeniden yazılır. */
class Stroke {
  readonly mesh: Mesh
  private readonly pos: Float32Array
  private readonly nor: Float32Array
  private readonly geo = new BufferGeometry()

  constructor(
    readonly count: number,
    readonly closed: boolean,
    readonly radius: number,
    material: Material,
  ) {
    this.pos = new Float32Array(count * RAD * 3)
    this.nor = new Float32Array(count * RAD * 3)
    const index: number[] = []
    const segs = closed ? count : count - 1
    for (let i = 0; i < segs; i++) {
      const a = i * RAD
      const b = ((i + 1) % count) * RAD
      for (let k = 0; k < RAD; k++) {
        const k1 = (k + 1) % RAD
        index.push(a + k, b + k, a + k1, a + k1, b + k, b + k1)
      }
    }
    this.geo.setIndex(index)
    this.geo.setAttribute('position', new BufferAttribute(this.pos, 3))
    this.geo.setAttribute('normal', new BufferAttribute(this.nor, 3))
    this.mesh = new Mesh(this.geo, material)
  }

  /** pts: nokta konumları, ns: her noktada yüzeyin dışa bakan normali (count·3) */
  set(pts: Float32Array, ns: Float32Array) {
    const { count, closed } = this
    for (let i = 0; i < count; i++) {
      const prev = closed ? (i - 1 + count) % count : Math.max(0, i - 1)
      const next = closed ? (i + 1) % count : Math.min(count - 1, i + 1)
      T.set(
        pts[next * 3]! - pts[prev * 3]!,
        pts[next * 3 + 1]! - pts[prev * 3 + 1]!,
        pts[next * 3 + 2]! - pts[prev * 3 + 2]!,
      )
      N.set(ns[i * 3]!, ns[i * 3 + 1]!, ns[i * 3 + 2]!)
      if (T.lengthSq() < 1e-12) T.crossVectors(N, UP)
      T.normalize()
      N.addScaledVector(T, -N.dot(T)).normalize()
      B.crossVectors(T, N)
      // Açık uçlar sivrilir (fırça darbesi gibi)
      const s = closed ? 1 : Math.sin((Math.PI * i) / (count - 1))
      const r = this.radius * (closed ? 1 : 0.25 + 0.75 * Math.sqrt(s))
      for (let k = 0; k < RAD; k++) {
        const a = (k / RAD) * Math.PI * 2
        const c = Math.cos(a)
        const d = Math.sin(a)
        const o = (i * RAD + k) * 3
        const nx = c * N.x + d * B.x
        const ny = c * N.y + d * B.y
        const nz = c * N.z + d * B.z
        this.nor[o] = nx
        this.nor[o + 1] = ny
        this.nor[o + 2] = nz
        this.pos[o] = pts[i * 3]! + nx * r
        this.pos[o + 1] = pts[i * 3 + 1]! + ny * r
        this.pos[o + 2] = pts[i * 3 + 2]! + nz * r
      }
    }
    this.geo.attributes.position!.needsUpdate = true
    this.geo.attributes.normal!.needsUpdate = true
    this.geo.computeBoundingSphere()
  }
}

const T = new Vector3()
const N = new Vector3()
const B = new Vector3()
const UP = new Vector3(0, 1, 0)

// ---------------------------------------------------------------- yüz

export interface FaceSurface {
  /** Gövde ekseninden yüzeye uzaklık (yerel y'de) */
  radius(y: number): number
  /** Yüzün ortasının yüksekliği */
  y: number
  /** Kameraya bakan yatay açı (x-z düzleminde) */
  angle: number
  /** Kamera yükseklik açısının tanjantı */
  tilt: number
  /** Gövde ekseninin yüksekliğe göre yana kayması (sosis kıvrımı) ve yönü */
  bend(y: number): number
  bendDir: { x: number; z: number }
}

const M = 28
const BROW = 7

export class Face {
  readonly group = new Group()
  private readonly cur: Expr = { ...EXPR.idle }
  private target: Expr = { ...EXPR.idle }
  private dirty = true
  private readonly eyes: { root: Group; oval: Mesh; shine: Mesh; happy: Mesh; x: Group }[] = []
  private readonly brows: Stroke[]
  private readonly lips: Stroke
  private readonly inside: Mesh
  private readonly insidePos = new Float32Array((M + 1) * 3)
  private readonly cheeks: Mesh[] = []
  private readonly cheekMat: MeshBasicMaterial
  private readonly sweat: Mesh
  private readonly pts = new Float32Array(M * 3)
  private readonly ns = new Float32Array(M * 3)

  constructor(private readonly surf: FaceSurface) {
    const ink = new MeshStandardMaterial({ color: 0x2a1712, roughness: 0.42 })
    const eyeMat = new MeshStandardMaterial({ color: 0x1b1515, roughness: 0.18 })
    const shineMat = new MeshBasicMaterial({ color: 0xffffff })
    const mouthMat = new MeshStandardMaterial({ color: 0x5e1b17, roughness: 0.7, side: DoubleSide })
    this.cheekMat = new MeshBasicMaterial({ color: 0xff5a5f, transparent: true, opacity: 0, depthWrite: false })

    const ovalGeo = new SphereGeometry(0.07, 20, 14)
    const shineGeo = new SphereGeometry(0.021, 10, 8)
    const flat = new Float32Array(BROW * 3)
    const out = new Float32Array(BROW * 3)
    for (let i = 0; i < BROW; i++) out[i * 3 + 2] = 1

    for (const side of [-1, 1]) {
      const root = new Group()
      this.place(root, side * 0.12, 0.06, 0)
      const oval = new Mesh(ovalGeo, eyeMat)
      oval.scale.z = 0.5
      const shine = new Mesh(shineGeo, shineMat)
      shine.position.set(0.024, 0.038, 0.032)
      // Mutlu göz: ters "U"
      const happy = new Stroke(BROW, false, 0.026, eyeMat)
      for (let i = 0; i < BROW; i++) {
        const s = (i / (BROW - 1)) * 2 - 1
        flat[i * 3] = s * 0.062
        flat[i * 3 + 1] = 0.036 * (1 - s * s) - 0.012
        flat[i * 3 + 2] = 0.012
      }
      happy.set(flat, out)
      // Çarpı göz
      const x = new Group()
      for (const dir of [-1, 1]) {
        const st = new Stroke(BROW, false, 0.025, eyeMat)
        for (let i = 0; i < BROW; i++) {
          const s = (i / (BROW - 1)) * 2 - 1
          flat[i * 3] = s * 0.052
          flat[i * 3 + 1] = s * 0.052 * dir
          flat[i * 3 + 2] = 0.012
        }
        st.set(flat, out)
        x.add(st.mesh)
      }
      root.add(oval, shine, happy.mesh, x)
      this.group.add(root)
      this.eyes.push({ root, oval, shine, happy: happy.mesh, x })

      const cheek = new Mesh(new SphereGeometry(0.062, 16, 10), this.cheekMat)
      cheek.scale.set(1, 0.55, 0.2)
      this.place(cheek, side * 0.2, -0.06, 0.004)
      cheek.renderOrder = 3
      this.cheeks.push(cheek)
      this.group.add(cheek)
    }

    this.brows = [0, 1].map(() => new Stroke(BROW, false, 0.027, ink))
    this.lips = new Stroke(M, true, 0.022, ink)
    const fan = new BufferGeometry()
    fan.setAttribute('position', new BufferAttribute(this.insidePos, 3))
    const idx: number[] = []
    for (let i = 0; i < M; i++) idx.push(0, 1 + i, 1 + ((i + 1) % M))
    fan.setIndex(idx)
    this.inside = new Mesh(fan, mouthMat)
    this.group.add(...this.brows.map((b) => b.mesh), this.lips.mesh, this.inside)

    // Ter damlası: alnın yanında
    const dropPts: Vector2[] = []
    for (let i = 0; i <= 12; i++) {
      const t = i / 12
      const y = -0.045 + 0.11 * t
      const r = t < 0.45 ? 0.04 * Math.sin(Math.acos(1 - t / 0.45)) : 0.04 * (1 - (t - 0.45) / 0.55) ** 1.4
      dropPts.push(new Vector2(Math.max(0.0005, r), y))
    }
    this.sweat = new Mesh(
      new LatheGeometry(dropPts, 16),
      new MeshStandardMaterial({ color: 0x9fd6f2, roughness: 0.08, metalness: 0 }),
    )
    this.place(this.sweat, 0.3, 0.2, 0.02)
    this.group.add(this.sweat)

    for (const o of this.group.children) o.traverse((m) => (m.castShadow = false))
    this.apply()
  }

  /** Nesneyi yüzeyde (u: yatay yay uzunluğu, v: yükseklik) konumlar, yüzün dışa bakması için döndürür. */
  private place(o: { position: Vector3; rotation: { y: number } }, u: number, v: number, lift: number) {
    this.surface(u, v, lift, TMP, NRM)
    o.position.copy(TMP)
    o.rotation.y = Math.atan2(NRM.x, NRM.z)
  }

  private surface(u: number, v: number, lift: number, out: Vector3, n: Vector3) {
    // Kamera yukarıdan baktığı için gövdenin yanlarına doğru kalan noktalar ekranda yükselir;
    // bu kadar aşağı alınır ki yüz kameradan düz çizilmiş gibi görünsün.
    const y0 = this.surf.y + v
    const r0 = this.surf.radius(y0)
    const y = y0 - r0 * (1 - Math.cos(u / r0)) * this.surf.tilt
    const r = this.surf.radius(y) + lift
    // Kameradan bakınca sağa giden u, açıyı azaltır.
    const a = this.surf.angle - u / r
    n.set(Math.cos(a), 0, Math.sin(a))
    const b = this.surf.bend(y)
    return out.set(r * n.x + b * this.surf.bendDir.x, y, r * n.z + b * this.surf.bendDir.z)
  }

  set(e: Expr) {
    this.target = e
    this.dirty = true
    if (e.eyes !== this.cur.eyes) this.cur.eyes = e.eyes
  }

  /** Hemen uygula (geçişsiz) */
  snap(e: Expr) {
    this.target = e
    Object.assign(this.cur, e)
    this.dirty = true
    this.apply()
  }

  get settled() {
    return !this.dirty
  }

  update(dt: number) {
    if (!this.dirty) return
    const k = 1 - Math.exp(-dt * 16)
    let moving = false
    for (const key of KEYS) {
      const d = this.target[key] - this.cur[key]
      if (Math.abs(d) > 1e-4) {
        this.cur[key] += d * k
        moving = true
      } else this.cur[key] = this.target[key]
    }
    this.apply()
    this.dirty = moving
  }

  private apply() {
    const e = this.cur
    // Gözler
    for (const eye of this.eyes) {
      const open = e.eyes === 'open'
      eye.oval.visible = open
      eye.shine.visible = open && e.eyeOpen > 0.45
      eye.happy.visible = e.eyes === 'happy'
      eye.x.visible = e.eyes === 'x'
      eye.oval.scale.set(e.eyeSize, 1.3 * e.eyeSize * Math.max(0.12, e.eyeOpen), 0.5 * e.eyeSize)
      eye.shine.position.y = 0.03 * Math.max(0.12, e.eyeOpen) * e.eyeSize
      eye.root.scale.setScalar(open ? 1 : 1 + 0.15 * (e.eyeSize - 1))
    }
    // Kaşlar
    this.brows.forEach((brow, b) => {
      const side = b === 0 ? -1 : 1
      // İç uç (yüzün ortasına bakan) tilt > 0 iken aşağı iner.
      const a = side < 0 ? -e.browTilt : e.browTilt
      const cu = side * 0.125
      const cv = 0.185 + e.browLift + (e.eyeSize - 1) * 0.05
      for (let i = 0; i < BROW; i++) {
        const s = (i / (BROW - 1)) * 2 - 1
        const u = cu + s * 0.068 * Math.cos(a)
        const v = cv + s * 0.068 * Math.sin(a) + 0.014 * (1 - s * s)
        this.surface(u, v, 0.006, TMP, NRM)
        TMP.toArray(this.pts, i * 3)
        NRM.toArray(this.ns, i * 3)
      }
      brow.set(this.pts, this.ns)
    })
    // Ağız: kapalı eğri; üst dudak az, alt dudak çok açılır.
    const w = e.mouthW * 0.65
    const open = Math.max(0.003, e.mouthOpen * 1.3)
    let cu = 0
    let cv = 0
    for (let i = 0; i < M; i++) {
      const th = (i / M) * Math.PI * 2
      const s = -Math.cos(th)
      const sn = Math.sin(th)
      const mid = e.mouthCurve * (s * s - 1)
      const v = -0.125 + mid + (sn >= 0 ? 0.25 : -0.75) * open * Math.abs(sn)
      const u = s * w
      cu += u
      cv += v
      this.surface(u, v, 0.004, TMP, NRM)
      TMP.toArray(this.pts, i * 3)
      NRM.toArray(this.ns, i * 3)
      this.surface(u, v, 0.001, TMP, NRM)
      TMP.toArray(this.insidePos, (i + 1) * 3)
    }
    this.lips.set(this.pts.subarray(0, M * 3), this.ns.subarray(0, M * 3))
    this.surface(cu / M, cv / M, 0.001, TMP, NRM)
    TMP.toArray(this.insidePos, 0)
    this.inside.visible = e.mouthOpen > 0.008
    this.inside.geometry.attributes.position!.needsUpdate = true
    this.inside.geometry.computeBoundingSphere()
    // Yanaklar, ter
    this.cheekMat.opacity = 0.6 * clamp01(e.blush)
    for (const c of this.cheeks) c.visible = e.blush > 0.02
    this.sweat.visible = e.sweat > 0.02
    this.sweat.scale.setScalar(Math.max(0.001, e.sweat))
  }
}

const TMP = new Vector3()
const NRM = new Vector3()
