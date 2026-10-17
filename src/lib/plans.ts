/**
 * Üyelik planları. Bir mesele ücretsizdir; sonrası için aylık ya da yıllık üyelik gerekir.
 * Üyelik ÇİFT düzeyindedir: çiftlerden birinin alması ikisine de yeter.
 * Fiyatlar varsayılan olarak aşağıdadır; sunucu ortam değişkenleri (MESELE_PRICE_MONTHLY,
 * MESELE_PRICE_YEARLY) bunları geçersiz kılar. Yıllık üyelik bir kez 3 gün ücretsiz denenebilir.
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

/** Varsayılan fiyatlar (TL) */
export const DEFAULT_PRICES: Record<SalePeriod, number> = { monthly: 249, yearly: 1999 }

/** Yıllık üyeliğin ücretsiz deneme süresi (gün); çift başına bir kez */
export const TRIAL_DAYS = 3

/** "1.999 ₺", "249,90 TL", "1999" → sayı; okunamazsa null */
export function parsePrice(raw: string | undefined | null): number | null {
  if (!raw?.trim()) return null
  const n = Number(raw.replace(/[^\d.,]/g, '').replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null
}

/** 1999 → "1.999 ₺" */
export function formatPrice(n: number) {
  return `${n.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} ₺`
}

/** Yıllığın aylık karşılığı ve aylığa göre indirimi */
export function yearlyDeal(prices: Record<SalePeriod, number | null>) {
  const { monthly, yearly } = prices
  if (!yearly) return null
  return {
    perMonth: Math.round(yearly / 12),
    savingPercent: monthly ? Math.max(0, Math.round((1 - yearly / (monthly * 12)) * 100)) : null,
  }
}

export function addPeriod(fromIso: string, period: PlanPeriod) {
  return new Date(Date.parse(fromIso) + PLAN_DAYS[period] * 86_400_000).toISOString()
}

export function addDays(fromIso: string, days: number) {
  return new Date(Date.parse(fromIso) + days * 86_400_000).toISOString()
}

/** Ödeme altyapısı: none → satın alma kapalı; test → ödeme alınmadan etkinleşir (yalnızca deneme için). */
export type PaymentMode = 'none' | 'test'
