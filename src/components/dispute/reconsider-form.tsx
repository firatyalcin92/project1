import { useMutation } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { saveReconsiderationFn } from '~/functions/dispute'
import { parseError } from '~/lib/errors'
import { CLOSENESS_LABELS, LIMITS, RECONSIDER_QUESTIONS, type ReflectionId } from '~/lib/questions'
import { alsoAfter, dative, genitive } from '~/lib/turkish'
import type { DisputeView } from '~/lib/views'
import { IconArrowLeft } from '../icons'
import { BottomBar } from '../layout'
import { Button, Notice, TextArea, cx } from '../ui'

type Items = Record<ReflectionId, { text: string }>

export function ReconsiderForm({
  view,
  onView,
  onBack,
  startWithObjection = false,
}: {
  view: DisputeView
  onView: (v: DisputeView) => void
  onBack: () => void
  /** "İtirazım var" ile gelindiyse itiraz alanı açık ve en üstte başlar */
  startWithObjection?: boolean
}) {
  const partner = view.partner?.name ?? 'Partnerin'
  const [items, setItems] = useState<Items>(view.myReconsideration.items)
  const [closeness, setCloseness] = useState<number | null>(view.myReconsideration.closeness)
  const [confirming, setConfirming] = useState(false)
  const [objectionOpen, setObjectionOpen] = useState(
    () => startWithObjection || Boolean(view.myReconsideration.items.itiraz?.text.trim()),
  )
  const chain = useRef<Promise<unknown>>(Promise.resolve())

  const save = useMutation({
    mutationFn: (submit: boolean) => {
      const payload = {
        disputeId: view.id,
        items: RECONSIDER_QUESTIONS.map((q) => ({ id: q.id, text: items[q.id]?.text ?? '' })),
        closeness,
        submit,
      }
      const run = chain.current.catch(() => {}).then(() => saveReconsiderationFn({ data: payload }))
      chain.current = run
      return run
    },
    // Taslak kaydında da görünüm güncellenir: geri dönüp gelince yazılanlar kaybolmaz.
    onSuccess: (v) => onView(v),
  })

  const set = (id: ReflectionId, patch: Partial<Items[ReflectionId]>) =>
    setItems((s) => ({ ...s, [id]: { ...s[id], ...patch } }))

  const complete = RECONSIDER_QUESTIONS.every((q) => !q.required || (items[q.id]?.text.trim().length ?? 0) >= 3)

  return (
    <div className="space-y-6">
      <div className="animate-rise space-y-2">
        <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-clay-strong">
          3. Adım · Yeniden Değerlendir
        </p>
        <h2 className="text-[24px] leading-snug font-semibold">Okuduktan sonra içinizde ne değişti?</h2>
        <p className="leading-relaxed text-ink-soft">
          Haklı ya da haksız aramadan, sadece fark ettiklerinizi yazın. Yazdıklarınız {dative(partner)} olduğu gibi
          gösterilmez; danışman bunları çözüm raporunuzda ihtiyaç diliyle kullanır.
        </p>
        <p className="rounded-2xl bg-sunken px-3.5 py-2.5 text-[13px] leading-relaxed text-ink-soft">
          Geriye dönüp {genitive(partner)} gözünden metne tekrar bakabilirsiniz; bu ekranda yazdıklarınız silinmez.
        </p>
      </div>

      {RECONSIDER_QUESTIONS.map((q) =>
        q.objection ? (
          <section key={q.id} className="space-y-2.5 rounded-2xl border border-honey/40 bg-honey-soft/50 p-4">
            {objectionOpen ? (
              <>
                <label className="block text-[16px] leading-snug font-semibold text-ink" htmlFor={`r-${q.id}`}>
                  İtirazım var
                </label>
                <p className="text-[15px] leading-relaxed text-ink">{q.prompt(partner)}</p>
                {q.helper ? <p className="text-[13px] leading-relaxed text-ink-soft">{q.helper}</p> : null}
                <TextArea
                  id={`r-${q.id}`}
                  value={items[q.id]?.text ?? ''}
                  onChange={(v) => set(q.id, { text: v })}
                  onBlur={() => save.mutate(false)}
                  maxLength={LIMITS.reflection}
                  minRows={3}
                  placeholder={q.placeholder}
                />
              </>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <p className="text-[14px] leading-snug text-ink-soft">
                  Metinde katılmadığınız ya da yanlış anlaşılan bir şey mi var?
                </p>
                <Button variant="secondary" size="sm" onClick={() => setObjectionOpen(true)}>
                  İtirazım var
                </Button>
              </div>
            )}
          </section>
        ) : (
          <section key={q.id} className="space-y-2.5">
            <label className="block text-[16px] leading-snug font-semibold text-ink" htmlFor={`r-${q.id}`}>
              {q.prompt(partner)}
              {!q.required ? <span className="ml-1 text-sm font-normal text-ink-faint">(isteğe bağlı)</span> : null}
            </label>
            <TextArea
              id={`r-${q.id}`}
              value={items[q.id]?.text ?? ''}
              onChange={(v) => set(q.id, { text: v })}
              onBlur={() => save.mutate(false)}
              maxLength={LIMITS.reflection}
              minRows={3}
              placeholder={q.placeholder}
            />
          </section>
        ),
      )}

      <section className="space-y-3">
        <p className="text-[16px] font-semibold">Şu an kendinizi {dative(partner)} ne kadar yakın hissediyorsunuz?</p>
        <div className="grid grid-cols-5 gap-1.5" role="radiogroup" aria-label="Yakınlık">
          {CLOSENESS_LABELS.map((label, i) => (
            <button
              key={label}
              type="button"
              role="radio"
              aria-checked={closeness === i + 1}
              onClick={() => setCloseness(i + 1)}
              className={cx(
                'flex min-h-14 flex-col items-center justify-center rounded-2xl border px-1 text-[12px] leading-tight font-medium transition',
                closeness === i + 1
                  ? 'border-clay bg-clay text-on-clay'
                  : 'border-line-strong bg-surface text-ink-soft',
              )}
            >
              <span className="text-base font-semibold tabular-nums">{i + 1}</span>
              {label}
            </button>
          ))}
        </div>
        <p className="text-[13px] text-ink-faint">Bu puan size özel raporunuzda kullanılır.</p>
      </section>

      {save.isError ? <Notice tone="error">{parseError(save.error).message}</Notice> : null}

      <BottomBar>
        {confirming ? (
          <div className="space-y-3">
            <p className="text-center text-sm text-ink-soft">
              Gönderdikten sonra değiştiremezsiniz. {genitive(partner)} {alsoAfter(genitive(partner))} tamamlamasıyla
              çözüm raporunuz hazırlanacak.
            </p>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setConfirming(false)}>
                Bir daha bakayım
              </Button>
              <Button full loading={save.isPending} onClick={() => save.mutate(true)}>
                Evet, gönder
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button
              variant="secondary"
              aria-label={`${genitive(partner)} gözünden metne dön`}
              onClick={() => {
                save.mutate(false)
                onBack()
              }}
            >
              <IconArrowLeft size={18} />
            </Button>
            <Button full size="lg" disabled={!complete} onClick={() => setConfirming(true)}>
              Yeniden değerlendirmemi gönder
            </Button>
          </div>
        )}
      </BottomBar>
    </div>
  )
}
