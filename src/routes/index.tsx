import { useMutation, useQuery } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useState, type ReactNode } from 'react'
import { LogoMark, Wordmark } from '~/components/brand'
import { IconArrowLeft, IconArrowRight, IconCheck, IconLoop, IconMail, IconUsers } from '~/components/icons'
import { Disclaimer } from '~/components/safety'
import { TherapistAvatar } from '~/components/therapist-avatar'
import { Button, LinkButton, Notice } from '~/components/ui'
import { betaStatusFn, joinWaitlistFn } from '~/functions/couple'
import { parseError } from '~/lib/errors'
import { useMember } from '~/lib/hooks'
import { TIPS } from '~/lib/tips'

export const Route = createFileRoute('/')({
  component: Landing,
})

const BLOG_URL = 'https://firatyalcin.blog'

function Landing() {
  const member = useMember()
  const navigate = useNavigate()
  const beta = useQuery({ queryKey: ['beta'], queryFn: () => betaStatusFn(), staleTime: 60_000 }).data

  useEffect(() => {
    if (member) void navigate({ to: '/panel', replace: true })
  }, [member, navigate])

  return (
    <div className="paper-grain relative min-h-dvh overflow-x-clip">
      {/* Arka plandaki iki yumuşak halka: iki ayrı hikâye, ortak bir zemin */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[560px] overflow-hidden">
        <div className="absolute -top-40 -left-32 size-[420px] rounded-full bg-partner-a/15 blur-3xl" />
        <div className="absolute -top-24 -right-36 size-[420px] rounded-full bg-partner-b/15 blur-3xl" />
        <div className="absolute top-40 left-1/2 size-64 -translate-x-1/2 rounded-full bg-honey/20 blur-3xl" />
      </div>

      <div className="safe-top safe-bottom relative mx-auto flex min-h-dvh w-full max-w-xl flex-col px-5 md:max-w-3xl">
        <header className="flex h-16 items-center">
          <Wordmark />
        </header>

        <section className="animate-rise pt-8 pb-10 md:pt-14">
          {beta?.beta ? <BetaBadge remaining={beta.remaining} open={beta.open} /> : null}
          <TypedHeadline />
          <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-ink-soft md:text-[19px]">
            Yapay zekâ çift terapistiniz ikinizi ayrı ayrı dinler, aranızdaki döngüyü gösterir ve birbirinize
            dönmenin yolunu açar.
          </p>

          <Conversation />

          <div className="mt-8 space-y-3 md:flex md:gap-3 md:space-y-0">
            <LinkButton to="/olustur" size="lg" full>
              Başla <IconArrowRight size={18} />
            </LinkButton>
            <LinkButton to="/katil" variant="secondary" size="lg" full>
              Partnerimden davet aldım
            </LinkButton>
          </div>
          <Link
            to="/olustur"
            search={{ mod: 'bireysel' }}
            className="mt-3 block py-2 text-center text-sm font-medium text-ink-soft hover:text-ink"
          >
            Tek başıma bakmak istiyorum
          </Link>
        </section>

        <HowItWorks />
        <Schools />
        <Tips />

        <footer className="mt-auto space-y-4 border-t border-line pt-6 pb-6 text-[13px] text-ink-faint">
          <div className="flex items-start gap-3">
            <LogoMark size={32} className="mt-0.5 shrink-0" />
            <p className="leading-relaxed text-ink-soft">
              Bir çift terapisti olan <span className="font-semibold text-ink">Psk. Dan. Fırat YALÇIN</span>{' '}
              tarafından, yapay zekânın çift terapisi ekollerine göre eğitilmesiyle oluşturulmuştur.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <a
              href={BLOG_URL}
              className="inline-flex items-center gap-1.5 font-semibold text-ink-soft hover:text-ink"
            >
              <IconArrowLeft size={16} /> firatyalcin.blog’a geri dön
            </a>
            <Link to="/gizlilik" className="underline underline-offset-2">
              Gizlilik
            </Link>
          </div>
          <Disclaimer />
        </footer>
      </div>
    </div>
  )
}

/** Başlıktaki dönen cümleler: [öncesi, vurgulanan, sonrası] */
const HEADLINES: readonly (readonly [string, string, string])[] = [
  ['Aranızdaki meseleye ', 'birlikte', ' bakalım.'],
  ['Kim haklı değil; ', 'ne olduğuna', ' bakalım.'],
  ['Aranızdaki döngüyü ', 'birlikte', ' görelim.'],
  ['Önce sizi, sonra ', 'eşinizi', ' dinleyelim.'],
  ['Birbirinize dönmenin ', 'yolunu', ' açalım.'],
]
const TYPE_MS = 55
const DELETE_MS = 28
const HOLD_MS = 2600

/** Klavyede yazılıyormuş gibi beliren, silinip yenisi gelen başlık. */
function TypedHeadline() {
  const [index, setIndex] = useState(0)
  // İlk cümle sunucuda tam görünür; yazma döngüsü sayfa açıldıktan sonra başlar.
  const [shown, setShown] = useState(() => HEADLINES[0]!.join('').length)
  const [phase, setPhase] = useState<'hold' | 'delete' | 'type'>('hold')
  const full = HEADLINES[index]!.join('').length

  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    let t: number
    if (phase === 'hold') t = window.setTimeout(() => setPhase('delete'), HOLD_MS)
    else if (phase === 'delete') {
      if (shown === 0) {
        setIndex((i) => (i + 1) % HEADLINES.length)
        setPhase('type')
        return
      }
      t = window.setTimeout(() => setShown((n) => n - 1), DELETE_MS)
    } else {
      if (shown >= full) {
        setPhase('hold')
        return
      }
      t = window.setTimeout(() => setShown((n) => n + 1), TYPE_MS)
    }
    return () => clearTimeout(t)
  }, [phase, shown, full])

  const [before, mark, after] = HEADLINES[index]!
  const cut = (s: string, start: number) => s.slice(0, Math.max(0, shown - start))
  return (
    <h1 className="mt-5 grid text-[40px] leading-[1.05] font-semibold text-ink md:text-[60px]">
      <span className="sr-only">Aranızdaki meseleye birlikte bakalım.</span>
      {/* Bütün cümleler görünmez olarak üst üste yer tutar; yazarken sayfa zıplamaz. */}
      {HEADLINES.map((h) => (
        <span key={h.join('')} aria-hidden className="invisible col-start-1 row-start-1">
          {h[0]}
          <em>{h[1]}</em>
          {h[2]}
          <span className="ml-1 inline-block w-[3px]" />
        </span>
      ))}
      <span aria-hidden className="col-start-1 row-start-1">
        {cut(before, 0)}
        <span className="text-clay italic">{cut(mark, before.length)}</span>
        {cut(after, before.length + mark.length)}
        <span className="ml-1 inline-block h-[0.9em] w-[3px] translate-y-[0.1em] animate-caret bg-clay align-baseline" />
      </span>
    </h1>
  )
}

