import { useMutation } from '@tanstack/react-query'
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { reflectAnswersFn, saveAnswersFn } from '~/functions/dispute'
import { parseError } from '~/lib/errors'
import {
  AGREE_TAG,
  ANSWER_QUESTION_IDS,
  EVENT_AGREE,
  FEELINGS,
  FEELING_GROUPS,
  FEELING_MAX,
  FEELING_MIN,
  LIMITS,
  OTHER_CHIP,
  OTHER_FEELING_LABEL,
  QUESTIONS,
  QUESTION_COUNT,
  STRONGEST_FEELING,
  WHEN_LABEL,
  chipLabel,
  feelingCount,
  introMessage,
  privacyNotice,
  seedFor,
  strongestOptions,
  type AnswerQuestionId,
  type Question,
} from '~/lib/questions'
import { genitive } from '~/lib/turkish'
import type { AnswerDraft, DisputeView } from '~/lib/views'
import { LogoMark } from '../brand'
import { OfferSheet } from '../offer'
import { IconArrowLeft, IconArrowRight, IconUsers } from '../icons'
import { BottomBar } from '../layout'
import { Button, ChipToggle, Notice, TextArea, cx } from '../ui'

type Draft = { whatHappened: string; answers: Record<AnswerQuestionId, AnswerDraft> }

/** Mesele bilgisi: soru ifadesi seçimi ve sırayla anlatım */
type WizardMeta = { disputeId: string; order: 'first' | 'second' | 'solo'; partnerEvent: string | null }
const Meta = createContext<WizardMeta>({ disputeId: '', order: 'solo', partnerEvent: null })
const useSeed = (questionId: string) => seedFor(useContext(Meta).disputeId, questionId)

/** İkinci anlatan, ilk anlatımı aynen onayladı mı? */
const agreed = (d: Pick<Draft, 'answers'>) => d.answers[EVENT_AGREE]?.tags.includes(AGREE_TAG) ?? false

type Page = 'giris' | Question['id'] | 'ozet'
const PAGES: Page[] = ['giris', ...QUESTIONS.map((q) => q.id), 'ozet']

/** Sayfa neden henüz geçilemiyor? (geçilebiliyorsa null) */
function blockReason(page: Page, d: Draft, order: WizardMeta['order'] = 'solo'): string | null {
  if (page === 'giris' || page === 'ozet') return null
  const q = QUESTIONS.find((x) => x.id === page)!
  if (page === 'olay') {
    if (order === 'second')
      return agreed(d) || d.whatHappened.trim().length >= 10 ? null : 'Onaylayın ya da kendi eklemenizi yazın.'
    return d.whatHappened.trim().length >= q.minLength ? null : ''
  }
  const a = d.answers[page as AnswerQuestionId]
  if (q.kind === 'feelings')
    return feelingCount(a) >= FEELING_MIN ? null : 'Devam etmek için sizi anlatan en az bir his seçin.'
  if (q.kind === 'strongest')
    return optionsFor(d).some((o) => a.tags.includes(o.id)) ? null : 'Devam etmek için birini seçin.'
  if (q.kind === 'needs') {
    if (a.tags.length === 0) return q.chipsError ?? ''
    return a.text.trim().length >= q.minLength ? null : ''
  }
  if (q.textRequired && a.text.trim().length < q.minLength) return ''
  if (q.chipsRequired && a.tags.length === 0) return q.chipsError ?? ''
  return null
}

const pageComplete = (page: Page, d: Draft, order?: WizardMeta['order']) => blockReason(page, d, order) === null

/** Sayfaya dönüldüğünde (önceden cevaplanmışsa) her şey hemen görünür. */
function hasContent(page: Page, d: Draft) {
  if (page === 'giris' || page === 'ozet') return false
  if (page === 'olay') return d.whatHappened.trim().length > 0 || agreed(d)
  const a = d.answers[page as AnswerQuestionId]
  return a.text.trim().length > 0 || a.tags.length > 0
}

