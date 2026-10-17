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
      {/* Okumaya başlamadan önce */}
      <p className="rounded-2xl border-l-4 border-clay bg-clay-soft/50 py-2.5 pr-3 pl-3.5 text-[14px] leading-relaxed text-ink">
        Bu metni özenle hazırladık. Lütfen merakla okuyun; yüz yüze konuşmanız için aklınıza gelenleri not alın.
      </p>
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
    </Card>
  )
}

/** Şeffaflık: senin anlatımın partnerine nasıl yansıtıldı. */
export function MyPerspectiveDisclosure({ view }: { view: DisputeView }) {
  if (!view.myPerspective || !view.partner) return null
  return (
    <Disclosure summary={<span>Anlatımınız {dative(view.partner.name)} böyle yansıtıldı</span>}>
      <div className="space-y-3 text-[15px] leading-relaxed">
        <p className="font-semibold text-ink">{view.myPerspective.headline}</p>
        <Paragraphs text={view.myPerspective.story} className="text-ink-soft" />
      </div>
    </Disclosure>
  )
}
