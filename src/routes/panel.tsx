import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { QueryError } from '~/components/boundaries'
import { ProgressRing } from '~/components/charts'
import { CodeTiles } from '~/components/code-tiles'
import { IconArchive, IconArrowRight, IconKey, IconLogout, IconPlus, IconShare, IconSparkle } from '~/components/icons'
import { AppShell } from '~/components/layout'
import { Disclaimer } from '~/components/safety'
import { StepTrack } from '~/components/steps'
import { Button, Card, CopyButton, Disclosure, Eyebrow, LinkButton, Notice, TextField } from '~/components/ui'
import { getPanelFn } from '~/functions/couple'
import { createDisputeFn } from '~/functions/dispute'
import { parseError } from '~/lib/errors'
import { requireMember } from '~/lib/guard'
import { useMember } from '~/lib/hooks'
import { clearMember, readMember, updateMemberCache } from '~/lib/member-token'
import { activeLine } from '~/lib/progress-copy'
import { LIMITS } from '~/lib/questions'
import { inviteMessage, shareOrCopy } from '~/lib/share'
import { formatDate, withName } from '~/lib/turkish'
import type { PanelView } from '~/lib/views'

export const Route = createFileRoute('/panel')({
  ssr: false,
  beforeLoad: requireMember,
  head: () => ({ meta: [{ title: 'Panel — MESELE' }] }),
  component: Panel,
})

function Panel() {
  const query = useQuery({
    queryKey: ['panel'],
    queryFn: () => getPanelFn(),
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
      {query.isPending ? (
        <PanelSkeleton />
      ) : query.isError ? (
        <QueryError error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <PanelBody data={query.data} />
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

function PanelBody({ data }: { data: PanelView }) {
  const partnerName = data.partnerName
  const solo = data.couple.mode === 'solo'
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

      {!solo && !data.partner ? <InviteCard code={data.couple.code} myName={data.me.name} /> : null}

      {data.active ? <ActiveCard data={data} /> : <NewDisputeCard hasPartner={solo || Boolean(data.partner)} />}

      {solo ? null : <OverviewCard data={data} />}

      <RecentCard data={data} />

      <DeviceCard />

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
      <p className="leading-relaxed text-ink-soft">{line.text}</p>
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

function NewDisputeCard({ hasPartner }: { hasPartner: boolean }) {
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
        <Button full onClick={() => setOpen(true)}>
          <IconPlus size={18} /> Yeni bir mesele aç
        </Button>
        {!hasPartner ? (
          <p className="text-[13px] text-ink-faint">
            Şimdi başlayabilirsiniz; partneriniz katıldığında o da anlatacak.
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
        {mutation.isError ? <Notice tone="error">{parseError(mutation.error).message}</Notice> : null}
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

function DeviceCard() {
  const member = useMember()
  const navigate = useNavigate()
  const [reveal, setReveal] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const token = member?.token ?? readMember()?.token ?? ''

  return (
    <Disclosure
      summary={
        <span className="flex items-center gap-2">
          <IconKey size={18} className="text-ink-faint" /> Cihaz anahtarı ve güvenlik
        </span>
      }
    >
      <div className="space-y-4 text-sm leading-relaxed text-ink-soft">
        <p>
          MESELE’de şifre yok: bu telefona özel, gizli bir anahtar kayıtlı. Telefonunuzu değiştirirseniz ya da
          uygulamayı silerseniz geri dönebilmek için anahtarınızı güvenli bir yere (ör. parola yöneticinize) kaydedin.
        </p>
        {reveal ? (
          <div className="space-y-2">
            <code className="block break-all rounded-xl bg-sunken px-3 py-2 font-mono text-[13px] text-ink">
              {token}
            </code>
            <CopyButton text={token} label="Anahtarı kopyala" />
          </div>
        ) : (
          <Button variant="secondary" size="sm" onClick={() => setReveal(true)}>
            Anahtarımı göster
          </Button>
        )}
        <Notice tone="warn">
          Bu anahtarı partneriniz dâhil kimseyle paylaşmayın; sizin yerinize yanıt verebilirler.
        </Notice>
        <div className="border-t border-line pt-4">
          {confirm ? (
            <div className="space-y-2">
              <p className="text-ink">
                Emin misiniz? Anahtarınızı yedeklemediyseniz bu hesaba bu cihazdan bir daha giremezsiniz.
              </p>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => setConfirm(false)}>
                  Vazgeç
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    clearMember()
                    void navigate({ to: '/' })
                  }}
                >
                  Evet, çıkış yap
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="quiet" size="sm" onClick={() => setConfirm(true)}>
              <IconLogout size={16} /> Bu cihazdan çık
            </Button>
          )}
        </div>
      </div>
    </Disclosure>
  )
}
