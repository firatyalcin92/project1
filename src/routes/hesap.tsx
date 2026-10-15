import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useState, type ReactNode } from 'react'
import { DeletionDone, membershipLine } from '~/components/account'
import { QueryError } from '~/components/boundaries'
import { IconArrowRight, IconKey, IconLogout, IconShare, IconShield, IconSparkle, IconUsers } from '~/components/icons'
import { KeyBackup } from '~/components/key-backup'
import { AppShell, PageTitle } from '~/components/layout'
import { Button, Card, CopyButton, Notice } from '~/components/ui'
import { createRecoveryFn, dismissDeletionFn, requestDeletionFn } from '~/functions/account'
import { getPanelFn } from '~/functions/couple'
import { parseError } from '~/lib/errors'
import { requireMember } from '~/lib/guard'
import { clearMember } from '~/lib/member-token'
import { shareOrCopy } from '~/lib/share'
import { dative, formatDateTime } from '~/lib/turkish'
import type { PanelView } from '~/lib/views'

export const Route = createFileRoute('/hesap')({
  ssr: false,
  beforeLoad: requireMember,
  head: () => ({ meta: [{ title: 'Hesap ve güvenlik — MESELE' }] }),
  component: Account,
})

function Account() {
  const [deleted, setDeleted] = useState<{ transferCode: string | null } | null>(null)
  const query = useQuery({ queryKey: ['panel'], queryFn: () => getPanelFn(), enabled: !deleted })

  if (deleted) {
    return (
      <AppShell>
        <DeletionDone transferCode={deleted.transferCode} />
      </AppShell>
    )
  }

  return (
    <AppShell back="/panel" title="Hesap ve güvenlik">
      {query.isPending ? (
        <div className="h-64 animate-pulse rounded-3xl bg-sunken" />
      ) : query.isError ? (
        <QueryError error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <AccountBody data={query.data} onDeleted={setDeleted} />
      )}
    </AppShell>
  )
}

function Section({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <Card className="space-y-3">
      <p className="flex items-center gap-2 font-semibold">
        <span className="text-ink-faint">{icon}</span>
        {title}
      </p>
      {children}
    </Card>
  )
}

function AccountBody({
  data,
  onDeleted,
}: {
  data: PanelView
  onDeleted: (v: { transferCode: string | null }) => void
}) {
  const solo = data.couple.mode === 'solo'
  return (
    <div className="space-y-4 pb-8">
      <PageTitle
        eyebrow="Hesap"
        title="Hesap ve güvenlik"
        lead="Şifre ya da e-posta yok. Hesabınız bu telefondaki gizli anahtardır; burada onu yedekleyebilir, verilerinizi yönetebilirsiniz."
      />

      <Section icon={<IconKey size={18} />} title="Cihaz anahtarı">
        <KeyBackup solo={solo} />
      </Section>

      {!solo && data.partner ? <PartnerRecovery partnerName={data.partner.name} code={data.couple.code} /> : null}

      <Section icon={<IconSparkle size={18} />} title="Üyelik">
        <p className="text-sm leading-relaxed text-ink-soft">{membershipLine(data.membership, data.partnerName)}</p>
        <Link to="/uyelik" className="inline-flex items-center text-sm font-semibold text-clay-strong">
          Üyelik ayrıntıları <IconArrowRight size={16} className="ml-1" />
        </Link>
      </Section>

      <Section icon={<IconShield size={18} />} title="Gizlilik">
        <p className="text-sm leading-relaxed text-ink-soft">
          Cevaplarınız partnerinize olduğu gibi gösterilmez ve üçüncü kişilerle paylaşılmaz.
        </p>
        <Link to="/gizlilik" className="inline-flex items-center text-sm font-semibold text-clay-strong">
          Gizlilik nasıl korunuyor? <IconArrowRight size={16} className="ml-1" />
        </Link>
      </Section>

      <DeleteAll data={data} onDeleted={onDeleted} />

      <SignOut />
    </div>
  )
}

function PartnerRecovery({ partnerName, code }: { partnerName: string; code: string }) {
  const create = useMutation({ mutationFn: () => createRecoveryFn() })
  const [note, setNote] = useState<string | null>(null)
  const r = create.data
  return (
    <Section icon={<IconUsers size={18} />} title={`${partnerName} cihazını kaybetti mi?`}>
      <p className="text-sm leading-relaxed text-ink-soft">
        {partnerName} telefonunu değiştirdiyse ya da anahtarını kaybettiyse ona tek kullanımlık bir yeniden bağlanma
        kodu üretin. Güvenlik için kod 12 saat sonra çalışmaya başlar; bu sürede {partnerName} eski cihazı hâlâ
        elindeyse uyarı görür ve iptal edebilir. Kullanıldığında eski cihazdaki giriş kapanır.
      </p>
      {r ? (
        <div className="space-y-2 rounded-2xl bg-sunken p-3">
          <code className="block text-center font-mono text-2xl tracking-[0.25em] text-ink">{r.code}</code>
          <p className="text-center text-[12px] text-ink-faint">
            Çift kodu: {code} · {formatDateTime(r.usableAfter)} itibarıyla, 2 gün geçerli
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <CopyButton text={r.code} label="Kodu kopyala" />
            <Button
              variant="secondary"
              size="sm"
              onClick={async () => {
                const res = await shareOrCopy({
                  title: 'MESELE yeniden bağlanma kodu',
                  text: `MESELE'yi aç → "Partnerimin koduyla katıl" → "Kurtarma koduyla dön". Çift kodu: ${code} · Yeniden bağlanma kodu: ${r.code}`,
                  url: `${window.location.origin}/katil?mod=kurtar&kod=${code}`,
                })
                setNote(res === 'copied' ? 'Panoya kopyalandı.' : res === 'shared' ? 'Gönderildi.' : null)
              }}
            >
              <IconShare size={16} /> {dative(partnerName)} gönder
            </Button>
          </div>
          {note ? <p className="text-center text-[13px] text-sage">{note}</p> : null}
        </div>
      ) : (
        <Button variant="secondary" full loading={create.isPending} onClick={() => create.mutate()}>
          Yeniden bağlanma kodu üret
        </Button>
      )}
      {create.isError ? <Notice tone="error">{parseError(create.error).message}</Notice> : null}
    </Section>
  )
}

