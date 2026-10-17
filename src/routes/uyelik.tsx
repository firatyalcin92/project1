import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { membershipLine } from '~/components/account'
import { QueryError } from '~/components/boundaries'
import { IconCheck, IconSparkle } from '~/components/icons'
import { KeyBackup } from '~/components/key-backup'
import { AppShell, PageTitle } from '~/components/layout'
import { Button, Card, CopyButton, Disclosure, Notice, TextField, cx } from '~/components/ui'
import { claimTransferFn, purchaseFn } from '~/functions/account'
import { getPanelFn } from '~/functions/couple'
import { useBackedUp } from '~/lib/backup'
import { parseError } from '~/lib/errors'
import { requireMember } from '~/lib/guard'
import { PLAN_LABEL, PLAN_PERIODS, type SalePeriod } from '~/lib/plans'
import type { PanelView } from '~/lib/views'

export const Route = createFileRoute('/uyelik')({
  ssr: false,
  beforeLoad: requireMember,
  head: () => ({ meta: [{ title: 'Üyelik — MESELE' }] }),
  component: Membership,
})

const PLAN_NOTE: Record<SalePeriod, string> = {
  monthly: 'Düzenli olarak birlikte bakmak için',
  yearly: 'İlişkinizi uzun soluklu tanımak için',
}

function Membership() {
  const query = useQuery({ queryKey: ['panel'], queryFn: () => getPanelFn() })
  return (
    <AppShell back="/panel" title="Üyelik">
      {query.isPending ? (
        <div className="h-64 animate-pulse rounded-3xl bg-sunken" />
      ) : query.isError ? (
        <QueryError error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <MembershipBody data={query.data} />
      )}
    </AppShell>
  )
}

