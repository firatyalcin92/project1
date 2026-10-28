// Hopla ikonlarını üretir (PWA, iOS ana ekran, Expo uygulaması).
// Kullanım:  npx -y -p playwright@1.56.1 node hopla/scripts/icons.mjs
// (Chromium kurulu olmalı: npx playwright install chromium)
import { chromium } from 'playwright'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * İkon görseli: oyundaki 3B sosis, petrol yeşili platformun üstünde (hero-icon.png, şeffaf arka plan).
 * Görsel oyunun kendi modelleriyle çizilir: hopla/web/icon-render.html?tone=1&zoom=1.12&y=1.95
 * (npm run hopla:dev ile açılıp 1024×1024 şeffaf ekran görüntüsü alınır).
 */
const hero = `data:image/png;base64,${readFileSync(join(root, 'scripts/hero-icon.png')).toString('base64')}`

/** rounded: köşeler yuvarlak (tarayıcı ikonu), scale: içerik ölçeği (maskable ikonlarda güvenli alan) */
function svg({ rounded = true, scale = 1, background = true } = {}) {
  const t = `translate(256 256) scale(${scale}) translate(-256 -256)`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#f9f6f1"/><stop offset="1" stop-color="#ebe4da"/>
    </linearGradient>
    <clipPath id="clip"><rect width="512" height="512" ${rounded ? 'rx="112"' : ''}/></clipPath>
  </defs>
  <g clip-path="url(#clip)">
    ${background ? '<rect width="512" height="512" fill="url(#bg)"/>' : ''}
    <image href="${hero}" width="512" height="512" transform="${t}"/>
  </g>
</svg>`
}

const targets = [
  { file: 'web/public/icons/icon-192.png', size: 192, svg: svg() },
  { file: 'web/public/icons/icon-512.png', size: 512, svg: svg() },
  { file: 'web/public/icons/icon-maskable-512.png', size: 512, svg: svg({ rounded: false }) },
  { file: 'web/public/icons/apple-touch-icon.png', size: 180, svg: svg({ rounded: false }) },
  { file: 'mobile/assets/icon.png', size: 1024, svg: svg({ rounded: false }) },
  { file: 'mobile/assets/adaptive-icon.png', size: 1024, svg: svg({ rounded: false }) },
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
// Tarayıcı sekmesi ikonu: küçük PNG'yi saran hafif SVG
const fav = readFileSync(join(root, 'web/public/icons/icon-192.png')).toString('base64')
writeFileSync(
  join(root, 'web/public/icon.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192"><image href="data:image/png;base64,${fav}" width="192" height="192"/></svg>\n`,
)
console.log('yazıldı: web/public/icon.svg')
await browser.close()
