import '@tanstack/react-start/server-only'
import { ALLOW, ANYWHERE, FIGURES, NEGATIVE, RESERVED, SCRIPT, WORDS } from './blocklist'

/**
 * Hopla isim denetimi.
 *
 * - nameKey(): benzersizlik anahtarı. Büyük/küçük harf, aksan, ayraç ve birbirine benzeyen
 *   harfler (Kiril "а" ↔ Latin "a", 𝐡 ↔ h, ｈ ↔ h…) yok sayılır; böylece "Ali", "ALİ", "A.l.i"
 *   ve "Аli" aynı isim sayılır, kimse başkasının ismini taklit edemez.
 * - screenName(): içerik denetimi (çok dilli küfür, hakaret, nefret, kötü şöhretli kişiler,
 *   terör örgütleri, siyasi hakaret, ayrılmış isimler). Rakamla yazılanlar (h1tl3r), ayraçla
 *   bölünenler (f.u.c.k), harf tekrarları (fuuuck) ve benzer harfler de yakalanır.
 */

/** Her zaman uygulanan harf dönüşümleri */
const SPECIAL: Record<string, string> = {
  ı: 'i',
  ß: 'ss',
  æ: 'ae',
  œ: 'oe',
  ø: 'o',
  ł: 'l',
  đ: 'd',
  ð: 'd',
  þ: 'th',
  ŋ: 'n',
  ħ: 'h',
  ŧ: 't',
  ĸ: 'k',
}

/** Latin harflere benzeyen Kiril, Yunan ve küçük büyük harfler (yalnızca Latin denetiminde) */
const CONFUSABLE: Record<string, string> = {
  а: 'a',
  в: 'b',
  е: 'e',
  ё: 'e',
  з: '3',
  к: 'k',
  м: 'm',
  н: 'h',
  о: 'o',
  р: 'p',
  с: 'c',
  т: 't',
  у: 'y',
  х: 'x',
  ь: 'b',
  і: 'i',
  ї: 'i',
  ј: 'j',
  ѕ: 's',
  ԁ: 'd',
  ԛ: 'q',
  ԝ: 'w',
  һ: 'h',
  ӏ: 'l',
  ү: 'y',
  ғ: 'f',
  α: 'a',
  β: 'b',
  ε: 'e',
  η: 'n',
  ι: 'i',
  κ: 'k',
  ν: 'v',
  ο: 'o',
  ρ: 'p',
  τ: 't',
  υ: 'u',
  χ: 'x',
  ω: 'w',
  ϲ: 'c',
  ζ: 'z',
  μ: 'u',
  γ: 'y',
  ʜ: 'h',
  ɪ: 'i',
  ᴛ: 't',
  ʟ: 'l',
  ᴇ: 'e',
  ʀ: 'r',
  ᴀ: 'a',
  ᴄ: 'c',
  ᴅ: 'd',
  ꜰ: 'f',
  ɢ: 'g',
  ᴊ: 'j',
  ᴋ: 'k',
  ᴍ: 'm',
  ɴ: 'n',
  ᴏ: 'o',
  ᴘ: 'p',
  ꜱ: 's',
  ᴜ: 'u',
  ᴠ: 'v',
  ᴡ: 'w',
  ʏ: 'y',
  ᴢ: 'z',
  ɡ: 'g',
  ɑ: 'a',
  ɩ: 'i',
}

const LEET_I: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '2': 'z',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '6': 'g',
  '7': 't',
  '8': 'b',
  '9': 'g',
}
const LEET_L: Record<string, string> = { ...LEET_I, '1': 'l' }

/** Küçük harf, aksansız; confusables=true ise benzer harfler Latin'e çevrilir. */
function fold(s: string, confusables: boolean) {
  let out = ''
  for (const ch of s.normalize('NFKC').toLowerCase().normalize('NFD')) {
    if (/\p{M}/u.test(ch)) continue
    out += SPECIAL[ch] ?? (confusables ? CONFUSABLE[ch] : undefined) ?? ch
  }
  return out
}

const stripSeparators = (s: string) => s.replace(/[^\p{L}\p{N}]/gu, '')
const leet = (s: string, map: Record<string, string>) => s.replace(/[0-9]/g, (d) => map[d] ?? d)

