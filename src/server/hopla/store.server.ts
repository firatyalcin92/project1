import '@tanstack/react-start/server-only'
import { join } from 'node:path'
import { dataDir } from '../store.server'

/**
 * Hopla sıralama deposu. MESELE ile aynı seçim mantığı: Supabase bilgileri varsa Supabase
 * (yeni hopla_players tablosu), üretimde Supabase yoksa SQLite (ayrı hopla.db dosyası),
 * geliştirme ve testlerde bellek. MESELE tablolarına hiç dokunulmaz.
 */

export interface PlayerRow {
  id: string
  name: string
  name_key: string
  country: string
  token_hash: string
  best_score: number
  best_at: string | null
  best_jumps: number
  best_perfects: number
  /** En son kabul edilen oyunun bilet zamanı (aynı bilet ikinci kez kullanılamaz) */
  last_run_iat: number
  created_ip_hash: string | null
  rename_count: number
  rename_window: string | null
  banned: boolean
  created_at: string
}

export type NewPlayer = Pick<PlayerRow, 'name' | 'name_key' | 'country' | 'token_hash' | 'created_ip_hash'>

export interface ProfilePatch {
  name?: string
  name_key?: string
  country?: string
  rename_count: number
  rename_window: string
}

export interface BestRun {
  score: number
  jumps: number
  perfects: number
  iat: number
  at: string
}

export interface TopRow {
  name: string
  country: string
  score: number
}

export interface CountryRow {
  country: string
  score: number
  players: number
}

export type StoreCheck = { ready: true } | { ready: false; problem: string }

/** Tablolar kurulmamışsa fırlatılır; API 503 SETUP_REQUIRED döner. */
export class SetupRequired extends Error {}

export interface HoplaStore {
  readonly kind: 'memory' | 'supabase' | 'sqlite'
  check(): Promise<StoreCheck>
  createPlayer(p: NewPlayer): Promise<PlayerRow | 'name_taken'>
  playerByToken(tokenHash: string): Promise<PlayerRow | null>
  playerByNameKey(nameKey: string): Promise<PlayerRow | null>
  updateProfile(id: string, patch: ProfilePatch): Promise<PlayerRow | 'name_taken'>
  countRecentByIp(ipHash: string, sinceIso: string): Promise<number>
  /** Yalnızca skor öncekinden yüksek ve bilet daha yeniyse yazar (tek atomik işlem). */
  submitBest(id: string, run: BestRun): Promise<boolean>
  /** 1'den başlayan sıra: daha yüksek skor ya da aynı skora daha önce ulaşanlar önde */
  rank(score: number, bestAt: string, country: string | null): Promise<number>
  top(limit: number, country: string | null): Promise<TopRow[]>
  countRanked(country: string | null): Promise<number>
  /** Ülkeler: en iyi 10 oyuncunun rekorları toplamı */
  countryRanking(limit: number): Promise<CountryRow[]>
  /** Hiç skor göndermemiş eski kayıtları siler (isim kapatmayı önler; yasaklı/kilitli kayıtlar kalır) */
  deleteStale(beforeIso: string): Promise<number>
  setBanned(id: string, banned: boolean): Promise<void>
  /** Oyuncunun kendi isteğiyle kaydını ve skorunu tamamen siler */
  deletePlayer(id: string): Promise<void>
  /**
   * Kaydı kişisel veriden arındırıp yalnızca isim kilidi olarak bırakır: isim, ülke, skorlar, IP özeti
   * silinir; name_key ayrılmış (özetlenmiş) anahtarla, cihaz anahtarı kullanılamaz bir değerle değişir.
   */
  retirePlayer(id: string, retiredKey: string, deadTokenHash: string): Promise<void>
}

let cached: HoplaStore | null = null

export async function getHoplaStore(): Promise<HoplaStore> {
  if (cached) return cached
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (url && key) {
    const { createSupabaseHoplaStore } = await import('./store-supabase.server')
    cached = createSupabaseHoplaStore(url, key)
    return cached
  }
  const memory =
    process.env.HOPLA_STORE === 'memory' ||
    process.env.MESELE_STORE === 'memory' ||
    (process.env.NODE_ENV !== 'production' && !process.env.MESELE_DB_PATH && !process.env.HOPLA_DB_PATH)
  if (memory) {
    const { createMemoryHoplaStore } = await import('./store-memory.server')
    cached = createMemoryHoplaStore()
    return cached
  }
  const { createSqliteHoplaStore } = await import('./store-sqlite.server')
  cached = createSqliteHoplaStore(process.env.HOPLA_DB_PATH?.trim() || join(dataDir(), 'hopla.db'))
  return cached
}

/** Testler için */
export function __setHoplaStoreForTests(store: HoplaStore | null) {
  cached = store
}

/** Sıralama karşılaştırması (bellek ve SQLite deposu için ortak) */
export function ahead(a: { best_score: number; best_at: string | null }, score: number, bestAt: string) {
  return a.best_score > score || (a.best_score === score && (a.best_at ?? '') < bestAt)
}
