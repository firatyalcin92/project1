import '@tanstack/react-start/server-only'
import { createHash, timingSafeEqual } from 'node:crypto'
import { betaStatus, istanbulDayStart } from './beta.server'
import { fail } from './errors.server'
import { getStore } from './store.server'

/**
 * Yönetim sayacı (/yonetim): test sürümünün sonuçları. MESELE_ADMIN_PASSWORD
 * tanımlı değilse kapalıdır. Kişisel içerik (cevaplar, raporlar) asla dönmez.
 */

function checkPassword(given: string) {
  const expected = process.env.MESELE_ADMIN_PASSWORD?.trim()
  if (!expected) fail('CONFIG', 'Yönetim sayfası kapalı: MESELE_ADMIN_PASSWORD tanımlanmamış.')
  const h = (v: string) => createHash('sha256').update(v).digest()
  if (!timingSafeEqual(h(given), h(expected!))) fail('UNAUTHORIZED', 'Şifre hatalı.')
}

const tag = (tags: readonly string[], k: string) => tags.find((t) => t.startsWith(`${k}:`))?.slice(k.length + 1)

export async function adminStats(password: string) {
  checkPassword(password)
  const store = await getStore()
  const snap = await store.adminSnapshot()
  const today = istanbulDayStart()

  const withPartner = new Set(snap.members.filter((m) => m.role === 'B').map((m) => m.couple_id))
  const solo = new Set(snap.couples.filter((c) => c.mode === 'solo').map((c) => c.id))
  const coupleDisputes = snap.disputes.filter((d) => !solo.has(d.couple_id))
  const completed = snap.disputes.filter((d) => d.status === 'completed')

  const surveys = snap.surveys
    .map((s) => ({
      rating: Number(tag(s.selected_tags, 'puan')),
      again: tag(s.selected_tags, 'tekrar') === 'evet',
      recommend: tag(s.selected_tags, 'oneri') ?? '',
      at: s.updated_at,
    }))
    .filter((s) => s.rating >= 1 && s.rating <= 5)
    .sort((a, b) => b.at.localeCompare(a.at))
  const pct = (n: number, of: number) => (of ? Math.round((n / of) * 100) : 0)

  // Son 14 gün: gün gün açılan mesele sayısı
  const days: { day: string; count: number }[] = []
  for (let i = 13; i >= 0; i--) {
    const start = istanbulDayStart(Date.now() - i * 86_400_000)
    const end = istanbulDayStart(Date.now() - (i - 1) * 86_400_000)
    days.push({
      day: new Date(Date.parse(start) + 3 * 3_600_000).toISOString().slice(0, 10),
      count: snap.disputes.filter((d) => d.created_at >= start && d.created_at < end).length,
    })
  }

  return {
    beta: await betaStatus(),
    disputes: {
      total: snap.disputes.length,
      today: snap.disputes.filter((d) => d.created_at >= today).length,
      couple: coupleDisputes.length,
      solo: snap.disputes.length - coupleDisputes.length,
      partnerJoined: coupleDisputes.filter((d) => withPartner.has(d.couple_id)).length,
      completed: completed.length,
    },
    survey: {
      count: surveys.length,
      avgRating: surveys.length
        ? Math.round((surveys.reduce((a, s) => a + s.rating, 0) / surveys.length) * 10) / 10
        : 0,
      againPercent: pct(surveys.filter((s) => s.again).length, surveys.length),
      recommend: {
        evet: surveys.filter((s) => s.recommend === 'evet').length,
        belki: surveys.filter((s) => s.recommend === 'belki').length,
        hayir: surveys.filter((s) => s.recommend === 'hayir').length,
      },
      latest: surveys.slice(0, 50),
    },
    days,
  }
}
