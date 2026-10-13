import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { QueryError } from '~/components/boundaries'
import { IconArrowRight } from '~/components/icons'
import { AppShell, PageTitle } from '~/components/layout'
import { LinkButton, cx } from '~/components/ui'
import { listDisputesFn } from '~/functions/dispute'
import { requireMember } from '~/lib/guard'
import { STATUS_LABEL } from '~/lib/status'
import { formatDate, formatMonth } from '~/lib/turkish'
import type { DisputeSummary } from '~/lib/views'

export const Route = createFileRoute('/meseleler')({
  ssr: false,
  beforeLoad: requireMember,
  head: () => ({ meta: [{ title: 'Meseleler — MESELE' }] }),
  component: Archive,
})

function groupByMonth(items: DisputeSummary[]) {
  const groups = new Map<string, DisputeSummary[]>()
  for (const d of items) {
    const key = formatMonth(d.completedAt ?? d.createdAt)
    groups.set(key, [...(groups.get(key) ?? []), d])
  }
  return [...groups.entries()]
}

function Archive() {
  const query = useQuery({ queryKey: ['disputes'], queryFn: () => listDisputesFn() })

  return (
    <AppShell back="/panel" title="Meseleler">
      <PageTitle
        eyebrow="Arşiv"
        title="Birlikte baktığınız meseleler"
        lead="Tamamlanan meseleler hiçbir zaman otomatik silinmez. Her biri, ilişkinizin öğrendiği bir şeyin kaydı."
      />
      {query.isPending ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-sunken" />
          ))}
        </div>
      ) : query.isError ? (
        <QueryError error={query.error} onRetry={() => query.refetch()} />
      ) : query.data.length === 0 ? (
        <div className="space-y-4 py-8 text-center">
          <p className="text-ink-soft">Henüz bir mesele yok. İlkini açtığınızda burada görünecek.</p>
          <LinkButton to="/panel">Panele dön</LinkButton>
        </div>
      ) : (
        <div className="space-y-6 pb-8">
          {groupByMonth(query.data).map(([month, items]) => (
            <section key={month} className="space-y-2">
              <h2 className="text-sm font-semibold capitalize text-ink-faint">{month}</h2>
              <ul className="card divide-y divide-line overflow-hidden">
                {items.map((d) => (
                  <li key={d.id}>
                    <Link
                      to="/mesele/$id"
                      params={{ id: d.id }}
                      className="flex items-center gap-3 px-4 py-3.5 transition hover:bg-sunken"
                    >
                      <span
                        className={cx(
                          'inline-block size-2.5 shrink-0 rounded-full',
                          d.status === 'completed' ? 'bg-sage' : 'bg-clay',
                        )}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-ink">{d.title}</span>
                        <span className="block text-[13px] text-ink-faint">
                          {STATUS_LABEL[d.status]} · {formatDate(d.completedAt ?? d.createdAt)}
                        </span>
                      </span>
                      <IconArrowRight size={16} className="text-ink-faint" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </AppShell>
  )
}
