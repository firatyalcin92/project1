import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { submitSurveyFn } from '~/functions/dispute'
import { parseError } from '~/lib/errors'
import type { DisputeView } from '~/lib/views'
import { Button, Card, Notice, cx } from './ui'

type Recommend = 'evet' | 'belki' | 'hayir'

/** Rapordan sonra 3 soruluk kısa anket (test sürümünün sonuçları için). */
export function SurveyCard({ view, onView }: { view: DisputeView; onView: (v: DisputeView) => void }) {
  const [rating, setRating] = useState<number | null>(null)
  const [again, setAgain] = useState<boolean | null>(null)
  const [recommend, setRecommend] = useState<Recommend | null>(null)
  const send = useMutation({
    mutationFn: () =>
      submitSurveyFn({ data: { disputeId: view.id, rating: rating!, again: again!, recommend: recommend! } }),
    onSuccess: onView,
  })

  if (view.survey) {
    return (
      <Card className="text-center">
        <p className="font-semibold">Görüşleriniz için teşekkür ederiz 🙏</p>
        <p className="mt-1 text-sm text-ink-soft">MESELE’yi sizin geri bildirimlerinizle geliştiriyoruz.</p>
      </Card>
    )
  }

  const option = (selected: boolean, label: string, onClick: () => void) => (
    <button
      key={label}
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cx(
        'min-h-11 flex-1 rounded-full border px-4 text-[15px] font-medium transition',
        selected ? 'border-clay bg-clay text-on-clay' : 'border-line-strong bg-surface text-ink hover:border-clay',
      )}
    >
      {label}
    </button>
  )

  return (
    <Card className="space-y-5 border-honey/40">
      <div>
        <p className="font-display text-xl font-semibold">Son olarak, 3 kısa soru</p>
        <p className="mt-1 text-sm text-ink-soft">Uygulamayı test ediyoruz; cevaplarınız çok değerli.</p>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-[15px] font-semibold">1. Uygulamamızı beğendiniz mi?</legend>
        <div className="flex gap-1" role="radiogroup" aria-label="Puan">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={rating === n}
              aria-label={`${n} yıldız`}
              onClick={() => setRating(n)}
              className={cx(
                'text-[34px] leading-none transition',
                rating !== null && n <= rating ? 'text-honey' : 'text-line-strong',
              )}
            >
              ★
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-[15px] font-semibold">2. Uygulamamızı tekrar kullanmak ister misiniz?</legend>
        <div className="flex gap-2">
          {option(again === true, 'Evet', () => setAgain(true))}
          {option(again === false, 'Hayır', () => setAgain(false))}
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-[15px] font-semibold">3. Bir arkadaşınıza önerir misiniz?</legend>
        <div className="flex gap-2">
          {option(recommend === 'evet', 'Evet', () => setRecommend('evet'))}
          {option(recommend === 'belki', 'Belki', () => setRecommend('belki'))}
          {option(recommend === 'hayir', 'Hayır', () => setRecommend('hayir'))}
        </div>
      </fieldset>

      {send.isError ? <Notice tone="error">{parseError(send.error).message}</Notice> : null}
      <Button
        full
        disabled={rating === null || again === null || recommend === null}
        loading={send.isPending}
        onClick={() => send.mutate()}
      >
        Gönder
      </Button>
    </Card>
  )
}
