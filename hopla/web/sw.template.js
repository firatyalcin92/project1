/*
 * Hopla service worker (derlemede üretilir). Oyun bir kez açıldıktan sonra internet olmadan
 * da açılır. Sayfa önce ağdan istenir (yeni sürüm hemen görünür); ağ yoksa ya da 3 saniyede
 * yanıt gelmezse önbellekten açılır. Sıralama API'si (/api/…) bu kapsamın dışındadır.
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
    // Önce ağ (yeni sürüm ilk yenilemede gelsin); ağ yoksa ya da çok yavaşsa önbellek.
    event.respondWith(
      caches.open(VERSION).then(async (cache) => {
        const fresh = fetch(request, { cache: 'no-cache' })
          .then((res) => {
            if (res.ok) cache.put('./', res.clone())
            return res
          })
          .catch(() => null)
        const slow = new Promise((resolve) => setTimeout(() => resolve(null), 3000))
        const res = await Promise.race([fresh, slow])
        if (res) return res
        const cached = (await cache.match(request, { ignoreSearch: true })) || (await cache.match('./'))
        return cached || (await fresh) || Response.error()
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
