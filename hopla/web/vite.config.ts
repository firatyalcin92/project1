import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'

/**
 * Hopla oyun istemcisi (three.js). Ana uygulamadan bağımsız derlenir:
 *   web    → dist/client/hopla  (mevcut sunucu /hopla/ adresinde sunar)
 *   native → hopla/mobile/game  (tek HTML dosyası; Expo uygulaması çevrimdışı açar)
 */
const here = fileURLToPath(new URL('.', import.meta.url))
const repo = resolve(here, '../..')

/** root altındaki tüm dosyalar, root'a göre yollarıyla */
function listFiles(root: string, dir = root): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) out.push(...listFiles(root, full))
    else out.push(relative(root, full).split('\\').join('/'))
  }
  return out
}

/** Çevrimdışı oynamak için service worker: derlenen her dosyayı önbelleğe alır. */
function serviceWorker(): Plugin {
  return {
    name: 'hopla-sw',
    apply: 'build',
    enforce: 'post',
    // Tüm dosyalar (HTML ve CSS dahil) yazıldıktan sonra listeyi çıkar.
    writeBundle(options) {
      const dir = options.dir!
      const files = listFiles(dir).filter((f) => f !== 'sw.js' && !f.endsWith('.map'))
      const hash = createHash('sha256')
      for (const f of files.sort()) hash.update(f).update(readFileSync(join(dir, f)))
      const precache = ['./', ...files.map((f) => `./${f}`)]
      const source = readFileSync(join(here, 'sw.template.js'), 'utf8')
        .replace('__VERSION__', hash.digest('hex').slice(0, 12))
        .replace('__PRECACHE__', JSON.stringify(precache))
      writeFileSync(join(dir, 'sw.js'), source)
    },
  }
}

export default defineConfig(({ mode }) => {
  const native = mode === 'native'
  return {
    root: here,
    base: './',
    envDir: here,
    publicDir: native ? false : 'public',
    build: {
      outDir: native ? join(here, '../mobile/game') : join(repo, 'dist/client/hopla'),
      emptyOutDir: true,
      target: ['es2020', 'safari15', 'chrome90'],
      chunkSizeWarningLimit: 900,
      assetsInlineLimit: native ? 100_000_000 : 4096,
      modulePreload: native ? false : { polyfill: false },
      cssCodeSplit: false,
      reportCompressedSize: false,
    },
    server: {
      port: 5173,
      host: true,
      proxy: { '/api/hopla': 'http://localhost:3000' },
    },
    preview: { port: 4173, host: true },
    plugins: native ? [] : [serviceWorker()],
  }
})
