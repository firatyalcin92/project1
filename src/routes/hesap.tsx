import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useState, type ReactNode } from 'react'
import { DeletionDone, membershipLine } from '~/components/account'
import { QueryError } from '~/components/boundaries'
import { IconArrowRight, IconCheck, IconLogout, IconShare } from '~/components/icons'
import { AppShell } from '~/components/layout'
import { Disclaimer } from '~/components/safety'
import { SignInOptions } from '~/components/sign-in'
import { Button, Card, Notice } from '~/components/ui'
import { dismissDeletionFn, requestDeletionFn } from '~/functions/account'
import { getPanelFn } from '~/functions/couple'
import { parseError } from '~/lib/errors'
import { requireMember } from '~/lib/guard'
import { clearMember } from '~/lib/member-token'
import { inviteMessage, shareOrCopy } from '~/lib/share'
import { dative } from '~/lib/turkish'
import type { PanelView } from '~/lib/views'

export const Route = createFileRoute('/hesap')({
  ssr: false,
  beforeLoad: requireMember,
  head: () => ({ meta: [{ title: 'Ayarlar — MESELE' }] }),
  component: Settings,
})

function Settings() {
  const [deleted, setDeleted] = useState<{ membershipKept: boolean } | null>(null)
  const query = useQuery({ queryKey: ['panel'], queryFn: () => getPanelFn(), enabled: !deleted })

  if (deleted) {
    return (
      <AppShell>
        <DeletionDone membershipKept={deleted.membershipKept} />
      </AppShell>
    )
  }

  return (
    <AppShell back="/panel" title="Ayarlar">
      {query.isPending ? (
        <div className="h-64 animate-pulse rounded-3xl bg-sunken" />
      ) : query.isError ? (
        <QueryError error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <SettingsBody data={query.data} onDeleted={setDeleted} />
      )}
    </AppShell>
  )
}

function Row({ to, children }: { to: '/uyelik' | '/gizlilik' | '/meseleler' | '/genel-gorus'; children: ReactNode }) {
  return (
    <Link to={to} className="flex items-center justify-between gap-3 px-1 py-3.5 font-medium text-ink">
      {children}
      <IconArrowRight size={18} className="text-ink-faint" />
    </Link>
  )
}

function SettingsBody({ data, onDeleted }: { data: PanelView; onDeleted: (v: { membershipKept: boolean }) => void }) {
  const solo = data.couple.mode === 'solo'
  return (
    <div className="space-y-6 pb-8">
      <section className="space-y-3">
        <p className="text-sm font-semibold text-ink-soft">Hesap</p>
        {data.account.saved ? (
          <Card className="flex items-start gap-2 text-sm">
            <IconCheck size={18} className="mt-0.5 shrink-0 text-sage" />
            <span>
              Hesabınız kayıtlı{data.account.email ? ` (${data.account.email})` : ''}. Başka bir cihazdan aynı yöntemle
              giriş yapabilirsiniz.
            </span>
          </Card>
        ) : (
          <Card className="space-y-4">
            <p className="text-sm leading-relaxed text-ink-soft">
              Kayıtlarınız şu an yalnızca bu tarayıcıda. Hesabınızı kaydedin; başka bir cihazdan da ulaşabilin.
            </p>
            <SignInOptions />
          </Card>
        )}
      </section>

      {!solo && !data.partner ? <InvitePartner data={data} /> : null}

      <nav className="divide-y divide-line border-y border-line">
        {data.beta.on ? null : (
          <Row to="/uyelik">
            <span>
              Üyelik
              <span className="block text-[13px] font-normal text-ink-faint">
                {membershipLine(data.membership, data.partnerName)}
              </span>
            </span>
          </Row>
        )}
        <Row to="/meseleler">Tüm meseleler</Row>
        {solo ? null : <Row to="/genel-gorus">Genel Görüş</Row>}
        <Row to="/gizlilik">Gizlilik</Row>
      </nav>

      <DeleteAll data={data} onDeleted={onDeleted} />
      <SignOut saved={data.account.saved} />
      <Disclaimer />
    </div>
  )
}

