import { useMutation } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { CodeTiles } from '~/components/code-tiles'
import { IconArrowRight, IconCopy, IconShield, IconShare } from '~/components/icons'
import { KeyBackup } from '~/components/key-backup'
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
  const [displayName, setDisplayName] = useState('')
  const [partnerName, setPartnerName] = useState('')
  const [created, setCreated] = useState<SessionResult | null>(null)
  const [backupStep, setBackupStep] = useState(false)

  const mutation = useMutation({
    mutationFn: () =>
      createCoupleFn({
        data: { mode: solo ? 'solo' : 'couple', displayName, partnerName },
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
      if (res.couple.mode === 'solo') setBackupStep(true)
      else setCreated(res)
    },
  })

  if (backupStep) {
    return (
      <AppShell>
        <PageTitle
          eyebrow={solo ? 'Son adım' : '3 / 3 · Son adım'}
          title="Cihaz anahtarınızı yedekleyin"
          lead="Telefonunuzu değiştirirseniz ya da uygulamayı silerseniz kayıtlarınıza bu anahtarla dönersiniz."
        />
        <KeyBackup solo={solo} onDone={() => navigate({ to: '/panel' })} />
      </AppShell>
    )
  }

  if (created) return <Created session={created} onNext={() => setBackupStep(true)} />

  const ready = displayName.trim().length > 0 && partnerName.trim().length > 0

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
          eyebrow="1 / 3 · Yeni çift"
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
        <TextField
          label={solo ? 'Eşinizin / partnerinizin adı' : 'Partnerinizin adı'}
          hint={
            solo
              ? 'Sorular ve rapor onun adıyla kişiselleşir. Ona hiçbir şey gönderilmez.'
              : 'Sorular onun adıyla kişiselleşir. Partneriniz katılırken kendi adını yazacak.'
          }
          value={partnerName}
          onChange={setPartnerName}
          maxLength={LIMITS.displayName}
          placeholder="Partnerinizin adı"
          autoCapitalize="words"
        />
        {mutation.isError ? <Notice tone="error">{parseError(mutation.error).message}</Notice> : null}
        <div className="flex gap-2.5 rounded-2xl border border-line bg-sunken px-4 py-3 text-[13px] leading-relaxed text-ink-soft">
          <IconShield size={18} className="mt-0.5 shrink-0" />
          <p>
            E-posta, telefon ya da şifre istemiyoruz; takma ad da kullanabilirsiniz. Cevaplarınız size
            {solo ? '' : ' ve partnerinize'} özeldir, üçüncü kişilerle paylaşılmaz.{' '}
            <Link to="/gizlilik" className="font-semibold text-clay-strong underline-offset-4 hover:underline">
              Gizlilik
            </Link>
            <br />
            İlk mesele ücretsiz; sonrası için aylık ya da yıllık üyelik.
            {solo ? '' : ' Birinizin alması ikiniz için de yeterli.'}
          </p>
        </div>
        <BottomBar>
          <Button type="submit" size="lg" full disabled={!ready} loading={mutation.isPending}>
            {solo ? 'Başlayalım' : 'Çift kodumu oluştur'} <IconArrowRight size={18} />
          </Button>
        </BottomBar>
      </form>
    </AppShell>
  )
}

function Created({ session, onNext }: { session: SessionResult; onNext: () => void }) {
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
        eyebrow="2 / 3 · Kodunuz hazır"
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

      <div className="mt-4 rounded-2xl border border-line bg-sunken px-4 py-3 text-[14px] leading-relaxed text-ink-soft">
        <p className="font-semibold text-ink">Önce siz mi anlatmak istersiniz?</p>
        <p className="mt-1">
          Kodu şimdi paylaşmak zorunda değilsiniz. İlk meseleyi önce siz anlatın; bitirdiğinizde kodu partnerinizle
          paylaşmanızı hatırlatacağız. Kod panelde de her zaman duruyor.
        </p>
      </div>

      <BottomBar>
        <Button size="lg" full onClick={onNext}>
          {shareState === 'idle' ? 'Önce ben ilerleyeyim' : 'Devam: anahtarımı yedekle'}{' '}
          <IconArrowRight size={18} />
        </Button>
        {shareState === 'idle' ? (
          <p className="mt-2 text-center text-[12px] text-ink-faint">Kodu sonra paylaşırsınız · sıradaki adım: anahtar yedeği</p>
        ) : null}
      </BottomBar>
    </AppShell>
  )
}
