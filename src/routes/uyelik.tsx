import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { membershipLine } from '~/components/account'
import { QueryError } from '~/components/boundaries'
import { AppShell, PageTitle } from '~/components/layout'
import { PurchasePanel } from '~/components/offer'
import { Card, Notice } from '~/components/ui'
import { getPanelFn } from '~/functions/couple'
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
          <li>• Üyelik hesabınıza bağlıdır; verilerinizi silseniz de aynı hesapla devam eder.</li>
        </ul>
      </Card>
    </div>
  )
}
