import { Link } from '@tanstack/react-router'
import { PLAN_LABEL } from '~/lib/plans'
import { formatDate } from '~/lib/turkish'
import type { MembershipView } from '~/lib/views'
import { IconCheck, IconSparkle } from './icons'
import { Card, CopyButton, LinkButton, Notice } from './ui'

/** Üyelik durumu, tek satırlık özet. */
export function membershipLine(m: MembershipView, partnerName: string | null) {
  if (m.active) {
    const who = m.purchasedByMe ? 'Sizin aldığınız' : `${partnerName ?? 'Partnerinizin'} aldığı`
    return `${PLAN_LABEL[m.period!]} üyelik ${formatDate(m.expiresAt)} tarihine kadar açık. ${who} üyelik ikiniz için de geçerli.`
  }
  const left = Math.max(0, m.freeLimit - m.disputesUsed)
  return left > 0
    ? `İlk meseleniz ücretsiz. Sonrası için aylık ya da yıllık üyelik.`
    : 'Ücretsiz meselenizi kullandınız. Yeni meseleler için üyelik gerekiyor.'
}

/** Yeni mesele açılamıyorsa panelde gösterilir. */
export function PaywallCard({ membership, solo }: { membership: MembershipView; solo: boolean }) {
  return (
    <Card className="animate-rise space-y-3 border-honey/40 bg-honey-soft/40 text-center">
      <span className="mx-auto inline-flex size-12 items-center justify-center rounded-full bg-surface text-honey shadow-soft">
        <IconSparkle size={22} />
      </span>
      <p className="font-display text-xl font-semibold">İlk meseleniz ücretsizdi</p>
      <p className="text-sm leading-relaxed text-ink-soft">
        Yeni bir mesele açmak için üyeliğinizi başlatın. {solo ? '' : 'Birinizin alması ikiniz için de yeterli. '}
        Önceki meseleleriniz ve raporlarınız her zaman açık kalır.
      </p>
      <LinkButton to="/uyelik" full>
        Üyelik seçeneklerini gör
      </LinkButton>
      <p className="text-[12px] text-ink-faint">{membership.disputesUsed} mesele açıldı</p>
    </Card>
  )
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
