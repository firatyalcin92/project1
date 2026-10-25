import { useMutation } from '@tanstack/react-query'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { finishPart1Fn, reflectAnswersFn, reflectEventFn, saveAnswersFn } from '~/functions/dispute'
import { parseError } from '~/lib/errors'
import { readMember } from '~/lib/member-token'
import {
  ANSWER_QUESTION_IDS,
  FEELINGS,
  FEELING_GROUPS,
  FEELING_MAX,
  FEELING_MIN,
  LIMITS,
  NEED_CHIPS,
  NEEDS_MAX,
  OTHER_CHIP,
  OTHER_FEELING_LABEL,
  QUESTIONS,
  REACTION_CHIPS,
  STRONGEST_FEELING,
  chipLabel,
  feelingCount,
  privacyNotice,
  seedFor,
  strongestOptions,
  type AnswerQuestionId,
  type FeelingGroup,
} from '~/lib/questions'
import { inviteMessage, shareOrCopy } from '~/lib/share'
import { accusative, alsoAfter, dative, genitive } from '~/lib/turkish'
import type { AnswerDraft, DisputeView } from '~/lib/views'
import { IconArrowRight, IconShare } from '../icons'
import { OfferSheet } from '../offer'
import { TherapistAvatar } from '../therapist-avatar'
import { Button, ChipToggle, Notice, cx } from '../ui'

/**
 * Sohbet biçiminde anlatım. Danışman (yapay zekâ çift terapisti) soruları tek tek sorar,
 * her cevaptan sonra kısa bir yansıtma yapar.
 *
 * 1. bölüm (3 soru): ne oldu → o an ne düşündünüz / ne yaptınız → neler hissettiniz,
 *    ardından ayrıntılı geri bildirim. Çift modunda ilk anlatan burada partnerini bekler.
 * 2. bölüm (4 soru): en çok etkileyen his → ihtiyacınız → onun ihtiyacı → kendinizde
 *    değiştireceğiniz. Son cevapla anlatım gönderilir.
 *
 * Konuşma kaydedilen cevaplardan yeniden kurulur; sayfa yenilense de kaldığı yerden devam eder.
 */

/** "Ayşe’yi de", "Fırat’ı da" */
const also = (w: string) => `${w} ${alsoAfter(w)}`

type Draft = { whatHappened: string; answers: Record<AnswerQuestionId, AnswerDraft> }

type Step =
  | 'olay'
  | 'dusunce'
  | 'davranis'
  | 'hisler'
  | 'bekle'
  | 'en_etkili'
  | 'ihtiyac'
  | 'ihtiyac_takip'
  | 'partner_ihtiyac'
  | 'degisim'
  | 'bitti'

const STEPS: Step[] = [
  'olay',
  'dusunce',
  'davranis',
  'hisler',
  'bekle',
  'en_etkili',
  'ihtiyac',
  'ihtiyac_takip',
  'partner_ihtiyac',
  'degisim',
  'bitti',
]

const q = (id: string) => QUESTIONS.find((x) => x.id === id)!

const words = (t: string) => (t.trim() ? t.trim().split(/\s+/).length : 0)

/** 2. bölümde sorular arasında kısa, sıcak geçişler */
const ACKS = ['Anlıyorum.', 'Teşekkür ederim.', 'Bu çok değerli.', 'Peki.']

/** Kaydedilmiş cevaplara göre konuşmanın nerede kaldığı (sayfa yenilendiğinde). */
function savedCursor(d: Draft, view: DisputeView): number {
  const a = d.answers
  const part1 = view.progress.mePart1
  const done = (s: Step): boolean => {
    switch (s) {
      case 'olay':
        return part1 || (d.whatHappened.trim().length >= 20 && Boolean(view.mine.eventReflection))
      case 'dusunce':
        return part1 || a.dusunce.text.trim().length >= 5
      case 'davranis':
        return part1 || (a.dusunce.tags.length > 0 && Boolean(view.mine.reflection))
      case 'hisler':
        return part1
      case 'bekle':
        return part1 && (view.answerOrder !== 'first' || view.progress.partnerPart1)
      case 'en_etkili':
        return a[STRONGEST_FEELING].tags.length === 1 && a.ihtiyac.tags.length > 0
      case 'ihtiyac':
        return a.ihtiyac.tags.length > 0 && a.ihtiyac.text.trim().length >= 5
      case 'ihtiyac_takip':
        return a.ihtiyac.text.trim().length >= 5 && a.partner_ihtiyac.text.trim().length >= 5
      case 'partner_ihtiyac':
        return a.partner_ihtiyac.text.trim().length >= 5 && a.degisim.text.trim().length >= 5
      default:
        return false
    }
  }
  let i = 0
  while (i < STEPS.length - 1 && done(STEPS[i]!)) i++
  return i
}

