import { cx } from './ui'

/** 6 haneli çift kodunu okunaklı karolar hâlinde gösterir. */
export function CodeTiles({ code, className }: { code: string; className?: string }) {
  return (
    <div
      className={cx('flex justify-center gap-1.5', className)}
      aria-label={`Çift kodu: ${code.split('').join(' ')}`}
      role="img"
    >
      {code.split('').map((ch, i) => (
        <span
          key={i}
          className="inline-flex h-14 w-11 items-center justify-center rounded-xl border border-line-strong bg-surface font-display text-[28px] font-semibold text-ink shadow-soft"
        >
          {ch}
        </span>
      ))}
    </div>
  )
}
