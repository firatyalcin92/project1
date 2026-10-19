import { useMutation } from '@tanstack/react-query'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { requestPerspectivesFn, requestReportsFn } from '~/functions/dispute'
import { parseError } from '~/lib/errors'
import { readMember } from '~/lib/member-token'
import { inviteMessage, shareOrCopy } from '~/lib/share'
import { dative, genitive } from '~/lib/turkish'
import type { DisputeView } from '~/lib/views'
import { LogoMark } from '../brand'
import { IconLeaf, IconShare } from '../icons'
import { Button, Card, Notice } from '../ui'

const TIPS = [
  'Tartışmadan sonra beden sakinleşmek için yaklaşık 20 dakikaya ihtiyaç duyar. Bu bekleyiş de bir mola sayılır.',
  'Öfke çoğu zaman bir bekçidir; arkasında kırgınlık ya da korku durur.',
  '“Sen hep…” yerine “Ben o an…” ile başlayan cümleler, kapıyı kapatmak yerine aralar.',
  'Bir döngüyü fark etmek, onu kırmanın yarısıdır.',
  'Haklı çıkmak ile yakın kalmak arasında seçim yapmak zorunda değilsiniz.',
]

function useRotating<T>(items: readonly T[], ms: number) {
  const [i, setI] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % items.length), ms)
    return () => clearInterval(t)
  }, [items.length, ms])
  return items[i]!
}

/** Kendi adımını bitirmiş, partnerini bekleyen kişi için. */
export function WaitingForPartner({ view, children }: { view: DisputeView; children?: ReactNode }) {
  const tip = useRotating(TIPS, 9000)
  const [note, setNote] = useState<string | null>(null)
  const partner = view.partner?.name
  const phase = view.step === 1 ? 'anlatmasını' : 'yeniden değerlendirmesini'

  // Partner henüz katılmadı: tek iş, onu davet etmek.
  if (!partner) return <InviteNow view={view} />

  return (
    <div className="space-y-5">
      <Card className="animate-rise space-y-4 py-8 text-center">
        <div className="mx-auto flex size-20 items-center justify-center">
          <LogoMark size={72} className="animate-breathe" />
        </div>
        <h2 className="text-[22px] font-semibold">
          {view.step === 1 ? 'Anlattınız. Teşekkürler.' : 'Yeniden düşündünüz. Teşekkürler.'}
        </h2>
        <p className="mx-auto max-w-sm leading-relaxed text-ink-soft">
          {`${genitive(partner)} ${phase} bekliyoruz. Hazır olduğunda size haber vereceğiz.`}
        </p>
        <Button
          variant="secondary"
          className="mx-auto"
          onClick={async () => {
            const r = await shareOrCopy({
              title: 'MESELE',
              text: `MESELE’de seni bekleyen bir mesele var: “${view.title}”. Hazır olduğunda kendi tarafını anlatır mısın?`,
              url: `${window.location.origin}/mesele/${view.id}`,
            })
            setNote(r === 'copied' ? 'Mesaj panoya kopyalandı.' : r === 'shared' ? 'Hatırlatma gönderildi.' : null)
          }}
        >
          <IconShare size={18} /> Nazikçe hatırlatın
        </Button>
        {note ? <p className="text-sm text-sage">{note}</p> : null}
      </Card>

      <div className="flex gap-3 rounded-2xl bg-sage-soft px-4 py-3 text-[15px] leading-relaxed text-ink">
        <IconLeaf size={20} className="mt-0.5 shrink-0 text-sage" />
        <p key={tip} className="animate-rise">
          {tip}
        </p>
      </div>
      {children}
    </div>
  )
}

