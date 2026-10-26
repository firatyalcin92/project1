// cPanel (Node.js uygulaması / Passenger) için tek parça paket: `npm run paket:cpanel`
// Çıktı: paket/mesele-cpanel.zip — içinde npm install gerektirmeyen, bağımlılıkları gömülü sunucu.
import { execFileSync } from 'node:child_process'
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { build } from 'rolldown'

const OUT = 'paket/mesele'
rmSync('paket', { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })

execFileSync('npx', ['vite', 'build'], { stdio: 'inherit', shell: process.platform === 'win32' })

await build({
  input: 'server.mjs',
  platform: 'node',
  logLevel: 'warn',
  onLog(level, log, handler) {
    if (log.code === 'MODULE_LEVEL_DIRECTIVE') return
    handler(level, log)
  },
  output: {
    dir: OUT,
    format: 'esm',
    entryFileNames: 'server.mjs',
    chunkFileNames: 'lib/[name]-[hash].mjs',
    // Bazı paketler require() kullanır: ESM içinde de çalışsın.
    banner: "import { createRequire as __mcr } from 'node:module'; const require = __mcr(import.meta.url);",
  },
})

cpSync('dist/client', `${OUT}/dist/client`, { recursive: true })

// Passenger başlangıç dosyası (CommonJS) → ESM sunucuyu yükler.
writeFileSync(
  `${OUT}/app.js`,
  `// cPanel "Application startup file": app.js
process.env.NODE_ENV = process.env.NODE_ENV || 'production'
import('./server.mjs').catch((e) => {
  console.error('[mesele] başlatılamadı:', e)
  process.exit(1)
})
`,
)
writeFileSync(
  `${OUT}/package.json`,
  JSON.stringify({ name: 'mesele', private: true, version: '1.0.0', engines: { node: '>=22.5' } }, null, 2) + '\n',
)

execFileSync('zip', ['-qr', '../mesele-cpanel.zip', '.'], { cwd: OUT, stdio: 'inherit' })
console.log('Hazır: paket/mesele-cpanel.zip')
