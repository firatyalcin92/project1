import { useMutation, useQuery } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { IconArrowRight } from '~/components/icons'
import { AppShell, BottomBar, PageTitle } from '~/components/layout'
import { Button, Notice, TextField } from '~/components/ui'
import { invitePreviewFn, joinCoupleFn } from '~/functions/couple'
import { persistSession, readTicket } from '~/lib/auth-client'
import { parseError } from '~/lib/errors'
import { LIMITS } from '~/lib/questions'

type JoinSearch = { kod?: string }

export const Route = createFileRoute('/katil')({
  validateSearch: (search: Record<string, unknown>): JoinSearch =>
    typeof search.kod === 'string' ? { kod: search.kod.slice(0, 16) } : {},
  head: () => ({ meta: [{ title: 'Davete katıl — MESELE' }] }),
  component: Join,
})

/** Davet linkiyle gelen kişi yalnızca adını onaylar; kod elle yazılmaz. */
function Join() {
  const search = Route.useSearch()
  const navigate = useNavigate()
  const [code, setCode] = useState((search.kod ?? '').toUpperCase())
  const [displayName, setDisplayName] = useState('')
  const normalized = code.replace(/[\s-]/g, '')

  const preview = useQuery({
    queryKey: ['invite', normalized],
    queryFn: () => invitePreviewFn({ data: { code: normalized } }),
    enabled: normalized.length === 6,
    staleTime: 60_000,
  })
  const invite = preview.data

  // Davet eden, partnerinin adını zaten yazdı: hazır gelsin.
  useEffect(() => {
    if (invite?.suggestedName && !displayName) setDisplayName(invite.suggestedName)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invite?.suggestedName])

  const mutation = useMutation({
    mutationFn: () => joinCoupleFn({ data: { code: normalized, displayName, ticket: readTicket() } }),
    onSuccess: (res) => {
      persistSession(res)
      void navigate({ to: '/panel', replace: true })
    },
  })

  const ready = normalized.length === 6 && displayName.trim().length > 0
  const fromLink = Boolean(search.kod)

  return (
    <AppShell back="/">
      <PageTitle
        title={invite?.inviter ? `${invite.inviter} sizi davet etti` : 'Davete katılın'}
        lead={
          invite?.inviter
            ? `Aranızdaki meseleye birlikte bakacaksınız. ${invite.inviter} kendi tarafını anlattı ya da anlatıyor; sıra size de gelecek.`
            : 'Partnerinizin gönderdiği daveti açtığınızda bu ekran kendiliğinden dolar.'
        }
      />
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault()
          if (ready) mutation.mutate()
        }}
      >
        {fromLink && invite !== null ? null : (
          <TextField
            label="Davet kodu"
            hint="Davet mesajındaki 6 karakterlik kod"
            value={code}
            onChange={(v) => setCode(v.toUpperCase().replace(/[^A-Z0-9\s-]/gi, ''))}
            maxLength={9}
            placeholder="WWPX6G"
            autoCapitalize="characters"
            inputClassName="text-center font-display text-2xl tracking-[0.4em] uppercase"
          />
        )}
        {preview.data === null && normalized.length === 6 ? (
          <Notice tone="warn">
            Bu davet bulunamadı ya da zaten kullanılmış. Daha önce katıldıysanız{' '}
            <Link to="/giris" className="font-semibold underline">
              giriş yapın
            </Link>
            .
          </Notice>
        ) : null}
        <TextField
          label="Adınız"
          value={displayName}
          onChange={setDisplayName}
          maxLength={LIMITS.displayName}
          placeholder="Adınız"
          autoCapitalize="words"
          autoComplete="given-name"
        />
        {mutation.isError ? <Notice tone="error">{parseError(mutation.error).message}</Notice> : null}
        <BottomBar>
          <Button type="submit" size="lg" full disabled={!ready} loading={mutation.isPending}>
            Katıl <IconArrowRight size={18} />
          </Button>
          <p className="mt-2 text-center text-[12px] text-ink-faint">
            Daha önce katıldınız mı?{' '}
            <Link to="/giris" className="underline underline-offset-2">
              Giriş yapın
            </Link>
          </p>
        </BottomBar>
      </form>
    </AppShell>
  )
}