/** İlk anlatan bitirdi, partner henüz katılmadı: davet linkini gönder. */
function InviteNow({ view }: { view: DisputeView }) {
  const code = readMember()?.coupleCode ?? ''
  const [note, setNote] = useState<string | null>(null)
  const name = view.partnerName ?? 'Partneriniz'
  return (
    <Card className="animate-rise space-y-5 py-8 text-center">
      <div className="mx-auto flex size-20 items-center justify-center">
        <LogoMark size={72} />
      </div>
      <div className="space-y-2">
        <h2 className="text-[22px] font-semibold">Şimdi sıra {genitive(name)}</h2>
        <p className="mx-auto max-w-sm leading-relaxed text-ink-soft">
          Davet linkini gönderin; {name} kendi tarafını anlatsın. Yalnızca olay anlatımınızı görecek.
        </p>
      </div>
      <Button
        full
        size="lg"
        disabled={!code}
        onClick={async () => {
          const r = await shareOrCopy(inviteMessage(code, window.location.origin, view.me.name))
          setNote(r === 'copied' ? 'Davet panoya kopyalandı.' : r === 'shared' ? 'Davet gönderildi.' : null)
        }}
      >
        <IconShare size={18} /> {dative(name)} gönder
      </Button>
      <p className="text-[13px] text-ink-faint">{note ?? `Davet kodu: ${code}`}</p>
    </Card>
  )
}

const MESSAGES = {
  perspectives: [
    'İkinizin anlattıklarını dikkatle okuyoruz…',
    'Görünen tepkilerin altındaki duyguları arıyoruz…',
    'Birbirinizin gözünden bakabilmeniz için hazırlıyoruz…',
  ],
  reports: [
    'Döngünüzün haritasını çıkarıyoruz…',
    'İkinizin de haklı olduğu yerleri buluyoruz…',
    'Onarım cümlelerinizi seçiyoruz…',
    'Size özel raporunuzu hazırlıyoruz…',
  ],
} as const

/**
 * AI üretimini tetikler ve beklerken nefes egzersizi gösterir.
 * İki partner aynı anda bu ekrandaysa ikisi de tetikler; sunucudaki atomik
 * kilit (claimStatus) yalnızca birinin AI çağrısı yapmasına izin verir.
 */
export function Generating({
  view,
  kind,
  onView,
}: {
  view: DisputeView
  kind: 'perspectives' | 'reports'
  onView: (v: DisputeView) => void
}) {
  const message = useRotating(MESSAGES[kind], 4500)
  const triggered = useRef(false)
  const mutation = useMutation({
    mutationFn: () =>
      (kind === 'perspectives' ? requestPerspectivesFn : requestReportsFn)({ data: { disputeId: view.id } }),
    onSuccess: onView,
  })

  const ready =
    kind === 'perspectives' ? view.status === 'both_answers_completed' : view.status === 'reconsideration_completed'
  const shouldTrigger = ready || view.generation.stale

  useEffect(() => {
    // Bir hata olduysa kendiliğinden yeniden deneme: geçersiz anahtar ya da kesinti
    // durumunda AI'ye döngü hâlinde istek atmayalım. Kullanıcı "Tekrar dene"ye basar.
    if (shouldTrigger && !triggered.current && !mutation.isPending && !mutation.isError) {
      triggered.current = true
      mutation.mutate()
    }
    if (!shouldTrigger) triggered.current = false
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldTrigger])

  return (
    <Card className="animate-rise space-y-6 py-10 text-center">
      <div className="relative mx-auto size-40" aria-hidden>
        <span
          className="absolute inset-0 rounded-full bg-clay-soft"
          style={{ animation: 'breath-cycle 10s ease-in-out infinite' }}
        />
        <span
          className="absolute inset-6 rounded-full bg-partner-b-soft"
          style={{ animation: 'breath-cycle 10s ease-in-out infinite', animationDelay: '-0.6s' }}
        />
        <span className="absolute inset-0 flex items-center justify-center">
          <LogoMark size={56} />
        </span>
      </div>
      <div className="space-y-2" aria-live="polite">
        <p key={mutation.isError ? 'error' : message} className="animate-rise font-display text-xl font-semibold">
          {mutation.isError ? 'Kısa bir duraklama oldu' : message}
        </p>
        <p className="text-sm text-ink-soft">Bu arada birlikte nefes alın: 4 saniye içinize çekin, 6 saniye bırakın.</p>
        {mutation.isError ? null : <p className="text-[13px] text-ink-faint">Genellikle bir dakikadan kısa sürer.</p>}
      </div>
      {mutation.isError ? (
        <div className="space-y-3 text-left">
          <Notice tone="error">{parseError(mutation.error).message}</Notice>
          <Button
            variant="secondary"
            full
            onClick={() => {
              triggered.current = true
              mutation.mutate()
            }}
          >
            Tekrar dene
          </Button>
        </div>
      ) : null}
    </Card>
  )
}
