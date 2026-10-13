import type { Safety } from '~/lib/report-schemas'
import { IconShield } from './icons'

/** AI bir güvenlik işareti gördüğünde raporun en üstünde gösterilir. */
export function SafetyNote({ safety }: { safety: Safety | undefined | null }) {
  if (!safety?.concern) return null
  return (
    <div role="alert" className="animate-rise rounded-2xl border border-danger/40 bg-danger-soft p-4">
      <div className="flex gap-3">
        <IconShield className="mt-0.5 shrink-0 text-danger" />
        <div className="space-y-2 text-[15px] leading-relaxed">
          <p className="font-semibold text-ink">Önce güvenliğin</p>
          <p className="text-ink">{safety.message}</p>
          <SafetyLines />
        </div>
      </div>
    </div>
  )
}

export function SafetyLines() {
  return (
    <ul className="space-y-1 text-sm text-ink-soft">
      <li>
        Acil durumda:{' '}
        <a className="font-semibold text-ink underline" href="tel:112">
          112
        </a>
      </li>
      <li>
        Aile ve Sosyal Hizmetler destek hattı:{' '}
        <a className="font-semibold text-ink underline" href="tel:183">
          ALO 183
        </a>
      </li>
      <li>Kadınlar için acil destek: KADES uygulaması</li>
    </ul>
  )
}

export function Disclaimer({ className }: { className?: string }) {
  return (
    <p className={`text-[13px] leading-relaxed text-ink-faint ${className ?? ''}`}>
      MESELE bir terapi, tanı ya da kriz hizmeti değildir; yapay zekâ destekli bir ayna tutma ve arabuluculuk aracıdır.
      İlişkinizde şiddet, tehdit ya da korku varsa lütfen önce güvenliğinizi sağlayın ve{' '}
      <a href="tel:112" className="underline">
        112
      </a>{' '}
      ya da{' '}
      <a href="tel:183" className="underline">
        ALO 183
      </a>{' '}
      ile iletişime geçin.
    </p>
  )
}
