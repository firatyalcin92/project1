import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { QueryError } from '~/components/boundaries'
import { ProgressRing } from '~/components/charts'
import { CodeTiles } from '~/components/code-tiles'
import { DeletionDone } from '~/components/account'
import { OfferSheet, markOfferSeen, offerSeen } from '~/components/offer'
import { IconArchive, IconArrowRight, IconKey, IconPlus, IconShare, IconSparkle } from '~/components/icons'
import { ReadinessCard, readinessFromSummary } from '~/components/readiness'
import { AppShell } from '~/components/layout'
import { Disclaimer } from '~/components/safety'
import { StepTrack } from '~/components/steps'
import { Button, Card, Eyebrow, LinkButton, Notice, TextField } from '~/components/ui'
import { approveDeletionFn, cancelRecoveryFn, dismissDeletionFn } from '~/functions/account'
import { getPanelFn } from '~/functions/couple'
import { createDisputeFn } from '~/functions/dispute'
import { parseError } from '~/lib/errors'
import { requireMember } from '~/lib/guard'
import { useBackedUp } from '~/lib/backup'
import { clearMember, updateMemberCache } from '~/lib/member-token'
import { activeLine } from '~/lib/progress-copy'
import { LIMITS } from '~/lib/questions'
import { inviteMessage, shareOrCopy } from '~/lib/share'
import { formatDate, formatDateTime, withName } from '~/lib/turkish'
import type { PanelView } from '~/lib/views'

export const Route = createFileRoute('/panel')({
  ssr: false,
  beforeLoad: requireMember,
  head: () => ({ meta: [{ title: 'Panel — MESELE' }] }),
  component: Panel,
})

function Panel() {
  // Veriler silindiyse: oturum kapandı, sorgu durur; aktarım kodu ekranda kalır.
  const [deleted, setDeleted] = useState<{ transferCode: string | null } | null>(null)
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
    <AppShell>
      {deleted ? (
        <DeletionDone transferCode={deleted.transferCode} />
      ) : query.isPending ? (
        <PanelSkeleton />
      ) : query.isError ? (
        <QueryError error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <PanelBody data={query.data} onDeleted={setDeleted} />
      )}
    </AppShell>
  )
}

function PanelSkeleton() {
  return (
    <div className="space-y-4" aria-busy>
      <div className="h-8 w-2/3 animate-pulse rounded-xl bg-sunken" />
      <div className="h-40 animate-pulse rounded-3xl bg-sunken" />
      <div className="h-24 animate-pulse rounded-3xl bg-sunken" />
    </div>
  )
}

function PanelBody({ data, onDeleted }: { data: PanelView; onDeleted: (v: { transferCode: string | null }) => void }) {
  const partnerName = data.partnerName
  const solo = data.couple.mode === 'solo'
  const backedUp = useBackedUp()
  return (
    <div className="space-y-5 pb-6">
      <div className="animate-rise">
        <Eyebrow>{data.couple.name}</Eyebrow>
        <h1 className="mt-1 text-[28px] leading-tight font-semibold">Merhaba {data.me.name}.</h1>
        <p className="mt-1 text-ink-soft">
          {solo ? (
            <>Bireysel danışma · {partnerName ? withName(partnerName) : 'eşinizle'} yaşadığınız meseleler</>
          ) : partnerName ? (
            <>
              <span className="font-medium text-ink">{withName(partnerName)}</span> eşleştiniz.
            </>
          ) : (
            'Partnerinizin katılmasını bekliyoruz.'
          )}
        </p>
      </div>

      {data.recoveryPending ? <RecoveryWarning data={data} /> : null}

      {data.deletion ? <DeletionBanner data={data} onDeleted={onDeleted} /> : null}

      {backedUp ? null : (
        <Notice tone="warn" title="Cihaz anahtarınızı yedekleyin">
          Telefon değişirse ya da uygulama silinirse kayıtlarınıza yalnızca bu anahtarla dönebilirsiniz.{' '}
          <Link to="/hesap" className="font-semibold underline">
            Şimdi yedekle
          </Link>
        </Notice>
      )}

      {!solo && !data.partner ? <InviteCard code={data.couple.code} myName={data.me.name} /> : null}

      {data.active ? <ActiveCard data={data} /> : <NewDisputeCard data={data} />}

      <ResolvedOffer data={data} />

      {solo ? null : <OverviewCard data={data} />}

      <RecentCard data={data} />

      <Link to="/hesap" className="card flex items-center justify-between gap-3 p-4 transition hover:shadow-lift">
        <span className="flex items-center gap-2 font-semibold">
          <IconKey size={18} className="text-ink-faint" /> Hesap, güvenlik ve üyelik
        </span>
        <IconArrowRight size={18} className="text-ink-faint" />
      </Link>

      <Disclaimer className="pt-2" />
    </div>
  )
}