/** Test sürümü rozeti + "ücretli sürüme üye olmak isterim" bekleme listesi */
function BetaBadge({ remaining, open }: { remaining: number; open: boolean }) {
  const [formOpen, setFormOpen] = useState(false)
  const [email, setEmail] = useState('')
  const join = useMutation({ mutationFn: () => joinWaitlistFn({ data: { email } }) })

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-2 rounded-full bg-sage-soft px-3 py-1 text-[13px] font-medium text-ink">
          <span className="inline-block size-2 animate-breathe rounded-full bg-sage" aria-hidden />
          {open
            ? `Ücretsiz test sürümü · bugün ${remaining} yer kaldı`
            : 'Ücretsiz test sürümü · bugünlük kontenjan doldu'}
        </span>
        {!formOpen && !join.isSuccess ? (
          <button
            type="button"
            onClick={() => setFormOpen(true)}
            className="rounded-full px-2 py-1 text-[13px] font-semibold text-clay underline-offset-4 hover:underline"
          >
            Ücretli sürüme üye olmak isterim
          </button>
        ) : null}
      </div>

      {join.isSuccess ? (
        <Notice tone="success" title="Teşekkürler!">
          Ücretli sürüm yayınlanır yayınlanmaz sizinle iletişime geçeceğiz.
        </Notice>
      ) : formOpen ? (
        <form
          className="animate-rise space-y-2 rounded-3xl border border-line bg-surface/80 p-4 shadow-soft backdrop-blur"
          onSubmit={(e) => {
            e.preventDefault()
            if (email.trim()) join.mutate()
          }}
        >
          <label htmlFor="waitlist-email" className="block text-sm font-semibold text-ink">
            E-postanızı yazın
          </label>
          <div className="flex gap-2">
            <input
              id="waitlist-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ornek@eposta.com"
              className="h-12 min-w-0 flex-1 rounded-2xl border border-line-strong bg-surface px-4 text-ink focus:border-clay focus:outline-none"
            />
            <Button type="submit" loading={join.isPending} disabled={!email.trim()}>
              Gönder
            </Button>
          </div>
          <p className="text-[12px] text-ink-faint">
            Ücretli sürüm yayınlanır yayınlanmaz iletişime geçeceğiz. E-postanız başka bir amaçla kullanılmaz.
          </p>
          {join.isError ? <Notice tone="error">{parseError(join.error).message}</Notice> : null}
        </form>
      ) : null}
    </div>
  )
}

