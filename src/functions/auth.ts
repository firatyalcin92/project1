import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { signIn } from '~/server/couples.server'
import {
  authOptions,
  finishOAuth,
  issueTicket,
  oauthUrl,
  sendEmailCode,
  verifyEmailCode,
} from '~/server/identity.server'
import { rateLimit } from '~/server/rate-limit.server'
import { optionalMemberAuth } from './middleware'

const TEN_MINUTES = 10 * 60 * 1000

/** Açık giriş yöntemleri (Google düğmesi yalnızca açıksa görünür). */
export const authOptionsFn = createServerFn({ method: 'POST' }).handler(async () => authOptions())

/** Apple / Google: sağlayıcının onay sayfasının adresi (PKCE). */
export const oauthStartFn = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      provider: z.enum(['google', 'apple']),
      redirectTo: z.url().max(300),
      codeChallenge: z.string().max(128),
    }),
  )
  .handler(async ({ data }) => {
    rateLimit('oauth-start', 30, TEN_MINUTES)
    return { url: oauthUrl(data.provider, data.redirectTo, data.codeChallenge) }
  })

export const oauthFinishFn = createServerFn({ method: 'POST' })
  .middleware([optionalMemberAuth])
  .validator(z.object({ code: z.string().max(500), verifier: z.string().max(128) }))
  .handler(async ({ data, context }) => {
    rateLimit('oauth-finish', 30, TEN_MINUTES)
    const identity = await finishOAuth(data.code, data.verifier)
    return signIn(identity, context.member, issueTicket)
  })

export const emailCodeSendFn = createServerFn({ method: 'POST' })
  .validator(z.object({ email: z.string().max(300) }))
  .handler(async ({ data }) => {
    rateLimit('email-send', 6, TEN_MINUTES)
    return sendEmailCode(data.email)
  })

export const emailCodeVerifyFn = createServerFn({ method: 'POST' })
  .middleware([optionalMemberAuth])
  .validator(z.object({ email: z.string().max(300), code: z.string().max(12) }))
  .handler(async ({ data, context }) => {
    // Kod tahminini zorlaştırmak için sıkı sınır.
    rateLimit('email-verify', 10, TEN_MINUTES)
    const identity = await verifyEmailCode(data.email, data.code)
    return signIn(identity, context.member, issueTicket)
  })
