import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { LIMITS } from '~/lib/questions'
import { buildPanel, createCouple, joinCouple, restoreSession } from '~/server/couples.server'
import { rateLimit } from '~/server/rate-limit.server'
import { memberAuth } from './middleware'

const TEN_MINUTES = 10 * 60 * 1000

export const createCoupleFn = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      mode: z.enum(['couple', 'solo']).default('couple'),
      coupleName: z
        .string()
        .max(LIMITS.coupleName * 2)
        .default(''),
      displayName: z.string().max(LIMITS.displayName * 2),
      partnerName: z
        .string()
        .max(LIMITS.displayName * 2)
        .optional(),
    }),
  )
  .handler(async ({ data }) => {
    rateLimit('create', 10, TEN_MINUTES)
    return createCouple(data)
  })

export const joinCoupleFn = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      code: z.string().max(16),
      displayName: z.string().max(LIMITS.displayName * 2),
    }),
  )
  .handler(async ({ data }) => {
    // Kod tahminini zorlaştırmak için sıkı sınır.
    rateLimit('join', 12, TEN_MINUTES)
    return joinCouple(data)
  })

export const restoreSessionFn = createServerFn({ method: 'POST' })
  .validator(z.object({ token: z.string().max(64) }))
  .handler(async ({ data }) => {
    rateLimit('restore', 12, TEN_MINUTES)
    return restoreSession(data.token)
  })

export const getPanelFn = createServerFn({ method: 'POST' })
  .middleware([memberAuth])
  .handler(async ({ context }) => buildPanel(context.member))
