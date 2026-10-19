import { useMutation } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'
import { AppShell, PageTitle } from '~/components/layout'
import { SignInOptions, useSignInResult } from '~/components/sign-in'
import { Notice, Spinner } from '~/components/ui'
import { oauthFinishFn } from '~/functions/auth'
import { takeOAuthState } from '~/lib/auth-client'
import { parseError } from '~/lib/errors'
import { useMember } from '~/lib/hooks'

type Search = { code?: string; error?: string }

export const Route = createFileRoute('/giris')({
  ssr: false,
  validateSearch: (s: Record<string, unknown>): Search => ({
    ...(typeof s.code === 'string' ? { code: s.code.slice(0, 500) } : {}),
    ...(typeof s.error === 'string' ? { error: s.error.slice(0, 100) } : {}),
  }),
  head: () => ({ meta: [{ title: 'Giriş — MESELE' }] }),
  component: SignInPage,
})

function SignInPage() {
  const { code, error } = Route.useSearch()
  const member = useMember()
  if (code) return <Finish code={code} />
  return (
    <AppShell back={member ? '/panel' : '/'}>
      <PageTitle
        title={member ? 'Hesabınızı kaydedin' : 'Hesabınıza giriş yapın'}
        lead={
          member
            ? 'Telefonunuz değişse de meseleleriniz ve raporlarınız hesabınızda kalır.'
            : 'Daha önce kullandığınız yöntemle devam edin.'
        }
      />
      {error ? (
        <div className="mb-4">
          <Notice tone="error">Giriş tamamlanamadı. Lütfen tekrar deneyin.</Notice>
        </div>
      ) : null}
      <SignInOptions />
      {member ? null : (
        <p className="mt-8 text-center text-sm text-ink-faint">
          İlk kez mi kullanıyorsunuz?{' '}
          <Link to="/olustur" className="font-semibold text-clay-strong">
            Başlayın
          </Link>
        </p>
      )}
    </AppShell>
  )
}

/** Apple / Google'dan dönüş: kod ve bu cihazdaki doğrulayıcıyla girişi tamamla. */
function Finish({ code }: { code: string }) {
  const apply = useSignInResult()
  const started = useRef(false)
  const finish = useMutation({
    mutationFn: async () => {
      const state = takeOAuthState()
      if (!state) throw new Error('[VALIDATION] Giriş süresi doldu. Lütfen yeniden deneyin.')
      const r = await oauthFinishFn({ data: { code, verifier: state.verifier } })
      await apply(r, { returnTo: state.returnTo === '/giris' ? '/panel' : state.returnTo })
    },
  })
  useEffect(() => {
    if (started.current) return
    started.current = true
    finish.mutate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <AppShell>
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        {finish.isError ? (
          <>
            <Notice tone="error">{parseError(finish.error).message}</Notice>
            <Link to="/giris" className="text-sm font-semibold text-clay-strong">
              Tekrar dene
            </Link>
          </>
        ) : (
          <>
            <Spinner />
            <p className="text-ink-soft">Giriş yapılıyor…</p>
          </>
        )}
      </div>
    </AppShell>
  )
}
