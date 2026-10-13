import { Link, type LinkProps } from '@tanstack/react-router'
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react'
import { copyText } from '~/lib/native'
import { VISIBILITY_LABEL, type Visibility } from '~/lib/questions'
import { IconAlert, IconCheck, IconCopy, IconLock, IconUsers } from './icons'

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ')
}

// ---------------------------------------------------------------------------
// Düğmeler
// ---------------------------------------------------------------------------

type Variant = 'primary' | 'secondary' | 'ghost' | 'quiet'

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-clay text-on-clay shadow-soft hover:bg-clay-strong active:translate-y-px disabled:opacity-50 disabled:shadow-none',
  secondary:
    'bg-surface text-ink border border-line-strong hover:border-clay hover:text-clay-strong active:translate-y-px disabled:opacity-50',
  ghost: 'text-clay-strong hover:bg-clay-soft disabled:opacity-50',
  quiet: 'text-ink-soft hover:text-ink underline-offset-4 hover:underline disabled:opacity-50',
}

const SIZES = {
  md: 'h-12 px-5 text-[15px]',
  lg: 'h-14 px-6 text-base',
  sm: 'h-10 px-4 text-sm',
}

export function buttonClass(variant: Variant = 'primary', size: keyof typeof SIZES = 'md', full = false) {
  return cx(
    'inline-flex select-none items-center justify-center gap-2 rounded-full font-semibold transition duration-150',
    'focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed',
    VARIANTS[variant],
    SIZES[size],
    full && 'w-full',
  )
}

export function Button({
  variant = 'primary',
  size = 'md',
  full,
  loading,
  className,
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: keyof typeof SIZES
  full?: boolean
  loading?: boolean
}) {
  return (
    <button
      type="button"
      className={cx(buttonClass(variant, size, full), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Spinner /> : null}
      {children}
    </button>
  )
}

export function LinkButton({
  variant = 'primary',
  size = 'md',
  full,
  className,
  children,
  ...props
}: LinkProps & {
  variant?: Variant
  size?: keyof typeof SIZES
  full?: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <Link className={cx(buttonClass(variant, size, full), className)} {...props}>
      {children}
    </Link>
  )
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cx(
        'inline-block size-4 animate-spin rounded-full border-2 border-current border-r-transparent',
        className,
      )}
      aria-hidden
    />
  )
}

// ---------------------------------------------------------------------------
// Yüzeyler ve metin
// ---------------------------------------------------------------------------

export function Card({
  className,
  children,
  as: As = 'section',
}: {
  className?: string
  children: ReactNode
  as?: 'section' | 'div' | 'article'
}) {
  return <As className={cx('card p-5', className)}>{children}</As>
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cx('text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-faint', className)}>{children}</p>
  )
}

