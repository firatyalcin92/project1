import {
  AGREE_TAG,
  EVENT_AGREE,
  OTHER_CHIP,
  chipLabel,
  strongestOptions,
  type AnswerQuestionId,
  type Question,
} from '~/lib/questions'
import type { AnswerDraft } from '~/lib/views'

type Draft = { whatHappened: string; answers: Record<AnswerQuestionId, AnswerDraft> }

/** Tamamlanmış meselede "Anlattıklarınız" için tek satırlık gövde. */
export function answerBody(q: Question, draft: Draft): string {
  if (q.id === 'olay') {
    const agreed = draft.answers[EVENT_AGREE]?.tags.includes(AGREE_TAG) ?? false
    return agreed && !draft.whatHappened ? 'Partnerimin anlatımını onayladım.' : draft.whatHappened
  }
  const a = draft.answers[q.id as AnswerQuestionId]
  if (q.kind === 'feelings') {
    const chips = a.tags.filter((t) => t !== OTHER_CHIP).map((t) => chipLabel(q.id, t))
    if (a.tags.includes(OTHER_CHIP) && a.text) chips.push(a.text)
    return chips.join(', ')
  }
  if (q.kind === 'needs') {
    return [a.tags.map((t) => chipLabel(q.id, t)).join(', '), a.text].filter(Boolean).join(' — ')
  }
  if (q.kind === 'strongest') {
    const option = strongestOptions(draft.answers).find((o) => a.tags.includes(o.id))
    return [option?.label, a.text].filter(Boolean).join(' — ')
  }
  const thoughts = q.thoughts
    ? draft.answers[q.thoughts.answerId].tags.map((t) => chipLabel(q.thoughts!.answerId, t))
    : []
  const chips = a.tags.map((t) => chipLabel(q.id, t))
  return [a.text, thoughts.join(', '), chips.join(', ')].filter(Boolean).join(' — ')
}