function MembershipBody({ data }: { data: PanelView }) {
  const m = data.membership
  const solo = data.couple.mode === 'solo'
  const qc = useQueryClient()
  const backedUp = useBackedUp()
  const [period, setPeriod] = useState<SalePeriod>('monthly')
  const [codeSaved, setCodeSaved] = useState(false)
  const [showBackup, setShowBackup] = useState(false)
  const partnerJoined = Boolean(data.partner)
  const codeOk = solo || partnerJoined || codeSaved

  const buy = useMutation({
    mutationFn: () => purchaseFn({ data: { period, keyBackedUp: backedUp, codeSaved: codeOk } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['panel'] }),
  })

  return (
    <div className="space-y-5 pb-8">
      <PageTitle
        eyebrow="Üyelik"
        title={m.active ? 'Üyeliğiniz açık' : 'İlk mesele ücretsiz'}
        lead={membershipLine(m, data.partnerName)}
      />

      {buy.isSuccess ? (
        <Notice tone="success" title="Üyeliğiniz başladı">
          {solo ? 'Yeni meseleler açabilirsiniz.' : 'Partneriniz de yeni meseleleri hemen kullanabilir.'}
        </Notice>
      ) : null}

      <div className="grid gap-3" role="radiogroup" aria-label="Üyelik süresi">
        {PLAN_PERIODS.map((p) => (
          <button
            key={p}
            type="button"
            role="radio"
            aria-checked={period === p}
            onClick={() => setPeriod(p)}
            className={cx(
              'flex items-center justify-between gap-3 rounded-2xl border p-4 text-left transition',
              period === p ? 'border-clay bg-clay-soft/50 shadow-soft' : 'border-line-strong bg-surface',
            )}
          >
            <span>
              <span className="block font-semibold text-ink">{PLAN_LABEL[p]}</span>
              <span className="block text-[13px] text-ink-soft">{PLAN_NOTE[p]}</span>
            </span>
            <span className="shrink-0 text-right font-display text-lg font-semibold text-ink">
              {m.prices[p] ?? <span className="text-[13px] font-normal text-ink-faint">Fiyat yakında</span>}
            </span>
          </button>
        ))}
      </div>

      <Card className="space-y-3">
        <p className="font-semibold">Kayıtlarınızı hiçbir koşulda kaybetmemeniz için</p>
        {solo ? null : partnerJoined ? (
          <p className="flex items-start gap-2 text-[14px] text-ink">
            <IconCheck size={18} className="mt-0.5 shrink-0 text-sage" /> {data.partner!.name} katıldı; çift kodunuz
            eşleşti.
          </p>
        ) : (
          <div className="space-y-2">
            <p className="text-[14px] leading-relaxed text-ink-soft">
              Çift kodunuz: <span className="font-mono font-semibold text-ink">{data.couple.code}</span>{' '}
              <CopyButton text={data.couple.code} label="Kopyala" />
            </p>
            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-line-strong p-3">
              <input
                type="checkbox"
                className="mt-1 size-5 accent-[var(--color-clay)]"
                checked={codeSaved}
                onChange={(e) => setCodeSaved(e.target.checked)}
              />
              <span className="text-[14px] leading-snug text-ink">
                Çift kodumu partnerimle paylaştım ya da güvenli bir yere kaydettim
              </span>
            </label>
          </div>
        )}
        {backedUp ? (
          <p className="flex items-start gap-2 text-[14px] text-ink">
            <IconCheck size={18} className="mt-0.5 shrink-0 text-sage" /> Cihaz anahtarınız yedeklendi.
          </p>
        ) : showBackup ? (
          <KeyBackup solo={solo} />
        ) : (
          <Notice tone="warn" title="Önce cihaz anahtarınızı yedekleyin">
            Telefon değişirse kayıtlarınıza bu anahtarla dönersiniz.{' '}
            <button type="button" className="font-semibold underline" onClick={() => setShowBackup(true)}>
              Şimdi yedekle
            </button>
          </Notice>
        )}
        <ul className="space-y-1.5 border-t border-line pt-3 text-[13px] leading-relaxed text-ink-soft">
          <li>• Üyelik çiftinize aittir; {solo ? 'tek başınıza kullanırsınız' : 'birinizin alması yeterlidir'}.</li>
          <li>• Önceki meseleleriniz ve raporlarınız üyelik bitse bile açık kalır.</li>
          <li>
            • Tüm verilerinizi silmek isterseniz{solo ? '' : ' (partnerinizin onayıyla)'} silinir; üyeliğiniz bununla
            iptal olmaz, kalan süreyi aktarım koduyla yeni bir çifte ya da bireysel kullanıma taşıyabilirsiniz.
          </li>
        </ul>
      </Card>

      {buy.isError ? <Notice tone="error">{parseError(buy.error).message}</Notice> : null}

      {m.payments === 'test' ? (
        <Button full size="lg" disabled={!backedUp || !codeOk} loading={buy.isPending} onClick={() => buy.mutate()}>
          <IconSparkle size={18} /> {m.active ? 'Üyeliği uzat' : 'Üyeliği başlat'} · deneme modu
        </Button>
      ) : (
        <Notice tone="info" title="Ödeme altyapısı çok yakında">
          Üyelik satın alma henüz açılmadı. Açıldığında buradan aylık ya da yıllık üyelik başlatabileceksiniz.
        </Notice>
      )}
      {m.payments === 'test' ? (
        <p className="text-center text-[12px] text-ink-faint">Deneme modunda ödeme alınmaz; yalnızca akış denenir.</p>
      ) : null}

      <TransferCode />
    </div>
  )
}

function TransferCode() {
  const qc = useQueryClient()
  const [code, setCode] = useState('')
  const claim = useMutation({
    mutationFn: () => claimTransferFn({ data: { code } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['panel'] }),
  })
  return (
    <Disclosure summary={<span>Üyelik aktarım kodum var</span>}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          if (code.trim()) claim.mutate()
        }}
      >
        <p className="text-sm leading-relaxed text-ink-soft">
          Verilerinizi sildiğinizde size verilen 12 karakterlik kodla kalan üyelik sürenizi bu hesaba taşıyın.
        </p>
        <TextField
          label="Aktarım kodu"
          value={code}
          onChange={(v) => setCode(v.toUpperCase())}
          maxLength={16}
          placeholder="ABCD-EFGH-JKLM"
          inputClassName="text-center font-mono tracking-[0.15em]"
        />
        {claim.isError ? <Notice tone="error">{parseError(claim.error).message}</Notice> : null}
        {claim.isSuccess ? <Notice tone="success">Üyeliğiniz bu hesaba aktarıldı.</Notice> : null}
        <Button type="submit" variant="secondary" full loading={claim.isPending} disabled={!code.trim()}>
          Kodu kullan
        </Button>
      </form>
    </Disclosure>
  )
}
