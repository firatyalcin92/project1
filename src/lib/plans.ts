/**
 * Üyelik planları. Bir mesele ücretsizdir; sonrası için haftalık, aylık ya da yıllık
 * üyelik gerekir. Üyelik ÇİFT düzeyindedir: çiftlerden birinin alması ikisine de yeter.
 * Fiyatlar sunucu ortam değişkenlerinden gelir (MESELE_PRICE_WEEKLY vb.).
 */

export const FREE_DISPUTES = 1

export type PlanPeriod = 'weekly' | 'monthly' | 'yearly'

export const PLAN_PERIODS: readonly PlanPeriod[] = ['weekly', 'monthly', 'yearly']

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
