import { createMiddleware } from '@tanstack/react-start'
import { getRequestHeader } from '@tanstack/react-start/server'
import { MEMBER_HEADER, readMemberToken } from '~/lib/member-token'
import { authenticateMember } from '~/server/auth.server'

/**
 * memberAuth: Her korumalı sunucu fonksiyonunun önündeki kapı.
 *
 * İstemci: cihazdaki gizli token'ı `x-mesele-member` başlığına koyar.
 * Sunucu:  token'ı SHA-256 ile hash'ler, üyeyi bulur ve bağlama ekler.
 *          Üye bulunamazsa hiçbir veri dönmeden UNAUTHORIZED fırlatılır.
 *          Mesele düzeyindeki erişim ayrıca requireDispute ile doğrulanır.
 */
export const memberAuth = createMiddleware({ type: 'function' })
  .client(async ({ next }) => {
    const token = readMemberToken()
    return next({ headers: token ? { [MEMBER_HEADER]: token } : {} })
  })
  .server(async ({ next }) => {
    const member = await authenticateMember(getRequestHeader(MEMBER_HEADER))
    return next({ context: { member } })
  })

/** Oturum varsa üyeyi ekler, yoksa member = null (giriş / hesap kaydetme için). */
export const optionalMemberAuth = createMiddleware({ type: 'function' })
  .client(async ({ next }) => {
    const token = readMemberToken()
    return next({ headers: token ? { [MEMBER_HEADER]: token } : {} })
  })
  .server(async ({ next }) => {
    const raw = getRequestHeader(MEMBER_HEADER)
    const member = raw ? await authenticateMember(raw).catch(() => null) : null
    return next({ context: { member } })
  })
