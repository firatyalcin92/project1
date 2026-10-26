import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { DeletionDone } from '~/components/account'
import { QueryError } from '~/components/boundaries'
import { IconArrowRight, IconPlus, IconSettings, IconShare, IconSparkle } from '~/components/icons'
import { AppShell } from '~/components/layout'
import { OfferSheet, markOfferSeen, offerSeen } from '~/components/offer'
import { ReadinessCard, readinessFromSummary } from '~/components/readiness'
import { AccessCodeForm } from '~/components/access-code'
import { SaveAccountCard } from '~/components/save-account'
import { Button, Card, LinkButton, Notice } from '~/components/ui'
import { approveDeletionFn, dismissDeletionFn } from '~/functions/account'
import { getPanelFn } from '~/functions/couple'
import { createDisputeFn } from '~/functions/dispute'
import { parseError } from '~/lib/errors'
import { requireMember } from '~/lib/guard'
import { clearMember, updateMemberCache } from '~/lib/member-token'
import { activeLine } from '~/lib/progress-copy'
import { inviteMessage, shareOrCopy } from '~/lib/share'
import { formatDate } from '~/lib/turkish'
import type { PanelView } from '~/lib/views'

export const Route = createFileRoute('/panel')({
  ssr: false,
  beforeLoad: requireMember,
  head: () => ({ meta: [{ title: 'MESELE' }] }),
  component: Panel,
})

type Deleted = { membershipKept: boolean }

function Panel() {
  // Veriler silindiyse: oturum kapandı, sorgu durur.
  const [deleted, setDeleted] = useState<Deleted | null>(null)
  const query = useQuery({
    queryKey: ['panel'],
    queryFn: () => getPanelFn(),
    enabled: !deleted,
    // Partner katılmamışsa ya da partner bekleniyorsa daha sık bak.
    refetchInterval: (q) => {
      const d = q.state.data
      if (!d) return false
      return !d.partner || d.active?.meDone ? 5000 : 20000
    },
  })

  useEffect(() => {
    if (query.data) {
      updateMemberCache({
        displayName: query.data.me.name,
        coupleName: query.data.couple.name,
        coupleCode: query.data.couple.code,
      })
    }
  }, [query.data])

  return (
    <AppShell
      right={
        deleted ? null : (
          <Link
            to="/hesap"
            aria-label="Ayarlar"
            className="-mr-2 inline-flex size-10 items-center justify-center rounded-full text-ink-soft hover:bg-sunken"
          >
            <IconSettings size={20} />
          </Link>
        )
      }
    >
      {deleted ? (
        <DeletionDone membershipKept={deleted.membershipKept} />
      ) : query.isPending ? (
        <div className="space-y-4" aria-busy>
          <div className="h-8 w-2/3 animate-pulse rounded-xl bg-sunken" />
          <div className="h-40 animate-pulse rounded-3xl bg-sunken" />
        </div>
      ) : query.isError ? (
        <QueryError error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <PanelBody data={query.data} onDeleted={setDeleted} />
      )}
    </AppShell>
  )
}

/** Panel: şu an yapılacak tek şey ve altında sade bir geçmiş listesi. */
function PanelBody({ data, onDeleted }: { data: PanelView; onDeleted: (v: Deleted) => void }) {
  const solo = data.couple.mode === 'solo'
  const overviewOpen = !solo && data.overview.status !== 'locked'
  return (
    <div className="space-y-5 pb-8">
      <h1 className="animate-rise text-[28px] leading-tight font-semibold">Merhaba {data.me.name}.</h1>

      {data.deletion ? <DeletionBanner data={data} onDeleted={onDeleted} /> : null}

      {data.active ? <ActiveCard data={data} /> : <NewDisputeCard data={data} />}

      {!solo && !data.partner ? <InviteLine data={data} /> : null}

      {!data.account.saved && !data.beta.on && data.completedCount >= 1 ? <SaveAccountCard /> : null}

      {overviewOpen ? (
        <Link
          to="/genel-gorus"
          className="card flex items-center justify-between gap-3 p-4 transition hover:shadow-lift"
        >
          <span className="flex items-center gap-2 font-semibold">
            <IconSparkle size={18} className="text-honey" /> Genel Görüş
            {data.overview.status === 'available' ? (
              <span className="rounded-full bg-honey-soft px-2 py-0.5 text-[11px] text-ink">Yeni</span>
            ) : null}
          </span>
          <IconArrowRight size={18} className="text-ink-faint" />
        </Link>
      ) : null}

      <RecentList data={data} />

      <ResolvedOffer data={data} />
    </div>
  )
}