export function nameKey(name: string) {
  return stripSeparators(fold(name, true)).slice(0, 64)
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** "fuck" → f+u+c+k+ (harf tekrarları serbest; terimdeki çift harfler en az iki kez aranır) */
function pattern(term: string) {
  let re = ''
  for (const run of term.match(/(.)\1*/gsu) ?? []) {
    const ch = escape([...run][0]!)
    const n = [...run].length
    re += n > 1 ? `${ch}{${n},}` : `${ch}+`
  }
  return re
}

function compile(list: string[], confusables: boolean, anchored: boolean) {
  const terms = [...new Set(list.map((t) => stripSeparators(fold(t, confusables))).filter(Boolean))]
  // Uzun terimler önce (alternation ilk eşleşeni alır)
  terms.sort((a, b) => b.length - a.length)
  const body = terms.map(pattern).join('|')
  return new RegExp(anchored ? `^(?:${body})$` : `(?:${body})`, 'u')
}

const RE_ANYWHERE = compile(ANYWHERE, true, false)
const RE_WORDS = compile(WORDS, true, true)
const RE_SCRIPT = compile(SCRIPT, false, false)
const RE_RESERVED = compile(RESERVED, true, true)
const ALLOW_F = [...new Set(ALLOW.map((t) => stripSeparators(fold(t, true))))].sort((a, b) => b.length - a.length)
const FIGURES_F = [...new Set(FIGURES.map((t) => stripSeparators(fold(t, true))))]
const NEGATIVE_F = [...new Set(NEGATIVE.map((t) => stripSeparators(fold(t, true))))]

/** Gamalı haç, SS ve Odal rünleri vb. */
const SYMBOLS = /[卐卍ᛋᛟϟ࿕-࿘\u{1F595}]/u

export type Verdict = { ok: true } | { ok: false; reason: 'reserved' | 'blocked' | 'political' }

function maskAllowed(s: string) {
  let out = s
  for (const w of ALLOW_F) if (out.includes(w)) out = out.split(w).join('#'.repeat(w.length))
  return out
}

export function screenName(name: string): Verdict {
  if (SYMBOLS.test(name)) return { ok: false, reason: 'blocked' }
  if (name.replace(/\D/g, '').includes('1488')) return { ok: false, reason: 'blocked' }

  // Kelimeler: boşluk/nokta/alt çizgi/tire ve küçükBüyük geçişlerinde bölünür.
  const raw = name
    .normalize('NFKC')
    .split(/[\s._-]+|(?<=\p{Ll})(?=\p{Lu})/u)
    .filter(Boolean)
  const folded = raw.map((t) => fold(t, true))

  const tokens = new Set<string>()
  const joined = new Set<string>()
  const forms = [
    (t: string) => t,
    (t: string) => leet(t, LEET_I),
    (t: string) => leet(t, LEET_L),
    (t: string) => t.replace(/[0-9]/g, ''),
  ]
  for (const form of forms) {
    const parts = folded.map((t) => stripSeparators(form(t))).filter(Boolean)
    for (const p of parts) tokens.add(p)
    joined.add(parts.join(''))
  }

  for (const j of joined) {
    if (RE_RESERVED.test(j)) return { ok: false, reason: 'reserved' }
    if (RE_WORDS.test(j)) return { ok: false, reason: 'blocked' }
    if (RE_ANYWHERE.test(maskAllowed(j))) return { ok: false, reason: 'blocked' }
  }
  for (const t of tokens) if (RE_WORDS.test(t)) return { ok: false, reason: 'blocked' }

  // Latin dışı yazılar (benzer harf dönüşümü olmadan)
  if (RE_SCRIPT.test(stripSeparators(fold(name, false)))) return { ok: false, reason: 'blocked' }

  // Siyasi kişi + aşağılayıcı kelime. Kısa adlar (rte, akp…) yalnızca tam kelime olarak sayılır.
  for (const j of joined) {
    for (const fig of FIGURES_F) {
      let rest: string[]
      if (fig.length <= 3) {
        if (!tokens.has(fig)) continue
        rest = [...tokens].filter((t) => t !== fig)
      } else {
        const at = j.indexOf(fig)
        if (at < 0) continue
        rest = [j.slice(0, at), j.slice(at + fig.length), ...[...tokens].filter((t) => t !== fig)].filter(Boolean)
      }
      for (const neg of NEGATIVE_F) {
        const hit = neg.length >= 4 ? rest.some((r) => r.includes(neg)) : rest.some((r) => r === neg)
        if (hit) return { ok: false, reason: 'political' }
      }
    }
  }
  return { ok: true }
}

/**
 * İsteğe bağlı ikinci kontrol: OpenAI moderasyon uç noktası (ücretsiz, çok dilli).
 * Anahtar yoksa, HOPLA_NAME_AI=off ise ya da servis yanıt vermezse 'skip' döner
 * (yerel liste yine uygulanmıştır).
 */
export async function moderateWithAI(
  name: string,
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<'ok' | 'flagged' | 'skip'> {
  const key = env.OPENAI_API_KEY?.trim()
  if (!key || env.HOPLA_NAME_AI === 'off' || env.MESELE_AI_PROVIDER === 'mock') return 'skip'
  const base = (env.OPENAI_BASE_URL?.trim() || 'https://api.openai.com/v1').replace(/\/+$/, '')
  try {
    const res = await fetchImpl(`${base}/moderations`, {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'omni-moderation-latest', input: `Username: ${name}` }),
      signal: AbortSignal.timeout(4000),
    })
    if (!res.ok) return 'skip'
    const data = (await res.json()) as {
      results?: { flagged?: boolean; category_scores?: Record<string, number> }[]
    }
    const r = data.results?.[0]
    if (!r) return 'skip'
    if (r.flagged) return 'flagged'
    const scores = r.category_scores ?? {}
    const strict = ['hate', 'hate/threatening', 'harassment', 'harassment/threatening', 'sexual', 'sexual/minors']
    return strict.some((c) => (scores[c] ?? 0) >= 0.4) ? 'flagged' : 'ok'
  } catch {
    return 'skip'
  }
}
