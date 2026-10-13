import '@tanstack/react-start/server-only'
import { getRequestIP } from '@tanstack/react-start/server'
import { fail } from './errors.server'

/**
 * Kimlik doğrulaması olmayan uçlar (çift oluşturma, koda katılma, anahtarla dönüş)
 * için en iyi çaba hız sınırı. Tek süreçte bellekte tutulur; çok örnekli
 * kurulumlarda bir kenar (CDN/WAF) kuralıyla desteklenmesi önerilir.
 */

const buckets = new Map<string, { count: number; resetAt: number }>()

export function rateLimit(action: string, limit: number, windowMs: number) {
  let ip = 'unknown'
  try {
    ip = getRequestIP({ xForwardedFor: true }) ?? 'unknown'
  } catch {
    // istek bağlamı yoksa (testler) yerel anahtar kullan
  }
  const key = `${action}:${ip}`
  const now = Date.now()
  const bucket = buckets.get(key)
  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    if (buckets.size > 10_000) {
      for (const [k, b] of buckets) if (b.resetAt < now) buckets.delete(k)
    }
    return
  }
  bucket.count++
  if (bucket.count > limit) {
    fail('RATE_LIMITED', 'Çok fazla deneme yapıldı. Lütfen birkaç dakika sonra tekrar dene.')
  }
}
