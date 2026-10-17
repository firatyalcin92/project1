import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { membershipLine } from '~/components/account'
import { QueryError } from '~/components/boundaries'
import { AppShell, PageTitle } from '~/components/layout'
import { PurchasePanel } from '~/components/offer'
import { Button, Card, Disclosure, Notice, TextField } from '~/components/ui'
import { claimTransferFn } from '~/functions/account'
import { getPanelFn } from '~/functions/couple'
import { parseError } from '~/lib/errors'
import { requireMember } from '~/lib/guard'
import type { PanelView } from '~/lib/views'

export const Route = createFileRoute('/uyelik')({
  ssr: false,
  beforeLoad: requireMember,
  head: () => ({ meta: [{ title: 'Üyelik — MESELE' }] }),
  component: Membership,
})

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
  const [started, setStarted] = useState<null | 'trial' | 'paid'>(null)

  return (
    <div className="space-y-5 pb-8">
      <PageTitle
        eyebrow="Üyelik"
        title={m.active ? (m.trial ? 'Ücretsiz denemeniz açık' : 'Üyeliğiniz açık') : 'İlk mesele ücretsiz'}
        lead={membershipLine(m, data.partnerName)}
      />

      {started ? (
        <Notice tone="success" title={started === 'trial' ? 'Ücretsiz denemeniz başladı' : 'Üyeliğiniz başladı'}>
          {solo ? 'Yeni meseleler açabilirsiniz.' : 'Partneriniz de yeni meseleleri hemen kullanabilir.'}
        </Notice>
      ) : null}

      <Card className="space-y-4">
        <PurchasePanel data={data} onPurchased={(next) => setStarted(next.trial ? 'trial' : 'paid')} />
        <ul className="space-y-1.5 border-t border-line pt-3 text-[13px] leading-relaxed text-ink-soft">
          <li>• Üyelik çiftinize aittir; {solo ? 'tek başınıza kullanırsınız' : 'birinizin alması yeterlidir'}.</li>
          <li>• Önceki meseleleriniz ve raporlarınız üyelik bitse bile açık kalır.</li>
          <li>
            • Tüm verilerinizi silmek isterseniz{solo ? '' : ' (partnerinizin onayıyla)'} silinir; üyeliğiniz bununla
            iptal olmaz, kalan süreyi aktarım koduyla yeni bir çifte ya da bireysel kullanıma taşıyabilirsiniz.
          </li>
        </ul>
      </Card>

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
