import { useMutation } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { IconArrowRight, IconKey } from '~/components/icons'
import { AppShell, BottomBar, PageTitle } from '~/components/layout'
import { Button, Notice, TextField, cx } from '~/components/ui'
import { joinCoupleFn, restoreSessionFn } from '~/functions/couple'
import { parseError } from '~/lib/errors'
import { saveMember } from '~/lib/member-token'
import { LIMITS } from '~/lib/questions'
import type { SessionResult } from '~/lib/views'

type JoinSearch = { kod?: string; mod?: 'kod' | 'anahtar' }

function parseSearch(search: Record<string, unknown>): JoinSearch {
  const out: JoinSearch = {}
  if (typeof search.kod === 'string') out.kod = search.kod.slice(0, 16)
  if (search.mod === 'kod' || search.mod === 'anahtar') out.mod = search.mod
  return out
}

export const Route = createFileRoute('/katil')({
  validateSearch: parseSearch,
  head: () => ({ meta: [{ title: 'Çiftine katıl — MESELE' }] }),
  component: Join,
})

function persist(res: SessionResult) {
  saveMember({
    token: res.token,
    memberId: res.member.id,
    coupleId: res.couple.id,
    role: res.member.role,
    displayName: res.member.name,
    coupleName: res.couple.name,
    coupleCode: res.couple.code,
  })
}

function Join() {
  const search = Route.useSearch()
  const navigate = useNavigate()
  const mode = search.mod ?? 'kod'

  return (
    <AppShell back="/">
      <div className="mb-6 inline-flex rounded-full border border-line bg-sunken p-1 text-sm" role="tablist">
        {(
          [
            ['kod', 'Çift koduyla katıl'],
            ['anahtar', 'Cihaz anahtarımla dön'],
          ] as const
        ).map(([m, label]) => (
          <button
            key={m}
            role="tab"
            type="button"
            aria-selected={mode === m}
            onClick={() => navigate({ to: '/katil', search: { ...search, mod: m }, replace: true })}
            className={cx(
              'min-h-9 rounded-full px-4 font-medium transition',
              mode === m ? 'bg-surface text-ink shadow-soft' : 'text-ink-faint hover:text-ink',
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {mode === 'kod' ? <JoinWithCode initialCode={search.kod ?? ''} /> : <RestoreWithKey />}
    </AppShell>
  )
}

function JoinWithCode({ initialCode }: { initialCode: string }) {
  const navigate = useNavigate()
  const [code, setCode] = useState(initialCode.toUpperCase())
  const [displayName, setDisplayName] = useState('')

  const mutation = useMutation({
    mutationFn: () => joinCoupleFn({ data: { code, displayName } }),
    onSuccess: (res) => {
      persist(res)
      void navigate({ to: '/panel' })
    },
  })

  const normalized = code.replace(/[\s-]/g, '')
  const ready = normalized.length === 6 && displayName.trim().length > 0

  return (
    <>
      <PageTitle
        eyebrow="Partnerine katıl"
        title="Kodunu gir, adını yaz"
        lead="Partnerinin sana gönderdiği 6 haneli çift kodunu gir. Ardından ikiniz aynı meseleye, ayrı ayrı bakabileceksiniz."
      />
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault()
          if (ready) mutation.mutate()
        }}
      >
        <TextField
          label="Çift kodu"
          value={code}
          onChange={(v) => setCode(v.toUpperCase().replace(/[^A-Z0-9\s-]/gi, ''))}
          maxLength={9}
          placeholder="WWPX6G"
          autoCapitalize="characters"
          inputClassName="text-center font-display text-2xl tracking-[0.4em] uppercase"
        />
        <TextField
          label="Senin adın"
          hint="Partnerin seni bu adla görecek."
          value={displayName}
          onChange={setDisplayName}
          maxLength={LIMITS.displayName}
          placeholder="Adın"
          autoCapitalize="words"
          autoComplete="given-name"
        />
        {mutation.isError ? <Notice tone="error">{parseError(mutation.error).message}</Notice> : null}
        <p className="text-sm text-ink-faint">
          Kodun yok mu?{' '}
          <Link to="/olustur" className="font-semibold text-clay-strong underline-offset-4 hover:underline">
            Yeni bir çift oluştur
          </Link>
        </p>
        <BottomBar>
          <Button type="submit" size="lg" full disabled={!ready} loading={mutation.isPending}>
            Eşleş <IconArrowRight size={18} />
          </Button>
        </BottomBar>
      </form>
    </>
  )
}

function RestoreWithKey() {
  const navigate = useNavigate()
  const [token, setToken] = useState('')
  const mutation = useMutation({
    mutationFn: () => restoreSessionFn({ data: { token: token.trim() } }),
    onSuccess: (res) => {
      persist(res)
      void navigate({ to: '/panel' })
    },
  })

  return (
    <>
      <PageTitle
        eyebrow="Yeni cihaz"
        title="Cihaz anahtarınla geri dön"
        lead="Panelinden yedeklediğin cihaz anahtarını buraya yapıştır. Bu anahtar bir şifre gibidir; kimseyle paylaşma."
      />
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault()
          if (token.trim().length >= 40) mutation.mutate()
        }}
      >
        <TextField
          label="Cihaz anahtarı"
          value={token}
          onChange={setToken}
          maxLength={64}
          placeholder="43 karakterlik anahtar"
          inputClassName="font-mono text-sm"
        />
        {mutation.isError ? <Notice tone="error">{parseError(mutation.error).message}</Notice> : null}
        <Notice tone="info">
          <span className="inline-flex items-center gap-1.5">
            <IconKey size={16} /> Çift kodu burada işe yaramaz; o yalnızca eşleştirme içindir.
          </span>
        </Notice>
        <BottomBar>
          <Button type="submit" size="lg" full disabled={token.trim().length < 40} loading={mutation.isPending}>
            Geri dön <IconArrowRight size={18} />
          </Button>
        </BottomBar>
      </form>
    </>
  )
}
