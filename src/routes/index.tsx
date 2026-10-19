import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { Wordmark } from '~/components/brand'
import { IconArrowRight } from '~/components/icons'
import { Disclaimer } from '~/components/safety'
import { LinkButton } from '~/components/ui'
import { useMember } from '~/lib/hooks'

export const Route = createFileRoute('/')({
  component: Landing,
})

function Landing() {
  const member = useMember()
  const navigate = useNavigate()

  useEffect(() => {
    if (member) void navigate({ to: '/panel', replace: true })
  }, [member, navigate])

  return (
    <div className="paper-grain min-h-dvh">
      <div className="safe-top safe-bottom mx-auto flex min-h-dvh w-full max-w-xl flex-col px-5">
        <header className="flex h-14 items-center justify-between">
          <Wordmark />
          <Link to="/giris" className="text-sm font-semibold text-ink-soft hover:text-ink">
            Giriş yap
          </Link>
        </header>

        <section className="flex flex-1 animate-rise flex-col justify-center py-10">
          <h1 className="text-[40px] leading-[1.08] font-semibold text-ink">
            Aranızdaki meseleye <span className="text-clay italic">birlikte</span> bakalım.
          </h1>
          <p className="mt-5 text-[17px] leading-relaxed text-ink-soft">
            İkinizi ayrı ayrı dinler, aranızdaki döngüyü gösterir ve birbirinize dönmenin yolunu açar.
          </p>

          <div className="mt-10 space-y-3">
            <LinkButton to="/olustur" size="lg" full>
              Başla <IconArrowRight size={18} />
            </LinkButton>
            <LinkButton to="/katil" variant="secondary" size="lg" full>
              Partnerimden davet aldım
            </LinkButton>
            <Link
              to="/olustur"
              search={{ mod: 'bireysel' }}
              className="block py-2 text-center text-sm font-medium text-ink-soft hover:text-ink"
            >
              Tek başıma bakmak istiyorum
            </Link>
          </div>
        </section>

        <footer className="space-y-3 pb-4 text-[13px] text-ink-faint">
          <p>
            Psk. Dan. Fırat YALÇIN tarafından tasarlandı · İlk mesele ücretsiz ·{' '}
            <Link to="/gizlilik" className="underline underline-offset-2">
              Gizlilik
            </Link>
          </p>
          <Disclaimer />
        </footer>
      </div>
    </div>
  )
}
