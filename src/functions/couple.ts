import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { LIMITS } from '~/lib/questions'
import { buildPanel, createCouple, invitePreview, joinCouple } from '~/server/couples.server'
import { readTicket } from '~/server/identity.server'
import { adminStats } from '~/server/admin.server'
import { betaStatus } from '~/server/beta.server'
import { rateLimit } from '~/server/rate-limit.server'
import { memberAuth } from './middleware'

const TEN_MINUTES = 10 * 60 * 1000

/** Giriş yapmış ama kaydı olmayan kişinin bileti: yeni üye hesaba bağlanır. */
const ticket = z.string().max(1000).optional()

export const createCoupleFn = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      mode: z.enum(['couple', 'solo']).default('couple'),
      displayName: z.string().max(LIMITS.displayName * 2),
      partnerName: z
        .string()
        .max(LIMITS.displayName * 2)
        .optional(),
      ticket,
    }),
  )
  .handler(async ({ data }) => {
    rateLimit('create', 10, TEN_MINUTES)
    return createCouple({ ...data, identity: readTicket(data.ticket) })
  })

export const joinCoupleFn = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      code: z.string().max(16),
      displayName: z.string().max(LIMITS.displayName * 2),
      ticket,
    }),
  )
  .handler(async ({ data }) => {
    // Kod tahminini zorlaştırmak için sıkı sınır.
    rateLimit('join', 12, TEN_MINUTES)
    return joinCouple({ ...data, identity: readTicket(data.ticket) })
  })

export const invitePreviewFn = createServerFn({ method: 'POST' })
  .validator(z.object({ code: z.string().max(16) }))
  .handler(async ({ data }) => {
    rateLimit('invite-preview', 30, TEN_MINUTES)
    return invitePreview(data.code)
  })

/** Test sürümü: bugün yeni mesele açılabilir mi? */
export const betaStatusFn = createServerFn({ method: 'POST' }).handler(async () => betaStatus())

export const adminStatsFn = createServerFn({ method: 'POST' })
  .validator(z.object({ password: z.string().max(200) }))
  .handler(async ({ data }) => {
    rateLimit('admin', 20, TEN_MINUTES)
    return adminStats(data.password)
  })

export const getPanelFn = createServerFn({ method: 'POST' })
  .middleware([memberAuth])
  .handler(async ({ context }) => buildPanel(context.member))
