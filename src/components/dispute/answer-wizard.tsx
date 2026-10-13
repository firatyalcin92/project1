import { useMutation } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { saveAnswersFn } from '~/functions/dispute'
import { parseError } from '~/lib/errors'
import {
  ANSWER_QUESTION_IDS,
  LIMITS,
  PRIVACY_STEP,
  QUESTIONS,
  chipLabel,
  type AnswerQuestionId,
  type Question,
  type Visibility,
} from '~/lib/questions'
import { alsoAfter, genitive } from '~/lib/turkish'
import type { AnswerDraft, DisputeView } from '~/lib/views'
import { IconArrowLeft, IconArrowRight, IconLock } from '../icons'
import { BottomBar } from '../layout'
import { Button, ChipToggle, Notice, TextArea, VisibilityToggle, cx } from '../ui'

type Draft = {
  whatHappened: string
  eventVisibility: Visibility
  answers: Record<AnswerQuestionId, AnswerDraft>
}

type Page = Question['id'] | 'gizlilik'
const PAGES: Page[] = [...QUESTIONS.map((q) => q.id), 'gizlilik']

function pageComplete(page: Page, d: Draft): boolean {
  if (page === 'gizlilik') return true
  const q = QUESTIONS.find((x) => x.id === page)!
  if (page === 'olay') return d.whatHappened.trim().length >= q.minLength
  const a = d.answers[page as AnswerQuestionId]
  if (q.chipsRequired && a.tags.length === 0) return false
  if (q.textRequired && a.text.trim().length < q.minLength) return false
  return true
}

function toPayload(disputeId: string, d: Draft, submit: boolean) {
  return {
    disputeId,
    whatHappened: d.whatHappened,
    eventVisibility: d.eventVisibility,
    answers: ANSWER_QUESTION_IDS.map((id) => ({
      questionId: id,
      text: d.answers[id].text,
      tags: d.answers[id].tags,
      visibility: d.answers[id].visibility,
    })),
    submit,
  }
}

