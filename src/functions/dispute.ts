import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { ANSWER_QUESTION_IDS, LIMITS, RECONSIDER_QUESTIONS, type ReflectionId } from '~/lib/questions'
import {
  approveSharedReport,
  cancelDispute,
  createDispute,
  ensurePerspectives,
  ensureReports,
  getDisputeView,
  listDisputeSummaries,
  saveAnswers,
  saveReconsideration,
} from '~/server/disputes.server'
import { memberAuth } from './middleware'

const visibility = z.enum(['private', 'partner'])
const disputeId = z.object({ disputeId: z.uuid() })
const reflectionIds = RECONSIDER_QUESTIONS.map((q) => q.id) as [ReflectionId, ...ReflectionId[]]

export const listDisputesFn = createServerFn({ method: 'POST' })
  .middleware([memberAuth])
  .handler(async ({ context }) => listDisputeSummaries(context.member))

export const createDisputeFn = createServerFn({ method: 'POST' })
  .middleware([memberAuth])
  .validator(z.object({ title: z.string().max(LIMITS.title * 2) }))
  .handler(async ({ data, context }) => createDispute(context.member, data.title))

export const cancelDisputeFn = createServerFn({ method: 'POST' })
  .middleware([memberAuth])
  .validator(disputeId)
  .handler(async ({ data, context }) => {
    await cancelDispute(context.member, data.disputeId)
    return { ok: true as const }
  })

export const getDisputeFn = createServerFn({ method: 'POST' })
  .middleware([memberAuth])
  .validator(disputeId)
  .handler(async ({ data, context }) => getDisputeView(context.member, data.disputeId))

export const saveAnswersFn = createServerFn({ method: 'POST' })
  .middleware([memberAuth])
  .validator(
    z.object({
      disputeId: z.uuid(),
      whatHappened: z.string().max(LIMITS.text * 2),
      eventVisibility: visibility,
      answers: z
        .array(
          z.object({
            questionId: z.enum(ANSWER_QUESTION_IDS),
            text: z.string().max(LIMITS.text * 2),
            tags: z.array(z.string().max(32)).max(12),
            visibility,
          }),
        )
        .max(ANSWER_QUESTION_IDS.length),
      submit: z.boolean(),
    }),
  )
  .handler(async ({ data, context }) => saveAnswers(context.member, data))

export const requestPerspectivesFn = createServerFn({ method: 'POST' })
  .middleware([memberAuth])
  .validator(disputeId)
  .handler(async ({ data, context }) => ensurePerspectives(context.member, data.disputeId))

export const saveReconsiderationFn = createServerFn({ method: 'POST' })
  .middleware([memberAuth])
  .validator(
    z.object({
      disputeId: z.uuid(),
      items: z
        .array(z.object({ id: z.enum(reflectionIds), text: z.string().max(LIMITS.reflection * 2), visibility }))
        .max(reflectionIds.length),
      closeness: z.number().int().min(1).max(5).nullable(),
      submit: z.boolean(),
    }),
  )
  .handler(async ({ data, context }) => saveReconsideration(context.member, data))

export const requestReportsFn = createServerFn({ method: 'POST' })
  .middleware([memberAuth])
  .validator(disputeId)
  .handler(async ({ data, context }) => ensureReports(context.member, data.disputeId))

export const approveSharedReportFn = createServerFn({ method: 'POST' })
  .middleware([memberAuth])
  .validator(disputeId)
  .handler(async ({ data, context }) => approveSharedReport(context.member, data.disputeId))
