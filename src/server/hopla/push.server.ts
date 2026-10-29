import '@tanstack/react-start/server-only'
import { flagEmoji } from '../../../hopla/core/countries'
import type { HoplaStore, PushTarget } from './store.server'

/**
 * Hopdog bildirimleri (Expo push servisi, ücretsiz; anahtar gerekmez).
 *
 *  - Rekorun geçildi: dünya/ülke birincisi tahtını kaybedince ya da bir oyuncu tarafından geçilince.
 *    Aynı kişiye günde en fazla bir, oyuna girmeden en fazla iki bildirim gider (rahatsız etmesin).
 *  - Haftalık: pazar akşamı her ülkede haftanın birincisi duyurulur (GitHub Actions zamanlayıcısı).
 */

const EXPO_PUSH = 'https://exp.host/--/api/v2/push/send'
/** Oyuna girmeden gönderilecek en fazla "geçildin" bildirimi */
export const MAX_UNSEEN = 2

type Lang = 'tr' | 'en'
const lang = (l: string | null): Lang => (l === 'tr' ? 'tr' : 'en')
const pick = <T>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)]!

export function countryLabel(code: string, l: Lang) {
  let name = code
  try {
    name = new Intl.DisplayNames([l], { type: 'region' }).of(code) ?? code
  } catch {
    // ICU yoksa kod
  }
  return `${flagEmoji(code)} ${name}`
}

type Kind = 'world' | 'country' | 'passed'

/** Sempatik "goygoy" metinleri: {n} geçen oyuncu, {s} skoru, {c} ülke */
const TEXTS: Record<Lang, Record<Kind, readonly string[]>> = {
  tr: {
    world: [
      '{n} senin dünya rekorunu geçti! Bu da ne demek? 🌍',
      'Dünya tahtı sallanıyor: {n} {s} yaptı ve rekor artık onun. Geri al! 👑',
      '{n} dünya rekorunu senden aldı ({s}). Bu iş burada bitmez 🌭',
    ],
    country: [
      '{n} senin {c} rekorunu geçti, nasıl geçer? 😤',
      '{n} {c} rekorunu kaptı, {s} yaptı. Bu resmen meydan okuma! 🌭',
      'Alarm! {c} rekoru {n} adlı birine geçti ({s}). Sosisini al gel 🚨',
    ],
    passed: [
      '{n} seni geçti, {s} yaptı. Cevap vermeyecek misin? 🌭',
      '{n} {s} ile önüne geçti. Bunu sineye mi çekeceksin? 😏',
      'Sıralamada biri sinsice seni geçti: {n} ({s}) 👀',
    ],
  },
  en: {
    world: [
      '{n} just broke your world record! What does that even mean? 🌍',
      'The world throne is shaking: {n} scored {s} and the record is theirs. Take it back! 👑',
      '{n} took the world record from you ({s}). This is not over 🌭',
    ],
    country: [
      '{n} beat your {c} record. How?! 😤',
      '{n} grabbed the {c} record with {s}. That is a challenge! 🌭',
      'Alert! The {c} record now belongs to {n} ({s}). Grab your sausage 🚨',
    ],
    passed: [
      "{n} just passed you with {s}. Aren't you going to answer? 🌭",
      '{n} hopped past you with {s}. Will you let that slide? 😏',
      'Someone sneaked past you on the leaderboard: {n} ({s}) 👀',
    ],
  },
}

const fill = (t: string, v: Record<string, string>) => t.replace(/\{(\w)\}/g, (_, k: string) => v[k] ?? '')

interface Message {
  to: string
  title: string
  body: string
  sound: 'default'
}

