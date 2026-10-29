/**
 * Rekor kutlamaları (ekranın üstünde, dokunuşları engellemez):
 *  - kişisel rekor: üstten patlayan konfeti
 *  - ülke rekoru: bayrak yağmuru ve şerit
 *  - dünya rekoru: aşağıdan yukarı akan kupalar ve şerit
 */

const COLORS = ['#f2551d', '#e2a83a', '#2f8c85', '#4e6e9e', '#d3828c', '#86a05a', '#ffffff']

function layer(root: HTMLElement, cls: string, ms: number) {
  const el = document.createElement('div')
  el.className = `celebrate ${cls}`
  root.append(el)
  setTimeout(() => el.remove(), ms)
  return el
}

/** Kişisel rekor: kısa konfeti patlaması (canvas) */
export function confetti(root: HTMLElement) {
  const host = layer(root, 'confetti', 2600)
  const canvas = document.createElement('canvas')
  host.append(canvas)
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const w = root.clientWidth
  const h = root.clientHeight
  canvas.width = w * dpr
  canvas.height = h * dpr
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.scale(dpr, dpr)
  const parts = Array.from({ length: 140 }, (_, i) => {
    const side = i % 2 ? 1 : -1
    const a = -Math.PI / 2 + side * (0.25 + Math.random() * 0.75)
    const v = 7 + Math.random() * 9
    return {
      x: w / 2 + side * w * 0.18,
      y: h * 0.32,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      r: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.4,
      s: 5 + Math.random() * 6,
      c: COLORS[i % COLORS.length]!,
    }
  })
  const start = performance.now()
  const tick = (now: number) => {
    const t = (now - start) / 1000
    ctx.clearRect(0, 0, w, h)
    ctx.globalAlpha = Math.max(0, 1 - Math.max(0, t - 1.6) / 0.8)
    for (const p of parts) {
      p.vy += 0.32
      p.vx *= 0.985
      p.x += p.vx
      p.y += p.vy
      p.r += p.vr
      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.rotate(p.r)
      ctx.fillStyle = p.c
      ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2)
      ctx.restore()
    }
    if (t < 2.5 && host.isConnected) requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

function banner(host: HTMLElement, text: string) {
  const b = document.createElement('div')
  b.className = 'banner'
  b.textContent = text
  host.append(b)
}

/** Ülke rekoru: yukarıdan düşen bayraklar */
export function countryRecord(root: HTMLElement, flag: string, text: string) {
  const host = layer(root, 'rain', 4200)
  banner(host, text)
  for (let i = 0; i < 26; i++) {
    const e = document.createElement('span')
    e.className = 'drop'
    e.textContent = flag
    e.style.left = `${Math.random() * 100}%`
    e.style.animationDelay = `${Math.random() * 1.4}s`
    e.style.animationDuration = `${1.8 + Math.random() * 1.2}s`
    e.style.fontSize = `${22 + Math.random() * 22}px`
    host.append(e)
  }
}

/** Dünya rekoru: aşağıdan yukarı akan kupalar */
export function worldRecord(root: HTMLElement, text: string) {
  const host = layer(root, 'rise', 5200)
  banner(host, text)
  for (let i = 0; i < 30; i++) {
    const e = document.createElement('span')
    e.className = 'cup'
    e.textContent = i % 5 === 0 ? '🌭' : '🏆'
    e.style.left = `${Math.random() * 100}%`
    e.style.animationDelay = `${Math.random() * 1.8}s`
    e.style.animationDuration = `${2.2 + Math.random() * 1.4}s`
    e.style.fontSize = `${26 + Math.random() * 26}px`
    host.append(e)
  }
}
