// PWA ikonlarını, iOS açılış ekranlarını ve paylaşım görselini üretir.
// Kullanım:  npx -y -p playwright@1.56.1 node scripts/generate-assets.mjs
// (Chromium kurulu olmalı: npx playwright install chromium)
import { chromium } from 'playwright'
import { mkdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = (p) => join(root, 'public', p)
// Yazı tipi gömülür: setContent sayfası file:// kaynaklarına erişemez.
const fontUrl = `data:font/woff2;base64,${readFileSync(join(root, 'node_modules/@fontsource-variable/fraunces/files/fraunces-latin-opsz-normal.woff2')).toString('base64')}`

const PAPER = '#fbf6ee'
const INK = '#2a211c'

const mark = (size, mono = null) => `
<svg width="${size}" height="${size}" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
  <path d="M24 13.2a12.5 12.5 0 010 21.6 12.5 12.5 0 010-21.6z" fill="${mono ?? '#a8741c'}" opacity="${mono ? 0.35 : 0.55}"/>
  <circle cx="18" cy="24" r="12.5" fill="none" stroke="${mono ?? '#b4553a'}" stroke-width="4"/>
  <circle cx="30" cy="24" r="12.5" fill="none" stroke="${mono ?? '#06658e'}" stroke-width="4"/>
</svg>`

const page = (
  body,
  w,
  h,
  plain = false,
  transparent = false,
) => `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: 'Fraunces'; src: url('${fontUrl}') format('woff2'); font-weight: 100 900; }
html,body { margin:0; width:${w}px; height:${h}px; }
body { display:flex; align-items:center; justify-content:center; flex-direction:column;
  background: ${transparent ? 'transparent' : plain ? PAPER : `radial-gradient(120% 70% at 0% 0%, #f5e1d7, transparent 60%), radial-gradient(90% 60% at 100% 10%, #dce9f0, transparent 65%), ${PAPER}`};
  font-family: 'Fraunces', Georgia, serif; color:${INK}; }
.word { font-weight: 600; letter-spacing: 0.18em; }
.slogan { color: #5b4d44; }
</style></head><body>${body}</body></html>`

const browser = await chromium.launch()
async function render(file, w, h, body, scale = 1, plain = false, transparent = false) {
  const p = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: scale })
  await p.setContent(page(body, w, h, plain, transparent))
  await p.evaluate(() => document.fonts.ready)
  const target = file.startsWith('mobile/') ? join(root, file) : out(file)
  mkdirSync(dirname(target), { recursive: true })
  await p.screenshot({ path: target, omitBackground: transparent })
  await p.close()
  console.log('✓', file)
}

// Uygulama ikonları: logo, kenarlardan güvenli boşlukla.
for (const size of [32, 192, 512]) {
  await render(`icons/icon-${size}.png`, size, size, mark(Math.round(size * 0.78)))
}
await render('icons/apple-touch-icon.png', 180, 180, mark(132))
// Maskable: içerik merkezdeki %80'lik güvenli alanda.
await render('icons/icon-maskable-512.png', 512, 512, mark(300))

// Paylaşım görseli
await render(
  'icons/og-image.png',
  1200,
  630,
  `${mark(150)}<div class="word" style="font-size:84px;margin-top:18px">MESELE</div>
   <div class="slogan" style="font-size:34px;margin-top:10px">Bir tartışmayı anlamanın daha iyi bir yolu.</div>`,
)

// iOS açılış ekranları (CSS px × piksel oranı); __root.tsx'teki SPLASH listesiyle aynı.
const SPLASH = [
  [440, 956, 3],
  [402, 874, 3],
  [430, 932, 3],
  [393, 852, 3],
  [428, 926, 3],
  [390, 844, 3],
  [375, 812, 3],
  [414, 896, 2],
  [375, 667, 2],
  [820, 1180, 2],
  [1024, 1366, 2],
]
for (const [w, h, r] of SPLASH) {
  await render(
    `splash/splash-${w * r}x${h * r}.png`,
    w,
    h,
    `${mark(Math.round(w * 0.26))}<div class="word" style="font-size:${Math.round(w * 0.075)}px;margin-top:14px">MESELE</div>
     <div class="slogan" style="font-size:${Math.round(w * 0.036)}px;margin-top:8px">Bir tartışmayı anlamanın daha iyi bir yolu.</div>`,
    r,
    true, // düz zemin: açılış görselleri küçük kalsın
  )
}
// Expo kabuğu (mobile/assets): iOS ikonu opak olmalı; Android uyarlanabilir ikonu katmanlıdır.
await render('mobile/assets/icon.png', 1024, 1024, mark(800))
await render('mobile/assets/android-icon-background.png', 512, 512, '', 1, true)
await render('mobile/assets/android-icon-foreground.png', 512, 512, mark(300), 1, false, true)
await render('mobile/assets/android-icon-monochrome.png', 432, 432, mark(250, '#000000'), 1, false, true)
await render('mobile/assets/splash-icon.png', 1024, 1024, mark(600), 1, false, true)
await render('mobile/assets/favicon.png', 48, 48, mark(44), 1, false, true)

await browser.close()
