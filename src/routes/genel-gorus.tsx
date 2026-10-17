import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'
import { QueryError } from '~/components/boundaries'
import { LogoMark } from '~/components/brand'
import { PairedBars, ProgressRing, type PairedRow } from '~/components/charts'
import { IconCheck, IconLock, IconSparkle } from '~/components/icons'
import { AppShell, PageTitle } from '~/components/layout'
import { Disclaimer, SafetyNote } from '~/components/safety'
import { Button, Card, Notice, Paragraphs, cx } from '~/components/ui'
import { generateOverviewFn, getOverviewFn } from '~/functions/overview'
import { parseError } from '~/lib/errors'
import { requireMember } from '~/lib/guard'
import { REACTION_CHIPS, THOUGHT_CHIPS, feelingLabel } from '~/lib/questions'
import { RELATIONSHIP_SECTIONS } from '~/lib/report-meta'
import type { RelationshipReport } from '~/lib/report-schemas'
import { formatDate } from '~/lib/turkish'
import type { OverviewView, Role } from '~/lib/views'

export const Route = createFileRoute('/genel-gorus')({
  ssr: false,
  beforeLoad: requireMember,
  head: () => ({ meta: [{ title: 'Genel Görüş — MESELE' }] }),
  component: Overview,
})

function Overview() {
  const qc = useQueryClient()
  const query = useQuery({
    queryKey: ['overview'],
    queryFn: () => getOverviewFn(),
    refetchInterval: (q) => (q.state.data?.status === 'generating' ? 4000 : false),
  })
  const generate = useMutation({
    mutationFn: () => generateOverviewFn(),
    onSuccess: (v) => {
      qc.setQueryData(['overview'], v)
      void qc.invalidateQueries({ queryKey: ['panel'] })
    },
  })

  // Her 5 yeni meselede Genel Görüş kendiliğinden güncellenir.
  const autoTried = useRef(false)
  useEffect(() => {
    const d = query.data
    if (!d || autoTried.current || generate.isPending) return
    if (d.canRefresh && d.status !== 'generating') {
      autoTried.current = true
      generate.mutate()
    }
  }, [query.data, generate])

  return (
    <AppShell back="/panel" title="Genel Görüş">
      {query.isPending ? (
        <div className="h-64 animate-pulse rounded-3xl bg-sunken" />
      ) : query.isError ? (
        <QueryError error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <OverviewBody
          data={query.data}
          generating={generate.isPending || query.data.status === 'generating'}
          error={generate.isError ? parseError(generate.error).message : null}
          onGenerate={() => generate.mutate()}
        />
      )}
    </AppShell>
  )
}

