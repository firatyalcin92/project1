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
import { copyText } from '~/lib/native'
import { LIMITS } from '~/lib/questions'
import { inviteMessage, shareOrCopy } from '~/lib/share'
import type { SessionResult } from '~/lib/views'

export const Route = createFileRoute('/olustur')({
  validateSearch: (search: Record<string, unknown>): { mod?: 'bireysel' } =>
    search.mod === 'bireysel' ? { mod: 'bireysel' } : {},
  head: () => ({ meta: [{ title: 'Başlayalım — MESELE' }] }),
  component: CreateCouple,
})

function CreateCouple() {
  const member = useMember()
  const navigate = useNavigate()
  const solo = Route.useSearch().mod === 'bireysel'
  const [coupleName, setCoupleName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [partnerName, setPartnerName] = useState('')
  const [created, setCreated] = useState<SessionResult | null>(null)

  const mutation = useMutation({
    mutationFn: () =>
      createCoupleFn({
        data: solo
          ? { mode: 'solo', coupleName: '', displayName, partnerName }
          : { mode: 'couple', coupleName, displayName },
      }),
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
      if (res.couple.mode === 'solo') void navigate({ to: '/panel' })
      else setCreated(res)
    },
  })

  if (created) return <Created session={created} />

  const ready = solo
    ? displayName.trim().length > 0 && partnerName.trim().length > 0
    : coupleName.trim().length > 0 && displayName.trim().length > 0

  return (
    <AppShell back="/">
      {solo ? (
        <PageTitle
          eyebrow="Bireysel danışma"
          title="Tek başınıza da başlayabilirsiniz"
          lead="Eşiniz uygulamayı kullanmasa da yaşadığınız tartışmayı anlatın; danışman size özel bir yol haritası hazırlasın."
        />
      ) : (
        <PageTitle
          eyebrow="1 / 2 · Yeni çift"
          title="Önce kendinizi tanıtın"
          lead="Partnerinizle eşleşmek için size 6 haneli bir çift kodu vereceğiz. Kod yalnızca sizi buluşturur."
        />
      )}

      {member ? (
        <div className="mb-5">
          <Notice tone="warn" title="Bu cihazda zaten bir hesabınız var">
            Yeni bir hesap oluşturursanız bu cihaz yenisine bağlanır.{' '}
            <Link to="/panel" className="font-semibold underline">
              Mevcut panele dönün
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
        {solo ? null : (
          <TextField
            label="Çiftinize bir ad verin"
            hint="Sadece ikiniz göreceksiniz. Ör. “Biz”, “Ayşe & Fırat”, “Ev”"
            value={coupleName}
            onChange={setCoupleName}
            maxLength={LIMITS.coupleName}
            placeholder="Biz"
            autoCapitalize="words"
          />
        )}
        <TextField
          label="Adınız"
          hint={solo ? 'Danışman size bu adla seslenecek.' : 'Partneriniz sizi bu adla görecek.'}
          value={displayName}
          onChange={setDisplayName}
          maxLength={LIMITS.displayName}
          placeholder="Adınız"
          autoCapitalize="words"
          autoComplete="given-name"
        />
        {solo ? (
          <TextField
            label="Eşinizin / partnerinizin adı"
            hint="Sorular ve rapor onun adıyla kişiselleşir. Ona hiçbir şey gönderilmez."
            value={partnerName}
            onChange={setPartnerName}
            maxLength={LIMITS.displayName}
            placeholder="Eşinizin adı"
            autoCapitalize="words"
          />
        ) : null}
        {mutation.isError ? <Notice tone="error">{parseError(mutation.error).message}</Notice> : null}
        <BottomBar>
          <Button type="submit" size="lg" full disabled={!ready} loading={mutation.isPending}>
            {solo ? 'Başlayalım' : 'Çift kodumu oluştur'} <IconArrowRight size={18} />
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
        title={`Hoş geldiniz, ${session.member.name}.`}
        lead="Bu kodu partnerinizle paylaşın. O, kendi telefonundan “Partnerimin koduyla katıl” diyerek size katılacak."
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
              if (await copyText(code)) setShareState('copied')
            }}
          >
            <IconCopy size={18} /> Kodu kopyala
          </Button>
        </div>
        {shareState === 'copied' ? (
          <p className="text-sm text-sage">Kopyalandı. Şimdi partnerinize gönderebilirsiniz.</p>
        ) : null}
        {shareState === 'shared' ? <p className="text-sm text-sage">Davet gönderildi.</p> : null}
      </Card>

      <div className="mt-6 space-y-3">
        <Notice tone="info" title="Kod bir şifre değildir">
          Çift kodu yalnızca sizi eşleştirmek içindir ve partneriniz katıldıktan sonra başka kimseye kapı açmaz. Sizin
          asıl anahtarınız bu cihazda saklanır.
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
