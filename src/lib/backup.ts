import { useSyncExternalStore } from 'react'
import { readMember } from './member-token'

/**
 * "Cihaz anahtarımı yedekledim" bilgisi yalnızca bu cihazda tutulur. Anahtar
 * değişirse (ör. partnerin verdiği kodla yeniden bağlanınca) yeniden sorulur.
 */
const KEY = 'mesele.backup.v1'
const EVENT = 'mesele:backup-change'

const fingerprint = (token: string) => token.slice(0, 10)

export function isBackedUp(): boolean {
  if (typeof window === 'undefined') return true
  const token = readMember()?.token
  if (!token) return true
  try {
    return window.localStorage.getItem(KEY) === fingerprint(token)
  } catch {
    return false
  }
}

export function markBackedUp() {
  const token = readMember()?.token
  if (!token) return
  try {
    window.localStorage.setItem(KEY, fingerprint(token))
  } catch {
    // depolama kapalıysa yok say
  }
  window.dispatchEvent(new Event(EVENT))
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb)
  window.addEventListener('storage', cb)
  return () => {
    window.removeEventListener(EVENT, cb)
    window.removeEventListener('storage', cb)
  }
}

export function useBackedUp() {
  return useSyncExternalStore(subscribe, isBackedUp, () => true)
}