function OverviewBody({
  data,
  generating,
  error,
  onGenerate,
}: {
  data: OverviewView
  generating: boolean
  error: string | null
  onGenerate: () => void
}) {
  const names = {
    A: data.me.role === 'A' ? data.me.name : (data.partner?.name ?? 'A'),
    B: data.me.role === 'B' ? data.me.name : (data.partner?.name ?? 'B'),
  } as Record<Role, string>

  if (data.status === 'locked') {
    const remaining = data.threshold - data.completed
    return (
      <div className="space-y-5 pb-8">
        <PageTitle
          eyebrow="Genel Görüş"
          title="İlişkinizin bütününe bakan rapor"
          lead={`Tek bir kavga değil, aranızdaki döngünün tamamı. ${data.threshold} meseleyi birlikte tamamladığınızda açılır.`}
        />
        <Card className="flex items-center gap-5">
          <ProgressRing
            value={data.completed}
            max={data.threshold}
            size={92}
            label={`${data.completed} / ${data.threshold}`}
          />
          <div>
            <p className="flex items-center gap-1.5 font-semibold">
              <IconLock size={16} /> {remaining} mesele kaldı
            </p>
            <p className="mt-1 text-sm leading-relaxed text-ink-soft">
              Her tamamlanan mesele, döngünüzün haritasına bir çizgi daha ekler.
            </p>
          </div>
        </Card>
        <Card className="space-y-3">
          <p className="font-semibold">Açıldığında neler göreceksiniz?</p>
          <ol className="grid gap-2 text-[15px] text-ink-soft">
            {RELATIONSHIP_SECTIONS.map((s, i) => (
              <li key={s.key} className="flex gap-3">
                <span className="w-5 text-right font-display text-clay-strong tabular-nums">{i + 1}</span>
                {s.title}
              </li>
            ))}
          </ol>
        </Card>
        {data.completed > 0 ? <Stats data={data} names={names} /> : null}
      </div>
    )
  }

  if (generating && !data.report) {
    return (
      <Card className="space-y-4 py-12 text-center">
        <LogoMark size={64} className="mx-auto animate-breathe" />
        <p className="font-display text-xl font-semibold">Meselelerinizin bütününe bakıyoruz…</p>
        <p className="text-sm text-ink-soft">
          Bu biraz sürebilir. Sayfadan ayrılabilirsiniz; rapor hazır olduğunda burada olacak.
        </p>
      </Card>
    )
  }

  if (!data.report) {
    return (
      <div className="space-y-5 pb-8">
        <PageTitle
          eyebrow="Kilit açıldı"
          title={`${data.completed} meseleyi birlikte tamamladınız.`}
          lead="Bu, ilişkinize verdiğiniz emeğin kendisi. Şimdi aranızdaki döngünün bütününe birlikte bakabilirsiniz."
        />
        {error ? <Notice tone="error">{error}</Notice> : null}
        <Button size="lg" full onClick={onGenerate} loading={generating}>
          <IconSparkle size={18} /> Genel Görüşümüzü hazırla
        </Button>
        <Stats data={data} names={names} />
      </div>
    )
  }

  return (
    <div className="space-y-5 pb-8">
      <PageTitle
        eyebrow={`Genel Görüş · ${data.basedOn ?? data.completed} meseleye dayanarak`}
        title={data.report.headline}
        lead={
          data.generatedAt
            ? `${formatDate(data.generatedAt)} tarihinde ${(data.basedOn ?? 0) > data.threshold ? 'güncellendi' : 'hazırlandı'}. Her 5 yeni mesele sonra kendiliğinden güncellenir.`
            : undefined
        }
      />
      {generating ? (
        <Notice tone="info">Yeni meselelerinizle Genel Görüş güncelleniyor…</Notice>
      ) : (data.basedOn ?? 0) > data.threshold ? (
        <p className="-mt-2 inline-flex w-fit items-center gap-1.5 rounded-full bg-sage-soft px-3 py-1 text-[13px] font-semibold text-ink">
          <IconCheck size={14} className="text-sage" /> Güncellendi · {data.basedOn} mesele
        </p>
      ) : null}
      <SafetyNote safety={data.report.safety} />
      <ReportSections report={data.report} />
      <Stats data={data} names={names} />
      {data.canRefresh ? (
        <Card className="space-y-3">
          <p className="text-sm text-ink-soft">
            Son rapordan bu yana 5 yeni mesele tamamladınız. Genel Görüş güncelleniyor; olmazsa buradan deneyin.
          </p>
          {error ? <Notice tone="error">{error}</Notice> : null}
          <Button variant="secondary" full onClick={onGenerate} loading={generating}>
            Genel Görüşü güncelle
          </Button>
        </Card>
      ) : null}
      <Disclaimer />
    </div>
  )
}