// Danışman konuşur gibi, acele etmeden: önce soru, sonra açıklama, en son cevap alanı.
const REVEAL_DELAYS = [1100, 2300, 1900, 1500]
/** Seçenek grupları da birer birer belirir (ms) */
const STAGGER_MS = 320

function useReveal(stages: number, { instant, ready = true }: { instant: boolean; ready?: boolean }) {
  const [shown, setShown] = useState(instant ? stages : 0)
  useEffect(() => {
    if (instant || !ready) return
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const timers: number[] = []
    let t = 0
    for (let i = 1; i <= stages; i++) {
      t += (REVEAL_DELAYS[i - 1] ?? 900) * (reduce ? 0.35 : 1)
      timers.push(window.setTimeout(() => setShown((s) => Math.max(s, i)), t))
    }
    return () => timers.forEach(clearTimeout)
  }, [instant, ready, stages])
  return instant ? stages : shown
}

/** Mevcut taslağa göre "en çok etkileyen his" seçenekleri. */
function optionsFor(d: Pick<Draft, 'answers'>) {
  return strongestOptions(d.answers)
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
  const meta: WizardMeta = { disputeId: view.id, order: view.answerOrder, partnerEvent: view.partnerEvent }
  const [draft, setDraft] = useState<Draft>(() => ({
    whatHappened: view.mine.whatHappened,
    answers: view.mine.answers,
  }))
  const [pageIndex, setPageIndex] = useState(() => {
    if (!view.mine.whatHappened && !agreed(view.mine)) return 0
    const firstOpen = PAGES.findIndex((p) => p !== 'giris' && !pageComplete(p, { ...view.mine }, view.answerOrder))
    const index = firstOpen === -1 ? PAGES.length - 1 : firstOpen
    // Üyelik gerekiyorsa 1. sorunun ötesine geçilmez.
    return view.paywall ? Math.min(index, PAGES.indexOf('olay')) : index
  })
  // Ücretsiz hak bittiyse: 1. sorudan sonra teklif ekranı (satın alınca kilit kalkar).
  const [unlocked, setUnlocked] = useState(false)
  const [offerOpen, setOfferOpen] = useState(false)
  const paywall = view.paywall && !unlocked
  const onPaymentRequired = (e: unknown) => {
    if (parseError(e).code === 'PAYMENT_REQUIRED') setOfferOpen(true)
  }
  const [confirming, setConfirming] = useState(false)
  const [reflection, setReflection] = useState(view.mine.reflection)
  // Yansıtmanın hangi "olay + düşünce" için üretildiği; durum olduğu için değişince ekran yenilenir.
  const [reflectedFor, setReflectedFor] = useState(view.mine.reflection ? '__saved__' : '')
  const [revealedPage, setRevealedPage] = useState<Page | null>(null)
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
    onError: onPaymentRequired,
  })

  const reflect = useMutation({
    mutationFn: () =>
      reflectAnswersFn({
        data: { disputeId: view.id, whatHappened: draft.whatHappened, thought: draft.answers.dusunce.text },
      }),
    onSuccess: (r) => setReflection(r.reflection),
    onError: onPaymentRequired,
  })

  // His sorusuna gelince, ilk iki cevap değiştiyse danışman yeniden yansıtır.
  const reflectKey = `${draft.whatHappened}\u0000${draft.answers.dusunce.text}`
  useEffect(() => {
    if (page !== FEELINGS) return
    if (reflectedFor === '__saved__') {
      setReflectedFor(reflectKey)
      return
    }
    if (reflectedFor === reflectKey || reflect.isPending) return
    setReflectedFor(reflectKey)
    reflect.mutate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])
  // Yansıtma gelene (ya da hata verene) kadar his sorusu açılmaz.
  const reflectionReady = !reflect.isPending && reflectedFor === reflectKey

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

  const reason = blockReason(page, draft, meta.order)
  const revealed = page === 'ozet' || revealedPage === page
  const complete = reason === null && revealed
  const allComplete = useMemo(() => PAGES.every((p) => pageComplete(p, draft, meta.order)), [draft, meta.order])
  const questionIndex = QUESTIONS.findIndex((q) => q.id === page)
  const question = questionIndex >= 0 ? QUESTIONS[questionIndex]! : null

  return (
    <Meta.Provider value={meta}>
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
            <Intro
              partnerName={partnerName}
              solo={solo}
              order={meta.order}
              onRevealed={() => setRevealedPage('giris')}
            />
          ) : page === 'ozet' ? (
            <Summary draft={draft} partnerName={partnerName} solo={solo} order={meta.order} />
          ) : (
            <QuestionStep
              question={question!}
              draft={draft}
              partnerName={partnerName}
              update={update}
              setAnswer={setAnswer}
              reflection={page === FEELINGS ? reflection : null}
              ready={page === FEELINGS ? reflectionReady : true}
              onRevealed={() => setRevealedPage(page)}
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
                <Button full size="lg" disabled={!revealed} onClick={() => go(1)}>
                  Hazırım, başlayalım <IconArrowRight size={18} />
                </Button>
              ) : page === 'ozet' ? (
                <Button full size="lg" disabled={!allComplete} onClick={() => setConfirming(true)}>
                  Cevaplarımı gönder
                </Button>
              ) : (
                <Button
                  full
                  size="lg"
                  disabled={!complete}
                  onClick={() => {
                    if (page === 'olay' && paywall) {
                      if (dirty.current) save.mutate(false)
                      setOfferOpen(true)
                    } else go(1)
                  }}
                >
                  Devam <IconArrowRight size={18} />
                </Button>
              )}
            </div>
          )}
          {revealed && reason ? (
            <p className="mt-2 text-center text-[13px] text-ink-soft">{reason}</p>
          ) : (
            <p
              className={cx(
                'mt-2 text-center text-[12px] text-ink-faint',
                save.isPending ? 'opacity-100' : 'opacity-0',
              )}
            >
              Taslak kaydediliyor…
            </p>
          )}
        </BottomBar>
        {offerOpen ? (
          <OfferSheet
            variant="continue"
            onClose={() => setOfferOpen(false)}
            onPurchased={() => {
              setUnlocked(true)
              setOfferOpen(false)
              save.reset()
              if (page === 'olay') go(1)
            }}
          />
        ) : null}
      </div>
    </Meta.Provider>
  )
}

