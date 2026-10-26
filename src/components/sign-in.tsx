import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import { useState } from 'react'
import { emailCodeSendFn, emailCodeVerifyFn, oauthStartFn } from '~/functions/auth'
import { createPkce, persistSession, saveOAuthState, saveTicket } from '~/lib/auth-client'
import { parseError } from '~/lib/errors'
import type { SessionResult } from '~/lib/views'
import { IconGoogle, IconMail } from './icons'
import { Button, Notice, TextField, cx } from './ui'

export type SignInResult =
  | { status: 'linked'; email: string | null }
  | { status: 'signed_in'; session: SessionResult }
  | { status: 'no_account'; ticket: string; email: string | null }

/** Giriş sonucunu uygular: oturumu kaydeder, bileti saklar ya da paneli yeniler. */
export function useSignInResult() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  return async (r: SignInResult, opts: { onLinked?: () => void; returnTo?: string } = {}) => {
    if (r.status === 'signed_in') {
      persistSession(r.session)
      qc.clear()
      await navigate({ to: '/panel', replace: true })
    } else if (r.status === 'no_account') {
      saveTicket(r.ticket)
      await navigate({ to: '/olustur', search: { hesap: 'yeni' }, replace: true })
    } else {
      await qc.invalidateQueries({ queryKey: ['panel'] })
      if (opts.onLinked) opts.onLinked()
      else if (opts.returnTo) await navigate({ to: opts.returnTo, replace: true })
    }
  }
}

const providerButton =
  'flex h-12 w-full items-center justify-center gap-2.5 rounded-full text-[15px] font-semibold transition active:translate-y-px disabled:opacity-50'

/**
 * Google ya da e-postaya gelen kodla giriş (Apple ile giriş şimdilik kapalı). Bu cihazda hesapsız kayıtlar varsa
 * hesaba bağlanır; yoksa hesaba bağlı kayıtlara giriş yapılır.
 */
export function SignInOptions({ onLinked }: { onLinked?: () => void }) {
  const apply = useSignInResult()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'buttons' | 'email' | 'code'>('buttons')

  const oauth = useMutation({
    mutationFn: async (provider: 'google' | 'apple') => {
      const { verifier, challenge } = await createPkce()
      saveOAuthState({ verifier, returnTo: pathname })
      const { url } = await oauthStartFn({
        data: { provider, redirectTo: `${window.location.origin}/giris`, codeChallenge: challenge },
      })
      window.location.assign(url)
    },
  })
  const send = useMutation({
    mutationFn: () => emailCodeSendFn({ data: { email } }),
    onSuccess: () => setStep('code'),
  })
  const verify = useMutation({
    mutationFn: () => emailCodeVerifyFn({ data: { email, code } }),
    onSuccess: (r) => apply(r, { onLinked }),
  })
  const error = oauth.error ?? send.error ?? verify.error

  if (step === 'buttons') {
    return (
      <div className="space-y-3">
        <button
          type="button"
          className={cx(providerButton, 'border border-line-strong bg-surface text-ink')}
          disabled={oauth.isPending}
          onClick={() => oauth.mutate('google')}
        >
          <IconGoogle size={20} /> Google ile devam et
        </button>
        <button
          type="button"
          className={cx(providerButton, 'text-ink-soft hover:text-ink')}
          onClick={() => setStep('email')}
        >
          <IconMail size={18} /> E-posta ile devam et
        </button>
        {error ? <Notice tone="error">{parseError(error).message}</Notice> : null}
      </div>
    )
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (step === 'email') send.mutate()
        else verify.mutate()
      }}
    >
      {step === 'email' ? (
        <TextField
          label="E-posta adresiniz"
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="ornek@eposta.com"
          autoComplete="email"
          inputMode="email"
          autoFocus
        />
      ) : (
        <TextField
          label="E-postanıza gelen 6 haneli kod"
          hint={`${email} adresine gönderdik. Gelmediyse gereksiz klasörüne bakın.`}
          value={code}
          onChange={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
          placeholder="123456"
          autoComplete="one-time-code"
          inputMode="numeric"
          inputClassName="text-center font-display text-2xl tracking-[0.4em]"
          autoFocus
        />
      )}
      {error ? <Notice tone="error">{parseError(error).message}</Notice> : null}
      <Button
        type="submit"
        full
        loading={send.isPending || verify.isPending}
        disabled={step === 'email' ? !email.includes('@') : code.length !== 6}
      >
        {step === 'email' ? 'Kodu gönder' : 'Devam'}
      </Button>
      <button
        type="button"
        className="block w-full py-1 text-center text-sm text-ink-faint hover:text-ink"
        onClick={() => {
          send.reset()
          verify.reset()
          setCode('')
          setStep(step === 'code' ? 'email' : 'buttons')
        }}
      >
        Geri
      </button>
    </form>
  )
}