function ReportSections({ report }: { report: RelationshipReport }) {
  return (
    <ol className="space-y-4">
      {RELATIONSHIP_SECTIONS.map((meta, i) => {
        const section = report[meta.key]
        return (
          <li key={meta.key}>
            <Card as="article" className="space-y-3">
              <p className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-clay-strong">
                <span className="font-display text-base tabular-nums">{i + 1}</span> {meta.title}
              </p>
              {'cycleName' in section ? (
                <h2 className="text-[22px] leading-snug font-semibold">{section.cycleName}</h2>
              ) : null}
              <Paragraphs text={section.body} className="text-ink" />
              {section.highlights.length ? (
                <ul className="flex flex-wrap gap-1.5">
                  {section.highlights.map((h) => (
                    <li key={h} className="rounded-full bg-sunken px-3 py-1 text-[13px] text-ink">
                      {h}
                    </li>
                  ))}
                </ul>
              ) : null}
              {'items' in section ? (
                <ul className="grid gap-2">
                  {section.items.map((h) => (
                    <li key={h.name} className="rounded-2xl border border-line p-3.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold">{h.name}</p>
                        <span
                          className={cx(
                            'rounded-full px-2.5 py-0.5 text-[12px] font-medium',
                            h.level === 'sık'
                              ? 'bg-clay-soft text-ink'
                              : h.level === 'zaman zaman'
                                ? 'bg-honey-soft text-ink'
                                : 'bg-sage-soft text-ink',
                          )}
                        >
                          {h.level}
                        </span>
                      </div>
                      <p className="mt-1 text-[14px] leading-relaxed text-ink-soft">{h.note}</p>
                      <p className="mt-1.5 text-[14px] leading-relaxed text-ink">
                        <span className="font-semibold">Panzehir: </span>
                        {h.antidote}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : null}
              {'rituals' in section ? (
                <div className="space-y-3">
                  <ul className="grid gap-2">
                    {section.rituals.map((r) => (
                      <li key={r.title} className="rounded-2xl bg-sage-soft p-3.5">
                        <p className="font-semibold">{r.title}</p>
                        <p className="mt-1 text-[14px] leading-relaxed text-ink">{r.description}</p>
                      </li>
                    ))}
                  </ul>
                  <p className="rounded-2xl bg-sunken p-3.5 text-[14px] leading-relaxed text-ink-soft">
                    {section.professionalNote}
                  </p>
                </div>
              ) : null}
            </Card>
          </li>
        )
      })}
    </ol>
  )
}

function Stats({ data, names }: { data: OverviewView; names: Record<Role, string> }) {
  const rows = (chips: readonly { id: string; label: string }[], src: OverviewView['stats']['emotions']): PairedRow[] =>
    chips.map((c) => ({ id: c.id, label: c.label, A: src.A[c.id] ?? 0, B: src.B[c.id] ?? 0 }))
  // His listesi uzun: yalnızca seçilmiş olanlar, en sık 10 tanesi.
  const feelingRows = (src: OverviewView['stats']['emotions']): PairedRow[] =>
    [...new Set([...Object.keys(src.A), ...Object.keys(src.B)])]
      .map((id) => ({ id, label: feelingLabel(id), A: src.A[id] ?? 0, B: src.B[id] ?? 0 }))
      .sort((x, y) => y.A + y.B - (x.A + x.B))
      .slice(0, 10)
  const thoughtRows = data.stats.thoughts ? rows(THOUGHT_CHIPS, data.stats.thoughts).filter((r) => r.A + r.B > 0) : []
  return (
    <Card className="space-y-6">
      <div>
        <p className="font-semibold">Seçimlerinizin dağılımı</p>
        <p className="mt-1 text-[13px] text-ink-faint">İkinizin seçtiği duygu, düşünce ve davranışlardan sayılır.</p>
      </div>
      <PairedBars title="En sık hissedilenler" rows={feelingRows(data.stats.emotions)} names={names} />
      {thoughtRows.length ? <PairedBars title="Sık düşünceler" rows={thoughtRows} names={names} /> : null}
      <PairedBars title="Davranışlar (o an yapılan)" rows={rows(REACTION_CHIPS, data.stats.reactions)} names={names} />
    </Card>
  )
}