function ActiveCard({ data }: { data: PanelView }) {
  const a = data.active!
  const solo = data.couple.mode === 'solo'
  const line = activeLine(a, data.partnerName, solo)
  return (
    <Card className="animate-rise space-y-4">
      <div>
        <h2 className="text-xl font-semibold">{a.title}</h2>
        <p className="mt-1 leading-relaxed text-ink-soft">{line.text}</p>
      </div>
      {solo || !data.partner ? null : (
        <ReadinessCard readiness={readinessFromSummary(a, data.partner, data.partnerName)} compact />
      )}
      <LinkButton to="/mesele/$id" params={{ id: a.id }} full variant={line.waiting ? 'secondary' : 'primary'}>
        {line.cta} <IconArrowRight size={18} />
      </LinkButton>
    </Card>
  )
}

/** Tek dokunuşla yeni mesele: başlık sorulmaz, doğrudan ilk soru. */
function NewDisputeCard({ data }: { data: PanelView }) {
  const m = data.membership
  const navigate = useNavigate()
  const qc = useQueryClient()
  const mutation = useMutation({
    mutationFn: () => createDisputeFn({ data: {} }),
    onSuccess: async ({ id }) => {
      await qc.invalidateQueries({ queryKey: ['panel'] })
      void navigate({ to: '/mesele/$id', params: { id } })
    },
  })
  if (data.beta.on && !data.beta.canCreate) {
    return (
      <Card className="animate-rise space-y-2 text-center">
        <p className="font-display text-xl font-semibold">Ücretsiz test sürümü</p>
        <p className="text-sm leading-relaxed text-ink-soft">{data.beta.reason}</p>
        <div className="pt-2">
          <AccessCodeForm />
        </div>
      </Card>
    )
  }
  return (
    <Card className="animate-rise space-y-4 text-center">
      <p className="font-display text-xl font-semibold">Aranızda bir mesele mi var?</p>
      <Button full size="lg" loading={mutation.isPending} onClick={() => mutation.mutate()}>
        <IconPlus size={18} /> Yeni mesele
      </Button>
      {!data.beta.on && !m.active && !m.nextDisputeFree ? (
        <p className="text-[13px] text-ink-faint">İlk sorudan sonra üyelikle devam edebilirsiniz.</p>
      ) : null}
      {data.beta.codeUses > 0 ? (
        <p className="text-[13px] text-ink-faint">Erişim kodunuzla {data.beta.codeUses} mesele hakkınız var.</p>
      ) : null}
      {mutation.isError ? <Notice tone="error">{parseError(mutation.error).message}</Notice> : null}
      {mutation.isError && ['BETA_USED', 'QUOTA_FULL', 'CONFLICT'].includes(parseError(mutation.error).code) ? (
        <AccessCodeForm startOpen />
      ) : null}
    </Card>
  )
}

/** Partner henüz katılmadıysa tek satırlık davet. */
function InviteLine({ data }: { data: PanelView }) {
  const [note, setNote] = useState<string | null>(null)
  const name = data.partnerName ?? 'Partneriniz'
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-line px-4 py-3">
      <p className="text-sm text-ink-soft">{note ?? `${name} henüz katılmadı.`}</p>
      <Button
        size="sm"
        variant="secondary"
        className="shrink-0"
        onClick={async () => {
          const r = await shareOrCopy(inviteMessage(data.couple.code, window.location.origin, data.me.name))
          setNote(r === 'copied' ? 'Davet panoya kopyalandı.' : r === 'shared' ? 'Davet gönderildi.' : null)
        }}
      >
        <IconShare size={16} /> Davet gönder
      </Button>
    </div>
  )
}

