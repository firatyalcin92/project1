/*
 * Hopla service worker (derlemede üretilir). Oyun bir kez açıldıktan sonra internet olmadan
 * da açılır. Sayfa önce önbellekten gelir (anında başlar), arka planda güncellenir; yeni
 * sürüm bir sonraki açılışta görünür. Sıralama API'si (/api/…) bu kapsamın dışındadır.
 */
const VERSION = 'hopla-__VERSION__'
const PRECACHE = __PRECACHE__

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k.startsWith('hopla-') && k !== VERSION).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    // Önbellekten hemen aç, arka planda yenile.
    event.respondWith(
      caches.open(VERSION).then(async (cache) => {
        const cached = (await cache.match(request, { ignoreSearch: true })) || (await cache.match('./'))
        const fresh = fetch(request)
          .then((res) => {
            if (res.ok) cache.put('./', res.clone())
            return res
          })
          .catch(() => null)
        if (cached) {
          event.waitUntil(fresh)
          return cached
        }
        return (await fresh) || Response.error()
      }),
    )
    return
  }

  event.respondWith(
    caches.match(request).then(
      (hit) =>
        hit ||
        fetch(request).then((res) => {
          if (res.ok && url.pathname.includes('/assets/')) {
            const copy = res.clone()
            caches.open(VERSION).then((c) => c.put(request, copy))
          }
          return res
        }),
    ),
  )
})
