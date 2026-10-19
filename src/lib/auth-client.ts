import { saveMember } from './member-token'
import type { SessionResult } from './views'

/**
 * Tarayıcı tarafı giriş yardımcıları.
 * - Apple / Google: PKCE. Doğrulayıcı (verifier) bu cihazda kalır; sağlayıcıdan dönülünce
 *   sunucuya kodla birlikte gönderilir.
 * - Bilet: hesabı doğrulanmış ama kaydı olmayan kişi adlarını yazınca hesap bağlanır.
 */

const OAUTH_KEY = 'mesele.oauth.v1'
const TICKET_KEY = 'mesele.ticket.v1'

export type OAuthState = { verifier: string; returnTo: string }

const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

export async function createPkce() {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(48)))
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return { verifier, challenge: b64url(new Uint8Array(digest)) }
}

function store(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key)
    else window.localStorage.setItem(key, value)
  } catch {
    // depolama kapalıysa yok say
  }
}

function load(key: string) {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

export function saveOAuthState(state: OAuthState) {
  store(OAUTH_KEY, JSON.stringify(state))
}

/** Bir kez okunur ve silinir. */
export function takeOAuthState(): OAuthState | null {
  const raw = load(OAUTH_KEY)
  store(OAUTH_KEY, null)
  try {
    const s = raw ? (JSON.parse(raw) as OAuthState) : null
    return s && typeof s.verifier === 'string' && typeof s.returnTo === 'string' ? s : null
  } catch {
    return null
  }
}

export const saveTicket = (ticket: string) => store(TICKET_KEY, ticket)
export const readTicket = () => load(TICKET_KEY) ?? undefined
export const clearTicket = () => store(TICKET_KEY, null)

/** Sunucudan dönen oturumu bu cihaza kaydeder. */
export function persistSession(res: SessionResult) {
  saveMember({
    token: res.token,
    memberId: res.member.id,
    coupleId: res.couple.id,
    role: res.member.role,
    displayName: res.member.name,
    coupleName: res.couple.name,
    coupleCode: res.couple.code,
  })
  clearTicket()
}