/** Expo'ya gönderir; uygulaması silinmiş cihazların anahtarlarını temizler. */
export async function sendPush(store: HoplaStore, messages: Message[], fetchImpl: typeof fetch = fetch) {
  let sent = 0
  for (let i = 0; i < messages.length; i += 100) {
    const batch = messages.slice(i, i + 100)
    try {
      const headers: Record<string, string> = { 'content-type': 'application/json', accept: 'application/json' }
      const access = process.env.EXPO_ACCESS_TOKEN?.trim()
      if (access) headers.authorization = `Bearer ${access}`
      const res = await fetchImpl(EXPO_PUSH, {
        method: 'POST',
        headers,
        body: JSON.stringify(batch),
        signal: AbortSignal.timeout(15_000),
      })
      const data = (await res.json().catch(() => null)) as {
        data?: { status: string; details?: { error?: string } }[]
      } | null
      for (const [k, ticket] of (data?.data ?? []).entries()) {
        if (ticket.status === 'ok') sent++
        else if (ticket.details?.error === 'DeviceNotRegistered') await store.clearPushToken(batch[k]!.to)
      }
    } catch (e) {
      console.error('[hopla] push gönderilemedi', e)
    }
  }
  return sent
}

const today = () => new Date().toISOString().slice(0, 10)

/** Günde bir, oyuna girmeden en fazla iki */
export function canNotify(t: PushTarget, day = today()) {
  return !!t.push_token && t.notify_day !== day && t.notify_unseen < MAX_UNSEEN
}

/**
 * Yeni rekordan sonra: dünya/ülke birincisi geçildiyse ona, ayrıca yeni skorla geçilen oyuncuya bildirim.
 * worldBefore / countryBefore: kayıttan önceki birinciler (bildirim isteyenler).
 */
export async function notifyPassed(
  store: HoplaStore,
  me: { id: string; name: string; country: string },
  score: number,
  oldBest: number,
  worldBefore: PushTarget | null,
  countryBefore: PushTarget | null,
  fetchImpl: typeof fetch = fetch,
) {
  const day = today()
  const picks: { t: PushTarget; kind: Kind }[] = []
  if (worldBefore && worldBefore.id !== me.id && score > worldBefore.score)
    picks.push({ t: worldBefore, kind: 'world' })
  else if (countryBefore && countryBefore.id !== me.id && score > countryBefore.score)
    picks.push({ t: countryBefore, kind: 'country' })
  const passed = await store.passedBy(me.country, score, oldBest, me.id)
  if (passed && !picks.some((p) => p.t.id === passed.id)) picks.push({ t: passed, kind: 'passed' })

  const messages: Message[] = []
  for (const { t, kind } of picks) {
    if (!canNotify(t, day)) continue
    const l = lang(t.push_lang)
    messages.push({
      to: t.push_token,
      title: 'Hopdog',
      body: fill(pick(TEXTS[l][kind]), { n: me.name, s: String(score), c: countryLabel(me.country, l) }),
      sound: 'default',
    })
    await store.markNotified(t.id, day, t.notify_unseen + 1)
  }
  if (messages.length) await sendPush(store, messages, fetchImpl)
  return messages
}

/** Pazar akşamı: her ülkede haftanın birincisini o ülkedeki oyunculara duyurur. */
export async function sendWeekly(store: HoplaStore, now = Date.now(), fetchImpl: typeof fetch = fetch) {
  const since = new Date(now - 7 * 24 * 3600_000).toISOString()
  const leaders = await store.weeklyLeaders(since)
  const messages: Message[] = []
  for (const w of leaders) {
    for (const t of await store.pushTargets(w.country)) {
      const l = lang(t.push_lang)
      const c = countryLabel(w.country, l)
      let body: string
      if (t.id === w.id) {
        body =
          l === 'tr'
            ? `Bu haftanın ${c} birincisi sensin! 👑 ${w.score} puan.`
            : `You're this week's ${c} champion! 👑 ${w.score} points.`
      } else if (l === 'tr') {
        const nth = w.plays > 0 ? `, ${w.plays}. oyununda` : ''
        body = `Bu hafta ${c} birincisi ${w.name}: ${w.score} puan${nth}. Şimdi onu geçme zamanı! 🌭`
      } else {
        const nth = w.plays > 0 ? ` on game #${w.plays}` : ''
        body = `This week's ${c} champion is ${w.name} with ${w.score}${nth}. Time to beat them! 🌭`
      }
      messages.push({ to: t.push_token, title: 'Hopdog', body, sound: 'default' })
    }
  }
  const sent = messages.length ? await sendPush(store, messages, fetchImpl) : 0
  return { countries: leaders.length, messages: messages.length, sent }
}
