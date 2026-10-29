import {
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  LatheGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  RingGeometry,
  SplineCurve,
  Vector2,
  type BufferGeometry,
  type Material,
  type Object3D,
} from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import type { Platform } from '../../core/sim'
import { COLORS, HERO, VIEW } from './config'
import { Face } from './face'

const materials = new Map<string, MeshStandardMaterial>()

/** Tona göre malzeme; shade < 1 aynı rengin koyusu (bacaklar, ayrıntılar). */
function toneMaterial(tone: number, shade = 1) {
  const key = `${tone}:${shade}`
  let m = materials.get(key)
  if (!m) {
    const color = new Color(COLORS.tones[tone % COLORS.tones.length]!).multiplyScalar(shade)
    m = new MeshStandardMaterial({ color, roughness: 0.8, metalness: 0 })
    materials.set(key, m)
  }
  return m
}

const detailMaterial = new MeshStandardMaterial({ color: COLORS.detail, roughness: 0.35, metalness: 0 })

function part(geometry: BufferGeometry, material: Material, x = 0, y = 0, z = 0) {
  const m = new Mesh(geometry, material)
  m.position.set(x, y, z)
  m.castShadow = true
  m.receiveShadow = true
  return m
}

/** Üst kenarı yuvarlatılmış dönel profil: alt yarıçap r0, üst yarıçap r1 (ters koni için r0 < r1). */
function roundedLathe(r0: number, r1: number, height: number) {
  const bevel = Math.min(0.08, r1 * 0.2)
  const pts: Vector2[] = [new Vector2(r0, 0), new Vector2(r1, height - bevel)]
  for (let s = 1; s <= 6; s++) {
    const a = (s / 6) * (Math.PI / 2)
    pts.push(new Vector2(r1 - bevel + bevel * Math.cos(a), height - bevel + bevel * Math.sin(a)))
  }
  pts.push(new Vector2(0, height))
  return new LatheGeometry(pts, 56)
}

function box(w: number, h: number, d: number, r = 0.06) {
  const g = new RoundedBoxGeometry(w, h, d, 3, r)
  g.translate(0, h / 2, 0)
  return g
}

/** Sabit renkli ayrıntılar (ahşap, ekmek, metal, döküm) */
const fixed = new Map<number, MeshStandardMaterial>()
function solid(color: number, roughness = 0.75, metalness = 0) {
  let m = fixed.get(color)
  if (!m) {
    m = new MeshStandardMaterial({ color, roughness, metalness })
    fixed.set(color, m)
  }
  return m
}
const WOOD = 0xb98352
const CRUST = 0xc4823f
const CRUMB = 0xf0d6a2
const STEEL = 0xb7bcc2
const IRON = 0x34302d

const CORNERS = [
  [-1, -1],
  [1, -1],
  [-1, 1],
  [1, 1],
] as const

/**
 * Platformun görünüşü yalnızca süs: üst yüzey (iniş alanı) her zaman sim.ts'teki kare ya da daire
 * izdüşümüyle aynıdır. Çeşit, platformun sırası ve renginden türetilir (seviye üretimi değişmez).
 * Üst yüzey çoğunlukla gövdeden farklı renktedir (nesne tek renk bir kütle gibi durmasın).
 */
export type Look =
  | 'block'
  | 'tv'
  | 'table'
  | 'chair'
  | 'drawer'
  | 'fridge'
  | 'bread'
  | 'grill'
  | 'tray'
  | 'cylinder'
  | 'cone'
  | 'roundTable'
  | 'pot'
  | 'pan'

const BOX_LOOKS: Look[] = ['block', 'block', 'tv', 'table', 'chair', 'drawer', 'fridge', 'bread', 'grill', 'tray']
const CYL_LOOKS: Look[] = ['cylinder', 'cone', 'roundTable', 'pot', 'pan']

export function lookOf(p: Platform): Look {
  if (p.i === 0) return 'block'
  const h = (Math.imul(p.i + 1, 2654435761) ^ Math.imul(p.tone + 7, 40503)) >>> 0
  const list = p.shape === 'cyl' ? CYL_LOOKS : BOX_LOOKS
  return list[h % list.length]!
}

