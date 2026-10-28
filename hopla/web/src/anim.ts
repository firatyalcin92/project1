/** Küçük animasyon yardımcıları (her kare çağrılır, bellek ayırmaz). */

export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)

export const ease = {
  inQuad: (t: number) => t * t,
  outQuad: (t: number) => t * (2 - t),
  inOutSine: (t: number) => 0.5 - 0.5 * Math.cos(Math.PI * t),
  outCubic: (t: number) => 1 - (1 - t) ** 3,
  inOutCubic: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  outBack: (t: number) => {
    const c1 = 1.6
    const c3 = c1 + 1
    return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2
  },
}

/**
 * Sönümlü yay: başlangıç sapmasından (x0) 0'a salınarak döner.
 * t saniye, freq Hz, damping 0..1 (1'e yakın = az salınım).
 */
export function spring(x0: number, t: number, freq = 4.2, damping = 0.32) {
  const w = 2 * Math.PI * freq
  return x0 * Math.exp(-damping * w * t) * Math.cos(w * Math.sqrt(1 - damping * damping) * t)
}

/** Zaman tabanlı efekt: done dönene kadar her kare güncellenir. */
export interface Effect {
  update(dt: number): boolean
}

export class Effects {
  private list: Effect[] = []

  add(e: Effect) {
    this.list.push(e)
  }

  get active() {
    return this.list.length > 0
  }

  update(dt: number) {
    let w = 0
    for (let r = 0; r < this.list.length; r++) {
      const e = this.list[r]!
      if (!e.update(dt)) this.list[w++] = e
    }
    this.list.length = w
  }

  clear() {
    this.list.length = 0
  }
}

/** Belirli sürede 0→1 ilerleyen efekt. */
export function timed(duration: number, fn: (t: number) => void, done?: () => void): Effect {
  let time = 0
  return {
    update(dt) {
      time += dt
      const t = clamp01(time / duration)
      fn(t)
      if (t >= 1) {
        done?.()
        return true
      }
      return false
    },
  }
}
