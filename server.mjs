// Üretim için küçük Node sunucusu: `npm run build && npm start`
// Statik dosyaları dist/client'tan sunar, geri kalan her şeyi TanStack Start'a devreder.
import { serve } from 'srvx'
import { serveStatic } from 'srvx/static'
import { diagnose } from './durum.mjs'

// .env dosyasını (varsa) ortam değişkenlerine yükle. Platformun kendi değişkenleri önceliklidir.
try {
  process.loadEnvFile('.env')
} catch {
  // .env yoksa sorun değil: değişkenler barındırma platformundan gelir.
}
const { default: app } = await import('./dist/server/server.js')

/** Güvenlik ve önbellek başlıkları + .webmanifest için doğru MIME türü. */
async function headers(request, next) {
  const res = await next()
  const { pathname } = new URL(request.url)
  const h = new Headers(res.headers)
  h.set('x-content-type-options', 'nosniff')
  h.set('referrer-policy', 'strict-origin-when-cross-origin')
  h.set('permissions-policy', 'camera=(), microphone=(), geolocation=()')
  if (pathname.endsWith('.webmanifest')) h.set('content-type', 'application/manifest+json; charset=utf-8')
  if (pathname.startsWith('/assets/')) h.set('cache-control', 'public, max-age=31536000, immutable')
  if (pathname === '/sw.js') h.set('cache-control', 'no-cache')
  if (pathname.startsWith('/_serverFn')) h.set('cache-control', 'no-store')
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h })
}

/** /durum: kurulum teşhisi (gizli bilgi içermez). */
async function status(request, next) {
  const { pathname } = new URL(request.url)
  if (pathname !== '/durum') return next()
  const body = JSON.stringify(await diagnose(), null, 2)
  return new Response(body, {
    status: 200,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
}

serve({
  port: Number(process.env.PORT ?? 3000),
  hostname: process.env.HOST ?? '0.0.0.0',
  middleware: [status, headers, serveStatic({ dir: './dist/client' })],
  fetch: (request) => app.fetch(request),
})