function InviteCard({ code, myName }: { code: string; myName: string }) {
  const [note, setNote] = useState<string | null>(null)
  return (
    <Card className="animate-rise space-y-4 border-clay/30 bg-clay-soft/40">
      <div>
        <p className="font-semibold">Partnerinizi davet edin</p>
        <p className="mt-1 text-sm text-ink-soft">
          Bu kodu partnerinize gönderin. Kendi telefonundan “Partnerimin koduyla katıl” diyerek size katılacak.
          Dilerseniz önce siz anlatın; bitirdiğinizde paylaşmanızı hatırlatacağız.
        </p>
      </div>
      <CodeTiles code={code} />
      <Button
        full
        onClick={async () => {
          const r = await shareOrCopy(inviteMessage(code, window.location.origin, myName))
          setNote(r === 'copied' ? 'Davet panoya kopyalandı.' : r === 'shared' ? 'Davet gönderildi.' : null)
        }}
      >
        <IconShare size={18} /> Daveti gönder
      </Button>
      {note ? <p className="text-center text-sm text-sage">{note}</p> : null}
    </Card>
  )
}

function ActiveCard({ data }: { data: PanelView }) {
  const a = data.active!
  const solo = data.couple.mode === 'solo'
  const line = activeLine(a, data.partnerName, solo)
  return (
    <Card className="animate-rise space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Eyebrow>Açık mesele</Eyebrow>
          <h2 className="mt-1 truncate text-xl font-semibold">{a.title}</h2>
        </div>
        <span className="shrink-0 text-xs text-ink-faint">{formatDate(a.createdAt)}</span>
      </div>
      <StepTrack step={a.step} partnerName={data.partner?.name} solo={solo} />
      {solo ? (
        <p className="leading-relaxed text-ink-soft">{line.text}</p>
      ) : (
        <ReadinessCard readiness={readinessFromSummary(a, data.partner, data.partnerName)} compact />
      )}
      {line.waiting ? (
        <p className="flex items-center gap-2 text-[13px] text-ink-faint">
          <span className="inline-block size-2 animate-breathe rounded-full bg-sage" aria-hidden /> Hazır olduğunda
          burada göreceksin.
        </p>
      ) : null}
      <LinkButton to="/mesele/$id" params={{ id: a.id }} full variant={line.waiting ? 'secondary' : 'primary'}>
        {line.cta} <IconArrowRight size={18} />
      </LinkButton>
    </Card>
  )
}

/** İlk mesele tamamlandıktan sonra, panele dönünce bir kez: yıllık teklif. */
function ResolvedOffer({ data }: { data: PanelView }) {
  const m = data.membership
  const eligible =
    !data.active && !m.active && m.payments === 'test' && m.disputesUsed === m.freeLimit && data.completedCount >= 1
  const [show, setShow] = useState(false)
  useEffect(() => {
    if (!eligible || offerSeen('cozum', data.me.id)) return
    // Panel önce görünsün, teklif ardından gelsin.
    const t = setTimeout(() => {
      markOfferSeen('cozum', data.me.id)
      setShow(true)
    }, 900)
    return () => clearTimeout(t)
  }, [eligible, data.me.id])
  if (!show) return null
  return <OfferSheet variant="resolved" onClose={() => setShow(false)} onPurchased={() => setShow(false)} />
}