/** Platform: tabanı y=0'da; y ölçeği tabana göre ezilir. */
export function createPlatform(p: Platform, look: Look = lookOf(p)): Object3D {
  const s = p.size
  const h = p.height
  const r = s / 2
  const n = COLORS.tones.length
  const main = toneMaterial(p.tone)
  const dark = toneMaterial(p.tone, 0.72)
  // Üst yüzey için gövdeyle uyumlu ama farklı bir ton
  const top = toneMaterial((p.tone + 3) % n, 1)
  const g = new Group()
  /** Kutu gövde + farklı renkte üst kapak */
  const capped = (body: Material, cap: Material, capH = 0.09, rad = 0.07) => {
    g.add(part(box(s, h - capH, s, rad), body))
    g.add(part(box(s, capH + 0.02, s, Math.min(rad, 0.04)), cap, 0, h - capH - 0.02))
  }
  switch (look) {
    case 'block':
      capped(main, top)
      break
    case 'tv': {
      // Kısa ayaklı eski televizyon; ekran kameraya bakan yüzde.
      const feet = 0.1
      g.add(part(box(s, h - feet, s, 0.12), main, 0, feet))
      for (const [fx, fz] of CORNERS)
        g.add(
          part(
            new CylinderGeometry(0.06, 0.06, feet, 12).translate(0, feet / 2, 0),
            dark,
            fx * r * 0.7,
            0,
            fz * r * 0.7,
          ),
        )
      g.add(part(box(s * 0.72, (h - feet) * 0.62, 0.03, 0.06), detailMaterial, -r * 0.1, feet + (h - feet) * 0.14, r))
      for (const k of [0, 1])
        g.add(
          part(
            new CylinderGeometry(0.045, 0.045, 0.03, 16).rotateX(Math.PI / 2),
            dark,
            r * 0.78,
            feet + (h - feet) * (0.58 - k * 0.2),
            r + 0.01,
          ),
        )
      // üstte ince örtü
      g.add(part(box(s * 0.7, 0.025, s * 0.7, 0.012), top, 0, h - 0.01))
      break
    }
    case 'table': {
      const t = 0.16
      g.add(part(box(s, t, s, 0.05), solid(WOOD), 0, h - t))
      for (const [fx, fz] of CORNERS)
        g.add(part(box(0.13, h - t, 0.13, 0.03), main, fx * (r - 0.14), 0, fz * (r - 0.14)))
      break
    }
    case 'chair': {
      // Oturak iniş alanıdır; arkalık uzak kenarda (kameradan uzakta) alçak durur.
      const seat = 0.16
      g.add(part(box(s, seat, s, 0.05), top, 0, h - seat))
      for (const [fx, fz] of CORNERS)
        g.add(part(box(0.12, h - seat, 0.12, 0.03), dark, fx * (r - 0.12), 0, fz * (r - 0.12)))
      g.add(part(box(s, 0.55, 0.1, 0.04), main, 0, h - seat, -r - 0.05))
      break
    }
    case 'drawer': {
      // Çekmeceli komodin: ahşap üst, önde üç çekmece ve kulplar
      capped(main, solid(WOOD), 0.1, 0.05)
      const rows = 3
      const fh = (h - 0.2) / rows
      for (let k = 0; k < rows; k++) {
        const y = 0.06 + k * fh
        g.add(part(box(s * 0.86, fh - 0.06, 0.03, 0.02), dark, 0, y, r))
        g.add(part(box(s * 0.22, 0.05, 0.05, 0.02), solid(STEEL, 0.35, 0.6), 0, y + (fh - 0.06) / 2 - 0.025, r + 0.03))
      }
      break
    }
    case 'fridge': {
      // Buzdolabı: iki kapı çizgisi, metal kulp, üstte farklı renk
      capped(main, top, 0.08, 0.1)
      g.add(part(box(s * 0.96, 0.025, 0.02, 0.008), dark, 0, h * 0.62, r + 0.005))
      for (const [y0, len] of [
        [h * 0.68, h * 0.18],
        [h * 0.2, h * 0.3],
      ] as const)
        g.add(part(box(0.06, len, 0.06, 0.025), solid(STEEL, 0.3, 0.7), r * 0.72, y0, r + 0.04))
      break
    }
    case 'bread': {
      // Somun ekmek: açık renk iç, kızarmış kabuk üstte, üstte çizikler
      g.add(part(box(s, h - 0.12, s, 0.18), solid(CRUMB, 0.9)))
      g.add(part(box(s, 0.16, s, 0.1), solid(CRUST, 0.8), 0, h - 0.16))
      for (const k of [-1, 0, 1])
        g.add(part(box(0.06, 0.012, s * 0.6, 0.005), solid(0x9a5f2b, 0.9), k * s * 0.25, h - 0.003, 0))
      break
    }
    case 'grill': {
      // Mangal: koyu gövde, üstte metal ızgara çubukları, ince ayaklar
      const legs = h * 0.45
      g.add(part(box(s, h - legs - 0.06, s, 0.08), main, 0, legs))
      g.add(part(box(s * 0.96, 0.06, s * 0.96, 0.02), solid(IRON, 0.5, 0.3), 0, h - 0.06))
      for (let k = -4; k <= 4; k++)
        g.add(part(box(0.035, 0.02, s * 0.9, 0.008), solid(STEEL, 0.3, 0.7), (k / 4.6) * r, h - 0.01, 0))
      for (const [fx, fz] of CORNERS)
        g.add(part(box(0.07, legs, 0.07, 0.02), solid(IRON, 0.5, 0.3), fx * (r - 0.1), 0, fz * (r - 0.1)))
      break
    }
    case 'tray': {
      // Ters çevrilmiş kaşıklık: plastik kasa, üstte bölme izleri
      capped(main, top, 0.06, 0.08)
      for (const k of [-1, 0, 1]) g.add(part(box(0.04, 0.015, s * 0.82, 0.006), dark, k * s * 0.24, h - 0.004, 0))
      g.add(part(box(s * 0.82, 0.015, 0.04, 0.006), dark, 0, h - 0.004, s * 0.1))
      break
    }
    case 'cylinder':
      g.add(part(roundedLathe(r, r, h - 0.08), main))
      g.add(part(roundedLathe(r * 0.98, r * 0.98, 0.1).translate(0, h - 0.1, 0), top))
      break
    case 'cone':
      // Ters koni: aşağı doğru daralır, üstte farklı renk kapak
      g.add(part(roundedLathe(r * 0.42, r * 0.97, h - 0.08), main))
      g.add(part(roundedLathe(r, r, 0.1).translate(0, h - 0.1, 0), top))
      break
    case 'roundTable': {
      const t = 0.16
      g.add(part(roundedLathe(r, r, t).translate(0, h - t, 0), solid(WOOD)))
      g.add(part(new CylinderGeometry(0.11, 0.13, h - t, 20).translate(0, (h - t) / 2, 0), main))
      g.add(part(new CylinderGeometry(r * 0.48, r * 0.52, 0.06, 32).translate(0, 0.03, 0), main))
      break
    }
    case 'pot': {
      // Tencere: gövde, iki yan kulp, üstte metal kapak
      g.add(part(roundedLathe(r * 0.95, r * 0.95, h - 0.07), main))
      g.add(part(roundedLathe(r, r, 0.08).translate(0, h - 0.08, 0), solid(STEEL, 0.3, 0.6)))
      for (const side of [-1, 1]) g.add(part(box(0.12, 0.08, 0.32, 0.03), dark, side * (r * 0.95 + 0.04), h * 0.72, 0))
      break
    }
    case 'pan': {
      // Ocağın üstünde döküm tava: üst yüzey tavanın içi, sapı dışarı uzanır
      const panH = 0.2
      g.add(part(roundedLathe(r * 0.8, r * 0.8, h - panH), main))
      g.add(part(roundedLathe(r * 0.82, r, panH).translate(0, h - panH, 0), solid(IRON, 0.45, 0.35)))
      g.add(part(box(r * 0.95, 0.07, 0.13, 0.03), solid(WOOD), -(r + r * 0.42), h - 0.1, 0))
      break
    }
  }
  g.position.set(p.x, 0, p.z)
  return g
}