function InvitePartner({ data }: { data: PanelView }) {
  const [note, setNote] = useState<string | null>(null)
  const name = data.partnerName ?? 'Partneriniz'
  return (
    <section className="space-y-3">
      <p className="text-sm font-semibold text-ink-soft">{name} henüz katılmadı</p>
      <Button
        variant="secondary"
        full
        onClick={async () => {
          const r = await shareOrCopy(inviteMessage(data.couple.code, window.location.origin, data.me.name))
          setNote(r === 'copied' ? 'Davet panoya kopyalandı.' : r === 'shared' ? 'Davet gönderildi.' : null)
        }}
      >
        <IconShare size={18} /> {dative(name)} davet gönder
      </Button>
      <p className="text-center text-[13px] text-ink-faint">{note ?? `Davet kodu: ${data.couple.code}`}</p>
    </section>
  )
}

function DeleteAll({ data, onDeleted }: { data: PanelView; onDeleted: (v: { membershipKept: boolean }) => void }) {
  const qc = useQueryClient()
  const solo = data.couple.mode === 'solo'
  const needsApproval = !solo && Boolean(data.partner)
  const [confirm, setConfirm] = useState(false)
  const request = useMutation({
    mutationFn: () => requestDeletionFn(),
    onSuccess: async (r) => {
      if (r.deleted) {
        clearMember()
        onDeleted({ membershipKept: r.membershipKept })
        return
      }
      setConfirm(false)
      await qc.invalidateQueries({ queryKey: ['panel'] })
    },
  })
  const dismiss = useMutation({
    mutationFn: () => dismissDeletionFn(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['panel'] }),
  })
  const pending = data.deletion

  if (pending) {
    return (
      <div className="space-y-3">
        <Notice tone="warn" title={pending.requestedByMe ? 'Silme talebiniz onay bekliyor' : 'Silme talebi var'}>
          {pending.requestedByMe
            ? `${data.partner?.name ?? 'Partneriniz'} onayladığında tüm meseleler ve raporlar kalıcı olarak silinecek.`
            : `${pending.requesterName ?? 'Partneriniz'} tüm verilerin silinmesini istedi. Panelden onaylayabilir ya da reddedebilirsiniz.`}
        </Notice>
        {pending.requestedByMe ? (
          <Button variant="secondary" full loading={dismiss.isPending} onClick={() => dismiss.mutate()}>
            Vazgeçtim, silinmesin
          </Button>
        ) : null}
      </div>
    )
  }

  if (!confirm) {
    return (
      <Button variant="quiet" onClick={() => setConfirm(true)}>
        Tüm verilerimi sil
      </Button>
    )
  }

  return (
    <Card className="space-y-3 border-danger/30">
      <p className="text-sm leading-relaxed text-ink">
        {needsApproval
          ? `Talebiniz ${dative(data.partner!.name)} iletilecek; onayladığında meseleler ve raporlar ikiniz için de kalıcı olarak silinir.`
          : 'Meseleleriniz ve raporlarınız şimdi kalıcı olarak silinecek.'}{' '}
        Bu işlem geri alınamaz. Üyeliğiniz varsa hesabınızda kalır.
      </p>
      {request.isError ? <Notice tone="error">{parseError(request.error).message}</Notice> : null}
      <div className="flex gap-2">
        <Button variant="secondary" onClick={() => setConfirm(false)}>
          Vazgeç
        </Button>
        <Button full loading={request.isPending} onClick={() => request.mutate()}>
          {needsApproval ? 'Silme talebi gönder' : 'Evet, hepsini sil'}
        </Button>
      </div>
    </Card>
  )
}

function SignOut({ saved }: { saved: boolean }) {
  const navigate = useNavigate()
  const [confirm, setConfirm] = useState(false)
  const out = () => {
    clearMember()
    void navigate({ to: '/' })
  }
  if (!confirm) {
    return (
      <Button variant="quiet" size="sm" onClick={() => (saved ? out() : setConfirm(true))}>
        <IconLogout size={16} /> Çıkış yap
      </Button>
    )
  }
  return (
    <div className="space-y-2">
      <p className="text-sm text-ink">
        Hesabınızı kaydetmediniz. Çıkış yaparsanız bu kayıtlara bir daha ulaşamazsınız.
      </p>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" onClick={() => setConfirm(false)}>
          Vazgeç
        </Button>
        <Button size="sm" onClick={out}>
          Yine de çık
        </Button>
      </div>
    </div>
  )
}
