/**
 * Cihaz kimliği: test sürümünde ücretsiz hakkın cihaza bağlı kalması için.
 *
 * Üye token'ından ayrıdır ve çıkış yapınca silinmez. localStorage'a ve uzun ömürlü bir
 * çereze birlikte yazılır; biri temizlenirse diğerinden geri yüklenir. Kişisel bir bilgi
 * taşımaz; sunucu yalnızca hash'ini saklar.
 */

export const DEVICE_HEADER = 'x-mesele-device'
export const DEVICE_PATTERN = /^[A-Za-z0-9_-]{22,64}$/
const KEY = 'mesele.device.v1'

function fromCookie() {
  const m = /(?:^|;\s*)mesele_d=([A-Za-z0-9_-]+)/.exec(document.cookie)
  return m?.[1] ?? null
}

export function deviceId(): string | null {
  if (typeof window === 'undefined') return null
  let id: string | null = null
  try {
    id = window.localStorage.getItem(KEY)
  } catch {
    // depolama kapalı olabilir
  }
  if (!id || !DEVICE_PATTERN.test(id)) id = fromCookie()
  if (!id || !DEVICE_PATTERN.test(id)) {
    const bytes = crypto.getRandomValues(new Uint8Array(18))
    id = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  }
  try {
    window.localStorage.setItem(KEY, id)
  } catch {
    // yoksay
  }
  document.cookie = `mesele_d=${id}; max-age=${60 * 60 * 24 * 400}; path=/; samesite=lax${location.protocol === 'https:' ? '; secure' : ''}`
  return id
}
