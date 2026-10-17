import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { LogoMark, SLOGAN, Wordmark } from '~/components/brand'
import { IconArrowRight, IconHeart, IconKey, IconLock, IconLoop, IconSparkle } from '~/components/icons'
import { Disclaimer } from '~/components/safety'
import { LinkButton } from '~/components/ui'
import { useMember } from '~/lib/hooks'

export const Route = createFileRoute('/')({
  component: Landing,
})

const STEPS = [
  {
    n: 1,
    title: 'Anlat',
    body: 'Her biriniz kendi telefonundan, kimse sözünüzü kesmeden anlatır: ne oldu, ne düşündünüz, ne hissettiniz, neye ihtiyacınız vardı.',
  },
  {
    n: 2,
    title: 'Partnerinin Gözünden Gör',
    body: 'Partnerinizin o an ne yaşadığını, savunmaya geçmeden, onun gözünden okursunuz.',
  },
  {
    n: 3,
    title: 'Yeniden Değerlendir',
    body: 'Okuduktan sonra içinizde ne değişti? Yeni bir cümle kurarsınız.',
  },
  {
    n: 4,
    title: 'Çözüm Raporu',
    body: 'Ortak döngünüz, ihtiyaç aynanız ve bu akşam partnerinize birebir söyleyebileceğiniz cümleler.',
  },
]

const MANIFESTO = [
  { icon: IconLoop, text: 'Düşmanınız birbiriniz değil; aranıza yerleşen döngü.' },
  { icon: IconHeart, text: 'Öfkenin altında hep daha kırılgan bir duygu bekler.' },
  { icon: IconLock, text: 'Cevaplarınız partnerinize olduğu gibi gösterilmez; danışman ihtiyaç diliyle aktarır.' },
  { icon: IconSparkle, text: 'Kimse kazanmaz. İlişki kazanır.' },
]

