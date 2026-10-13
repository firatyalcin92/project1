import '@tanstack/react-start/server-only'
import { MEMBER_TOKEN_PATTERN, hashMemberToken } from './crypto.server'
import { notFound, unauthorized } from './errors.server'
import { getStore, type DisputeRow, type Role } from './store.server'

export type AuthedMember = {
  id: string
  coupleId: string
  role: Role
  name: string
}

/**
 * `x-mesele-member` başlığındaki ham token'ı doğrular.
 * Token biçimsizse ya da hash'i hiçbir üyeyle eşleşmiyorsa UNAUTHORIZED.
 */
export async function authenticateMember(rawToken: string | undefined | null): Promise<AuthedMember> {
  const token = rawToken?.trim()
  if (!token || !MEMBER_TOKEN_PATTERN.test(token)) return unauthorized()
  const store = await getStore()
  const member = await store.getMemberByTokenHash(await hashMemberToken(token))
  if (!member) return unauthorized()
  return { id: member.id, coupleId: member.couple_id, role: member.role, name: member.display_name }
}

/**
 * IDOR koruması: member -> couple -> dispute zincirini doğrular.
 * Mesele yoksa da başka bir çifte aitse de aynı yanıt döner (varlık sızdırılmaz).
 */
export async function requireDispute(member: AuthedMember, disputeId: string): Promise<DisputeRow> {
  const store = await getStore()
  const dispute = await store.getDispute(disputeId)
  if (!dispute || dispute.couple_id !== member.coupleId) return notFound()
  return dispute
}