function toPayload(disputeId: string, d: Draft, submit: boolean) {
  return {
    disputeId,
    whatHappened: d.whatHappened,
    answers: ANSWER_QUESTION_IDS.map((id) => ({ questionId: id, text: d.answers[id].text, tags: d.answers[id].tags })),
    submit,
  }
}

type Msg = { key: string; from: 'bot' | 'me'; text: ReactNode; typing?: boolean }

export function ChatWizard({ view, onView }: { view: DisputeView; onView: (v: DisputeView) => void }) {
  const P = view.partnerName || 'eşiniz'
  const me = view.me.name
  const solo = view.mode === 'solo'
  const order = view.answerOrder
  const seed = (id: string) => seedFor(view.id, id)

  const [draft, setDraft] = useState<Draft>(() => ({
    whatHappened: view.mine.whatHappened,
    answers: view.mine.answers,
  }))
  const [cursor, setCursor] = useState(() =>
    savedCursor({ whatHappened: view.mine.whatHappened, answers: view.mine.answers }, view),
  )
  const [eventReflection, setEventReflection] = useState(view.mine.eventReflection)
  const [reflection, setReflection] = useState(view.mine.reflection)
  const [suggestions, setSuggestions] = useState(view.mine.suggestions)
  const [feedback, setFeedback] = useState(view.mine.feedback)
  const [nudge, setNudge] = useState<null | 'short' | 'medium'>(null)
  const [nudgeUsed, setNudgeUsed] = useState(false)
  const [text, setText] = useState('')
  const [offerOpen, setOfferOpen] = useState(false)
  const chain = useRef<Promise<unknown>>(Promise.resolve())
  const bottomRef = useRef<HTMLDivElement>(null)

  const step = STEPS[cursor]!
  const at = (s: Step) => cursor > STEPS.indexOf(s)

  const save = useMutation({
    mutationFn: ({ d, submit }: { d: Draft; submit: boolean }) => {
      const run = chain.current.catch(() => {}).then(() => saveAnswersFn({ data: toPayload(view.id, d, submit) }))
      chain.current = run
      return run
    },
    onSuccess: (v, { submit }) => {
      if (submit) onView(v)
    },
    onError: (e, { submit }) => {
      if (parseError(e).code === 'PAYMENT_REQUIRED') setOfferOpen(true)
      // Gönderim olmadıysa son soruya geri dön; cevap kaybolmaz.
      if (submit) setCursor(STEPS.indexOf('degisim'))
    },
  })
  const reflectEvent = useMutation({
    mutationFn: (whatHappened: string) => reflectEventFn({ data: { disputeId: view.id, whatHappened } }),
    onSuccess: (r) => setEventReflection(r.reflection),
  })
  const reflect = useMutation({
    mutationFn: (d: Draft) =>
      reflectAnswersFn({ data: { disputeId: view.id, whatHappened: d.whatHappened, thought: d.answers.dusunce.text } }),
    onSuccess: (r) => {
      setReflection(r.reflection)
      setSuggestions(r.suggestions)
    },
    onError: (e) => {
      if (parseError(e).code === 'PAYMENT_REQUIRED') setOfferOpen(true)
    },
  })
  const part1 = useMutation({
    mutationFn: (d: Draft) => {
      const run = chain.current.catch(() => {}).then(() => finishPart1Fn({ data: toPayload(view.id, d, false) }))
      chain.current = run
      return run
    },
    onSuccess: (v) => {
      setFeedback(v.mine.feedback)
      onView(v)
    },
    onError: (e) => {
      if (parseError(e).code === 'PAYMENT_REQUIRED') setOfferOpen(true)
      setCursor(STEPS.indexOf('hisler'))
    },
  })

  // İlk anlatan partnerini bekliyorsa: partner ilk 3 soruyu bitirdiğinde konuşma kendiliğinden ilerler.
  useEffect(() => {
    if (step === 'bekle' && view.progress.mePart1 && (order !== 'first' || view.progress.partnerPart1)) {
      setCursor((c) => Math.max(c, STEPS.indexOf('en_etkili')))
    }
  }, [step, view.progress.mePart1, view.progress.partnerPart1, order])

  const setAnswer = (id: AnswerQuestionId, patch: Partial<AnswerDraft>) =>
    setDraft((d) => ({ ...d, answers: { ...d.answers, [id]: { ...d.answers[id], ...patch } } }))

  const advance = (d: Draft, to?: Step) => {
    setCursor((c) => (to ? Math.max(c, STEPS.indexOf(to)) : c + 1))
    setText('')
    save.mutate({ d, submit: false })
  }

  /** Kullanıcı bir cevabı gönderdi. */
  const send = (value?: string) => {
    const v = (value ?? text).trim()
    if (step === 'olay') {
      if (nudge) {
        // Ek ayrıntı (ya da "bu kadar"): olay metnine eklenir, sonra yansıtma.
        const d = v ? { ...draft, whatHappened: `${draft.whatHappened.trim()}\n${v}` } : draft
        setDraft(d)
        setNudge(null)
        setNudgeUsed(true)
        reflectEvent.mutate(d.whatHappened)
        advance(d)
        return
      }
      const d = { ...draft, whatHappened: v }
      setDraft(d)
      setText('')
      const n = words(v)
      if (!nudgeUsed && n < 100) {
        setNudge(n < 50 ? 'short' : 'medium')
        save.mutate({ d, submit: false })
        return
      }
      reflectEvent.mutate(v)
      advance(d)
      return
    }
    if (step === 'dusunce' || step === 'ihtiyac_takip' || step === 'partner_ihtiyac' || step === 'degisim') {
      const id: AnswerQuestionId = step === 'ihtiyac_takip' ? 'ihtiyac' : step
      const d = { ...draft, answers: { ...draft.answers, [id]: { ...draft.answers[id], text: v } } }
      setDraft(d)
      if (step === 'degisim') {
        setCursor(STEPS.indexOf('bitti'))
        setText('')
        save.mutate({ d, submit: true })
        return
      }
      advance(d)
      return
    }
    if (step === 'davranis') {
      reflect.mutate(draft)
      advance(draft)
      return
    }
    if (step === 'hisler') {
      part1.mutate(draft)
      setCursor(STEPS.indexOf('bekle'))
      return
    }
    if (step === 'en_etkili' || step === 'ihtiyac') advance(draft)
  }

  // ------------------------------------------------------------------
  // Konuşma metni
  // ------------------------------------------------------------------

  const code = readMember()?.coupleCode ?? ''
  const msgs: Msg[] = []
  const bot = (key: string, t: ReactNode, typing?: boolean) => msgs.push({ key, from: 'bot', text: t, typing })
  const mine = (key: string, t: ReactNode) => msgs.push({ key, from: 'me', text: t })

  if (order === 'second') {
    bot('g1', `Merhaba ${me}. Az önce ${P} ile kısa bir sohbet ettim.`)
    bot(
      'g2',
      'Ben bir çift terapisti tarafından geliştirilmiş yapay zekâ çift terapistinizim. Size de üç sorum olacak.',
    )
    bot(
      'q1',
      'Yaşanan tartışmayı sizden de dinlemek isterim. Bana detaylıca anlatır mısınız? Sesle de yazabilirsiniz, dinliyorum.',
    )
  } else {
    bot('g1', `Merhaba ${me}. Ben bir çift terapisti tarafından geliştirilmiş yapay zekâ çift terapistinizim.`)
    bot('g2', 'Çok uzun sürmeyecek; size şimdilik üç sorum var. Birincisinden başlıyorum.')
    bot(
      'q1',
      'Tam olarak ne oldu? Aranızdaki tartışmayı bana detaylıca anlatır mısınız? Sesle de yazabilirsiniz, dinliyorum.',
    )
  }
  if (draft.whatHappened && (nudge || at('olay'))) mine('a1', draft.whatHappened)
  if (nudge && step === 'olay')
    bot(
      'nudge',
      nudge === 'short'
        ? 'Aranızda yaşananları anlayabilmem, değerlendirebilmem için biraz daha detaylı anlatır mısınız?'
        : 'Biraz daha detaylı anlatmanız meseleyi anlamamda bana yardımcı olacak.',
    )

  if (at('olay')) {
    if (eventReflection) bot('r1', eventReflection)
    else if (reflectEvent.isPending) bot('r1', '', true)
    if (!reflectEvent.isPending) {
      bot(
        'q2',
        `İkinci sorum: ${q('dusunce').prompt(P, seed('dusunce'))} Tam tartışma esnasında iç sesiniz size ne dedi?`,
      )
    }
  }
  if (at('dusunce')) {
    mine('a2', draft.answers.dusunce.text)
    bot('q2b', 'Peki o an ne yaptınız? Birden fazla seçebilirsiniz.')
  }
  if (at('davranis')) {
    mine('a2b', draft.answers.dusunce.tags.map((t) => chipLabel('dusunce', t)).join(' · '))
    if (reflection) bot('r2', reflection)
    else if (reflect.isPending) bot('r2', '', true)
    if (!reflect.isPending)
      bot(
        'q3',
        `Üçüncü ve şimdilik son sorum: ${q(FEELINGS).prompt(P, seed(FEELINGS))} İçinizden geçen duyguları seçin.`,
      )
  }
  if (at('hisler')) {
    const h = draft.answers[FEELINGS]
    const labels = h.tags.filter((t) => t !== OTHER_CHIP).map((t) => chipLabel(FEELINGS, t))
    if (h.tags.includes(OTHER_CHIP) && h.text.trim()) labels.push(h.text.trim())
    mine('a3', labels.join(' · '))
    if (feedback) bot('fb', feedback)
    else if (part1.isPending) bot('fb', '', true)
    else if (view.progress.mePart1) bot('fb', 'Anlattıklarınız için teşekkür ederim; sizi duyuyorum.')
  }
  const part1Ready = at('hisler') && !part1.isPending && view.progress.mePart1
  if (part1Ready) {
    if (order === 'first') {
      if (!view.progress.partnerPart1) {
        bot(
          'share',
          view.partner
            ? `Şimdi ${also(accusative(P))} dinlemem lazım. Bitirdiğinde sizinle kaldığımız yerden devam edeceğiz.`
            : `Şimdi şu linki ${dative(P)} gönderin; onu da bir dinlemem lazım.`,
        )
        bot('wait', `${accusative(P)} dinliyorum; bitince sizinle devam edeceğiz.`)
      } else {
        bot(
          'p2',
          `${also(accusative(P))} dinledim. Şimdi aranızda yaşanan bu olayı daha da net anlamak adına size birkaç sorum daha olacak; ardından son kez dönüş sağlayacağım.`,
        )
      }
    } else {
      bot(
        'p2',
        solo
          ? 'Şimdi aranızda yaşanan bu olayı daha da net anlamak adına size birkaç sorum daha olacak; ardından size son kez dönüş sağlayacağım.'
          : 'Şimdi aranızda yaşanan bu olayı daha da net anlamak adına size birkaç sorum daha olacak; ardından ikinize de son kez dönüş sağlayacağım.',
      )
    }
  }
  if (at('bekle')) bot('q4', q(STRONGEST_FEELING).prompt(P, seed(STRONGEST_FEELING)))
  if (at('en_etkili')) {
    const s = draft.answers[STRONGEST_FEELING]
    const opt = strongestOptions(draft.answers).find((o) => s.tags.includes(o.id))
    mine('a4', [opt?.label, s.text.trim()].filter(Boolean).join(' — '))
    bot('q5', `${ACKS[0]} ${q('ihtiyac').prompt(P, seed('ihtiyac'))} En fazla ${NEEDS_MAX} tane seçebilirsiniz.`)
  }
  if (at('ihtiyac')) {
    mine('a5', draft.answers.ihtiyac.tags.map((t) => chipLabel('ihtiyac', t)).join(' · '))
    bot('q5b', q('ihtiyac').followUp!(P, seed('ihtiyac')))
  }
  if (at('ihtiyac_takip')) {
    mine('a5b', draft.answers.ihtiyac.text)
    bot('q6', `${ACKS[1]} ${q('partner_ihtiyac').prompt(P, seed('partner_ihtiyac'))}`)
  }
  if (at('partner_ihtiyac')) {
    mine('a6', draft.answers.partner_ihtiyac.text)
    bot('q7', `${ACKS[2]} Son sorum: ${q('degisim').prompt(P, seed('degisim'))}`)
  }
  if (at('degisim')) {
    mine('a7', draft.answers.degisim.text)
    bot(
      'end',
      solo
        ? 'Teşekkür ederim, hepsi bu kadar. Şimdi anlattıklarınızı değerlendirip size özel raporunuzu hazırlıyorum.'
        : `Teşekkür ederim, hepsi bu kadar. ${genitive(P)} cevaplarıyla birlikte değerlendirip size son kez dönüş sağlayacağım.`,
    )
  }

  const shown = useStaggered(msgs)
  const allShown = shown >= msgs.length

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [shown, step, nudge])

  // ------------------------------------------------------------------
  // Cevap alanı
  // ------------------------------------------------------------------

  const busy = reflectEvent.isPending || reflect.isPending || part1.isPending
  const ready = allShown && !busy
  const a = draft.answers
  let composer: ReactNode = null

  if (view.paywall && at('olay')) {
    composer = (
      <Button full size="lg" onClick={() => setOfferOpen(true)}>
        Üyelikle devam et <IconArrowRight size={18} />
      </Button>
    )
  } else if (!ready) {
    composer = null
  } else if (
    step === 'olay' ||
    step === 'dusunce' ||
    step === 'ihtiyac_takip' ||
    step === 'partner_ihtiyac' ||
    step === 'degisim'
  ) {
    const min = nudge ? 0 : step === 'olay' ? 20 : 5
    composer = (
      <TextComposer
        value={text}
        onChange={setText}
        min={min}
        placeholder={
          nudge
            ? 'Eklemek istediklerinizi yazın…'
            : step === 'dusunce'
              ? 'İç sesim dedi ki: …'
              : 'Yazın ya da klavyedeki mikrofona dokunup konuşun…'
        }
        onSend={() => send()}
        extra={
          nudge ? (
            <button
              type="button"
              className="text-sm font-medium text-ink-soft underline-offset-4 hover:underline"
              onClick={() => send('')}
            >
              Bu kadar, devam edelim
            </button>
          ) : null
        }
      />
    )
  } else if (step === 'davranis') {
    composer = (
      <ChipPanel
        chips={REACTION_CHIPS}
        selected={a.dusunce.tags}
        onChange={(tags) => setAnswer('dusunce', { tags })}
        onSend={() => send()}
        canSend={a.dusunce.tags.length > 0}
        hint="O an yaptıklarınızı seçin."
      />
    )
  } else if (step === 'hisler') {
    composer = (
      <FeelingsPanel
        answer={a[FEELINGS]}
        suggested={suggestions.feelings}
        onChange={(patch) => setAnswer(FEELINGS, patch)}
        onSend={() => send()}
      />
    )
  } else if (step === 'en_etkili') {
    composer = (
      <StrongestPanel draft={draft} onChange={(patch) => setAnswer(STRONGEST_FEELING, patch)} onSend={() => send()} />
    )
  } else if (step === 'ihtiyac') {
    const top = NEED_CHIPS.filter((c) => suggestions.needs.includes(c.id))
    composer = (
      <ChipPanel
        chips={[...top, ...NEED_CHIPS.filter((c) => !suggestions.needs.includes(c.id))]}
        suggestedCount={top.length}
        max={NEEDS_MAX}
        selected={a.ihtiyac.tags}
        onChange={(tags) => setAnswer('ihtiyac', { tags })}
        onSend={() => send()}
        canSend={a.ihtiyac.tags.length > 0}
        hint={`Size uyanlara dokunun (en fazla ${NEEDS_MAX}).`}
      />
    )
  }

  const error = save.error ?? reflectEvent.error ?? reflect.error ?? part1.error

  return (
    <div className="pb-4">
      <div className="space-y-3" aria-live="polite">
        {msgs
          .slice(0, shown)
          .map((m) =>
            m.from === 'bot' ? (
              <BotBubble key={m.key} text={m.text} typing={m.typing} />
            ) : (
              <MyBubble key={m.key} text={m.text} />
            ),
          )}
        {!allShown || busy ? <BotBubble key="typing" typing text="" /> : null}
        {cursor === 0 && !nudge && allShown ? (
          <p className="pl-12 text-[12px] text-ink-faint">{privacyNotice(P, solo, order)}</p>
        ) : null}
        {part1Ready && order === 'first' && !view.progress.partnerPart1 && allShown ? (
          <ShareCard view={view} code={code} name={P} />
        ) : null}
      </div>
      {error && parseError(error).code !== 'PAYMENT_REQUIRED' ? (
        <div className="mt-4">
          <Notice tone="error">{parseError(error).message}</Notice>
        </div>
      ) : null}
      <div ref={bottomRef} />
      {composer ? (
        <div className="sticky bottom-0 z-20 -mx-4 mt-6 border-t border-line/70 bg-paper/95 px-4 pt-3 pb-[max(env(safe-area-inset-bottom),0.9rem)] backdrop-blur-md">
          {composer}
        </div>
      ) : null}
      {offerOpen ? (
        <OfferSheet variant="continue" onClose={() => setOfferOpen(false)} onPurchased={() => setOfferOpen(false)} />
      ) : null}
    </div>
  )
}

