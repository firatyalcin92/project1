/**
 * Üyelik planları. Bir mesele ücretsizdir; sonrası için aylık ya da yıllık üyelik gerekir.
 * Üyelik ÇİFT düzeyindedir: çiftlerden birinin alması ikisine de yeter.
 * Fiyatlar sunucu ortam değişkenlerinden gelir (MESELE_PRICE_MONTHLY, MESELE_PRICE_YEARLY).
 */

export const FREE_DISPUTES = 1

/** Kayıtlı üyeliklerin süresi. 'weekly' artık satılmıyor; eski kayıtlar için tutulur. */
export type PlanPeriod = 'weekly' | 'monthly' | 'yearly'

/** Satın alınabilen süreler */
export type SalePeriod = 'monthly' | 'yearly'

export const PLAN_PERIODS: readonly SalePeriod[] = ['monthly', 'yearly']

export const PLAN_LABEL: Record<PlanPeriod, string> = {
  weekly: 'Haftalık',
  monthly: 'Aylık',
  yearly: 'Yıllık',
}

export const PLAN_DAYS: Record<PlanPeriod, number> = { weekly: 7, monthly: 30, yearly: 365 }

export function addPeriod(fromIso: string, period: PlanPeriod) {
  return new Date(Date.parse(fromIso) + PLAN_DAYS[period] * 86_400_000).toISOString()
}

/** Ödeme altyapısı: none → satın alma kapalı; test → ödeme alınmadan etkinleşir (yalnızca deneme için). */
export type PaymentMode = 'none' | 'test'
