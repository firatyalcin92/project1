import {
  CapsuleGeometry,
  DoubleSide,
  Group,
  LatheGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  RingGeometry,
  Vector2,
  type BufferGeometry,
} from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import type { Platform } from '../../core/sim'
import { COLORS, HERO } from './config'

const materials = new Map<number, MeshStandardMaterial>()

function toneMaterial(tone: number) {
  let m = materials.get(tone)
  if (!m) {
    const color = COLORS.tones[tone % COLORS.tones.length]!
    m = new MeshStandardMaterial({ color, roughness: color === 0x47423f ? 0.7 : 0.86, metalness: 0 })
    materials.set(tone, m)
  }
  return m
}

/** Üst kenarı yuvarlatılmış silindir profili (alt yüz zemine oturur, görünmez). */
function roundedCylinder(radius: number, height: number) {
  const bevel = Math.min(0.08, radius * 0.2)
  const pts: Vector2[] = [new Vector2(radius, 0), new Vector2(radius, height - bevel)]
  const steps = 6
  for (let s = 1; s <= steps; s++) {
    const a = (s / steps) * (Math.PI / 2)
    pts.push(new Vector2(radius - bevel + bevel * Math.cos(a), height - bevel + bevel * Math.sin(a)))
  }
  pts.push(new Vector2(0, height))
  return new LatheGeometry(pts, 56)
}

/** Platform: tabanı y=0'da; y ölçeği tabana göre ezilir. */
export function createPlatform(p: Platform): Mesh {
  let geometry: BufferGeometry
  if (p.shape === 'cyl') {
    geometry = roundedCylinder(p.size / 2, p.height)
  } else {
    geometry = new RoundedBoxGeometry(p.size, p.height, p.size, 3, 0.07)
    geometry.translate(0, p.height / 2, 0)
  }
  const mesh = new Mesh(geometry, toneMaterial(p.tone))
  mesh.position.set(p.x, 0, p.z)
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

export function disposePlatform(mesh: Mesh) {
  mesh.geometry.dispose()
  mesh.removeFromParent()
}

/**
 * Kahraman: turuncu kapsül.
 * root (tabandaki nokta, devrilmede döner) → squash (ezilme) → spin (gövde ortası, takla) → body
 */
export class Hero {
  readonly root = new Group()
  readonly squash = new Group()
  readonly spin = new Group()
  readonly height = HERO.length + HERO.radius * 2

  constructor() {
    const body = new Mesh(
      new CapsuleGeometry(HERO.radius, HERO.length, 10, 28),
      new MeshStandardMaterial({ color: COLORS.hero, roughness: 0.48, metalness: 0 }),
    )
    body.castShadow = true
    body.receiveShadow = true
    this.spin.position.y = this.height / 2
    this.spin.add(body)
    this.squash.add(this.spin)
    this.root.add(this.squash)
  }

  reset() {
    this.root.quaternion.identity()
    this.spin.quaternion.identity()
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
