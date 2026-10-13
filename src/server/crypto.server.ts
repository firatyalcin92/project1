import '@tanstack/react-start/server-only'

/**
 * Web Crypto kullanılır: Node 20+, Cloudflare Workers, Deno ve Bun'da aynı şekilde çalışır.
 */

/** Çift kodu alfabesi: karışan karakterler (0/O, 1/I) yok. 32 karakter → 6 hanede ~1 milyar olasılık. */
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function generateCoupleCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6))
  // 256 % 32 === 0, dolayısıyla modulo sapması yok.
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('')
}

/** 256-bit gizli üye token'ı (base64url, 43 karakter). Yalnızca bir kez istemciye döner. */
export function generateMemberToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export const MEMBER_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/

/** Veritabanında saklanan tek şey: token'ın SHA-256 hash'i (hex). */
export async function hashMemberToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}
