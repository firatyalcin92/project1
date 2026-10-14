import { useMutation } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { reflectAnswersFn, saveAnswersFn } from '~/functions/dispute'
import { parseError } from '~/lib/errors'
import {
  ANSWER_QUESTION_IDS,
  FEELING_AFTER,
  FEELING_DURING,
  FEELING_GROUPS,
  FEELING_SOFT_MAX,
  LIMITS,
  OTHER_CHIP,
  OTHER_FEELING_LABEL,
  QUESTIONS,
  QUESTION_COUNT,
  STRONGEST_FEELING,
  WHEN_LABEL,
  chipLabel,
  introMessage,
  privacyNotice,
  strongestOptions,
  type AnswerQuestionId,
  type Question,
} from '~/lib/questions'
import type { AnswerDraft, DisputeView } from '~/lib/views'
import { LogoMark } from '../brand'
import { IconArrowLeft, IconArrowRight, IconUsers } from '../icons'
import { BottomBar } from '../layout'
import { Button, ChipToggle, Notice, TextArea, cx } from '../ui'

type Draft = { whatHappened: string; answers: Record<AnswerQuestionId, AnswerDraft> }

type Page = 'giris' | Question['id'] | 'ozet'
const PAGES: Page[] = ['giris', ...QUESTIONS.map((q) => q.id), 'ozet']

function pageComplete(page: Page, d: Draft): boolean {
  if (page === 'giris' || page === 'ozet') return true
  const q = QUESTIONS.find((x) => x.id === page)!
  if (page === 'olay') return d.whatHappened.trim().length >= q.minLength
  // His soruları isteğe bağlıdır: hiçbir seçim zorunlu değildir.
  if (q.kind !== 'text') return true
  const a = d.answers[page as AnswerQuestionId]
  if (q.textRequired && a.text.trim().length < q.minLength) return false
  return true
}

/** Mevcut taslağa göre "en çok etkileyen his" seçenekleri. */
function optionsFor(d: Pick<Draft, 'answers'>) {
  return strongestOptions(d.answers[FEELING_DURING], d.answers[FEELING_AFTER])
}

function toPayload(disputeId: string, d: Draft, submit: boolean) {
  return {
    disputeId,
    whatHappened: d.whatHappened,
    answers: ANSWER_QUESTION_IDS.map((id) => ({ questionId: id, text: d.answers[id].text, tags: d.answers[id].tags })),
    submit,
  }
}

/** Danışmanın konuşma balonu. */
function Bubble({ children, typing }: { children?: ReactNode; typing?: boolean }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-1 inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-surface shadow-soft">
        <LogoMark size={20} />
      </span>
      <div className="min-w-0 rounded-3xl rounded-tl-md bg-surface px-4 py-3 text-[16px] leading-relaxed text-ink shadow-soft">
        {typing ? (
          <span className="inline-flex gap-1 py-1" aria-label="Danışman yazıyor">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="inline-block size-2 animate-breathe rounded-full bg-ink-faint"
                style={{ animationDelay: `${i * 0.2}s` }}
              />
            ))}
          </span>
        ) : (
          children
        )}
      </div>
    </div>
  )
}

