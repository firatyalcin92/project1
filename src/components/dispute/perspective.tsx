import { QUESTIONS, chipLabel, type AnswerQuestionId } from '~/lib/questions'
import type { Perspective } from '~/lib/report-schemas'
import { dative, genitive } from '~/lib/turkish'
import type { DisputeView } from '~/lib/views'
import { IconEye, IconHeart } from '../icons'
import { Card, Disclosure, Eyebrow, Paragraphs } from '../ui'

/** "[Partner]'ın Gözünden" — partnerin anlatımının şefkatli yeniden anlatımı. */
export function PerspectiveCard({
  perspective,
  name,
  tone = 'b',
}: {
  perspective: Perspective
  name: string
  tone?: 'a' | 'b'
}) {
  return (
    <Card className="animate-rise space-y-5">
      <div className="space-y-2">
        <Eyebrow className="flex items-center gap-1.5">
          <IconEye size={14} /> {genitive(name)} Gözünden
        </Eyebrow>
        <h2 className="text-[24px] leading-snug font-semibold">{perspective.headline}</h2>
      </div>
      <Paragraphs text={perspective.story} className="text-[17px] text-ink" />
      <div className={`rounded-2xl px-4 py-3 ${tone === 'b' ? 'bg-partner-b-soft' : 'bg-partner-a-soft'}`}>
        <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-ink-faint">Altında belki de</p>
        <p className="mt-1 leading-relaxed text-ink">{perspective.beneath}</p>
      </div>
      <div className="flex gap-3">
        <IconHeart size={20} className="mt-0.5 shrink-0 text-clay" />
        <p className="leading-relaxed text-ink">
          <span className="font-semibold">İhtiyacı: </span>
          {perspective.need}
        </p>
      </div>
      <p className="border-l-2 border-line-strong pl-3 font-display text-[15px] italic leading-relaxed text-ink-soft">
        {perspective.readingNote}
      </p>
    </Card>
  )
}

/** Partnerin paylaşmayı seçtiği ham yanıtlar — "kendi sözleriyle". */
export function PartnerWords({ view }: { view: DisputeView }) {
  const pv = view.partnerView
  const name = view.partner?.name ?? 'Partnerin'
  if (!pv) return null
  const items = QUESTIONS.flatMap((q) => {
    if (q.id === 'olay')
      return pv.shared.whatHappened ? [{ title: q.title, text: pv.shared.whatHappened, chips: [] as string[] }] : []
    const a = pv.shared.answers[q.id as AnswerQuestionId]
    if (!a || (!a.text && a.tags.length === 0)) return []
    return [{ title: q.title, text: a.text, chips: a.tags.map((t) => chipLabel(q.id, t)) }]
  })
  if (items.length === 0) return null
  return (
    <Disclosure summary={<span>{genitive(name)} kendi sözleriyle</span>}>
      <dl className="space-y-4">
        {items.map((it) => (
          <div key={it.title}>
            <dt className="text-[12px] font-semibold uppercase tracking-[0.12em] text-ink-faint">{it.title}</dt>
            {it.chips.length ? (
              <dd className="mt-1.5 flex flex-wrap gap-1.5">
                {it.chips.map((c) => (
                  <span key={c} className="rounded-full bg-sunken px-3 py-1 text-[13px] text-ink">
                    {c}
                  </span>
                ))}
              </dd>
            ) : null}
            {it.text ? <dd className="mt-1.5 leading-relaxed whitespace-pre-line text-ink">{it.text}</dd> : null}
          </div>
        ))}
      </dl>
    </Disclosure>
  )
}

/** Şeffaflık: senin anlatımın partnerine nasıl yansıtıldı. */
export function MyPerspectiveDisclosure({ view }: { view: DisputeView }) {
  if (!view.myPerspective || !view.partner) return null
  return (
    <Disclosure summary={<span>Senin anlatımın {dative(view.partner.name)} böyle yansıtıldı</span>}>
      <div className="space-y-3 text-[15px] leading-relaxed">
        <p className="font-semibold text-ink">{view.myPerspective.headline}</p>
        <Paragraphs text={view.myPerspective.story} className="text-ink-soft" />
      </div>
    </Disclosure>
  )
}
