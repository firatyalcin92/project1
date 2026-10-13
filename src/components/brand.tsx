import { cx } from './ui'

/**
 * MESELE işareti: iki halka ve aralarındaki kesişim.
 * İki ayrı hikâye, tek bir ortak zemin.
 */
export function LogoMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden className={className}>
      <path d="M24 13.2a12.5 12.5 0 010 21.6 12.5 12.5 0 010-21.6z" fill="var(--color-honey)" opacity="0.55" />
      <circle cx="18" cy="24" r="12.5" fill="none" stroke="var(--color-partner-a)" strokeWidth="4" />
      <circle cx="30" cy="24" r="12.5" fill="none" stroke="var(--color-partner-b)" strokeWidth="4" />
    </svg>
  )
}

export function Wordmark({ className, size = 'md' }: { className?: string; size?: 'md' | 'lg' }) {
  return (
    <span className={cx('inline-flex items-center gap-2', className)}>
      <LogoMark size={size === 'lg' ? 40 : 26} />
      <span
        className={cx('font-display font-semibold tracking-[0.18em] text-ink', size === 'lg' ? 'text-3xl' : 'text-lg')}
      >
        MESELE
      </span>
    </span>
  )
}

export const SLOGAN = 'Bir tartışmayı anlamanın daha iyi bir yolu.'