/** Yeni danışman mesajları "yazıyor…" ile birer birer gelir; açılışta var olanlar hemen görünür. */
function useStaggered(msgs: Msg[]) {
  const [shown, setShown] = useState(() => {
    // İlk açılışta: kaydedilmiş konuşma hemen görünür (yalnızca karşılama ağır ağır gelir).
    const greeting = msgs.filter((m) => m.key.startsWith('g') || m.key === 'q1').length
    return msgs.length > greeting + 1 ? msgs.length : 0
  })
  const total = msgs.length
  // Bekleyen (typing) bir mesajın ötesine geçme.
  const typingAt = msgs.findIndex((m) => m.typing)
  const readyCount = typingAt === -1 ? total : typingAt
  const nextFrom = msgs[shown]?.from

  useEffect(() => {
    if (shown >= readyCount) return
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const delay = nextFrom === 'me' ? 0 : reduce ? 250 : 900
    const t = window.setTimeout(() => setShown((s) => s + 1), delay)
    return () => clearTimeout(t)
  }, [shown, readyCount, nextFrom])

  // Mesajlar azalırsa (ör. ek ayrıntı istendikten sonra) sayacı sınırla.
  return Math.min(shown, readyCount)
}

function BotBubble({ text, typing }: { text: ReactNode; typing?: boolean }) {
  return (
    <div className="flex animate-rise items-end gap-2.5">
      <TherapistAvatar size={38} className="shrink-0" />
      <div className="max-w-[85%] rounded-3xl rounded-bl-md bg-surface px-4 py-3 text-[16px] leading-relaxed whitespace-pre-line text-ink shadow-soft">
        {typing ? (
          <span className="inline-flex gap-1 py-1" aria-label="Terapist yazıyor">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="inline-block size-2 animate-breathe rounded-full bg-ink-faint"
                style={{ animationDelay: `${i * 0.2}s` }}
              />
            ))}
          </span>
        ) : (
          text
        )}
      </div>
    </div>
  )
}