/** Uygulamanın nasıl konuştuğunu gösteren küçük bir örnek */
function Conversation() {
  return (
    <div className="mt-8 space-y-3" aria-hidden>
      <div className="flex items-end gap-3">
        <TherapistAvatar size={56} className="shrink-0 md:size-[72px]" />
        <div className="rounded-[28px] rounded-bl-md bg-surface px-5 py-4 text-[16px] leading-relaxed text-ink shadow-soft md:text-[18px]">
          Merhaba, ben yapay zekâ çift terapistinizim. Aranızda tam olarak ne oldu? Önce sizi, sonra eşinizi ayrı
          ayrı dinleyeceğim.
        </div>
      </div>
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-[28px] rounded-br-md bg-clay px-5 py-3 text-[15px] leading-relaxed text-on-clay shadow-soft">
          Dün akşam yine aynı konuda tartıştık…
        </div>
      </div>
    </div>
  )
}

function Step({ n, title, children, icon }: { n: number; title: string; children: ReactNode; icon: ReactNode }) {
  return (
    <li className="flex gap-4 rounded-3xl border border-line bg-surface/70 p-5 shadow-soft">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-clay-soft text-clay">
        {icon}
      </span>
      <div>
        <p className="text-[12px] font-semibold tracking-[0.14em] text-ink-faint uppercase">Adım {n}</p>
        <p className="mt-0.5 font-display text-[19px] font-semibold text-ink">{title}</p>
        <p className="mt-1 text-[15px] leading-relaxed text-ink-soft">{children}</p>
      </div>
    </li>
  )
}

function HowItWorks() {
  return (
    <section className="py-8">
      <h2 className="font-display text-[26px] font-semibold text-ink">Nasıl işler?</h2>
      <ol className="mt-4 grid gap-3 md:grid-cols-3">
        <Step n={1} title="Siz anlatın" icon={<IconMail size={20} />}>
          Yaşadığınız tartışmayı, o an aklınızdan geçenleri ve hissettiklerinizi kendi kelimelerinizle yazın.
        </Step>
        <Step n={2} title="Eşiniz anlatsın" icon={<IconUsers size={20} />}>
          Eşiniz kendi tarafını ayrı anlatır. Kimse diğerinin yazdıklarını olduğu gibi görmez.
        </Step>
        <Step n={3} title="Döngünüzü görün" icon={<IconLoop size={20} />}>
          Aranızdaki döngüyü, ikinizin ihtiyaçlarını ve bu meseleye özel onarım adımlarını içeren bir rapor alırsınız.
        </Step>
      </ol>
    </section>
  )
}

const SCHOOLS = [
  'Gottman Çift Terapisi',
  'Bilişsel Davranışçı Terapi',
  'Transaksiyonel Analiz',
  'Duygu Odaklı Terapi',
]

function Schools() {
  return (
    <section className="py-6">
      <p className="text-[12px] font-semibold tracking-[0.14em] text-ink-faint uppercase">
        Raporlarınız şu yaklaşımlara dayanır
      </p>
      <ul className="mt-3 flex flex-wrap gap-2">
        {SCHOOLS.map((s) => (
          <li
            key={s}
            className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 py-1.5 text-[14px] font-medium text-ink"
          >
            <IconCheck size={14} className="text-sage" /> {s}
          </li>
        ))}
      </ul>
    </section>
  )
}

const TIP_MS = 9000

/** Sürekli değişen kısa bilgi notları */
function Tips() {
  // Sunucu ve istemci aynı notla başlasın; ardından rastgele bir yerden devam edilir.
  const [i, setI] = useState(0)
  const [paused, setPaused] = useState(false)
  useEffect(() => {
    setI(Math.floor(Math.random() * TIPS.length))
  }, [])
  useEffect(() => {
    if (paused) return
    const t = window.setInterval(() => setI((x) => (x + 1) % TIPS.length), TIP_MS)
    return () => clearInterval(t)
  }, [paused])
  const tip = TIPS[i]!
  return (
    <section
      className="py-8"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-label="İlişkiler üzerine kısa notlar"
    >
      <div className="relative overflow-hidden rounded-3xl bg-ink px-6 py-6 text-paper shadow-soft md:px-8 md:py-8">
        <div aria-hidden className="absolute -right-10 -bottom-12 size-44 rounded-full bg-clay/30 blur-2xl" />
        <p className="relative text-[12px] font-semibold tracking-[0.14em] text-paper/60 uppercase">
          Biliyor muydunuz? · {tip.source}
        </p>
        <p key={i} className="relative mt-3 min-h-[7.5rem] animate-rise font-display text-[19px] leading-relaxed md:min-h-24 md:text-[22px]">
          {tip.text}
        </p>
        <div className="relative mt-4 flex items-center justify-between gap-3">
          <span className="text-[12px] text-paper/50 tabular-nums">
            {i + 1} / {TIPS.length}
          </span>
          <button
            type="button"
            onClick={() => setI((x) => (x + 1) % TIPS.length)}
            className="inline-flex items-center gap-1.5 rounded-full bg-paper/10 px-3.5 py-1.5 text-[13px] font-semibold text-paper hover:bg-paper/20"
          >
            Sonraki <IconArrowRight size={14} />
          </button>
        </div>
      </div>
    </section>
  )
}
