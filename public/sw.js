/*
 * MESELE service worker
 *
 * Gizlilik kuralı: Sunucu fonksiyonu yanıtları (/_serverFn/) kişisel ve gizli
 * içerik taşır; ASLA önbelleğe alınmaz. Yalnızca adı hash'li statik dosyalar,
 * ikonlar ve çevrimdışı sayfa saklanır.
 */
const VERSION = 'mesele-v2'
const STATIC_CACHE = `${VERSION}-static`
const PRECACHE = [
  '/offline.html',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((c) => c.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/_serverFn')) return // asla önbellek yok

  // Sayfa gezintileri: her zaman ağ; bağlantı yoksa çevrimdışı sayfa.
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('/offline.html')))
    return
  }

  // Hash'li derleme çıktıları ve görseller: önce önbellek.
  if (
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/splash/')
  ) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => {
            if (res.ok) {
              const copy = res.clone()
              caches.open(STATIC_CACHE).then((c) => c.put(request, copy))
            }
            return res
          }),
      ),
    )
  }
})