export function Paragraphs({ text, className }: { text: string; className?: string }) {
  const parts = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
  return (
    <div className={cx('prose-warm leading-relaxed', className)}>
      {parts.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
    </div>
  )
}

export function Notice({
  tone = 'info',
  title,
  children,
}: {
  tone?: 'info' | 'warn' | 'error' | 'success'
  title?: string
  children?: ReactNode
}) {
  const tones = {
    info: 'bg-sunken text-ink-soft border-line',
    warn: 'bg-honey-soft text-ink border-honey/40',
    error: 'bg-danger-soft text-ink border-danger/40',
    success: 'bg-sage-soft text-ink border-sage/40',
  }
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cx('rounded-2xl border px-4 py-3 text-sm', tones[tone])}
    >
      <div className="flex gap-2.5">
        {tone === 'error' || tone === 'warn' ? <IconAlert size={18} className="mt-0.5 shrink-0" /> : null}
        <div className="space-y-1">
          {title ? <p className="font-semibold">{title}</p> : null}
          {children ? <div className="leading-relaxed">{children}</div> : null}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Form alanları
// ---------------------------------------------------------------------------

export function TextField({
  label,
  hint,
  value,
  onChange,
  maxLength,
  placeholder,
  autoFocus,
  inputMode,
  autoCapitalize,
  className,
  inputClassName,
  name,
  autoComplete = 'off',
}: {
  label: string
  hint?: string
  value: string
  onChange: (v: string) => void
  maxLength?: number
  placeholder?: string
  autoFocus?: boolean
  inputMode?: 'text' | 'search'
  autoCapitalize?: 'off' | 'characters' | 'words' | 'sentences'
  className?: string
  inputClassName?: string
  name?: string
  autoComplete?: string
}) {
  const id = useId()
  return (
    <div className={cx('space-y-1.5', className)}>
      <label htmlFor={id} className="block text-sm font-semibold text-ink">
        {label}
      </label>
      <input
        id={id}
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={maxLength}
        placeholder={placeholder}
        autoFocus={autoFocus}
        inputMode={inputMode}
        autoCapitalize={autoCapitalize}
        autoComplete={autoComplete}
        autoCorrect="off"
        spellCheck={false}
        className={cx(
          'h-13 w-full rounded-2xl border border-line-strong bg-surface px-4 text-ink placeholder:text-ink-faint',
          'transition focus:border-clay focus:outline-none focus:ring-4 focus:ring-clay-soft',
          inputClassName,
        )}
        aria-describedby={hint ? `${id}-hint` : undefined}
      />
      {hint ? (
        <p id={`${id}-hint`} className="text-[13px] text-ink-faint">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

/** İçeriğe göre büyüyen metin alanı. */
export function TextArea({
  value,
  onChange,
  maxLength,
  minRows = 4,
  className,
  label,
  ...props
}: Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange' | 'value'> & {
  value: string
  onChange: (v: string) => void
  minRows?: number
  label?: string
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const id = useId()
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.max(el.scrollHeight, minRows * 26)}px`
  }, [value, minRows])
  return (
    <div className="space-y-1.5">
      {label ? (
        <label htmlFor={id} className="block text-sm font-semibold text-ink">
          {label}
        </label>
      ) : null}
      <textarea
        ref={ref}
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={maxLength}
        rows={minRows}
        className={cx(
          'w-full resize-none rounded-2xl border border-line-strong bg-surface px-4 py-3.5 leading-relaxed text-ink placeholder:text-ink-faint',
          'transition focus:border-clay focus:outline-none focus:ring-4 focus:ring-clay-soft',
          className,
        )}
        {...props}
      />
      {maxLength && value.length > maxLength * 0.8 ? (
        <p className="text-right text-xs text-ink-faint">
          {value.length} / {maxLength}
        </p>
      ) : null}
    </div>
  )
}

/** Çoklu seçim çipi. */
export function ChipToggle({ label, selected, onToggle }: { label: string; selected: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onToggle}
      className={cx(
        'inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 py-2 text-[15px] font-medium transition',
        'active:scale-[0.98]',
        selected
          ? 'border-clay bg-clay text-on-clay shadow-soft'
          : 'border-line-strong bg-surface text-ink hover:border-clay hover:text-clay-strong',
      )}
    >
      {selected ? <IconCheck size={16} /> : null}
      {label}
    </button>
  )
}

/** Partnerimle paylaş / Yalnızca Danışman AI seçimi. */
export function VisibilityToggle({
  value,
  onChange,
  partnerName,
  compact,
}: {
  value: Visibility
  onChange: (v: Visibility) => void
  partnerName?: string
  compact?: boolean
}) {
  const options: { v: Visibility; icon: ReactNode; label: string }[] = [
    {
      v: 'partner',
      icon: <IconUsers size={16} />,
      label: partnerName ? `${partnerName} görsün` : VISIBILITY_LABEL.partner,
    },
    { v: 'private', icon: <IconLock size={16} />, label: VISIBILITY_LABEL.private },
  ]
  return (
    <div
      role="radiogroup"
      className={cx('inline-flex rounded-full border border-line bg-sunken p-1', compact ? 'text-[13px]' : 'text-sm')}
    >
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          role="radio"
          aria-checked={value === o.v}
          onClick={() => onChange(o.v)}
          className={cx(
            'inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 font-medium transition',
            value === o.v
              ? o.v === 'private'
                ? 'bg-ink text-paper shadow-soft'
                : 'bg-surface text-ink shadow-soft'
              : 'text-ink-faint hover:text-ink',
          )}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function CopyButton({
  text,
  label = 'Kopyala',
  className,
}: {
  text: string
  label?: string
  className?: string
}) {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      variant="ghost"
      size="sm"
      className={className}
      onClick={async () => {
        if (await copyText(text)) {
          setCopied(true)
          setTimeout(() => setCopied(false), 1800)
        }
      }}
    >
      {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
      {copied ? 'Kopyalandı' : label}
    </Button>
  )
}

export function Disclosure({
  summary,
  children,
  defaultOpen,
}: {
  summary: ReactNode
  children: ReactNode
  defaultOpen?: boolean
}) {
  return (
    <details className="group card overflow-hidden" open={defaultOpen}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 font-semibold text-ink [&::-webkit-details-marker]:hidden">
        {summary}
        <span className="text-ink-faint transition group-open:rotate-180">▾</span>
      </summary>
      <div className="border-t border-line px-5 py-4">{children}</div>
    </details>
  )
}
