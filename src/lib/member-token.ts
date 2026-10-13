import type { Role } from './views'

/**
 * Cihaza özel gizli üye token'ı.
 *
 * - localStorage anahtarı: `mesele.member.v1`
 * - Token 256-bit rastgele bir sırdır; sunucu yalnızca SHA-256 hash'ini saklar.
 * - Her sunucu çağrısında `x-mesele-member` başlığıyla gönderilir.
 * - Capacitor içinde çalışırken (iOS/Android), iOS'un WebView depolamasını
 *   temizleyebilmesine karşı token ayrıca yerel Preferences eklentisine yansıtılır.
 *
 * Çift kodu (ör. WWPX6G) burada yalnızca görüntüleme için tutulur; kimlik
 * doğrulamada asla kullanılmaz.
 */

export const MEMBER_STORAGE_KEY = 'mesele.member.v1'
export const MEMBER_HEADER = 'x-mesele-member'

export type StoredMember = {
  v: 1
  token: string
  memberId: string
  coupleId: string
  role: Role
  displayName: string
  coupleName: string
  coupleCode: string
  savedAt: string
}

const CHANGE_EVENT = 'mesele:member-change'

function isStoredMember(v: unknown): v is StoredMember {
  if (!v || typeof v !== 'object') return false
  const o = v as Record<string, unknown>
  return (
    o.v === 1 && typeof o.token === 'string' && /^[A-Za-z0-9_-]{43}$/.test(o.token) && typeof o.memberId === 'string'
  )
}

let cache: { raw: string | null; value: StoredMember | null } = { raw: null, value: null }

export function readMember(): StoredMember | null {
  if (typeof window === 'undefined') return null
  let raw: string | null = null
  try {
    raw = window.localStorage.getItem(MEMBER_STORAGE_KEY)
  } catch {
    return null
  }
  if (raw === cache.raw) return cache.value
  let value: StoredMember | null = null
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : null
    value = isStoredMember(parsed) ? parsed : null
  } catch {
    value = null
  }
  cache = { raw, value }
  return value
}

export function readMemberToken(): string | null {
  return readMember()?.token ?? null
}

export function saveMember(member: Omit<StoredMember, 'v' | 'savedAt'>) {
  const value: StoredMember = { v: 1, ...member, savedAt: new Date().toISOString() }
  const raw = JSON.stringify(value)
  try {
    window.localStorage.setItem(MEMBER_STORAGE_KEY, raw)
  } catch {
    // Gizli sekme vb. — Preferences yedeği yine de denenir.
  }
  void nativePreferences()?.set({ key: MEMBER_STORAGE_KEY, value: raw })
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

export function updateMemberCache(patch: Partial<Pick<StoredMember, 'displayName' | 'coupleName' | 'coupleCode'>>) {
  const current = readMember()
  if (!current) return
  const changed = Object.entries(patch).some(([k, v]) => current[k as keyof StoredMember] !== v)
  if (changed) saveMember({ ...current, ...patch })
}

export function clearMember() {
  try {
    window.localStorage.removeItem(MEMBER_STORAGE_KEY)
  } catch {
    // yok say
  }
  void nativePreferences()?.remove({ key: MEMBER_STORAGE_KEY })
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

export function subscribeMember(callback: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === MEMBER_STORAGE_KEY) callback()
  }
  window.addEventListener('storage', onStorage)
  window.addEventListener(CHANGE_EVENT, callback)
  return () => {
    window.removeEventListener('storage', onStorage)
    window.removeEventListener(CHANGE_EVENT, callback)
  }
}

// ---------------------------------------------------------------------------
// Capacitor Preferences yansıtması (eklenti yoksa sessizce atlanır)
// ---------------------------------------------------------------------------

type PreferencesPlugin = {
  get(opts: { key: string }): Promise<{ value: string | null }>
  set(opts: { key: string; value: string }): Promise<void>
  remove(opts: { key: string }): Promise<void>
}

function nativePreferences(): PreferencesPlugin | null {
  if (typeof window === 'undefined') return null
  const cap = (
    window as unknown as { Capacitor?: { isNativePlatform?: () => boolean; Plugins?: Record<string, unknown> } }
  ).Capacitor
  if (!cap?.isNativePlatform?.()) return null
  return (cap.Plugins?.Preferences as PreferencesPlugin | undefined) ?? null
}

/**
 * Uygulama açılışında çağrılır: localStorage boşsa ama yerel yedek varsa geri yükler.
 */
export async function restoreFromNative(): Promise<boolean> {
  const prefs = nativePreferences()
  if (!prefs || readMember()) return false
  try {
    const { value } = await prefs.get({ key: MEMBER_STORAGE_KEY })
    if (!value) return false
    const parsed: unknown = JSON.parse(value)
    if (!isStoredMember(parsed)) return false
    window.localStorage.setItem(MEMBER_STORAGE_KEY, value)
    window.dispatchEvent(new Event(CHANGE_EVENT))
    return true
  } catch {
    return false
  }
}