function DeleteAll({ data, onDeleted }: { data: PanelView; onDeleted: (v: { transferCode: string | null }) => void }) {
  const qc = useQueryClient()
  const solo = data.couple.mode === 'solo'
  const needsApproval = !solo && Boolean(data.partner)
  const [confirm, setConfirm] = useState(false)
  const [pendingCode, setPendingCode] = useState<string | null>(null)
  const request = useMutation({
    mutationFn: () => requestDeletionFn(),
    onSuccess: async (r) => {
      if (r.deleted) {
        clearMember()
        onDeleted({ transferCode: r.transferCode })
        return
      }
      setPendingCode(r.transferCode)
      setConfirm(false)
      await qc.invalidateQueries({ queryKey: ['panel'] })
    },
  })
  const dismiss = useMutation({
    mutationFn: () => dismissDeletionFn(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['panel'] }),
  })
  const pending = data.deletion

  return (
    <Card className="space-y-3 border-danger/30">
      <p className="font-semibold">Tüm verileri sil</p>
      {pending ? (
        <>
          <Notice tone="warn" title={pending.requestedByMe ? 'Talebiniz onay bekliyor' : 'Silme talebi var'}>
            {pending.requestedByMe
              ? `${data.partner?.name ?? 'Partneriniz'} onayladığında tüm meseleler ve raporlar kalıcı olarak silinecek.`
              : `${pending.requesterName ?? 'Partneriniz'} tüm verilerin silinmesini istedi. Panelden onaylayabilir ya da reddedebilirsiniz.`}
          </Notice>
          {pendingCode ? <TransferCodeBox code={pendingCode} /> : null}
          {pending.requestedByMe ? (
            <Button variant="secondary" full loading={dismiss.isPending} onClick={() => dismiss.mutate()}>
              Vazgeçtim, silinmesin
            </Button>
          ) : null}
        </>
      ) : confirm ? (
        <div className="space-y-3">
          <p className="text-sm leading-relaxed text-ink">
            {needsApproval
              ? `Talebiniz ${dative(data.partner!.name)} iletilecek. ${data.partner!.name} onayladığında meseleler, cevaplar ve raporlar ikiniz için de kalıcı olarak silinir.`
              : 'Meseleleriniz, cevaplarınız ve raporlarınız şimdi kalıcı olarak silinecek.'}{' '}
            Bu işlem geri alınamaz. Üyeliğiniz bununla iptal olmaz; yeni bir çift oluşturabilir ya da uygulamayı tek
            başınıza kullanabilirsiniz.
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setConfirm(false)}>
              Vazgeç
            </Button>
            <Button full loading={request.isPending} onClick={() => request.mutate()}>
              {needsApproval ? 'Silme talebi gönder' : 'Evet, hepsini sil'}
            </Button>
          </div>
        </div>
      ) : (
        <>
          <p className="text-sm leading-relaxed text-ink-soft">
            {needsApproval
              ? 'Ortak kayıtlarınız olduğu için silme, partnerinizin de onayıyla yapılır.'
              : 'Tüm meseleler, cevaplar ve raporlar kalıcı olarak silinir.'}
          </p>
          <Button variant="quiet" onClick={() => setConfirm(true)}>
            Tüm verileri silmek istiyorum
          </Button>
        </>
      )}
      {request.isError ? <Notice tone="error">{parseError(request.error).message}</Notice> : null}
    </Card>
  )
}

function TransferCodeBox({ code }: { code: string }) {
  return (
    <div className="space-y-2 rounded-2xl bg-sunken p-3">
      <p className="text-[13px] leading-relaxed text-ink-soft">
        Üyeliğiniz silmeyle iptal olmaz. Kalan süreyi yeni bir çifte ya da tek başınıza kullanmak için bu aktarım kodunu
        saklayın (bir kez gösterilir):
      </p>
      <code className="block text-center font-mono text-xl tracking-[0.2em] text-ink">{code}</code>
      <CopyButton text={code} label="Kodu kopyala" />
    </div>
  )
}

function SignOut() {
  const navigate = useNavigate()
  const [confirm, setConfirm] = useState(false)
  return (
    <div className="px-1 pt-2">
      {confirm ? (
        <div className="space-y-2">
          <p className="text-sm text-ink">
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
  )
}
