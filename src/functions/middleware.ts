import { createMiddleware } from '@tanstack/react-start'
import { getRequestHeader } from '@tanstack/react-start/server'
import { DEVICE_HEADER, deviceId } from '~/lib/device'
import { MEMBER_HEADER, readMemberToken } from '~/lib/member-token'
import { authenticateMember } from '~/server/auth.server'

/** Üye token'ı ve cihaz kimliği (test sürümü sınırları için) her çağrıya eklenir. */
function clientHeaders() {
  const headers: Record<string, string> = {}
  const token = readMemberToken()
  if (token) headers[MEMBER_HEADER] = token
  const device = deviceId()
  if (device) headers[DEVICE_HEADER] = device
  return headers
}

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
    return next({ headers: clientHeaders() })
  })
  .server(async ({ next }) => {
    const member = await authenticateMember(getRequestHeader(MEMBER_HEADER))
    return next({ context: { member } })
  })

/** Yalnızca cihaz kimliğini ekler (oturum gerektirmeyen çağrılar: katılma, çift oluşturma). */
export const deviceHeader = createMiddleware({ type: 'function' }).client(async ({ next }) =>
  next({ headers: clientHeaders() }),
)

/** Oturum varsa üyeyi ekler, yoksa member = null (giriş / hesap kaydetme için). */
export const optionalMemberAuth = createMiddleware({ type: 'function' })
  .client(async ({ next }) => {
    return next({ headers: clientHeaders() })
  })
  .server(async ({ next }) => {
    const raw = getRequestHeader(MEMBER_HEADER)
    const member = raw ? await authenticateMember(raw).catch(() => null) : null
    return next({ context: { member } })
  })
