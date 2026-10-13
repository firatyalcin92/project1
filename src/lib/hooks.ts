import { useSyncExternalStore } from 'react'
import { readMember, subscribeMember, type StoredMember } from './member-token'

/** Cihazdaki üye bilgisi. Sunucuda ve ilk hidrasyonda `undefined` (bilinmiyor). */
export function useMember(): StoredMember | null | undefined {
  return useSyncExternalStore(subscribeMember, readMember, () => undefined)
}
