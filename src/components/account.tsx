import { Link } from '@tanstack/react-router'
import { PLAN_LABEL, formatPrice } from '~/lib/plans'
import { formatDate } from '~/lib/turkish'
import type { MembershipView } from '~/lib/views'
import { IconCheck } from './icons'
import { Card, CopyButton, LinkButton, Notice } from './ui'

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

/** Silme tamamlandıktan sonra: aktarım kodu ve sonraki adımlar. */
export function DeletionDone({ transferCode }: { transferCode: string | null }) {
  return (
    <div className="animate-rise space-y-5">
      <div className="space-y-2">
        <p className="text-[12px] font-semibold tracking-[0.14em] text-clay-strong uppercase">Tamamlandı</p>
        <h1 className="text-[28px] leading-tight font-semibold">Verileriniz silindi</h1>
        <p className="leading-relaxed text-ink-soft">
          Meseleler, cevaplar ve raporlar kalıcı olarak silindi. Bu cihazdaki giriş de kapatıldı.
        </p>
      </div>
      {transferCode ? (
        <Card className="space-y-3">
          <p className="flex items-center gap-2 font-semibold">
            <IconCheck size={18} className="text-sage" /> Üyeliğiniz devam ediyor
          </p>
          <p className="text-sm leading-relaxed text-ink-soft">
            Verilerin silinmesi üyeliğinizi iptal etmez. Kalan süreyi yeni bir çiftte ya da tek başınıza kullanmak için
            bu aktarım kodunu saklayın; yeni hesabınızda Üyelik sayfasından girebilirsiniz.
          </p>
          <code className="block rounded-xl bg-sunken px-3 py-3 text-center font-mono text-xl tracking-[0.2em] text-ink">
            {transferCode}
          </code>
          <CopyButton text={transferCode} label="Kodu kopyala" />
          <Notice tone="warn">Bu kod bir kez gösterilir. Kaybederseniz kalan süre aktarılamaz.</Notice>
        </Card>
      ) : null}
      <div className="grid gap-2">
        <LinkButton to="/olustur" full>
          Yeni bir çift oluştur
        </LinkButton>
        <LinkButton to="/olustur" search={{ mod: 'bireysel' }} variant="secondary" full>
          Tek başıma kullanmak istiyorum
        </LinkButton>
        <Link to="/" className="pt-2 text-center text-sm text-ink-faint">
          Ana sayfa
        </Link>
      </div>
    </div>
  )
}
