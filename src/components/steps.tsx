import { STEPS, type Step } from '~/lib/status'
import { IconCheck } from './icons'
import { cx } from './ui'

/** 1. Anlat · 2. Partnerinin Gözünden · 3. Yeniden Değerlendir · 4. Çözüm Raporu */
const SOLO_STEPS: readonly { step: Step; title: string; short: string }[] = [
  { step: 1, title: 'Anlat', short: 'Anlat' },
  { step: 4, title: 'Danışman Raporu', short: 'Danışman raporu' },
]

export function StepTrack({
  step,
  done = false,
  partnerName,
  solo = false,
}: {
  step: Step
  done?: boolean
  partnerName?: string | null
  solo?: boolean
}) {
  const steps = solo ? SOLO_STEPS : STEPS
  return (
    <ol className={cx('grid gap-1.5', solo ? 'grid-cols-2' : 'grid-cols-4')} aria-label="Mesele adımları">
      {steps.map((s, idx) => {
        const complete = s.step < step || (done && s.step === step)
        const current = s.step === step && !done
        const label = s.step === 2 && partnerName ? 'Gözünden' : s.short
        return (
          <li key={s.step} className="flex flex-col gap-1.5" aria-current={current ? 'step' : undefined}>
            <span
              className={cx(
                'h-1.5 rounded-full transition-colors',
                complete ? 'bg-sage' : current ? 'bg-clay' : 'bg-line',
              )}
            />
            <span
              className={cx(
                'flex items-center gap-1 text-[12px] font-medium',
                current ? 'text-clay-strong' : complete ? 'text-sage' : 'text-ink-faint',
              )}
            >
              {complete ? <IconCheck size={12} /> : <span className="tabular-nums">{solo ? idx + 1 : s.step}.</span>}
              {label}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