function NewDisputeCard({ data }: { data: PanelView }) {
  const m = data.membership
  const hasPartner = data.couple.mode === 'solo' || Boolean(data.partner)
  const freeNote = !m.active && m.nextDisputeFree
  const paidNext = !m.active && !m.nextDisputeFree
  // İlk meseleye başlamadan önce: yıllık üyelik, 3 gün ücretsiz deneme teklifiyle (bir kez).
  const startOffer = !m.active && m.disputesUsed === 0 && m.trialAvailable && m.payments === 'test'
  const [offer, setOffer] = useState(false)
  const [title, setTitle] = useState('')
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const qc = useQueryClient()
  const mutation = useMutation({
    mutationFn: () => createDisputeFn({ data: { title } }),
    onSuccess: async ({ id }) => {
      await qc.invalidateQueries({ queryKey: ['panel'] })
      void navigate({ to: '/mesele/$id', params: { id } })
    },
  })

  if (!open) {
    return (
      <Card className="animate-rise space-y-3 text-center">
        <p className="font-display text-xl font-semibold">Aranızda bir mesele mi var?</p>
        <p className="text-sm leading-relaxed text-ink-soft">
          Az önceki tartışma, haftalardır dönen bir konu ya da adını koyamadığınız bir kırgınlık. Birlikte bakalım.
        </p>
        <Button
          full
          onClick={() => {
            if (startOffer && !offerSeen('baslangic', data.me.id)) {
              markOfferSeen('baslangic', data.me.id)
              setOffer(true)
            } else setOpen(true)
          }}
        >
          <IconPlus size={18} /> Yeni bir mesele aç
        </Button>
        {offer ? (
          <OfferSheet
            variant="start"
            onClose={() => {
              setOffer(false)
              setOpen(true)
            }}
            onPurchased={() => {
              setOffer(false)
              setOpen(true)
            }}
          />
        ) : null}
        {!hasPartner ? (
          <p className="text-[13px] text-ink-faint">
            Şimdi başlayabilirsiniz; partneriniz katıldığında o da anlatacak.
          </p>
        ) : null}
        {freeNote ? (
          <p className="text-[13px] text-ink-faint">
            İlk meseleniz ücretsiz. Sonrası için aylık ya da yıllık üyelik.
          </p>
        ) : paidNext ? (
          <p className="text-[13px] text-ink-faint">
            Ücretsiz meselenizi kullandınız. İlk soruyu yanıtladıktan sonra aylık ya da yıllık üyelikle devam
            edebilirsiniz.
          </p>
        ) : null}
      </Card>
    )
  }

  return (
    <Card className="animate-rise">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (title.trim().length >= 2) mutation.mutate()
        }}
      >
        <TextField
          label="Bu meseleye bir ad ver"
          hint="Kısa ve suçlamasız olsun. Ör. “Cumartesi akşamı planı”, “Annemlerin ziyareti”."
          value={title}
          onChange={setTitle}
          maxLength={LIMITS.title}
          placeholder="Cumartesi akşamı planı"
          autoFocus
        />
        {mutation.isError ? (
          <Notice tone="error">{parseError(mutation.error).message}</Notice>
        ) : null}
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Vazgeç
          </Button>
          <Button type="submit" full disabled={title.trim().length < 2} loading={mutation.isPending}>
            Başlayalım <IconArrowRight size={18} />
          </Button>
        </div>
      </form>
    </Card>
  )
}

