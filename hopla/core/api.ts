/**
 * Sıralama API'sinin istemci ve sunucu arasında paylaşılan sözleşmesi.
 * Uç noktalar: /api/hopla/v1/... (bkz. src/server/hopla/api.server.ts)
 */

export const API_PREFIX = '/api/hopla/v1'

export const NAME_MIN = 3
export const NAME_MAX = 16

export type ErrorCode =
  | 'BAD_REQUEST'
  | 'NAME_LENGTH'
  | 'NAME_CHARS'
  | 'NAME_BLOCKED'
  | 'NAME_TAKEN'
  | 'COUNTRY'
  | 'POW_INVALID'
  | 'UNAUTHORIZED'
  | 'RATE_LIMITED'
  | 'RENAME_LIMIT'
  | 'NAME_LOCKED'
  | 'RUN_INVALID'
  | 'RUN_EXPIRED'
  | 'RUN_TOO_FAST'
  | 'OUTDATED'
  | 'NOT_FOUND'
  | 'SETUP_REQUIRED'
  | 'INTERNAL'

export interface ApiError {
  error: { code: ErrorCode; message: string }
}

export interface Challenge {
  challenge: string
  bits: number
}

export interface Ticket {
  /** İmzalı oyun bileti; skor gönderilirken aynen geri yollanır */
  ticket: string
  seed: number
  /** Sunucunun bileti verdiği an (ms) */
  iat: number
  v: number
}

export interface Profile {
  name: string
  country: string
  best: number
  /** Dünya ve ülke sıralaması (skoru yoksa null) */
  rank: { world: number; country: number } | null
}

export interface RegisterRequest {
  name: string
  country: string
  challenge: string
  nonce: string
}

export interface RegisterResponse {
  token: string
  profile: Profile
}

export interface UpdateRequest {
  name?: string
  country?: string
}

export interface SubmitRequest {
  ticket: string
  holds: number[]
  score: number
}

export interface SubmitResponse {
  improved: boolean
  profile: Profile
}

export interface LeaderEntry {
  rank: number
  name: string
  country: string
  score: number
}

export interface LeaderboardResponse {
  scope: 'world' | 'country'
  country: string | null
  total: number
  entries: LeaderEntry[]
  me: { rank: number; score: number; name: string; country: string } | null
}

export interface CountryEntry {
  rank: number
  country: string
  /** Ülkenin en iyi 10 oyuncusunun rekorları toplamı */
  score: number
  players: number
}

export interface CountriesResponse {
  entries: CountryEntry[]
}

export interface Health {
  ok: boolean
  store: 'supabase' | 'sqlite' | 'memory'
  ready: boolean
  problem: string | null
}

/** Görünen adı sadeleştirir: baş/son boşluk, art arda boşluklar, görünmez karakterler. */
export function cleanName(raw: string) {
  return raw
    .normalize('NFC')
    .replace(/[​-‏‪-‮⁠-⁯﻿­]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Biçim denetimi (içerik denetimi yalnızca sunucuda yapılır). */
export function checkNameShape(name: string): 'ok' | 'NAME_LENGTH' | 'NAME_CHARS' {
  const chars = [...name]
  if (chars.length < NAME_MIN || chars.length > NAME_MAX) return 'NAME_LENGTH'
  // Yalnızca harf ve rakam: boşluk, nokta, tire, alt çizgi, @ vb. yok (kelimeleri bölüp
  // filtreden kaçırmanın önüne geçer). En az 2 harf: yalnızca rakamdan isim olmaz.
  if (!/^[\p{L}\p{N}][\p{L}\p{M}\p{N}]*$/u.test(name)) return 'NAME_CHARS'
  const letters = name.match(/\p{L}/gu)?.length ?? 0
  if (letters < 2) return 'NAME_CHARS'
  return 'ok'
}