export function AnswerWizard({ view, onView }: { view: DisputeView; onView: (v: DisputeView) => void }) {
  const partnerName = view.partnerName ?? ''
  const solo = view.mode === 'solo'
  const [draft, setDraft] = useState<Draft>(() => ({
    whatHappened: view.mine.whatHappened,
    answers: view.mine.answers,
  }))
  const [pageIndex, setPageIndex] = useState(() => {
    if (!view.mine.whatHappened) return 0
    const firstOpen = PAGES.findIndex((p) => p !== 'giris' && !pageComplete(p, { ...view.mine }))
    return firstOpen === -1 ? PAGES.length - 1 : firstOpen
  })
  const [confirming, setConfirming] = useState(false)
  const [reflection, setReflection] = useState(view.mine.reflection)
  const reflectedFor = useRef(view.mine.reflection ? '__saved__' : '')
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

  const reflect = useMutation({
    mutationFn: () =>
      reflectAnswersFn({
        data: { disputeId: view.id, whatHappened: draft.whatHappened, thought: draft.answers.dusunce.text },
      }),
    onSuccess: (r) => setReflection(r.reflection),
  })

  // His sorusuna gelince, ilk iki cevap değiştiyse danışman yeniden yansıtır.
  useEffect(() => {
    if (page !== FEELING_DURING) return
    const key = `${draft.whatHappened}\u0000${draft.answers.dusunce.text}`
    if (reflectedFor.current === '__saved__') {
      reflectedFor.current = key
      return
    }
    if (reflectedFor.current === key || reflect.isPending) return
    reflectedFor.current = key
    reflect.mutate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

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
  const questionIndex = QUESTIONS.findIndex((q) => q.id === page)
  const question = questionIndex >= 0 ? QUESTIONS[questionIndex]! : null

  return (
    <div ref={topRef} className="scroll-mt-20">
      {question ? (
        <div className="mb-5 flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
            <div
              className="h-full rounded-full bg-clay transition-[width] duration-500"
              style={{ width: `${((questionIndex + 1) / QUESTIONS.length) * 100}%` }}
            />
          </div>
          <span className="text-xs font-medium text-ink-faint tabular-nums">
            {question.number} / {QUESTION_COUNT}
          </span>
        </div>
      ) : null}

      <div key={page} className="animate-rise space-y-5">
        {page === 'giris' ? (
          <Intro partnerName={partnerName} solo={solo} />
        ) : page === 'ozet' ? (
          <Summary draft={draft} partnerName={partnerName} solo={solo} />
        ) : (
          <QuestionStep
            question={question!}
            draft={draft}
            partnerName={partnerName}
            update={update}
            setAnswer={setAnswer}
            reflection={page === FEELING_DURING ? reflection : null}
            reflecting={page === FEELING_DURING && reflect.isPending}
          />
        )}
      </div>

      {save.isError ? (
        <div className="mt-4">
          <Notice tone="error">{parseError(save.error).message}</Notice>
        </div>
      ) : null}

      <BottomBar>
        {page === 'ozet' && confirming ? (
          <div className="space-y-3">
            <p className="text-center text-sm text-ink-soft">
              Gönderdikten sonra cevaplarınızı değiştiremezsiniz.{' '}
              {solo
                ? 'Ardından danışman raporunuz hazırlanacak.'
                : 'Ardından partnerinizin de anlatmasını bekleyeceğiz.'}
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
            {page === 'giris' ? (
              <Button full size="lg" onClick={() => go(1)}>
                Hazırım, başlayalım <IconArrowRight size={18} />
              </Button>
            ) : page === 'ozet' ? (
              <Button full size="lg" disabled={!allComplete} onClick={() => setConfirming(true)}>
                Cevaplarımı gönder
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

function Intro({ partnerName, solo }: { partnerName: string; solo: boolean }) {
  const [hello, why, six] = introMessage(partnerName)
  return (
    <section className="space-y-3" aria-label="Danışmanın karşılaması">
      <Bubble>{hello}</Bubble>
      <Bubble>{why}</Bubble>
      <Bubble>{six}</Bubble>
      <div className="flex gap-2.5 rounded-2xl border border-line bg-sunken px-4 py-3 text-[14px] leading-relaxed text-ink-soft">
        <IconUsers size={18} className="mt-0.5 shrink-0" />
        <p>{privacyNotice(partnerName, solo)}</p>
      </div>
    </section>
  )
}

function QuestionStep({
  question: q,
  draft,
  partnerName,
  update,
  setAnswer,
  reflection,
  reflecting,
}: {
  question: Question
  draft: Draft
  partnerName: string
  update: (fn: (d: Draft) => Draft) => void
  setAnswer: (id: AnswerQuestionId, patch: Partial<AnswerDraft>) => void
  reflection: string | null
  reflecting: boolean
}) {
  return (
    <section className="space-y-4" aria-labelledby={`q-${q.id}`}>
      {reflecting ? <Bubble typing /> : reflection ? <Bubble>{reflection}</Bubble> : null}
      <Bubble>
        <span id={`q-${q.id}`} className="font-medium">
          {q.number}. {q.prompt(partnerName)}
        </span>
      </Bubble>
      {q.section ? (
        <p className="px-1">
          <span className="inline-flex rounded-full bg-clay-soft px-3 py-1 text-[13px] font-semibold text-clay-strong">
            {q.section}
          </span>
        </p>
      ) : null}
      {q.helper ? <p className="px-1 text-[14px] leading-relaxed text-ink-soft">{q.helper}</p> : null}

      {q.kind === 'feelings' ? (
        <FeelingsPicker
          question={q}
          answer={draft.answers[q.id as AnswerQuestionId]}
          onChange={(patch) => setAnswer(q.id as AnswerQuestionId, patch)}
        />
      ) : q.kind === 'strongest' ? (
        <StrongestPicker draft={draft} question={q} onChange={(patch) => setAnswer(STRONGEST_FEELING, patch)} />
      ) : (
        <TextStep question={q} draft={draft} partnerName={partnerName} update={update} setAnswer={setAnswer} />
      )}
    </section>
  )
}

function MicHint() {
  return (
    <p className="px-1 text-[13px] text-ink-faint">
      🎙 Klavyedeki mikrofon simgesine dokunarak sesli de anlatabilirsiniz.
    </p>
  )
}

function TextStep({
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
  const examples = q.examples(partnerName)
  const toggle = (id: string) =>
    setAnswer(q.id as AnswerQuestionId, {
      tags: answer!.tags.includes(id) ? answer!.tags.filter((t) => t !== id) : [...answer!.tags, id],
    })

  return (
    <>
      <div className="space-y-2">
        <TextArea
          value={text}
          onChange={setText}
          maxLength={LIMITS.text}
          minRows={isEvent ? 7 : 4}
          placeholder={q.placeholder}
          aria-label={q.prompt(partnerName)}
        />
        <MicHint />
        {short ? (
          <p className="px-1 text-[13px] text-ink-faint">Biraz daha açar mısınız? Birkaç kelime daha yeter.</p>
        ) : null}
        {examples.length && !text.trim() ? (
          <div className="space-y-1.5 pt-1">
            <p className="px-1 text-[12px] font-semibold tracking-[0.12em] text-ink-faint uppercase">
              Örnekler · dokunarak başlayabilirsiniz
            </p>
            <div className="flex flex-col gap-1.5">
              {examples.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => setText(ex.replace(/…$/, ' '))}
                  className="rounded-2xl border border-dashed border-line-strong px-3.5 py-2.5 text-left text-[14px] leading-snug text-ink-soft transition hover:border-clay hover:text-ink"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {q.chips ? (
        <div className="space-y-2 pt-1">
          <p className="px-1 text-[15px] font-medium text-ink">{q.chipsPrompt}</p>
          <div className="flex flex-wrap gap-2" role="group" aria-label={q.chipsPrompt}>
            {q.chips.map((chip) => (
              <ChipToggle
                key={chip.id}
                label={chip.label}
                selected={answer!.tags.includes(chip.id)}
                onToggle={() => toggle(chip.id)}
              />
            ))}
          </div>
        </div>
      ) : null}
    </>
  )
}

function FeelingsPicker({
  question: q,
  answer,
  onChange,
}: {
  question: Question
  answer: AnswerDraft
  onChange: (patch: Partial<AnswerDraft>) => void
}) {
  const otherSelected = answer.tags.includes(OTHER_CHIP)
  const count = answer.tags.filter((t) => t !== OTHER_CHIP).length + (otherSelected ? 1 : 0)
  const toggle = (id: string) => {
    const on = answer.tags.includes(id)
    onChange({
      tags: on ? answer.tags.filter((t) => t !== id) : [...answer.tags, id],
      ...(id === OTHER_CHIP && on ? { text: '' } : {}),
    })
  }

  return (
    <div className="space-y-5">
      <p
        className={cx(
          'rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed',
          count > FEELING_SOFT_MAX ? 'bg-honey-soft text-ink' : 'bg-sunken text-ink-soft',
        )}
        aria-live="polite"
      >
        {count > FEELING_SOFT_MAX
          ? `${count} his seçtiniz. İsterseniz sizde en belirgin olan 5–7 tanesinde kalabilirsiniz; bu bir zorunluluk değil.`
          : count > 0
            ? `${count} his seçtiniz. Mümkünse en çok 5–7 seçenek işaretlemeniz, en belirgin olanları görmemizi kolaylaştırır.`
            : 'Hiçbirini seçmek zorunda değilsiniz. Mümkünse en çok 5–7 seçenek işaretlemeniz, en belirgin olanları görmemizi kolaylaştırır.'}
      </p>

      {FEELING_GROUPS.map((g) => (
        <div key={g.id} className="space-y-2">
          <p className="px-1 text-[12px] font-semibold tracking-[0.12em] text-ink-faint uppercase">{g.label}</p>
          <div className="flex flex-wrap gap-2" role="group" aria-label={`${q.section ?? q.title}: ${g.label}`}>
            {g.chips.map((chip) => (
              <ChipToggle
                key={chip.id}
                shape="soft"
                label={chip.label}
                selected={answer.tags.includes(chip.id)}
                onToggle={() => toggle(chip.id)}
              />
            ))}
          </div>
        </div>
      ))}

      <div className="space-y-2">
        <p className="px-1 text-[12px] font-semibold tracking-[0.12em] text-ink-faint uppercase">Başka</p>
        <ChipToggle
          shape="soft"
          label={`${OTHER_FEELING_LABEL}…`}
          selected={otherSelected}
          onToggle={() => toggle(OTHER_CHIP)}
        />
        {otherSelected ? (
          <input
            value={answer.text}
            onChange={(e) => onChange({ text: e.target.value })}
            maxLength={LIMITS.other}
            placeholder={q.placeholder}
            autoFocus
            aria-label="Başka bir his"
            className="h-12 w-full rounded-2xl border border-line-strong bg-surface px-4 text-ink placeholder:text-ink-faint focus:border-clay focus:ring-4 focus:ring-clay-soft focus:outline-none"
          />
        ) : null}
      </div>
    </div>
  )
}

function StrongestPicker({
  draft,
  question: q,
  onChange,
}: {
  draft: Draft
  question: Question
  onChange: (patch: Partial<AnswerDraft>) => void
}) {
  const answer = draft.answers[STRONGEST_FEELING]
  const options = optionsFor(draft)
  const selected = options.find((o) => answer.tags.includes(o.id))?.id ?? null

  return (
    <div className="space-y-4">
      {options.length ? (
        <div className="flex flex-col gap-2" role="radiogroup" aria-label={q.title}>
          {options.map((o) => (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={selected === o.id}
              onClick={() => onChange({ tags: selected === o.id ? [] : [o.id] })}
              className={cx(
                'flex min-h-12 items-center justify-between gap-3 rounded-2xl border px-4 py-2.5 text-left transition active:scale-[0.99]',
                selected === o.id
                  ? 'border-clay bg-clay text-on-clay shadow-soft'
                  : 'border-line-strong bg-surface text-ink hover:border-clay',
              )}
            >
              <span className="text-[15px] leading-snug font-medium">{o.label}</span>
              <span className={cx('shrink-0 text-[12px]', selected === o.id ? 'text-on-clay/80' : 'text-ink-faint')}>
                {WHEN_LABEL[o.when]}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <Notice tone="info">
          Önceki adımlarda bir his işaretlemediniz. Dilerseniz sizi en çok etkileyen hissi aşağıya kendi cümlelerinizle
          yazabilirsiniz.
        </Notice>
      )}

      <div className="space-y-2">
        <p className="px-1 text-[15px] font-medium text-ink">Neden? (isteğe bağlı)</p>
        <TextArea
          value={answer.text}
          onChange={(v) => onChange({ text: v })}
          maxLength={LIMITS.text}
          minRows={3}
          placeholder={q.placeholder}
          aria-label="Bu his sizi neden en çok etkiledi?"
        />
        <MicHint />
      </div>
    </div>
  )
}

/** Özet ve tamamlanmış meseledeki "Anlattıklarınız" için tek satırlık gövde. */
export function answerBody(q: Question, draft: Pick<Draft, 'whatHappened' | 'answers'>): string {
  if (q.id === 'olay') return draft.whatHappened
  const a = draft.answers[q.id as AnswerQuestionId]
  if (q.kind === 'feelings') {
    const chips = a.tags.filter((t) => t !== OTHER_CHIP).map((t) => chipLabel(q.id, t))
    if (a.tags.includes(OTHER_CHIP) && a.text) chips.push(a.text)
    return chips.join(', ')
  }
  if (q.kind === 'strongest') {
    const option = optionsFor(draft).find((o) => a.tags.includes(o.id))
    return [option?.label, a.text].filter(Boolean).join(' — ')
  }
  const chips = a.tags.map((t) => chipLabel(q.id, t))
  return [a.text, chips.join(', ')].filter(Boolean).join(' — ')
}

function Summary({ draft, partnerName, solo }: { draft: Draft; partnerName: string; solo: boolean }) {
  return (
    <section className="space-y-4" aria-label="Cevaplarınızın özeti">
      <Bubble>Teşekkür ederim. Anlattıklarınıza son bir kez göz atın; isterseniz geri dönüp düzeltebilirsiniz.</Bubble>
      <ul className="space-y-2">
        {QUESTIONS.map((q) => (
          <li key={q.id} className="card p-4">
            <p className="text-sm font-semibold">{q.title}</p>
            <p className="mt-1 line-clamp-3 text-[14px] leading-relaxed text-ink-soft">{answerBody(q, draft) || '—'}</p>
          </li>
        ))}
      </ul>
      <p className="px-1 text-[13px] leading-relaxed text-ink-faint">{privacyNotice(partnerName, solo)}</p>
    </section>
  )
}