function OverviewCard({ data }: { data: PanelView }) {
  const o = data.overview
  const remaining = Math.max(0, o.threshold - o.completed)
  return (
    <Link to="/genel-gorus" className="card block p-5 transition hover:shadow-lift">
      <div className="flex items-center gap-4">
        <ProgressRing
          value={o.completed}
          max={o.threshold}
          label={`${o.completed} / ${o.threshold} mesele tamamlandı`}
        />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 font-semibold">
            <IconSparkle size={18} className="text-honey" /> Genel Görüş
          </p>
          <p className="mt-1 text-sm leading-relaxed text-ink-soft">
            {o.status === 'locked'
              ? `İlişkinizin bütününe dair derin rapor ${remaining} mesele sonra açılır.`
              : o.status === 'ready'
                ? 'İlişki dinamiği raporunuz hazır.'
                : o.status === 'generating'
                  ? 'Raporunuz hazırlanıyor…'
                  : 'Kilit açıldı! Genel Görüşünüzü hazırlayabilirsiniz.'}
          </p>
        </div>
        <IconArrowRight size={18} className="text-ink-faint" />
      </div>
    </Link>
  )
}

function RecentCard({ data }: { data: PanelView }) {
  if (data.recent.length === 0) return null
  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 font-semibold">
          <IconArchive size={18} className="text-ink-faint" /> Önceki meseleler
        </p>
        <Link to="/meseleler" className="text-sm font-medium text-clay-strong">
          Tümü ({data.completedCount})
        </Link>
      </div>
      <ul className="divide-y divide-line">
        {data.recent.map((d) => (
          <li key={d.id}>
            <Link to="/mesele/$id" params={{ id: d.id }} className="flex items-center justify-between gap-3 py-3">
              <span className="min-w-0 truncate font-medium">{d.title}</span>
              <span className="shrink-0 text-xs text-ink-faint">{formatDate(d.completedAt)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  )
}

function DeletionBanner({
  data,
  onDeleted,
}: {
  data: PanelView
  onDeleted: (v: { transferCode: string | null }) => void
}) {
  const qc = useQueryClient()
  const d = data.deletion!
  const approve = useMutation({
    mutationFn: () => approveDeletionFn(),
    onSuccess: (r) => {
      clearMember()
      onDeleted({ transferCode: r.transferCode })
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
        Onaylarsanız meseleler, cevaplar ve raporlar ikiniz için de kalıcı olarak silinir. Bu işlem geri alınamaz.
        Üyelik bununla iptal olmaz; yeni bir çift oluşturabilir ya da uygulamayı tek başınıza kullanabilirsiniz.
      </p>
      {approve.isError ? <Notice tone="error">{parseError(approve.error).message}</Notice> : null}
      <div className="flex gap-2">
        <Button
          variant="secondary"
          className="shrink-0 whitespace-nowrap"
          loading={dismiss.isPending}
          onClick={() => dismiss.mutate()}
        >
          Hayır, silinmesin
        </Button>
        <Button full loading={approve.isPending} onClick={() => approve.mutate()}>
          Onaylıyorum
        </Button>
      </div>
    </Card>
  )
}

/** Partner bu kişi için kurtarma kodu ürettiyse: kendisi istemediyse iptal edebilir. */
function RecoveryWarning({ data }: { data: PanelView }) {
  const qc = useQueryClient()
  const r = data.recoveryPending!
  const cancel = useMutation({
    mutationFn: () => cancelRecoveryFn(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['panel'] }),
  })
  return (
    <Card className="animate-rise space-y-3 border-honey/50 bg-honey-soft/50">
      <p className="font-semibold">{r.createdByName ?? 'Partneriniz'} sizin için bir yeniden bağlanma kodu üretti</p>
      <p className="text-sm leading-relaxed text-ink-soft">
        Bu kod, cihazını kaybeden birinin hesabına yeniden girmesi içindir ve {formatDateTime(r.usableAfter)} itibarıyla
        çalışır. Kullanılırsa bu cihazdaki giriş kapanır. Siz istemediyseniz iptal edin.
      </p>
      {cancel.isError ? <Notice tone="error">{parseError(cancel.error).message}</Notice> : null}
      <Button variant="secondary" full loading={cancel.isPending} onClick={() => cancel.mutate()}>
        Ben istemedim, kodu iptal et
      </Button>
    </Card>
  )
}
