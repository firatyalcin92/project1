import { useMutation } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { IconArrowRight } from '~/components/icons'
import { AppShell, BottomBar, PageTitle } from '~/components/layout'
import { Button, Notice, TextField } from '~/components/ui'
import { createCoupleFn } from '~/functions/couple'
import { createDisputeFn } from '~/functions/dispute'
import { persistSession, readTicket } from '~/lib/auth-client'
import { parseError } from '~/lib/errors'
import { useMember } from '~/lib/hooks'
import { LIMITS } from '~/lib/questions'

type Search = { mod?: 'bireysel'; hesap?: 'yeni' }

export const Route = createFileRoute('/olustur')({
  validateSearch: (search: Record<string, unknown>): Search => ({
    ...(search.mod === 'bireysel' ? { mod: 'bireysel' as const } : {}),
    ...(search.hesap === 'yeni' ? { hesap: 'yeni' as const } : {}),
  }),
  head: () => ({ meta: [{ title: 'Başlayalım — MESELE' }] }),
  component: CreateCouple,
})

/** Yalnızca iki ad; ardından doğrudan ilk meselenin ilk sorusu. */
function CreateCouple() {
  const member = useMember()
  const navigate = useNavigate()
  const search = Route.useSearch()
  const solo = search.mod === 'bireysel'
  const [displayName, setDisplayName] = useState('')
  const [partnerName, setPartnerName] = useState('')

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await createCoupleFn({
        data: { mode: solo ? 'solo' : 'couple', displayName, partnerName, ticket: readTicket() },
      })
      persistSession(res)
      return createDisputeFn({ data: {} })
    },
    onSuccess: ({ id }) => navigate({ to: '/mesele/$id', params: { id }, replace: true }),
  })

  const ready = displayName.trim().length > 0 && partnerName.trim().length > 0

  return (
    <AppShell back="/">
      <PageTitle
        title={solo ? 'Tek başınıza da bakabiliriz' : 'Önce adlarınız'}
        lead={
          search.hesap === 'yeni'
            ? 'Bu hesapla henüz bir kaydınız yok. Adlarınızı yazın, hemen başlayalım; hesabınız kendiliğinden bağlanır.'
            : solo
              ? 'Eşiniz uygulamayı kullanmasa da yaşadığınızı anlatın; size özel bir yol haritası hazırlayalım.'
              : 'Sonra hemen ilk soruya geçiyoruz.'
        }
      />

      {member ? (
        <div className="mb-5">
          <Notice tone="warn" title="Bu cihazda zaten kayıtlarınız var">
            Yeniden başlarsanız bu cihaz yeni kayda geçer.{' '}
            <Link to="/panel" className="font-semibold underline">
              Panele dönün
            </Link>
          </Notice>
        </div>
      ) : null}

      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault()
          if (ready) mutation.mutate()
        }}
      >
        <TextField
          label="Adınız"
          value={displayName}
          onChange={setDisplayName}
          maxLength={LIMITS.displayName}
          placeholder="Adınız"
          autoCapitalize="words"
          autoComplete="given-name"
          autoFocus
        />
        <TextField
          label={solo ? 'Eşinizin adı' : 'Partnerinizin adı'}
          value={partnerName}
          onChange={setPartnerName}
          maxLength={LIMITS.displayName}
          placeholder="Partnerinizin adı"
          autoCapitalize="words"
        />
        {mutation.isError ? <Notice tone="error">{parseError(mutation.error).message}</Notice> : null}
        <BottomBar>
          <Button type="submit" size="lg" full disabled={!ready} loading={mutation.isPending}>
            Başlayalım <IconArrowRight size={18} />
          </Button>
          <p className="mt-2 text-center text-[12px] text-ink-faint">
            Takma ad da olur.{' '}
            <Link to="/gizlilik" className="underline underline-offset-2">
              Gizlilik
            </Link>
          </p>
        </BottomBar>
      </form>
    </AppShell>
  )
}
