import { Link } from '@tanstack/react-router'
import { PLAN_LABEL, formatPrice } from '~/lib/plans'
import { formatDate } from '~/lib/turkish'
import type { MembershipView } from '~/lib/views'
import { LinkButton, Notice } from './ui'

/** Üyelik durumu, tek satırlık özet. */
export function membershipLine(m: MembershipView, partnerName: string | null) {
  if (m.active && m.trial) {
    const yearly = m.prices.yearly ? ` Sonrasında yıllık üyelik ${formatPrice(m.prices.yearly)}.` : ''
    return `Ücretsiz denemeniz ${formatDate(m.expiresAt)} tarihine kadar açık.${yearly}`
  }
  if (m.active) {
    const who = m.purchasedByMe ? 'Sizin aldığınız' : `${partnerName ?? 'Partnerinizin'} aldığı`
    return `${PLAN_LABEL[m.period!]} üyelik ${formatDate(m.expiresAt)} tarihine kadar açık. ${who} üyelik ikiniz için de geçerli.`
  }
  const prices = [
    m.prices.monthly ? `aylık ${formatPrice(m.prices.monthly)}` : null,
    m.prices.yearly ? `yıllık ${formatPrice(m.prices.yearly)}` : null,
  ]
    .filter(Boolean)
    .join(' ya da ')
  return m.disputesUsed < m.freeLimit
    ? `İlk meseleniz ücretsiz. Sonrası için ${prices || 'aylık ya da yıllık'} üyelik.`
    : `Ücretsiz meselenizi kullandınız. Yeni meseleler için ${prices || 'aylık ya da yıllık'} üyelik.`
}

/** Silme tamamlandıktan sonra: sonraki adımlar. */
export function DeletionDone({ membershipKept }: { membershipKept: boolean }) {
  return (
    <div className="animate-rise space-y-5">
      <div className="space-y-2">
        <h1 className="text-[28px] leading-tight font-semibold">Verileriniz silindi</h1>
        <p className="leading-relaxed text-ink-soft">
          Meseleler, cevaplar ve raporlar kalıcı olarak silindi. Bu cihazdaki oturum da kapatıldı.
        </p>
      </div>
      {membershipKept ? (
        <Notice tone="success" title="Üyeliğiniz hesabınızda duruyor">
          Aynı hesapla (Google ya da e-posta) yeniden başladığınızda kalan süre kendiliğinden devam eder.
        </Notice>
      ) : null}
      <div className="grid gap-2">
        <LinkButton to="/olustur" full>
          Yeniden başla
        </LinkButton>
        <Link to="/" className="pt-2 text-center text-sm text-ink-faint">
          Ana sayfa
        </Link>
      </div>
    </div>
  )
}
