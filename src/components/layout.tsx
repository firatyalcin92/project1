import { Link, useRouter } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { Wordmark } from './brand'
import { IconArrowLeft } from './icons'
import { cx } from './ui'

export function AppShell({
  children,
  back,
  title,
  right,
  className,
}: {
  children: ReactNode
  /** Geri bağlantısı: rota yolu ya da tarayıcı geçmişi ('history') */
  back?: string | 'history'
  title?: string
  right?: ReactNode
  className?: string
}) {
  const router = useRouter()
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="safe-top sticky top-0 z-30 border-b border-line/70 bg-paper/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-xl items-center gap-2 px-4">
          {back ? (
            back === 'history' ? (
              <button
                type="button"
                onClick={() => router.history.back()}
                className="-ml-2 inline-flex size-10 items-center justify-center rounded-full text-ink-soft hover:bg-sunken"
                aria-label="Geri"
              >
                <IconArrowLeft />
              </button>
            ) : (
              <Link
                to={back}
                className="-ml-2 inline-flex size-10 items-center justify-center rounded-full text-ink-soft hover:bg-sunken"
                aria-label="Geri"
              >
                <IconArrowLeft />
              </Link>
            )
          ) : null}
          {title ? (
            <p className="min-w-0 flex-1 truncate font-display text-[17px] font-semibold text-ink">{title}</p>
          ) : (
            <Link to="/" className="flex-1" aria-label="MESELE ana sayfa">
              <Wordmark />
            </Link>
          )}
          {right}
        </div>
      </header>
      <main className={cx('safe-bottom mx-auto w-full max-w-xl flex-1 px-4 pt-5', className)}>{children}</main>
    </div>
  )
}

export function PageTitle({ eyebrow, title, lead }: { eyebrow?: string; title: ReactNode; lead?: ReactNode }) {
  return (
    <div className="mb-6 animate-rise space-y-2">
      {eyebrow ? (
        <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-clay-strong">{eyebrow}</p>
      ) : null}
      <h1 className="text-[28px] leading-tight font-semibold text-ink">{title}</h1>
      {lead ? <p className="text-[16px] leading-relaxed text-ink-soft">{lead}</p> : null}
    </div>
  )
}

/** Mobilde başparmak hizasında, sayfanın altında yapışkan eylem çubuğu. */
export function BottomBar({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-0 z-20 -mx-4 mt-8 border-t border-line/70 bg-paper/90 px-4 pt-3 pb-[max(env(safe-area-inset-bottom),0.9rem)] backdrop-blur-md">
      {children}
    </div>
  )
}
