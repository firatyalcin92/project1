// Hopla ikonlarını üretir (PWA, iOS ana ekran, Expo uygulaması).
// Kullanım:  npx -y -p playwright@1.56.1 node hopla/scripts/icons.mjs
// (Chromium kurulu olmalı: npx playwright install chromium)
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * İzometrik beyaz platform üzerinde turuncu kapsül. rounded: köşeler yuvarlak (tarayıcı ikonu),
 * scale: içerik ölçeği (maskable ikonlarda güvenli alan için küçültülür).
 */
function svg({ rounded = true, scale = 1, background = true } = {}) {
  const t = `translate(256 256) scale(${scale}) translate(-256 -256)`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#f9f6f1"/><stop offset="1" stop-color="#ebe4da"/>
    </linearGradient>
    <linearGradient id="hero" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#ff7a45"/><stop offset="0.55" stop-color="#f2551d"/><stop offset="1" stop-color="#d9440d"/>
    </linearGradient>
    <filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="9"/></filter>
  </defs>
  ${background ? `<rect width="512" height="512" ${rounded ? 'rx="112"' : ''} fill="url(#bg)"/>` : ''}
  <g transform="${t}">
    <ellipse cx="306" cy="410" rx="120" ry="34" fill="#5a4434" opacity=".16" filter="url(#soft)"/>
    <path d="M256 284 L424 368 L256 452 L88 368 Z" fill="#ffffff"/>
    <path d="M88 368 L256 452 L256 484 L88 400 Z" fill="#e7dfd4"/>
    <path d="M256 452 L424 368 L424 400 L256 484 Z" fill="#d3c8ba"/>
    <ellipse cx="274" cy="370" rx="48" ry="16" fill="#5a4434" opacity=".18" filter="url(#soft)"/>
    <rect x="210" y="150" width="92" height="218" rx="46" fill="url(#hero)"/>
    <rect x="226" y="172" width="16" height="84" rx="8" fill="#ffffff" opacity=".28"/>
  </g>
</svg>`
}

const targets = [
  { file: 'web/public/icon.svg', svg: svg() },
  { file: 'web/public/icons/icon-192.png', size: 192, svg: svg() },
  { file: 'web/public/icons/icon-512.png', size: 512, svg: svg() },
  { file: 'web/public/icons/icon-maskable-512.png', size: 512, svg: svg({ rounded: false, scale: 0.74 }) },
  { file: 'web/public/icons/apple-touch-icon.png', size: 180, svg: svg({ rounded: false, scale: 0.9 }) },
  { file: 'mobile/assets/icon.png', size: 1024, svg: svg({ rounded: false, scale: 0.9 }) },
  { file: 'mobile/assets/adaptive-icon.png', size: 1024, svg: svg({ rounded: false, scale: 0.62, background: false }) },
]

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : undefined,
)
const page = await browser.newPage()
for (const t of targets) {
  const out = join(root, t.file)
  mkdirSync(dirname(out), { recursive: true })
  if (!t.size) {
    writeFileSync(out, t.svg)
    continue
  }
  await page.setViewportSize({ width: t.size, height: t.size })
  await page.setContent(
    `<!doctype html><html><body style="margin:0;background:transparent">${t.svg.replace('<svg ', `<svg width="${t.size}" height="${t.size}" `)}</body></html>`,
  )
  await page.screenshot({ path: out, omitBackground: true, clip: { x: 0, y: 0, width: t.size, height: t.size } })
  console.log('yazıldı:', t.file)
}
await browser.close()