export function AnswerWizard({ view, onView }: { view: DisputeView; onView: (v: DisputeView) => void }) {
  const partnerName = view.partner?.name ?? ''
  const [draft, setDraft] = useState<Draft>(() => ({
    whatHappened: view.mine.whatHappened,
    eventVisibility: view.mine.eventVisibility,
    answers: view.mine.answers,
  }))
  const [pageIndex, setPageIndex] = useState(() => {
    const firstOpen = PAGES.findIndex((p) => !pageComplete(p, { ...view.mine }))
    return firstOpen === -1 ? PAGES.length - 1 : firstOpen
  })
  const [confirming, setConfirming] = useState(false)
  const dirty = useRef(false)
  const topRef = useRef<HTMLDivElement>(null)
  // Kayıtlar sırayla gider: bir taslak kaydı asla "gönder"i geçemez.
  const chain = useRef<Promise<unknown>>(Promise.resolve())
  const page = PAGES[pageIndex]!

  const save = useMutation({
    mutationFn: (submit: boolean) => {
      const payload = toPayload(view.id, draft, submit)
      const run = chain.current.catch(() => {}).then(() => saveAnswersFn({ data: payload }))
      chain.current = run
      return run
    },
    onSuccess: (v, submit) => {
      dirty.current = false
      if (submit) onView(v)
    },
  })

  // Yazarken birkaç saniyede bir taslağı sessizce kaydet.
  useEffect(() => {
    if (!dirty.current) return
    const t = setTimeout(() => {
      if (dirty.current && !save.isPending) save.mutate(false)
    }, 2500)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft])

  const update = (fn: (d: Draft) => Draft) => {
    dirty.current = true
    setDraft(fn)
  }
  const setAnswer = (id: AnswerQuestionId, patch: Partial<AnswerDraft>) =>
    update((d) => ({ ...d, answers: { ...d.answers, [id]: { ...d.answers[id], ...patch } } }))

  const go = (delta: number) => {
    if (dirty.current) save.mutate(false)
    setConfirming(false)
    setPageIndex((i) => Math.min(PAGES.length - 1, Math.max(0, i + delta)))
    requestAnimationFrame(() => topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  const complete = pageComplete(page, draft)
  const allComplete = useMemo(() => PAGES.every((p) => pageComplete(p, draft)), [draft])

  return (
    <div ref={topRef} className="scroll-mt-20">
      <div className="mb-5 flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
          <div
            className="h-full rounded-full bg-clay transition-[width] duration-500"
            style={{ width: `${((pageIndex + 1) / PAGES.length) * 100}%` }}
          />
        </div>
        <span className="text-xs font-medium text-ink-faint tabular-nums">
          {pageIndex + 1} / {PAGES.length}
        </span>
      </div>

      {pageIndex === 0 ? (
        <div className="mb-5">
          <Notice tone="info">
            <span className="inline-flex items-start gap-2">
              <IconLock size={16} className="mt-0.5 shrink-0" />
              <span>
                Bu adımda yalnızca sen varsın. {partnerName ? partnerName : 'Partnerin'} yanıtlarını, ikiniz de
                anlatmadan göremez. Acele etme; nasıl hissettiysen öyle yaz.
              </span>
            </span>
          </Notice>
        </div>
      ) : null}

      <div key={page} className="animate-rise">
        {page === 'gizlilik' ? (
          <PrivacyStep draft={draft} partnerName={partnerName} update={update} setAnswer={setAnswer} />
        ) : (
          <QuestionStep
            question={QUESTIONS.find((q) => q.id === page)!}
            draft={draft}
            partnerName={partnerName}
            update={update}
            setAnswer={setAnswer}
          />
        )}
      </div>

      {save.isError ? (
        <div className="mt-4">
          <Notice tone="error">{parseError(save.error).message}</Notice>
        </div>
      ) : null}

      <BottomBar>
        {page === 'gizlilik' && confirming ? (
          <div className="space-y-3">
            <p className="text-center text-sm text-ink-soft">
              Gönderdikten sonra anlatımını değiştiremezsin.{' '}
              {partnerName ? `${genitive(partnerName)} ${alsoAfter(genitive(partnerName))}` : 'Partnerinin de'}{' '}
              anlatmasını bekleyeceğiz.
            </p>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setConfirming(false)}>
                Bir daha bakayım
              </Button>
              <Button full loading={save.isPending} onClick={() => save.mutate(true)}>
                Evet, gönder
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {pageIndex > 0 ? (
              <Button variant="secondary" aria-label="Önceki soru" onClick={() => go(-1)}>
                <IconArrowLeft size={18} />
              </Button>
            ) : null}
            {page === 'gizlilik' ? (
              <Button full size="lg" disabled={!allComplete} onClick={() => setConfirming(true)}>
                Anlatımımı gönder
              </Button>
            ) : (
              <Button full size="lg" disabled={!complete} onClick={() => go(1)}>
                Devam <IconArrowRight size={18} />
              </Button>
            )}
          </div>
        )}
        <p className={cx('mt-2 text-center text-[12px] text-ink-faint', save.isPending ? 'opacity-100' : 'opacity-0')}>
          Taslak kaydediliyor…
        </p>
      </BottomBar>
    </div>
  )
}

function QuestionStep({
  question: q,
  draft,
  partnerName,
  update,
  setAnswer,
}: {
  question: Question
  draft: Draft
  partnerName: string
  update: (fn: (d: Draft) => Draft) => void
  setAnswer: (id: AnswerQuestionId, patch: Partial<AnswerDraft>) => void
}) {
  const isEvent = q.id === 'olay'
  const answer = isEvent ? null : draft.answers[q.id as AnswerQuestionId]
  const text = isEvent ? draft.whatHappened : answer!.text
  const setText = (v: string) =>
    isEvent ? update((d) => ({ ...d, whatHappened: v })) : setAnswer(q.id as AnswerQuestionId, { text: v })
  const short = q.textRequired && text.trim().length > 0 && text.trim().length < q.minLength

  return (
    <section className="space-y-5" aria-labelledby={`q-${q.id}`}>
      <div className="space-y-2">
        <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-clay-strong">{q.title}</p>
        <h2 id={`q-${q.id}`} className="text-[24px] leading-snug font-semibold">
          {q.prompt(partnerName)}
        </h2>
        {q.helper ? <p className="leading-relaxed text-ink-soft">{q.helper}</p> : null}
      </div>

      {q.chips ? (
        <div className="flex flex-wrap gap-2" role="group" aria-label={q.title}>
          {q.chips.map((chip) => {
            const selected = answer!.tags.includes(chip.id)
            return (
              <ChipToggle
                key={chip.id}
                label={chip.label}
                selected={selected}
                onToggle={() =>
                  setAnswer(q.id as AnswerQuestionId, {
                    tags: selected ? answer!.tags.filter((t) => t !== chip.id) : [...answer!.tags, chip.id],
                  })
                }
              />
            )
          })}
        </div>
      ) : null}

      <div className="space-y-2">
        {q.textPrompt ? <p className="text-[15px] font-medium text-ink">{q.textPrompt}</p> : null}
        <TextArea
          value={text}
          onChange={setText}
          maxLength={LIMITS.text}
          minRows={isEvent ? 6 : q.textRequired ? 4 : 3}
          placeholder={q.placeholder}
          aria-label={q.textPrompt ?? q.prompt(partnerName)}
        />
        {short ? <p className="text-[13px] text-ink-faint">Biraz daha açar mısın? Birkaç kelime daha yeter.</p> : null}
      </div>
    </section>
  )
}

function PrivacyStep({
  draft,
  partnerName,
  update,
  setAnswer,
}: {
  draft: Draft
  partnerName: string
  update: (fn: (d: Draft) => Draft) => void
  setAnswer: (id: AnswerQuestionId, patch: Partial<AnswerDraft>) => void
}) {
  const rows = QUESTIONS.map((q) => {
    if (q.id === 'olay') {
      return {
        id: q.id,
        title: q.title,
        preview: draft.whatHappened,
        visibility: draft.eventVisibility,
        set: (v: Visibility) => update((d) => ({ ...d, eventVisibility: v })),
      }
    }
    const a = draft.answers[q.id as AnswerQuestionId]
    const chips = a.tags.map((t) => chipLabel(q.id, t)).join(', ')
    return {
      id: q.id,
      title: q.title,
      preview: [chips, a.text].filter(Boolean).join(' — '),
      visibility: a.visibility,
      set: (v: Visibility) => setAnswer(q.id as AnswerQuestionId, { visibility: v }),
    }
  })

  return (
    <section className="space-y-5" aria-labelledby="q-gizlilik">
      <div className="space-y-2">
        <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-clay-strong">{PRIVACY_STEP.title}</p>
        <h2 id="q-gizlilik" className="text-[24px] leading-snug font-semibold">
          {PRIVACY_STEP.prompt(partnerName)}
        </h2>
        <p className="leading-relaxed text-ink-soft">{PRIVACY_STEP.helper}</p>
      </div>
      <ul className="space-y-3">
        {rows.map((r) => (
          <li key={r.id} className="card space-y-3 p-4">
            <div>
              <p className="text-sm font-semibold">{r.title}</p>
              <p className="mt-1 line-clamp-2 text-[14px] leading-relaxed text-ink-soft">{r.preview || '—'}</p>
            </div>
            <VisibilityToggle value={r.visibility} onChange={r.set} partnerName={partnerName || undefined} compact />
          </li>
        ))}
      </ul>
      <p className="text-[13px] leading-relaxed text-ink-faint">
        İpucu: Paylaştıkların ne kadar çoksa, {partnerName ? genitive(partnerName) : 'partnerinin'} seni anlaması o
        kadar kolaylaşır. Ama hazır olmadığın bir şeyi paylaşmak zorunda değilsin.
      </p>
    </section>
  )
}