function Landing() {
  const member = useMember()
  const navigate = useNavigate()

  useEffect(() => {
    if (member) void navigate({ to: '/panel', replace: true })
  }, [member, navigate])

  return (
    <div className="paper-grain min-h-dvh">
      <div className="safe-top safe-bottom mx-auto flex w-full max-w-xl flex-col px-5">
        <header className="flex h-14 items-center">
          <Wordmark />
        </header>

        <section className="animate-rise pt-8 pb-10">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-surface/80 px-3 py-1 text-[13px] font-medium text-ink-soft shadow-soft">
            <LogoMark size={16} /> {SLOGAN}
          </p>
          <h1 className="text-[40px] leading-[1.05] font-semibold text-ink">
            Kavga ettiniz.
            <br />
            <span className="text-clay italic">Bir de MESELE’ye</span> soralım.
          </h1>
          <p className="mt-5 text-[17px] leading-relaxed text-ink-soft">
            Kim haklı diye düşünüyorsunuz. Belki artık konuşamıyorsunuz bile. MESELE ikinizi ayrı ayrı dinler,
            aranızdaki döngüyü gösterir ve birbirinize yeniden dönmenin yolunu açar.
          </p>

          <div className="mt-8 flex flex-col gap-3">
            <LinkButton to="/olustur" size="lg" full>
              Yeni çift oluştur <IconArrowRight size={18} />
            </LinkButton>
            <LinkButton to="/katil" variant="secondary" size="lg" full>
              Partnerimin koduyla katıl
            </LinkButton>
            <Link
              to="/olustur"
              search={{ mod: 'bireysel' }}
              className="card mt-1 flex items-center gap-3 px-4 py-3.5 text-left transition hover:shadow-lift"
            >
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-ink">Tek başıma danışmak istiyorum</span>
                <span className="block text-[13px] leading-snug text-ink-soft">
                  Eşiniz uygulamayı kullanmasa da, yaşadığınız tartışma için yönlendirme alın.
                </span>
              </span>
              <IconArrowRight size={18} className="shrink-0 text-ink-faint" />
            </Link>
            <Link
              to="/katil"
              search={{ mod: 'anahtar' }}
              className="mx-auto mt-1 inline-flex items-center gap-1.5 py-2 text-sm font-medium text-ink-soft hover:text-ink"
            >
              <IconKey size={16} /> Cihaz anahtarımla geri dön
            </Link>
          </div>
        </section>

        <section className="space-y-3 pb-10" aria-labelledby="ask-title">
          <h2 id="ask-title" className="sr-only">
            Ne zaman MESELE’ye sorulur?
          </h2>
          <div className="ml-auto w-fit max-w-[85%] rounded-3xl rounded-br-md bg-partner-b-soft px-4 py-3 text-[15px] text-ink">
            “Kim haklı, gel bir de MESELE’ye soralım.”
          </div>
          <div className="w-fit max-w-[85%] rounded-3xl rounded-bl-md bg-partner-a-soft px-4 py-3 text-[15px] text-ink">
            “Biz bunun içinden çıkamıyoruz. O nasıl yönlendirirse öyle yapalım.”
          </div>
          <div className="mx-auto w-fit max-w-[90%] rounded-3xl bg-surface px-4 py-3 text-center text-[15px] text-ink shadow-soft">
            <span className="font-display italic">MESELE:</span> “Önce ikinizi de dinleyelim.”
          </div>
        </section>

        <section className="pb-12" aria-labelledby="how-title">
          <h2 id="how-title" className="mb-5 text-2xl font-semibold">
            Nasıl işler?
          </h2>
          <ol className="relative space-y-5 border-l border-dashed border-line-strong pl-6">
            {STEPS.map((s) => (
              <li key={s.n} className="relative">
                <span className="absolute top-0 -left-[37px] inline-flex size-7 items-center justify-center rounded-full bg-clay font-display text-sm font-semibold text-on-clay">
                  {s.n}
                </span>
                <h3 className="text-lg font-semibold">{s.title}</h3>
                <p className="mt-1 leading-relaxed text-ink-soft">{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="card mb-12 p-6" aria-labelledby="manifesto-title">
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-clay-strong">Manifesto</p>
          <h2 id="manifesto-title" className="mt-1 text-[26px] leading-tight font-semibold">
            Burada mahkeme yok.
            <br />
            Ayna var.
          </h2>
          <ul className="mt-5 space-y-4">
            {MANIFESTO.map(({ icon: Icon, text }) => (
              <li key={text} className="flex gap-3">
                <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-clay-soft text-clay-strong">
                  <Icon size={18} />
                </span>
                <span className="leading-relaxed text-ink">{text}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mb-6 rounded-3xl bg-sunken p-6" aria-labelledby="privacy-title">
          <h2 id="privacy-title" className="text-xl font-semibold">
            Anlattıklarınız size özel.
          </h2>
          <ul className="mt-3 space-y-2 leading-relaxed text-ink-soft">
            <li>• E-posta, telefon ya da şifre istemiyoruz; takma ad da olur.</li>
            <li>
              • Olay anlatımı dışında partneriniz cevaplarınızı olduğu gibi görmez; danışman onları ihtiyaç diliyle
              yansıtır.
            </li>
            <li>• Üçüncü kişilerle paylaşılmaz, reklam için kullanılmaz.</li>
            <li>• Tüm verilerinizi istediğiniz an silebilirsiniz (çift olarak kullanıyorsanız ikinizin onayıyla).</li>
          </ul>
          <Link to="/gizlilik" className="mt-3 inline-flex text-sm font-semibold text-clay-strong">
            Gizlilik nasıl korunuyor? <IconArrowRight size={16} className="ml-1" />
          </Link>
        </section>

        <section className="mb-12 rounded-3xl border border-line p-6" aria-labelledby="price-title">
          <h2 id="price-title" className="text-xl font-semibold">
            İlk mesele ücretsiz.
          </h2>
          <p className="mt-2 leading-relaxed text-ink-soft">
            Sonrası için aylık ya da yıllık üyelik. Çiftlerden birinin alması ikiniz için de yeterli.
          </p>
        </section>

        <footer className="space-y-4 border-t border-line pt-6 pb-4">
          <p className="text-sm text-ink-soft">
            <span className="font-semibold text-ink">Psk. Dan. Fırat YALÇIN</span> — Aile Danışmanı tarafından, Duygu
            Odaklı Çift Terapisi ve Gottman yaklaşımlarından ilham alınarak tasarlandı.
          </p>
          <Disclaimer />
        </footer>
      </div>
    </div>
  )
}
