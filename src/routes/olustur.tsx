import { useMutation } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { CodeTiles } from '~/components/code-tiles'
import { IconArrowRight, IconCopy, IconShare } from '~/components/icons'
import { AppShell, BottomBar, PageTitle } from '~/components/layout'
import { Button, Card, Notice, TextField } from '~/components/ui'
import { createCoupleFn } from '~/functions/couple'
import { parseError } from '~/lib/errors'
import { useMember } from '~/lib/hooks'
import { saveMember } from '~/lib/member-token'
import { LIMITS } from '~/lib/questions'
import { inviteMessage, shareOrCopy } from '~/lib/share'
import type { SessionResult } from '~/lib/views'

export const Route = createFileRoute('/olustur')({
  head: () => ({ meta: [{ title: 'Yeni çift — MESELE' }] }),
  component: CreateCouple,
})

function CreateCouple() {
  const member = useMember()
  const [coupleName, setCoupleName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [created, setCreated] = useState<SessionResult | null>(null)

  const mutation = useMutation({
    mutationFn: () => createCoupleFn({ data: { coupleName, displayName } }),
    onSuccess: (res) => {
      saveMember({
        token: res.token,
        memberId: res.member.id,
        coupleId: res.couple.id,
        role: res.member.role,
        displayName: res.member.name,
        coupleName: res.couple.name,
        coupleCode: res.couple.code,
      })
      setCreated(res)
    },
  })

  if (created) return <Created session={created} />

  const ready = coupleName.trim().length > 0 && displayName.trim().length > 0

  return (
    <AppShell back="/">
      <PageTitle
        eyebrow="1 / 2 · Yeni çift"
        title="Önce kendinizi tanıtın"
        lead="Partnerinle eşleşmek için sana 6 haneli bir çift kodu vereceğiz. Kod yalnızca sizi buluşturur."
      />

      {member ? (
        <div className="mb-5">
          <Notice tone="warn" title="Bu cihazda zaten bir çiftin var">
            Yeni bir çift oluşturursan bu cihaz yeni çifte bağlanır.{' '}
            <Link to="/panel" className="font-semibold underline">
              Mevcut panele dön
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
          label="Çiftinize bir ad verin"
          hint="Sadece ikiniz göreceksiniz. Ör. “Biz”, “Ayşe & Fırat”, “Ev”"
          value={coupleName}
          onChange={setCoupleName}
          maxLength={LIMITS.coupleName}
          placeholder="Biz"
          autoCapitalize="words"
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
        <BottomBar>
          <Button type="submit" size="lg" full disabled={!ready} loading={mutation.isPending}>
            Çift kodumu oluştur <IconArrowRight size={18} />
          </Button>
        </BottomBar>
      </form>
    </AppShell>
  )
}

function Created({ session }: { session: SessionResult }) {
  const navigate = useNavigate()
  const [shareState, setShareState] = useState<'idle' | 'copied' | 'shared'>('idle')
  const code = session.couple.code

  const share = async () => {
    const msg = inviteMessage(code, window.location.origin, session.member.name)
    const r = await shareOrCopy(msg)
    if (r !== 'failed') setShareState(r)
  }

  return (
    <AppShell>
      <PageTitle
        eyebrow="2 / 2 · Kodunuz hazır"
        title={`Hoş geldin, ${session.member.name}.`}
        lead="Bu kodu partnerinle paylaş. O, kendi telefonundan “Partnerimin koduyla katıl” diyerek size katılacak."
      />
      <Card className="animate-rise space-y-5 text-center">
        <CodeTiles code={code} />
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button onClick={share} full>
            <IconShare size={18} /> Partnerime gönder
          </Button>
          <Button
            variant="secondary"
            full
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(code)
                setShareState('copied')
              } catch {
                /* yok say */
              }
            }}
          >
            <IconCopy size={18} /> Kodu kopyala
          </Button>
        </div>
        {shareState === 'copied' ? (
          <p className="text-sm text-sage">Kopyalandı. Şimdi partnerine gönderebilirsin.</p>
        ) : null}
        {shareState === 'shared' ? <p className="text-sm text-sage">Davet gönderildi.</p> : null}
      </Card>

      <div className="mt-6 space-y-3">
        <Notice tone="info" title="Kod bir şifre değildir">
          Çift kodu yalnızca sizi eşleştirmek içindir ve partnerin katıldıktan sonra başka kimseye kapı açmaz. Senin
          asıl anahtarın bu cihazda saklanır.
        </Notice>
      </div>

      <BottomBar>
        <Button size="lg" full variant="secondary" onClick={() => navigate({ to: '/panel' })}>
          Panele geç <IconArrowRight size={18} />
        </Button>
      </BottomBar>
    </AppShell>
  )
}