function Intro({
  partnerName,
  solo,
  order,
  onRevealed,
}: {
  partnerName: string
  solo: boolean
  order: WizardMeta['order']
  onRevealed: () => void
}) {
  const messages = introMessage(partnerName)
  const shown = useReveal(messages.length + 1, { instant: false })
  useEffect(() => {
    if (shown > messages.length) onRevealed()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown])
  return (
    <section className="space-y-3" aria-label="Danışmanın karşılaması" aria-live="polite">
      {messages.slice(0, shown).map((m) => (
        <div key={m} className="animate-rise">
          <Bubble>{m}</Bubble>
        </div>
      ))}
      {shown < messages.length ? <Bubble typing /> : null}
      {shown > messages.length ? (
        <div className="flex animate-rise gap-2.5 rounded-2xl border border-line bg-sunken px-4 py-3 text-[14px] leading-relaxed text-ink-soft">
          <IconUsers size={18} className="mt-0.5 shrink-0" />
          <p>{privacyNotice(partnerName, solo, order)}</p>
        </div>
      ) : null}
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
  ready,
  onRevealed,
}: {
  question: Question
  draft: Draft
  partnerName: string
  update: (fn: (d: Draft) => Draft) => void
  setAnswer: (id: AnswerQuestionId, patch: Partial<AnswerDraft>) => void
  reflection: string | null
  ready: boolean
  onRevealed: () => void
}) {
  // Aşamalar: 1 soru · 2 açıklama · 3 cevap alanı
  const seed = useSeed(q.id)
  const meta = useContext(Meta)
  const afterPartner = q.id === 'olay' && meta.order === 'second' && Boolean(meta.partnerEvent)
  const [instant] = useState(() => hasContent(q.id, draft))
  const shown = useReveal(3, { instant, ready })
  useEffect(() => {
    if (shown >= 3) onRevealed()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown])

  return (
    <section className="space-y-4" aria-labelledby={`q-${q.id}`} aria-live="polite">
      {!ready ? <Bubble typing /> : reflection ? <Bubble>{reflection}</Bubble> : null}
      {ready && shown === 0 ? <Bubble typing /> : null}
      {shown >= 1 ? (
        <div className="animate-rise">
          <Bubble>
            <span id={`q-${q.id}`} className="font-medium">
              {q.number}.{' '}
              {afterPartner
                ? `${partnerName || 'Partneriniz'} yaşananları şöyle anlattı. Sizin eklemek ya da düzeltmek istediğiniz bir kısım var mı? Yaşanan tartışmayı bir de sizden dinliyorum, buyurun.`
                : q.prompt(partnerName, seed)}
            </span>
          </Bubble>
        </div>
      ) : null}
      {shown >= 2 ? (
        <div className="animate-rise space-y-3">
          {q.section ? (
            <p className="px-1">
              <span className="inline-flex rounded-full bg-clay-soft px-3 py-1 text-[13px] font-semibold text-clay-strong">
                {q.section}
              </span>
            </p>
          ) : null}
          {afterPartner ? (
            <figure className="rounded-2xl border-l-4 border-partner-b bg-partner-b-soft/60 px-4 py-3">
              <figcaption className="text-[12px] font-semibold tracking-[0.12em] text-ink-faint uppercase">
                {partnerName || 'Partneriniz'} anlatıyor
              </figcaption>
              <blockquote className="mt-1.5 text-[15px] leading-relaxed whitespace-pre-line text-ink">
                {meta.partnerEvent}
              </blockquote>
            </figure>
          ) : q.helper ? (
            <p className="px-1 text-[14px] leading-relaxed text-ink-soft">{q.helper}</p>
          ) : null}
        </div>
      ) : null}
      {shown >= 3 ? (
        <div className="animate-rise space-y-4">
          {q.kind === 'feelings' ? (
            <FeelingsPicker
              question={q}
              answer={draft.answers[q.id as AnswerQuestionId]}
              onChange={(patch) => setAnswer(q.id as AnswerQuestionId, patch)}
            />
          ) : q.kind === 'strongest' ? (
            <StrongestPicker draft={draft} question={q} onChange={(patch) => setAnswer(STRONGEST_FEELING, patch)} />
          ) : q.kind === 'needs' ? (
            <NeedsStep
              question={q}
              answer={draft.answers[q.id as AnswerQuestionId]}
              partnerName={partnerName}
              onChange={(patch) => setAnswer(q.id as AnswerQuestionId, patch)}
            />
          ) : afterPartner ? (
            <EventAfterPartner draft={draft} partnerName={partnerName} update={update} setAnswer={setAnswer} />
          ) : (
            <TextStep question={q} draft={draft} partnerName={partnerName} update={update} setAnswer={setAnswer} />
          )}
        </div>
      ) : null}
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
  const seed = useSeed(q.id)
  const order = useContext(Meta).order
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
  const thoughts = q.thoughts ? draft.answers[q.thoughts.answerId] : null
  const toggleThought = (id: string) =>
    thoughts &&
    setAnswer(q.thoughts!.answerId, {
      tags: thoughts.tags.includes(id) ? thoughts.tags.filter((t) => t !== id) : [...thoughts.tags, id],
    })
  // Düşünce kalıpları ve "O an ne yaptınız?" düşünce yazıldıktan sonra, sırayla gelir.
  const [chipsInstant] = useState(() => (answer?.tags.length ?? 0) > 0 || (thoughts?.tags.length ?? 0) > 0)
  const textReady = text.trim().length >= q.minLength
  const chipStage = useReveal(2, { instant: chipsInstant, ready: Boolean(q.chips) && textReady })

  return (
    <>
      <div className="space-y-2">
        <TextArea
          value={text}
          onChange={setText}
          maxLength={LIMITS.text}
          minRows={isEvent ? 7 : 4}
          placeholder={q.placeholder}
          aria-label={q.prompt(partnerName, seed)}
        />
        <MicHint />
        {isEvent && order === 'first' ? (
          <p className="rounded-2xl bg-sunken px-3.5 py-2.5 text-[13px] leading-relaxed text-ink-soft">
            Bu kutuya yazdıklarınızı {partnerName || 'partneriniz'} olduğu gibi görecek; onaylayacak ya da kendi
            gözünden ekleme yapıp devam edecek. Diğer cevaplarınız ona gösterilmez.
          </p>
        ) : null}
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

      {q.thoughts && thoughts && chipStage >= 1 ? (
        <div className="animate-rise space-y-3 pt-2">
          <Bubble>
            <span className="font-medium">{q.thoughts.prompt}</span>
          </Bubble>
          <div className="flex flex-wrap gap-2" role="group" aria-label={q.thoughts.prompt}>
            {q.thoughts.chips.map((chip, i) => (
              <span key={chip.id} className="animate-rise" style={{ animationDelay: `${i * 60}ms` }}>
                <ChipToggle
                  shape="soft"
                  label={chip.label}
                  selected={thoughts.tags.includes(chip.id)}
                  onToggle={() => toggleThought(chip.id)}
                />
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {q.chips && chipStage >= 2 ? (
        <div className="animate-rise space-y-3 pt-2">
          <Bubble>
            <span className="font-medium">{q.chipsPrompt}</span>
          </Bubble>
          <div className="flex flex-wrap gap-2" role="group" aria-label={q.chipsPrompt}>
            {q.chips.map((chip, i) => (
              <span key={chip.id} className="animate-rise" style={{ animationDelay: `${i * 60}ms` }}>
                <ChipToggle
                  shape="soft"
                  label={chip.label}
                  selected={answer!.tags.includes(chip.id)}
                  onToggle={() => toggle(chip.id)}
                />
              </span>
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
  // Sınır için "başka bir şey" seçildiği an bir yer tutar.
  const used = answer.tags.filter((t) => t !== OTHER_CHIP).length + (otherSelected ? 1 : 0)
  const full = used >= FEELING_MAX
  const toggle = (id: string) => {
    const on = answer.tags.includes(id)
    if (!on && full) return
    onChange({
      tags: on ? answer.tags.filter((t) => t !== id) : [...answer.tags, id],
      ...(id === OTHER_CHIP && on ? { text: '' } : {}),
    })
  }

  return (
    <div className="space-y-5">
      <p
        className={cx(
          'sticky top-16 z-10 flex animate-rise items-center justify-between gap-3 rounded-2xl px-4 py-2.5 text-[13px] leading-snug shadow-soft',
          full ? 'bg-honey-soft text-ink' : 'bg-sunken text-ink-soft',
        )}
        aria-live="polite"
      >
        <span>
          {full
            ? 'En fazla 7 his seçebilirsiniz. Değiştirmek için birini kaldırın.'
            : 'Sizi en iyi anlatan hisleri seçin (en fazla 7).'}
        </span>
        <span className="shrink-0 font-semibold tabular-nums">
          {used} / {FEELING_MAX}
        </span>
      </p>

      {FEELING_GROUPS.map((g, gi) => (
        <div key={g.id} className="animate-rise space-y-2" style={{ animationDelay: `${(gi + 1) * STAGGER_MS}ms` }}>
          <p className="px-1 text-[12px] font-semibold tracking-[0.12em] text-ink-faint uppercase">{g.label}</p>
          <div className="flex flex-wrap gap-2" role="group" aria-label={`${q.title}: ${g.label}`}>
            {g.chips.map((chip) => {
              const selected = answer.tags.includes(chip.id)
              return (
                <ChipToggle
                  key={chip.id}
                  shape="soft"
                  label={chip.label}
                  selected={selected}
                  disabled={full && !selected}
                  onToggle={() => toggle(chip.id)}
                />
              )
            })}
          </div>
        </div>
      ))}

      <div
        className="animate-rise space-y-2"
        style={{ animationDelay: `${(FEELING_GROUPS.length + 1) * STAGGER_MS}ms` }}
      >
        <p className="px-1 text-[12px] font-semibold tracking-[0.12em] text-ink-faint uppercase">Başka</p>
        <ChipToggle
          shape="soft"
          label={`${OTHER_FEELING_LABEL}…`}
          selected={otherSelected}
          disabled={full && !otherSelected}
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

  if (!options.length) {
    return <Notice tone="info">Önceki soruda bir his seçmediniz. Geri dönüp sizi anlatan hisleri seçer misiniz?</Notice>
  }

  return (
    <div className="flex flex-col gap-2" role="radiogroup" aria-label={q.title}>
      {options.map((o, i) => (
        <div key={o.id} className="animate-rise space-y-2" style={{ animationDelay: `${i * STAGGER_MS}ms` }}>
          <button
            type="button"
            role="radio"
            aria-checked={selected === o.id}
            onClick={() => onChange({ tags: [o.id] })}
            className={cx(
              'flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl border px-4 py-2.5 text-left transition active:scale-[0.99]',
              selected === o.id
                ? 'border-clay bg-clay text-on-clay shadow-soft'
                : 'border-line-strong bg-surface text-ink hover:border-clay',
            )}
          >
            <span className="text-[15px] leading-snug font-medium">{o.label}</span>
            {o.when ? (
              <span className={cx('shrink-0 text-[12px]', selected === o.id ? 'text-on-clay/80' : 'text-ink-faint')}>
                {WHEN_LABEL[o.when]}
              </span>
            ) : null}
          </button>
          {/* Neden? — seçilen hissin hemen altında açılır. */}
          {selected === o.id ? (
            <div className="animate-rise space-y-2 rounded-2xl border border-clay/30 bg-clay-soft/40 p-3">
              <p className="px-1 text-[15px] font-medium text-ink">Neden bu his? (isteğe bağlı)</p>
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
          ) : null}
        </div>
      ))}
    </div>
  )
}

/** İkinci anlatan: ilk anlatımı aynen onayla ya da kendi eklemeni yaz. */
function EventAfterPartner({
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
  const ok = agreed(draft)
  return (
    <div className="space-y-3">
      <ChipToggle
        shape="soft"
        label={`Aynen böyle oldu, eklemem yok`}
        selected={ok}
        onToggle={() => {
          setAnswer(EVENT_AGREE, { tags: ok ? [] : [AGREE_TAG] })
          if (!ok) update((d) => ({ ...d, whatHappened: '' }))
        }}
      />
      {ok ? (
        <p className="px-1 text-[13px] text-ink-faint">
          Danışman, {partnerName ? genitive(partnerName) : 'partnerinizin'} anlatımını ikinizin ortak anlatımı olarak
          ele alacak.
        </p>
      ) : (
        <div className="space-y-2">
          <p className="px-1 text-[14px] text-ink-soft">
            Ya da sizin gözünüzden eklemek, düzeltmek istediklerinizi yazın:
          </p>
          <TextArea
            value={draft.whatHappened}
            onChange={(v) => update((d) => ({ ...d, whatHappened: v }))}
            maxLength={LIMITS.text}
            minRows={5}
            placeholder="Ben biraz farklı hatırlıyorum: …"
            aria-label="Eklemek ya da düzeltmek istedikleriniz"
          />
          <MicHint />
        </div>
      )}
    </div>
  )
}

/** Kendi ihtiyacı: ihtiyaç seçimi (en fazla 5), ardından değişen bir takip sorusu. */
function NeedsStep({
  question: q,
  answer,
  partnerName,
  onChange,
}: {
  question: Question
  answer: AnswerDraft
  partnerName: string
  onChange: (patch: Partial<AnswerDraft>) => void
}) {
  const seed = useSeed(q.id)
  const max = q.chipsMax ?? 5
  const full = answer.tags.length >= max
  const [followInstant] = useState(() => answer.text.trim().length > 0)
  const followStage = useReveal(1, { instant: followInstant, ready: answer.tags.length > 0 })
  const toggle = (id: string) => {
    const on = answer.tags.includes(id)
    if (!on && full) return
    onChange({ tags: on ? answer.tags.filter((t) => t !== id) : [...answer.tags, id] })
  }
  return (
    <div className="space-y-4">
      <p className="flex items-center justify-between rounded-2xl bg-sunken px-4 py-2.5 text-[13px] text-ink-soft">
        <span>{full ? `En fazla ${max} ihtiyaç seçebilirsiniz.` : 'Size uyanlara dokunun.'}</span>
        <span className="font-semibold tabular-nums">
          {answer.tags.length} / {max}
        </span>
      </p>
      <div className="flex flex-wrap gap-2" role="group" aria-label={q.title}>
        {q.chips!.map((chip, i) => {
          const selected = answer.tags.includes(chip.id)
          return (
            <span key={chip.id} className="animate-rise" style={{ animationDelay: `${i * 60}ms` }}>
              <ChipToggle
                shape="soft"
                label={chip.label}
                selected={selected}
                disabled={full && !selected}
                onToggle={() => toggle(chip.id)}
              />
            </span>
          )
        })}
      </div>
      {q.followUp && followStage >= 1 ? (
        <div className="animate-rise space-y-3 pt-1">
          <Bubble>
            <span className="font-medium">{q.followUp(partnerName, seed)}</span>
          </Bubble>
          <TextArea
            value={answer.text}
            onChange={(v) => onChange({ text: v })}
            maxLength={LIMITS.text}
            minRows={3}
            placeholder={q.placeholder}
            aria-label={q.followUp(partnerName, seed)}
          />
          <MicHint />
        </div>
      ) : null}
    </div>
  )
}

/** Özet ve tamamlanmış meseledeki "Anlattıklarınız" için tek satırlık gövde. */
export function answerBody(q: Question, draft: Pick<Draft, 'whatHappened' | 'answers'>): string {
  if (q.id === 'olay')
    return agreed(draft) && !draft.whatHappened ? 'Partnerimin anlatımını onayladım.' : draft.whatHappened
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
    const option = optionsFor(draft).find((o) => a.tags.includes(o.id))
    return [option?.label, a.text].filter(Boolean).join(' — ')
  }
  const thoughts = q.thoughts
    ? draft.answers[q.thoughts.answerId].tags.map((t) => chipLabel(q.thoughts!.answerId, t))
    : []
  const chips = a.tags.map((t) => chipLabel(q.id, t))
  return [a.text, thoughts.join(', '), chips.join(', ')].filter(Boolean).join(' — ')
}

function Summary({
  draft,
  partnerName,
  solo,
  order,
}: {
  draft: Draft
  partnerName: string
  solo: boolean
  order: WizardMeta['order']
}) {
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
      <p className="px-1 text-[13px] leading-relaxed text-ink-faint">{privacyNotice(partnerName, solo, order)}</p>
    </section>
  )
}
