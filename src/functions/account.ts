import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { PLAN_PERIODS } from '~/lib/plans'
import { approveDeletion, dismissDeletion, purchase, requestDeletion } from '~/server/account.server'
import { rateLimit } from '~/server/rate-limit.server'
import { memberAuth } from './middleware'

const TEN_MINUTES = 10 * 60 * 1000

export const purchaseFn = createServerFn({ method: 'POST' })
  .middleware([memberAuth])
  .validator(
    z.object({
      period: z.enum(PLAN_PERIODS as unknown as ['monthly', 'yearly']),
      trial: z.boolean().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    rateLimit('purchase', 10, TEN_MINUTES)
    return purchase(context.member, data)
  })

export const requestDeletionFn = createServerFn({ method: 'POST' })
  .middleware([memberAuth])
  .handler(async ({ context }) => requestDeletion(context.member))

export const approveDeletionFn = createServerFn({ method: 'POST' })
  .middleware([memberAuth])
  .handler(async ({ context }) => approveDeletion(context.member))

export const dismissDeletionFn = createServerFn({ method: 'POST' })
  .middleware([memberAuth])
  .handler(async ({ context }) => dismissDeletion(context.member))