export function disposePlatform(obj: Object3D) {
  obj.traverse((o) => {
    if (o instanceof Mesh) o.geometry.dispose()
  })
  obj.removeFromParent()
}

/** Sosis profili: gövde hafif tombul, uçlar küt yuvarlak (süperelips). Taban yarıçapı fizikle aynı. */
const END = 0.3
export function sausageRadius(y: number) {
  const h = HERO.height
  const mid = HERO.radius + 0.022 * Math.sin((Math.PI * clamp(y, 0, h)) / h)
  const d = y < END ? (END - y) / END : y > h - END ? (y - (h - END)) / END : 0
  return mid * Math.pow(Math.max(0, 1 - Math.pow(Math.min(1, d), 2.3)), 1 / 2.3)
}

const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x))

/** Sosis kıvrımı: uçlar eksende, orta kısım ekranda sağa doğru hafifçe kavislenir. */
const BEND_DIR = { x: Math.SQRT1_2, z: Math.SQRT1_2 }
export function sausageBend(y: number) {
  const t = clamp(y / HERO.height, 0, 1) * 2 - 1
  return 0.05 * (1 - t * t)
}

function sausageGeometry() {
  const pts: Vector2[] = []
  const n = 72
  for (let i = 0; i <= n; i++) {
    // Uçlarda daha sık örnek (yuvarlaklık düzgün görünsün)
    const t = 0.5 - 0.5 * Math.cos((Math.PI * i) / n)
    const y = t * HERO.height
    pts.push(new Vector2(Math.max(0.0005, sausageRadius(y)), y))
  }
  const g = new LatheGeometry(pts, 48)
  const pos = g.attributes.position!
  for (let i = 0; i < pos.count; i++) {
    const b = sausageBend(pos.getY(i))
    pos.setXYZ(i, pos.getX(i) + b * BEND_DIR.x, pos.getY(i), pos.getZ(i) + b * BEND_DIR.z)
  }
  g.computeVertexNormals()
  return g
}