function MyBubble({ text }: { text: ReactNode }) {
  return (
    <div className="flex animate-rise justify-end">
      <div className="max-w-[85%] rounded-3xl rounded-br-md bg-clay px-4 py-3 text-[15px] leading-relaxed whitespace-pre-line text-on-clay shadow-soft">
        {text}
      </div>
    </div>
  )
}

/** ChatGPT benzeri yazma kutusu: büyüyen metin alanı ve gönder düğmesi. */
function TextComposer({
  value,
  onChange,
  onSend,
  min,
  placeholder,
  extra,
}: {
  value: string
  onChange: (v: string) => void
  onSend: () => void
  min: number
  placeholder: string
  extra?: ReactNode
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 52), 220)}px`
  }, [value])
  useEffect(() => {
    ref.current?.focus({ preventScroll: true })
  }, [])
  const canSend = value.trim().length >= Math.max(min, 1)
  return (
    <div className="space-y-2">
      <div className="flex items-end gap-2 rounded-3xl border border-line-strong bg-surface p-1.5 pl-4 shadow-soft focus-within:border-clay">
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && canSend && window.matchMedia('(pointer: fine)').matches) {
              e.preventDefault()
              onSend()
            }
          }}
          rows={1}
          maxLength={LIMITS.text}
          placeholder={placeholder}
          aria-label="Cevabınız"
          className="max-h-56 min-h-[52px] flex-1 resize-none bg-transparent py-3 text-[16px] leading-relaxed text-ink placeholder:text-ink-faint focus:outline-none"
        />
        <button
          type="button"
          onClick={onSend}
          disabled={!canSend}
          aria-label="Gönder"
          className="mb-0.5 inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-clay text-on-clay transition disabled:opacity-35"
        >
          <IconArrowRight size={20} className="-rotate-90" />
        </button>
      </div>
      <div className="flex items-center justify-between gap-3 px-2 text-[12px] text-ink-faint">
        <span>
          {value.trim() && !canSend ? 'Biraz daha açar mısınız?' : '🎙 Klavyedeki mikrofonla sesli de yazabilirsiniz.'}
        </span>
        {extra}
      </div>
    </div>
  )
}

function ChipPanel({
  chips,
  selected,
  onChange,
  onSend,
  canSend,
  hint,
  max,
  suggestedCount = 0,
}: {
  chips: readonly { id: string; label: string }[]
  selected: string[]
  onChange: (tags: string[]) => void
  onSend: () => void
  canSend: boolean
  hint: string
  max?: number
  suggestedCount?: number
}) {
  const full = max !== undefined && selected.length >= max
  const toggle = (id: string) => {
    const on = selected.includes(id)
    if (!on && full) return
    onChange(on ? selected.filter((t) => t !== id) : [...selected, id])
  }
  const chip = (c: { id: string; label: string }) => (
    <ChipToggle
      key={c.id}
      shape="soft"
      label={c.label}
      selected={selected.includes(c.id)}
      disabled={full && !selected.includes(c.id)}
      onToggle={() => toggle(c.id)}
    />
  )
  return (
    <div className="space-y-3">
      <div className="max-h-[46dvh] space-y-3 overflow-y-auto pr-1">
        {suggestedCount ? (
          <>
            <p className="px-1 text-[12px] font-semibold tracking-[0.12em] text-ink-faint uppercase">
              Anlattıklarınıza göre
            </p>
            <div className="flex flex-wrap gap-2">{chips.slice(0, suggestedCount).map(chip)}</div>
            <p className="px-1 text-[12px] font-semibold tracking-[0.12em] text-ink-faint uppercase">Diğerleri</p>
          </>
        ) : null}
        <div className="flex flex-wrap gap-2">{chips.slice(suggestedCount).map(chip)}</div>
      </div>
      <SendRow hint={full ? `En fazla ${max} seçebilirsiniz.` : hint} canSend={canSend} onSend={onSend} />
    </div>
  )
}

function SendRow({ hint, canSend, onSend }: { hint: string; canSend: boolean; onSend: () => void }) {
  return (
    <div className="flex items-center gap-3">
      <p className="flex-1 text-[13px] text-ink-faint">{hint}</p>
      <Button onClick={onSend} disabled={!canSend}>
        Gönder <IconArrowRight size={18} />
      </Button>
    </div>
  )
}

/** Önerilen hisler en üstte; diğer gruplardan çıkarılır. */
function suggestedFirst(groups: readonly FeelingGroup[], suggested: readonly string[]): readonly FeelingGroup[] {
  if (!suggested.length) return groups
  const all = groups.flatMap((g) => g.chips)
  const top = { id: 'oneri', label: 'Anlattıklarınıza göre', chips: all.filter((c) => suggested.includes(c.id)) }
  const rest = groups
    .map((g) => ({ ...g, chips: g.chips.filter((c) => !suggested.includes(c.id)) }))
    .filter((g) => g.chips.length)
  return top.chips.length ? [top, ...rest] : groups
}

function FeelingsPanel({
  answer,
  suggested,
  onChange,
  onSend,
}: {
  answer: AnswerDraft
  suggested: string[]
  onChange: (patch: Partial<AnswerDraft>) => void
  onSend: () => void
}) {
  const otherOn = answer.tags.includes(OTHER_CHIP)
  const used = answer.tags.filter((t) => t !== OTHER_CHIP).length + (otherOn ? 1 : 0)
  const full = used >= FEELING_MAX
  const toggle = (id: string) => {
    const on = answer.tags.includes(id)
    if (!on && full) return
    onChange({
      tags: on ? answer.tags.filter((t) => t !== id) : [...answer.tags, id],
      ...(id === OTHER_CHIP && on ? { text: '' } : {}),
    })
  }
  const groups = suggestedFirst(FEELING_GROUPS, suggested)
  return (
    <div className="space-y-3">
      <div className="max-h-[46dvh] space-y-3 overflow-y-auto pr-1">
        {groups.map((g) => (
          <div key={g.id} className="space-y-1.5">
            <p className="px-1 text-[12px] font-semibold tracking-[0.12em] text-ink-faint uppercase">{g.label}</p>
            <div className="flex flex-wrap gap-2">
              {g.chips.map((c) => (
                <ChipToggle
                  key={c.id}
                  shape="soft"
                  label={c.label}
                  selected={answer.tags.includes(c.id)}
                  disabled={full && !answer.tags.includes(c.id)}
                  onToggle={() => toggle(c.id)}
                />
              ))}
            </div>
          </div>
        ))}
        <div className="space-y-2">
          <ChipToggle
            shape="soft"
            label={OTHER_FEELING_LABEL}
            selected={otherOn}
            disabled={full && !otherOn}
            onToggle={() => toggle(OTHER_CHIP)}
          />
          {otherOn ? (
            <input
              value={answer.text}
              onChange={(e) => onChange({ text: e.target.value })}
              maxLength={LIMITS.other}
              placeholder="Kendi kelimelerinizle…"
              aria-label="Başka bir his"
              className="h-11 w-full rounded-2xl border border-line-strong bg-surface px-4 text-ink focus:border-clay focus:outline-none"
            />
          ) : null}
        </div>
      </div>
      <SendRow
        hint={full ? `En fazla ${FEELING_MAX} his seçebilirsiniz.` : `${used} / ${FEELING_MAX} seçildi`}
        canSend={feelingCount(answer) >= FEELING_MIN}
        onSend={onSend}
      />
    </div>
  )
}

function StrongestPanel({
  draft,
  onChange,
  onSend,
}: {
  draft: Draft
  onChange: (patch: Partial<AnswerDraft>) => void
  onSend: () => void
}) {
  const a = draft.answers[STRONGEST_FEELING]
  const options = strongestOptions(draft.answers)
  const picked = options.find((o) => a.tags.includes(o.id))
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="En çok etkileyen his">
        {options.map((o) => (
          <ChipToggle
            key={o.id}
            role="radio"
            shape="soft"
            label={o.label}
            selected={a.tags.includes(o.id)}
            onToggle={() => onChange({ tags: [o.id] })}
          />
        ))}
      </div>
      {picked ? (
        <input
          value={a.text}
          onChange={(e) => onChange({ text: e.target.value })}
          maxLength={LIMITS.text}
          placeholder="Neden bu his? (isteğe bağlı)"
          aria-label="Neden bu his?"
          className="h-12 w-full rounded-2xl border border-line-strong bg-surface px-4 text-ink focus:border-clay focus:outline-none"
        />
      ) : null}
      <SendRow hint="Birine dokunun." canSend={Boolean(picked)} onSend={onSend} />
    </div>
  )
}

/** İlk anlatan 3 soruyu bitirdi: partnerine davet linki ya da hatırlatma. */
function ShareCard({ view, code, name }: { view: DisputeView; code: string; name: string }) {
  const [note, setNote] = useState<string | null>(null)
  const joined = Boolean(view.partner)
  return (
    <div className="ml-12 animate-rise space-y-3 rounded-3xl border border-clay/30 bg-clay-soft/40 p-4">
      <Button
        full
        size="lg"
        disabled={!joined && !code}
        onClick={async () => {
          const r = joined
            ? await shareOrCopy({
                title: 'MESELE',
                text: `MESELE’de seni bekleyen bir mesele var. Hazır olduğunda kendi tarafını anlatır mısın?`,
                url: `${window.location.origin}/mesele/${view.id}`,
              })
            : await shareOrCopy(inviteMessage(code, window.location.origin, view.me.name))
          setNote(r === 'copied' ? 'Link panoya kopyalandı.' : r === 'shared' ? 'Gönderildi.' : null)
        }}
      >
        <IconShare size={18} /> {joined ? `${dative(name)} hatırlat` : `Linki ${dative(name)} gönder`}
      </Button>
      <p className={cx('text-center text-[13px]', note ? 'text-sage' : 'text-ink-faint')}>
        {note ?? (joined ? 'Hazır olduğunda size burada haber vereceğim.' : `Linkteki davet kodu: ${code}`)}
      </p>
    </div>
  )
}
