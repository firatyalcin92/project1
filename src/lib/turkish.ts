/**
 * Özel isimlere Türkçe ek getirme (ünlü uyumu + kaynaştırma + sertleşme).
 * "Ayşe" -> "Ayşe’nin", "Fırat" -> "Fırat’ın", "Umut" -> "Umut’a", "Gül" -> "Gül’den".
 * Kesme işareti olarak tipografik ’ (U+2019) kullanılır.
 */

const BACK_VOWELS = 'aıou'
const FRONT_VOWELS = 'eiöü'
const VOWELS = BACK_VOWELS + FRONT_VOWELS + 'âîû'
// "Fıstıkçı Şahap": sert ünsüzlerden sonra d -> t
const HARD_CONSONANTS = 'fstkçşhp'

function lower(word: string) {
  return word.toLocaleLowerCase('tr-TR')
}

/** Kelimenin son ünlüsü; ünlü yoksa null. */
function lastVowel(word: string): string | null {
  const w = lower(word)
  for (let i = w.length - 1; i >= 0; i--) {
    const ch = w[i]!
    if (VOWELS.includes(ch)) {
      if (ch === 'â') return 'a'
      if (ch === 'î') return 'i'
      if (ch === 'û') return 'u'
      return ch
    }
  }
  return null
}

function lastLetter(word: string): string {
  const letters = lower(word).replace(/[^a-zçğıöşüâîû]/g, '')
  return letters[letters.length - 1] ?? ''
}

function endsWithVowel(word: string) {
  return VOWELS.includes(lastLetter(word))
}

function endsWithHard(word: string) {
  return HARD_CONSONANTS.includes(lastLetter(word))
}

/** Dört yönlü uyum için ünlü: ı, i, u, ü */
function fourWay(word: string): 'ı' | 'i' | 'u' | 'ü' {
  const v = lastVowel(word)
  if (v === 'a' || v === 'ı') return 'ı'
  if (v === 'o' || v === 'u') return 'u'
  if (v === 'ö' || v === 'ü') return 'ü'
  return 'i'
}

/** İki yönlü uyum için ünlü: a, e */
function twoWay(word: string): 'a' | 'e' {
  const v = lastVowel(word)
  return v && BACK_VOWELS.includes(v) ? 'a' : 'e'
}

function clean(name: string) {
  return name.trim()
}

/** İlgi hâli (-ın/-in/-un/-ün): Ayşe'nin, Fırat'ın */
export function genitive(name: string) {
  const n = clean(name)
  if (!n) return n
  return `${n}’${endsWithVowel(n) ? 'n' : ''}${fourWay(n)}n`
}

/** Yönelme hâli (-a/-e): Ayşe'ye, Fırat'a */
export function dative(name: string) {
  const n = clean(name)
  if (!n) return n
  return `${n}’${endsWithVowel(n) ? 'y' : ''}${twoWay(n)}`
}

/** Ayrılma hâli (-dan/-den/-tan/-ten): Ayşe'den, Fırat'tan */
export function ablative(name: string) {
  const n = clean(name)
  if (!n) return n
  return `${n}’${endsWithHard(n) ? 't' : 'd'}${twoWay(n)}n`
}

/** Belirtme hâli (-ı/-i/-u/-ü): Ayşe'yi, Fırat'ı */
export function accusative(name: string) {
  const n = clean(name)
  if (!n) return n
  return `${n}’${endsWithVowel(n) ? 'y' : ''}${fourWay(n)}`
}

/** "ile" eki (-la/-le, -yla/-yle): Ayşe'yle, Fırat'la */
export function withName(name: string) {
  const n = clean(name)
  if (!n) return n
  return `${n}’${endsWithVowel(n) ? 'y' : ''}l${twoWay(n)}`
}

/** Tarihleri sıcak ve kısa biçimde göster: "12 Ekim 2026" */
export function formatDate(iso: string | null | undefined) {
  if (!iso) return ''
  return new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso))
}

export function formatMonth(iso: string) {
  return new Intl.DateTimeFormat('tr-TR', { month: 'long', year: 'numeric' }).format(new Date(iso))
}

/** Bağlaç "de/da": "Ayşe'nin de", "Fırat'ın da" */
export function alsoAfter(word: string) {
  return twoWay(word) === 'a' ? 'da' : 'de'
}
