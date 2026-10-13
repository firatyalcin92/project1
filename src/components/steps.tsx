import { STEPS, type Step } from '~/lib/status'
import { IconCheck } from './icons'
import { cx } from './ui'

/** 1. Anlat · 2. Partnerinin Gözünden · 3. Yeniden Değerlendir · 4. Çözüm Raporu */
export function StepTrack({
  step,
  done = false,
  partnerName,
}: {
  step: Step
  done?: boolean
  partnerName?: string | null
}) {
  return (
    <ol className="grid grid-cols-4 gap-1.5" aria-label="Mesele adımları">
      {STEPS.map((s) => {
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
              {complete ? <IconCheck size={12} /> : <span className="tabular-nums">{s.step}.</span>}
              {label}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
