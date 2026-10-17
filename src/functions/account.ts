import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { PLAN_PERIODS } from '~/lib/plans'
import { approveDeletion, claimTransfer, dismissDeletion, purchase, requestDeletion } from '~/server/account.server'
import { cancelMyRecovery, createPartnerRecovery, redeemRecovery } from '~/server/couples.server'
import { rateLimit } from '~/server/rate-limit.server'
import { memberAuth } from './middleware'

const TEN_MINUTES = 10 * 60 * 1000

export const purchaseFn = createServerFn({ method: 'POST' })
  .middleware([memberAuth])
  .validator(
    z.object({
      period: z.enum(PLAN_PERIODS as unknown as ['monthly', 'yearly']),
      keyBackedUp: z.boolean(),
      codeSaved: z.boolean(),
      trial: z.boolean().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    rateLimit('purchase', 10, TEN_MINUTES)
    return purchase(context.member, data)
  })

export const claimTransferFn = createServerFn({ method: 'POST' })
  .middleware([memberAuth])
  .validator(z.object({ code: z.string().max(32) }))
  .handler(async ({ data, context }) => {
    rateLimit('transfer', 10, TEN_MINUTES)
    return claimTransfer(context.member, data.code)
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

/** Cihazını kaybeden partner için 24 saatlik, tek kullanımlık yeniden bağlanma kodu. */
export const createRecoveryFn = createServerFn({ method: 'POST' })
  .middleware([memberAuth])
  .handler(async ({ context }) => {
    rateLimit('recovery-create', 10, TEN_MINUTES)
    return createPartnerRecovery(context.member)
  })

/** "Bu kodu ben istemedim": benim için üretilmiş bekleyen kodları iptal eder. */
export const cancelRecoveryFn = createServerFn({ method: 'POST' })
  .middleware([memberAuth])
  .handler(async ({ context }) => cancelMyRecovery(context.member))

export const redeemRecoveryFn = createServerFn({ method: 'POST' })
  .validator(z.object({ coupleCode: z.string().max(16), recoveryCode: z.string().max(16) }))
  .handler(async ({ data }) => {
    // Kod tahminini zorlaştırmak için sıkı sınır.
    rateLimit('recovery-redeem', 8, TEN_MINUTES)
    return redeemRecovery(data)
  })
