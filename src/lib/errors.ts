/**
 * Sunucu hataları "[KOD] Kullanıcıya gösterilecek mesaj" biçiminde taşınır.
 * Böylece TanStack Start'ın hata serileştirmesinden bağımsız olarak istemci
 * kodu ve Türkçe mesajı güvenle ayırabilir.
 */
export type ErrorCode =
  | 'UNAUTHORIZED'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'VALIDATION'
  | 'RATE_LIMITED'
  | 'AI_UNAVAILABLE'
  | 'CONFIG'
  | 'INTERNAL'
  /** Ücretsiz mesele kullanıldı; devam etmek için üyelik gerekir */
  | 'PAYMENT_REQUIRED'

export function formatError(code: ErrorCode, message: string) {
  return `[${code}] ${message}`
}

export function parseError(error: unknown): { code: ErrorCode | 'UNKNOWN'; message: string } {
  const raw = error instanceof Error ? error.message : typeof error === 'string' ? error : ''
  const m = /^\[([A-Z_]+)\]\s*([\s\S]*)$/.exec(raw)
  if (m) return { code: m[1] as ErrorCode, message: m[2] || 'Bir şeyler ters gitti.' }
  return { code: 'UNKNOWN', message: 'Bir şeyler ters gitti. Lütfen biraz sonra tekrar dene.' }
}