/** Tepedeki bağ düğümü (kılıfın büküldüğü uç) */
function knotGeometry() {
  const pts = [
    [0.0005, -0.02],
    [0.07, -0.015],
    [0.042, 0.02],
    [0.03, 0.045],
    [0.042, 0.07],
    [0.036, 0.095],
    [0.0005, 0.105],
  ].map(([x, y]) => new Vector2(x!, y!))
  return new LatheGeometry(new SplineCurve(pts).getPoints(24), 20)
}

/**
 * Kahraman: yüzlü sosis.
 * root (tabandaki nokta, devrilmede döner) → squash (ezilme) → spin (gövde ortası, takla) → body
 */
export class Hero {
  readonly root = new Group()
  readonly squash = new Group()
  readonly spin = new Group()
  readonly height = HERO.height
  readonly face: Face

  constructor() {
    const skin = new MeshPhysicalMaterial({
      color: COLORS.hero,
      roughness: 0.42,
      metalness: 0,
      clearcoat: 0.55,
      clearcoatRoughness: 0.32,
      sheen: 0.4,
      sheenRoughness: 0.5,
      sheenColor: new Color(0xffc2a8),
    })
    const body = new Mesh(sausageGeometry(), skin)
    body.castShadow = true
    body.receiveShadow = true
    const knot = new Mesh(knotGeometry(), new MeshStandardMaterial({ color: COLORS.heroKnot, roughness: 0.55 }))
    knot.position.y = HERO.height - 0.012
    knot.rotation.z = -0.12
    knot.castShadow = true
    body.add(knot)
    const [cx, cy, cz] = VIEW.cameraOffset
    this.face = new Face({
      radius: sausageRadius,
      y: HERO.height * 0.71,
      angle: Math.atan2(cz, cx),
      tilt: cy / Math.hypot(cx, cz),
      bend: sausageBend,
      bendDir: BEND_DIR,
    })
    body.add(this.face.group)
    body.position.y = -this.height / 2
    this.spin.position.y = this.height / 2
    this.spin.add(body)
    this.squash.add(this.spin)
    this.root.add(this.squash)
  }

  reset() {
    this.root.quaternion.identity()
    this.spin.quaternion.identity()
    this.spin.position.set(0, this.height / 2, 0)
    this.squash.scale.set(1, 1, 1)
  }
}

/** Tam isabette platformun üstünde genişleyip kaybolan ince halka. */
export class Ripple {
  readonly mesh: Mesh<RingGeometry, MeshBasicMaterial>

  constructor() {
    this.mesh = new Mesh(
      new RingGeometry(0.92, 1, 64),
      new MeshBasicMaterial({ color: COLORS.ring, transparent: true, opacity: 0, depthWrite: false, side: DoubleSide }),
    )
    this.mesh.rotation.x = -Math.PI / 2
    this.mesh.visible = false
    this.mesh.renderOrder = 2
  }
}