function RecentList({ data }: { data: PanelView }) {
  if (data.recent.length === 0) return null
  return (
    <section className="space-y-1">
      <div className="flex items-center justify-between px-1">
        <p className="text-sm font-semibold text-ink-soft">Önceki meseleler</p>
        {data.completedCount > data.recent.length ? (
          <Link to="/meseleler" className="text-sm font-medium text-clay-strong">
            Tümü
          </Link>
        ) : null}
      </div>
      <ul className="divide-y divide-line">
        {data.recent.map((d) => (
          <li key={d.id}>
            <Link to="/mesele/$id" params={{ id: d.id }} className="flex items-center justify-between gap-3 px-1 py-3">
              <span className="min-w-0 truncate font-medium">{d.title}</span>
              <span className="shrink-0 text-xs text-ink-faint">{formatDate(d.completedAt)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** İlk mesele tamamlandıktan sonra, panele dönünce bir kez: yıllık teklif. */
function ResolvedOffer({ data }: { data: PanelView }) {
  const m = data.membership
  const eligible =
    !data.beta.on &&
    !data.active &&
    !m.active &&
    m.payments === 'test' &&
    m.disputesUsed === m.freeLimit &&
    data.completedCount >= 1
  const [show, setShow] = useState(false)
  useEffect(() => {
    if (!eligible || offerSeen('cozum', data.me.id)) return
    const t = setTimeout(() => {
      markOfferSeen('cozum', data.me.id)
      setShow(true)
    }, 900)
    return () => clearTimeout(t)
  }, [eligible, data.me.id])
  if (!show) return null
  return <OfferSheet variant="resolved" onClose={() => setShow(false)} onPurchased={() => setShow(false)} />
}

function DeletionBanner({ data, onDeleted }: { data: PanelView; onDeleted: (v: Deleted) => void }) {
  const qc = useQueryClient()
  const d = data.deletion!
  const approve = useMutation({
    mutationFn: () => approveDeletionFn(),
    onSuccess: (r) => {
      clearMember()
      onDeleted({ membershipKept: r.membershipKept })
    },
  })
  const dismiss = useMutation({
    mutationFn: () => dismissDeletionFn(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['panel'] }),
  })
  const partner = data.partner?.name ?? 'Partneriniz'

  if (d.requestedByMe) {
    return (
      <Notice tone="warn" title="Silme talebiniz onay bekliyor">
        {partner} onayladığında tüm meseleler ve raporlar kalıcı olarak silinecek.{' '}
        <button type="button" className="font-semibold underline" onClick={() => dismiss.mutate()}>
          Vazgeç
        </button>
      </Notice>
    )
  }
  return (
    <Card className="animate-rise space-y-3 border-danger/30">
      <p className="font-semibold">{d.requesterName ?? partner} tüm verilerin silinmesini istedi</p>
      <p className="text-sm leading-relaxed text-ink-soft">
        Onaylarsanız meseleler ve raporlar ikiniz için de kalıcı olarak silinir. Bu işlem geri alınamaz.
      </p>
      {approve.isError ? <Notice tone="error">{parseError(approve.error).message}</Notice> : null}
      <div className="flex gap-2">
        <Button
          variant="secondary"
          className="shrink-0 whitespace-nowrap"
          loading={dismiss.isPending}
          onClick={() => dismiss.mutate()}
        >
          Hayır
        </Button>
        <Button full loading={approve.isPending} onClick={() => approve.mutate()}>
          Onaylıyorum
        </Button>
      </div>
    </Card>
  )
}
