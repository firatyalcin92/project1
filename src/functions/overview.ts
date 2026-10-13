import { createServerFn } from '@tanstack/react-start'
import { ensureOverview, getOverview } from '~/server/overview.server'
import { memberAuth } from './middleware'

export const getOverviewFn = createServerFn({ method: 'POST' })
  .middleware([memberAuth])
  .handler(async ({ context }) => getOverview(context.member))

export const generateOverviewFn = createServerFn({ method: 'POST' })
  .middleware([memberAuth])
  .handler(async ({ context }) => ensureOverview(context.member))
