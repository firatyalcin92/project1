import { createFileRoute } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { IconEye, IconKey, IconLock, IconShield, IconSparkle, IconUsers } from '~/components/icons'
import { AppShell, PageTitle } from '~/components/layout'
import { Disclaimer } from '~/components/safety'
import { Card } from '~/components/ui'

export const Route = createFileRoute('/gizlilik')({
  head: () => ({ meta: [{ title: 'Gizlilik — MESELE' }] }),
  component: Privacy,
})

function Item({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <Card className="space-y-2">
      <p className="flex items-center gap-2 font-semibold text-ink">
        <span className="inline-flex size-8 items-center justify-center rounded-full bg-clay-soft text-clay-strong">
          {icon}
        </span>
        {title}
      </p>
      <div className="space-y-2 text-[15px] leading-relaxed text-ink-soft">{children}</div>
    </Card>
  )
}

function Privacy() {
  return (
    <AppShell back="history" title="Gizlilik">
      <PageTitle
        eyebrow="Gizlilik"
        title="Anlattıklarınız size özeldir"
        lead="Bir tartışmayı dürüstçe anlatabilmek için güvende hissetmek gerekir. MESELE’nin verilerinizi nasıl koruduğunu sade bir dille anlatıyoruz."
      />
      <div className="space-y-4 pb-8">
        <Item icon={<IconShield size={18} />} title="Kişisel bilginizi istemiyoruz">
          <p>
            E-posta adresi, telefon numarası, şifre, kimlik ya da adres bilgisi istemiyoruz. Yalnızca size nasıl
            seslenileceğini soruyoruz; takma ad da kullanabilirsiniz.
          </p>
        </Item>

        <Item icon={<IconUsers size={18} />} title="Partneriniz cevaplarınızı olduğu gibi görmez">
          <p>
            Yazdıklarınız partnerinize hiçbir ekranda olduğu gibi gösterilmez. Danışman (yapay zekâ) cevaplarınızı
            analizde kullanır; partnerinizin okuyacağı metinlerde alıntı yapmadan, ihtiyaç diliyle yansıtır.
          </p>
          <p>
            “Size Özel Ayna” raporunu yalnızca siz görürsünüz. Ortak rapor, ikiniz de “hazırım” dediğinizde açılır.
            İtirazlarınız ve yeniden değerlendirme notlarınız da partnerinize gösterilmez.
          </p>
        </Item>

        <Item icon={<IconEye size={18} />} title="Üçüncü kişiler göremez">
          <p>
            Cevaplarınız reklam ya da pazarlama için kullanılmaz, satılmaz ve kimseyle paylaşılmaz. Veritabanına
            yalnızca uygulamanın kendi sunucusu erişir; tarayıcıdan ya da dışarıdan doğrudan erişim kapalıdır.
          </p>
          <p>Çift kodu yalnızca sizi eşleştirmek içindir; partneriniz katıldıktan sonra başka kimseye kapı açmaz.</p>
        </Item>

        <Item icon={<IconSparkle size={18} />} title="Yapay zekâ analizi">
          <p>
            Rapor hazırlanırken cevaplarınız şifreli bağlantıyla yapay zekâ hizmet sağlayıcısına (OpenAI) gönderilir.
            OpenAI, API üzerinden gelen verileri varsayılan olarak modellerini eğitmek için kullanmadığını; kötüye
            kullanımı denetlemek için sınırlı bir süre saklayabileceğini belirtir.
          </p>
          <p>
            Danışman, aynı çiftin önceki meselelerini yalnızca sizin de okuduğunuz ortak raporlardan ve kendi kişisel
            raporunuzdan hatırlar; partnerinizin size özel raporu sizin raporunuza girmez.
          </p>
        </Item>

        <Item icon={<IconKey size={18} />} title="Hesabınız: cihaz anahtarı">
          <p>
            Telefonunuza size özel, gizli bir anahtar kaydedilir. Sunucuda bu anahtarın kendisi değil, geri çevrilemeyen
            bir izi saklanır. Anahtarı yedeklemezseniz telefon değişince kayıtlarınıza ulaşamayabilirsiniz; Hesap
            sayfasından yedekleyebilirsiniz.
          </p>
        </Item>

        <Item icon={<IconLock size={18} />} title="Silme hakkınız">
          <p>
            Tüm verilerinizi Hesap sayfasından silebilirsiniz. Çift olarak kullanıyorsanız partnerinizin de onay vermesi
            gerekir; böylece kimse ortak kayıtları tek taraflı silemez. Silme geri alınamaz.
          </p>
          <p>
            Verilerin silinmesi üyeliğinizi iptal etmez: satın alan kişiye verilen aktarım koduyla kalan süre yeni bir
            çifte ya da bireysel kullanıma taşınabilir.
          </p>
        </Item>

        <Disclaimer />
      </div>
    </AppShell>
  )
}
