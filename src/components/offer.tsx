import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { purchaseFn } from '~/functions/account'
import { getPanelFn } from '~/functions/couple'
import { parseError } from '~/lib/errors'
import { PLAN_LABEL, PLAN_PERIODS, formatPrice, yearlyDeal, type SalePeriod } from '~/lib/plans'
import type { MembershipView, PanelView } from '~/lib/views'
import { IconCheck, IconSparkle } from './icons'
import { SignInOptions } from './sign-in'
import { Button, Notice, Spinner, cx } from './ui'

const PLAN_NOTE: Record<SalePeriod, string> = {
  monthly: 'Düzenli olarak birlikte bakmak için',
  yearly: 'İlişkinizi uzun soluklu tanımak için',
}

const PER: Record<SalePeriod, string> = { monthly: '/ ay', yearly: '/ yıl' }

/** Aylık ve yıllık seçenekleri; yıllıkta indirim ve (varsa) ücretsiz deneme gösterilir. */
export function PlanPicker({
  membership: m,
  period,
  onChange,
}: {
  membership: MembershipView
  period: SalePeriod
  onChange: (p: SalePeriod) => void
}) {
  const deal = yearlyDeal(m.prices)
  const order: SalePeriod[] = ['yearly', ...PLAN_PERIODS.filter((p) => p !== 'yearly')]
  return (
    <div className="grid gap-3" role="radiogroup" aria-label="Üyelik süresi">
      {order.map((p) => {
        const price = m.prices[p]
        const yearly = p === 'yearly'
        return (
          <button
            key={p}
            type="button"
            role="radio"
            aria-checked={period === p}
            onClick={() => onChange(p)}
            className={cx(
              'relative flex items-center justify-between gap-3 rounded-2xl border p-4 text-left transition',
              period === p ? 'border-clay bg-clay-soft/50 shadow-soft' : 'border-line-strong bg-surface',
            )}
          >
            {yearly && deal?.savingPercent ? (
              <span className="absolute -top-2.5 left-4 rounded-full bg-clay px-2.5 py-0.5 text-[11px] font-semibold text-on-clay">
                En avantajlı · %{deal.savingPercent} indirim
              </span>
            ) : null}
            <span className="min-w-0">
              <span className="block font-semibold text-ink">{PLAN_LABEL[p]}</span>
              <span className="block text-[13px] text-ink-soft">
                {yearly && deal ? `Ayda yaklaşık ${formatPrice(deal.perMonth)}` : PLAN_NOTE[p]}
              </span>
              {yearly && m.trialAvailable ? (
                <span className="mt-1 inline-flex items-center gap-1 text-[13px] font-semibold text-sage">
                  <IconCheck size={14} /> İlk {m.trialDays} gün ücretsiz
                </span>
              ) : null}
            </span>
            <span className="shrink-0 text-right">
              {price ? (
                <>
                  <span className="block font-display text-lg font-semibold text-ink">{formatPrice(price)}</span>
                  <span className="block text-[12px] text-ink-faint">{PER[p]}</span>
                </>
              ) : (
                <span className="text-[13px] text-ink-faint">Fiyat yakında</span>
              )}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/** Plan seçimi + satın alma. Üyelik hesaba bağlanır; hesap kayıtlı değilse önce kaydedilir. */
export function PurchasePanel({ data, onPurchased }: { data: PanelView; onPurchased?: (m: MembershipView) => void }) {
  const m = data.membership
  const solo = data.couple.mode === 'solo'
  const qc = useQueryClient()
  const [period, setPeriod] = useState<SalePeriod>('yearly')
  const trial = period === 'yearly' && m.trialAvailable

  const buy = useMutation({
    mutationFn: () => purchaseFn({ data: { period, trial } }),
    onSuccess: async (next) => {
      await qc.invalidateQueries({ queryKey: ['panel'] })
      await qc.invalidateQueries({ queryKey: ['dispute'] })
      onPurchased?.(next)
    },
  })

  const yearlyPrice = m.prices.yearly
  const cta = trial
    ? `${m.trialDays} gün ücretsiz başlat`
    : m.active
      ? 'Üyeliği uzat'
      : `${PLAN_LABEL[period]} üyeliği başlat`

  return (
    <div className="space-y-4">
      <PlanPicker membership={m} period={period} onChange={setPeriod} />
      {trial && yearlyPrice ? (
        <p className="text-center text-[13px] leading-relaxed text-ink-soft">
          İlk {m.trialDays} gün ücretsiz, sonrasında yıllık {formatPrice(yearlyPrice)}. Deneme bitmeden iptal ederseniz
          ücret alınmaz.
        </p>
      ) : null}

      {buy.isError ? <Notice tone="error">{parseError(buy.error).message}</Notice> : null}

      {m.payments !== 'test' ? (
        <Notice tone="info" title="Ödeme altyapısı çok yakında">
          Üyelik satın alma henüz açılmadı. Açıldığında buradan aylık ya da yıllık üyelik başlatabileceksiniz.
        </Notice>
      ) : data.account.saved ? (
        <>
          <Button full size="lg" loading={buy.isPending} onClick={() => buy.mutate()}>
            <IconSparkle size={18} /> {cta}
          </Button>
          <p className="text-center text-[12px] text-ink-faint">
            Deneme modu: ödeme alınmaz, yalnızca akış denenir.
            {solo ? '' : ' Birinizin alması ikiniz için de yeterli.'}
          </p>
        </>
      ) : (
        <div className="space-y-3 rounded-2xl border border-line p-4">
          <p className="text-center text-sm leading-relaxed text-ink-soft">
            Üyeliğiniz hesabınıza bağlanır; cihaz değişse de kaybolmaz. Önce hesabınızı kaydedin:
          </p>
          <SignInOptions onLinked={() => {}} />
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Teklif ekranı
// ---------------------------------------------------------------------------

/**
 * resolved → ilk mesele tamamlandıktan sonra
 * continue → ücretsiz hak bittiyse, yeni meselede 1. sorudan sonra
 */
export type OfferVariant = 'resolved' | 'continue'

function offerCopy(variant: OfferVariant, m: MembershipView, solo: boolean) {
  const deal = yearlyDeal(m.prices)
  const perMonth = deal ? `ayda yaklaşık ${formatPrice(deal.perMonth)}` : null
  const both = solo ? '' : ' Birinizin alması ikiniz için de yeterli.'
  const trialLine = m.trialAvailable ? ` İlk ${m.trialDays} günü ücretsiz.` : ''
  switch (variant) {
    case 'resolved':
      return {
        eyebrow: 'Tebrikler',
        title: solo ? 'İlk meselenizi tamamladınız' : 'İlk meselenizi birlikte tamamladınız',
        lead: `Bir sonraki mesele geldiğinde hazır olun. Yıllık üyelik ${perMonth ?? 'en avantajlı seçenek'}.${trialLine}${both}`,
        dismiss: 'Şimdi değil',
      }
    case 'continue':
      return {
        eyebrow: 'Devam etmek için',
        title: 'Bu meseleye üyelikle devam edin',
        lead: `Anlattıklarınız kaydedildi. Ücretsiz meselenizi kullandığınız için devam etmek üzere aylık ya da yıllık üyelik gerekiyor.${trialLine}${both}`,
        dismiss: 'Şimdi değil',
      }
  }
}

/** Alttan açılan teklif ekranı. Panel verisini kendisi okur. */
export function OfferSheet({
  variant,
  onClose,
  onPurchased,
}: {
  variant: OfferVariant
  onClose: () => void
  onPurchased?: (m: MembershipView) => void
}) {
  const query = useQuery({ queryKey: ['panel'], queryFn: () => getPanelFn() })

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const data = query.data
  const copy = data ? offerCopy(variant, data.membership, data.couple.mode === 'solo') : null

  // Dönüşüm (animasyon) içeren kartların içinde "fixed" bozulmasın diye body'ye taşınır.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="presentation">
      <button type="button" aria-label="Kapat" className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="offer-title"
        className="relative max-h-[92dvh] w-full max-w-md animate-rise overflow-y-auto rounded-t-3xl bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-lift sm:rounded-3xl"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line sm:hidden" aria-hidden />
        {!data || !copy ? (
          <div className="flex justify-center py-10">
            {query.isError ? <Notice tone="error">{parseError(query.error).message}</Notice> : <Spinner />}
          </div>
        ) : (
          <div className="space-y-5">
            <div className="space-y-2 text-center">
              <span className="mx-auto inline-flex size-12 items-center justify-center rounded-full bg-honey-soft text-honey">
                <IconSparkle size={22} />
              </span>
              <p className="text-[12px] font-semibold tracking-[0.14em] text-clay-strong uppercase">{copy.eyebrow}</p>
              <h2 id="offer-title" className="text-[22px] leading-tight font-semibold">
                {copy.title}
              </h2>
              <p className="text-[15px] leading-relaxed text-ink-soft">{copy.lead}</p>
            </div>
            <PurchasePanel data={data} onPurchased={onPurchased} />
            <button
              type="button"
              onClick={onClose}
              className="block w-full py-2 text-center text-sm font-medium text-ink-faint hover:text-ink"
            >
              {copy.dismiss}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}

// ---------------------------------------------------------------------------
// "Gösterildi" bilgisi (yalnızca bu cihazda)
// ---------------------------------------------------------------------------

const seenKey = (name: string, memberId: string) => `mesele.teklif.${name}.v1:${memberId}`

export function offerSeen(name: string, memberId: string) {
  try {
    return window.localStorage.getItem(seenKey(name, memberId)) === '1'
  } catch {
    return false
  }
}

export function markOfferSeen(name: string, memberId: string) {
  try {
    window.localStorage.setItem(seenKey(name, memberId), '1')
  } catch {
    // depolama kapalıysa yok say
  }
}
