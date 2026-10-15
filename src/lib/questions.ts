import { dative, genitive, locative } from './turkish'

/**
 * MESELE soru seti (v3) — danışman sesiyle, adım adım.
 *
 * olay -> içten geçen düşünce (+ o an ne yapıldı) -> [danışman yansıtması]
 *      -> tartışma sırasında ve sonrasında hissedilenler (tek liste)
 *      -> en çok etkileyen his ve nedeni
 *      -> kendi ihtiyacı -> partnerin ihtiyacı (bakış açısı alma) -> kendinde değiştireceği
 *
 * Gizlilik seçeneği yoktur: cevaplar partnere olduğu gibi gösterilmez; danışman onları
 * analizde kullanır ve partnerin okuyacağı metinlerde ihtiyaç diliyle yansıtır.
 *
 * Bu dosya hem istemcide (form) hem sunucuda (doğrulama + AI istemleri) kullanılır.
 * Çip kimlikleri veritabanına yazılır; etiketleri değiştirmek eski kayıtları bozmaz.
 *
 * Saklama (answers tablosu, her satır bir question_id):
 * - hisler          selected_tags = tartışma sırasında ve sonrasında seçilen hisler, text_answer = "başka bir şey" metni
 * - en_etkili       selected_tags = [en çok etkileyen his], text_answer = nedeni (isteğe bağlı)
 * - his_sirasinda / his_sonrasinda  kısa süre iki ayrı listeyle toplanan kayıtlar (yalnızca okunur)
 * - duygular        v2'den kalan eski kayıtlar (yalnızca okunur)
 */

export type Chip = { id: string; label: string }

/** "Başka bir şey hissettim" seçilince kısa metin alanı açılır; metin text_answer'da tutulur. */
export const OTHER_CHIP = 'diger'

export type FeelingGroup = { id: string; label: string; chips: readonly Chip[] }

export const FEELING_GROUPS: readonly FeelingGroup[] = [
  {
    id: 'kirginlik',
    label: 'Kırgınlık ve üzüntü',
    chips: [
      { id: 'kirildim', label: 'Kırıldım' },
      { id: 'uzuldum', label: 'Üzüldüm' },
      { id: 'hayal_kirikligi', label: 'Hayal kırıklığına uğradım' },
      { id: 'yalniz', label: 'Yalnız hissettim' },
    ],
  },
  {
    id: 'ofke',
    label: 'Öfke',
    chips: [
      { id: 'ofkelendim', label: 'Öfkelendim' },
      { id: 'kiskanclik', label: 'Kıskandım' },
    ],
  },
  {
    id: 'kaygi',
    label: 'Korku ve kaygı',
    chips: [
      { id: 'kaygilandim', label: 'Kaygılandım' },
      { id: 'terk_korkusu', label: 'Kaybetmekten korktum' },
      { id: 'guvensiz', label: 'Güvensiz hissettim' },
      { id: 'caresiz', label: 'Çaresiz hissettim' },
      { id: 'bunalmis', label: 'Bunaldım' },
    ],
  },
  {
    id: 'utanc',
    label: 'Utanç ve suçluluk',
    chips: [
      { id: 'utanmis', label: 'Utandım' },
      { id: 'sucluluk', label: 'Suçluluk duydum' },
      { id: 'yetersiz', label: 'Yetersiz hissettim' },
      { id: 'degersiz', label: 'Değersiz hissettim' },
      { id: 'pismanlik', label: 'Pişman oldum' },
    ],
  },
  {
    id: 'yorgunluk',
    label: 'Yorgunluk',
    chips: [{ id: 'tukenmis', label: 'Yoruldum, tükendim' }],
  },
]

/**
 * Önceki listelerden çıkarılan hisler: benzerleriyle birleştirilenler ve aslında
 * düşünce ya da davranış olanlar (bunlar artık 2. sorudaki düşünce ve davranış
 * listelerinde). Yalnızca eski kayıtların etiketini göstermek için tutulur.
 */
const RETIRED_FEELING_CHIPS: readonly Chip[] = [
  { id: 'anlasilmadim', label: 'Anlaşılmadığımı hissettim' },
  { id: 'dinlenmedim', label: 'Dinlenmediğimi hissettim' },
  { id: 'onemsenmedim', label: 'Önemsenmediğimi hissettim' },
  { id: 'duygularim_kucumsendi', label: 'Duygularımın küçümsendiğini hissettim' },
  { id: 'reddedildim', label: 'Reddedilmiş hissettim' },
  { id: 'haksizlik', label: 'Haksızlığa uğradığımı düşündüm' },
  { id: 'suclandim', label: 'Suçlandığımı hissettim' },
  { id: 'saygisizlik', label: 'Saygısızlığa uğradığımı hissettim' },
  { id: 'kosede', label: 'Köşeye sıkışmış hissettim' },
  { id: 'kontrol_korkusu', label: 'Kontrolümü kaybetmekten korktum' },
  { id: 'savunma_zorunlu', label: 'Kendimi savunmak zorunda hissettim' },
  { id: 'ifade_edemedim', label: 'Kendimi ifade edemedim' },
  { id: 'uzaklasmak_istedim', label: 'Uzaklaşmak, konuşmayı bırakmak istedim' },
  { id: 'ice_kapandim', label: 'İçime kapandım, sustum' },
  { id: 'kendime_kizdim', label: 'Kendime kızdım' },
  { id: 'gorulmedim', label: 'Görülmediğimi veya fark edilmediğimi hissettim' },
  { id: 'degerim_bilinmedi', label: 'Değerimin bilinmediğini hissettim' },
  { id: 'yok_sayildim', label: 'Yok sayıldığımı hissettim' },
  { id: 'ciddiye_alinmadim', label: 'Anlattıklarımın ciddiye alınmadığını hissettim' },
  { id: 'uzaklastim', label: 'Partnerimden uzaklaştığımı hissettim' },
  { id: 'istenmedim', label: 'İstenmediğimi hissettim' },
  { id: 'sevilmedim', label: 'Sevilmediğimi düşündüm' },
  { id: 'bag_zayifladi', label: 'Aramızdaki bağın zayıfladığını hissettim' },
  { id: 'incindim', label: 'İncindim' },
  { id: 'umudum_kirildi', label: 'Umudum kırıldı' },
  { id: 'kalbim_kirildi', label: 'Kalbimin kırıldığını hissettim' },
  { id: 'sinirlendim', label: 'Sinirlendim' },
  { id: 'adaletsizlik', label: 'Adaletsizlik yaşadığımı düşündüm' },
  { id: 'birikenler', label: 'İçimde birikenleri söyleme ihtiyacı duydum' },
  { id: 'endiselendim', label: 'Endişelendim' },
  { id: 'bunalmis', label: 'Bunalmış hissettim' },
  { id: 'baski', label: 'Baskı altında hissettim' },
  { id: 'ne_yapacagimi_bilemedim', label: 'Ne yapacağımı bilemedim' },
  { id: 'yanlis_anlasilma_korkusu', label: 'Yanlış anlaşılmaktan korktum' },
  { id: 'konusmayi_birakmak', label: 'Konuşmayı bırakmak istedim' },
  { id: 'sessiz_kaldim', label: 'Sessiz kalmayı tercih ettim' },
  { id: 'bitsin_istedim', label: 'Tartışmanın bitmesini istedim' },
  { id: 'kendimden_suphe', label: 'Kendimden şüphe ettim' },
  { id: 'basarisiz', label: 'Kendimi başarısız hissettim' },
  { id: 'caresizce_acikladim', label: 'Kendimi çaresizce açıklamaya çalıştım' },
]

export const FEELING_CHIPS: readonly (Chip & { group: string })[] = FEELING_GROUPS.flatMap((g) =>
  g.chips.map((c) => ({ ...c, group: g.label })),
)

export const OTHER_FEELING_LABEL = 'Başka bir şey hissettim'

/** En az 1, en fazla 7 his seçilebilir ("başka bir şey" de bir sayılır). */
export const FEELING_MIN = 1
export const FEELING_MAX = 7

/** Seçili his sayısı ("başka bir şey" yalnızca metni varsa sayılır). */
export function feelingCount(a: { tags: readonly string[]; text: string }) {
  return a.tags.filter((t) => t !== OTHER_CHIP).length + (a.tags.includes(OTHER_CHIP) && a.text.trim() ? 1 : 0)
}

/** v2'nin tek "Nasıl hissettiniz?" sorusundaki çipler — eski kayıtları okumak için korunur. */
export const LEGACY_EMOTION_CHIPS = [
  { id: 'anlasilmamis', label: 'Anlaşılmamış' },
  { id: 'gorulmemis', label: 'Görülmemiş' },
  { id: 'yalniz', label: 'Yalnız / Terk Edilmiş' },
  { id: 'haksizlik', label: 'Haksızlığa Uğramış' },
  { id: 'yetersiz', label: 'Yetersiz / Eleştirilmiş' },
  { id: 'onemsiz', label: 'Önemsiz / İkincil Planda' },
  { id: 'degersiz', label: 'Değersiz' },
  { id: 'suclanmis', label: 'Suçlanmış' },
  { id: 'reddedilmis', label: 'Reddedilmiş' },
  { id: 'kontrol', label: 'Kontrol Edilmiş / Kısıtlanmış' },
  { id: 'bunalmis', label: 'Bunalmış / Sıkışmış' },
  { id: 'kaygili', label: 'Kaygılı / Korkmuş' },
  { id: 'caresiz', label: 'Çaresiz' },
  { id: 'tukenmis', label: 'Yorgun / Tükenmiş' },
  { id: 'utanmis', label: 'Utanmış / Mahcup' },
  { id: 'kiskanc', label: 'Kıskanç / Güvensiz' },
  { id: 'ofkeli', label: 'Öfkeli' },
  { id: 'kirilmis', label: 'Kırgın / Hayal Kırıklığı' },
] as const satisfies readonly Chip[]

/**
 * O an YAPILANLAR (davranış / otomatik tepki). pattern: EFT dansındaki ve Gottman
 * çerçevesindeki yeri; AI'ya ipucu olarak gider. Kimlikler eski kayıtlarla uyumludur.
 */
export const REACTION_CHIPS = [
  { id: 'sessizlesme', label: 'Sustum, içime kapandım', pattern: 'geri_cekilme' },
  { id: 'terk', label: 'Ortamı terk ettim', pattern: 'geri_cekilme' },
  { id: 'gecistirme', label: 'Konuyu geçiştirdim', pattern: 'geri_cekilme' },
  { id: 'savunma', label: 'Kendimi savundum', pattern: 'savunma' },
  { id: 'aciklama', label: 'Kendimi anlatmaya çalıştım', pattern: 'aciklama' },
  { id: 'israr', label: 'Üstüne gittim, ısrar ettim', pattern: 'takip' },
  { id: 'ofke', label: 'Sesimi yükselttim', pattern: 'takip' },
  { id: 'suclama', label: 'Suçladım, eleştirdim', pattern: 'elestiri' },
  { id: 'ironi', label: 'Alay ettim, iğneledim', pattern: 'asagilama' },
  { id: 'agladim', label: 'Ağladım', pattern: 'duygusal_tasma' },
  { id: 'firlattim', label: 'Bir şey fırlattım ya da kırdım', pattern: 'fiziksel_tasma' },
] as const satisfies readonly (Chip & { pattern: string })[]

export const PATTERN_LABEL: Record<string, string> = {
  geri_cekilme: 'geri çekilme',
  takip: 'üstüne gitme / takip',
  savunma: 'savunma',
  aciklama: 'anlaşılma çabası',
  elestiri: 'eleştiri',
  asagilama: 'alay / küçümseme',
  duygusal_tasma: 'duygusal taşma',
  fiziksel_tasma: 'fiziksel taşma — güvenlik işareti',
}

/**
 * O an AKLINDAN GEÇENLER (düşünce / yorum). Duygu değil, partnerin niyetine ya da
 * duruma dair yorumlardır; pattern bilişsel çarpıtmanın türünü AI'ya söyler.
 */
export const THOUGHT_CHIPS = [
  { id: 'anlamiyor', label: 'Beni anlamıyor, dinlemiyor', pattern: 'yorum' },
  { id: 'onemsemiyor', label: 'Beni önemsemiyor', pattern: 'yorum' },
  { id: 'istemiyor', label: 'Beni istemiyor', pattern: 'yorum' },
  { id: 'sucluyor', label: 'Beni suçluyor', pattern: 'yorum' },
  { id: 'haksizlik_ediyor', label: 'Bana haksızlık ediyor', pattern: 'yorum' },
  { id: 'saygi_duymuyor', label: 'Bana saygı duymuyor', pattern: 'yorum' },
  { id: 'bilerek', label: 'Bunu bilerek yapıyor', pattern: 'zihin_okuma' },
  { id: 'hep_boyle', label: 'Hep böyle oluyor, hiç değişmeyecek', pattern: 'genelleme' },
  { id: 'bitecek', label: 'Bu ilişki bitecek', pattern: 'felaketlestirme' },
  { id: 'bilmeliydi', label: 'Bunu kendisi bilmeliydi', pattern: 'meli_mali' },
  { id: 'yetmiyor', label: 'Ne yapsam yetmiyor', pattern: 'kisisellestirme' },
  { id: 'gorsun', label: 'O da aynısını yaşasın, görsün', pattern: 'cezalandirma' },
] as const satisfies readonly (Chip & { pattern: string })[]

export const THOUGHT_PATTERN_LABEL: Record<string, string> = {
  yorum: 'partnerin niyetine dair yorum',
  zihin_okuma: 'zihin okuma',
  genelleme: 'genelleme (hep / hiç)',
  felaketlestirme: 'felaketleştirme',
  meli_mali: 'meli-malı düşüncesi',
  kisisellestirme: 'kendini suçlama',
  cezalandirma: 'cezalandırma isteği',
}

/** Düşünce çipleri ayrı bir answers satırında tutulur (question_id = dusunce_kalip). */
export const THOUGHTS = 'dusunce_kalip'

export const FEELINGS = 'hisler'
export const STRONGEST_FEELING = 'en_etkili'
/** Kısa süre kullanılan iki ayrı liste (sırasında / sonrasında) — eski kayıtlar için. */
export const FEELING_DURING = 'his_sirasinda'
export const FEELING_AFTER = 'his_sonrasinda'
export const LEGACY_FEELINGS = 'duygular'

/**
 * En çok etkileyen his kullanıcının kendi yazdığı "başka bir şey" ise: tek listede OTHER_CHIP,
 * eski iki listeli kayıtlarda bu kimlikler saklanır.
 */
export const STRONGEST_OTHER = { during: 'diger_sirasinda', after: 'diger_sonrasinda' } as const

/** Bir his kimliğinin etiketi (yeni liste önce, sonra eski v2 listesi). */
export function feelingLabel(id: string): string {
  return (
    FEELING_CHIPS.find((c) => c.id === id)?.label ??
    RETIRED_FEELING_CHIPS.find((c) => c.id === id)?.label ??
    LEGACY_EMOTION_CHIPS.find((c) => c.id === id)?.label ??
    (id === OTHER_CHIP ? OTHER_FEELING_LABEL : id)
  )
}

export function chipLabel(questionId: string, chipId: string): string {
  if (questionId === LEGACY_FEELINGS) {
    if (chipId === OTHER_CHIP) return 'Diğer'
    return LEGACY_EMOTION_CHIPS.find((c) => c.id === chipId)?.label ?? chipId
  }
  if ([FEELINGS, FEELING_DURING, FEELING_AFTER, STRONGEST_FEELING].includes(questionId)) return feelingLabel(chipId)
  if (questionId === THOUGHTS) return THOUGHT_CHIPS.find((c) => c.id === chipId)?.label ?? chipId
  return REACTION_CHIPS.find((c) => c.id === chipId)?.label ?? chipId
}

export type QuestionId =
  'olay' | 'dusunce' | typeof FEELINGS | typeof STRONGEST_FEELING | 'ihtiyac' | 'partner_ihtiyac' | 'degisim'

/** text: serbest metin (+ isteğe bağlı çip); feelings: gruplu çoklu seçim; strongest: tek seçim + neden */
export type QuestionKind = 'text' | 'feelings' | 'strongest'

export type Question = {
  id: QuestionId
  kind: QuestionKind
  /** Kullanıcıya gösterilen soru numarası (iki his alanı aynı soruyu paylaşır). */
  number: number
  /** Kısa başlık (ilerleme, özet, rapor kayıtları) */
  title: string
  /** Danışmanın sorusu; partner adıyla kişiselleşir. */
  prompt: (partnerName: string) => string
  /** Aynı sorunun bölümü (ör. "A · Tartışma sırasında") */
  section?: string
  helper?: string
  placeholder: string
  /** Kutunun altında dokunarak başlanabilen örnek yönlendirmeler */
  examples: (partnerName: string) => string[]
  chips?: readonly Chip[]
  chipsPrompt?: string
  /** En az bir çip seçilmeden geçilemez */
  chipsRequired?: boolean
  /** Aynı sayfada, ayrı bir satıra kaydedilen isteğe bağlı düşünce çipleri */
  thoughts?: { answerId: typeof THOUGHTS; chips: readonly Chip[]; prompt: string }
  textRequired: boolean
  minLength: number
}

const p = (name: string) => name || 'partneriniz'

const FEELINGS_PROMPT = 'Tartışma sırasında ve sonrasında neler hissettiniz?'
const FEELINGS_HELPER =
  'Burada yalnızca duygular var; düşüncelerinizi ve ne yaptığınızı bir önceki soruda seçtiniz. Sizi en iyi anlatan en fazla 7 duygu seçebilirsiniz.'

export const QUESTIONS: readonly Question[] = [
  {
    id: 'olay',
    kind: 'text',
    number: 1,
    title: 'Ne oldu?',
    prompt: () => 'Tam olarak ne oldu, detaylıca anlatır mısınız? Sesle de yazabilirsiniz, dinliyorum.',
    helper: 'Neredeydiniz, kim ne dedi, ilk ne oldu, sonra nasıl büyüdü? Bir film sahnesi gibi anlatın.',
    placeholder: 'Akşam eve geldiğimde…',
    examples: (n) => [
      `Akşam yemeğinde hafta sonu planını konuşurken ${p(n)} telefona bakıyordu, ben de…`,
      'Eve geç geldiğimde ortam gergindi; ilk cümle şuydu…',
      'Küçük bir konu gibi başladı ama birden sesler yükseldi…',
    ],
    textRequired: true,
    minLength: 20,
  },
  {
    id: 'dusunce',
    kind: 'text',
    number: 2,
    title: 'O an ne düşündünüz?',
    prompt: () => 'Peki siz o esnada ne düşündünüz, içinizden geçen düşünce ne oldu?',
    helper: 'Aklınızdan geçen cümleyi olduğu gibi yazın; burada doğru ya da yanlış yok.',
    placeholder: '“Yine beni dinlemiyor” diye düşündüm…',
    examples: () => [
      '“Yine beni dinlemiyor” diye düşündüm.',
      '“Ne yapsam yetmiyor” dedim içimden.',
      '“Bu hep böyle olacak” diye korktum.',
    ],
    thoughts: {
      answerId: THOUGHTS,
      chips: THOUGHT_CHIPS,
      prompt: 'Bu düşüncelerden size tanıdık gelen var mı? (isteğe bağlı)',
    },
    chips: REACTION_CHIPS,
    chipsPrompt: 'Peki o an ne yaptınız? Birden fazla seçebilirsiniz.',
    chipsRequired: true,
    textRequired: true,
    minLength: 5,
  },
  {
    id: FEELINGS,
    kind: 'feelings',
    number: 3,
    title: 'Hissettikleriniz',
    prompt: () => FEELINGS_PROMPT,
    helper: FEELINGS_HELPER,
    placeholder: 'Kendi kelimelerinizle…',
    examples: () => [],
    textRequired: false,
    minLength: 0,
  },
  {
    id: STRONGEST_FEELING,
    kind: 'strongest',
    number: 4,
    title: 'Sizi en çok etkileyen his',
    prompt: () => 'Seçtiğiniz hisler arasından sizi en çok etkileyen hangisiydi? Neden?',
    helper: 'Birine dokunarak seçin. Nedenini yazmak isteğe bağlı ama danışmana çok yardımcı olur.',
    placeholder: 'Çünkü o an…',
    examples: () => [],
    textRequired: false,
    minLength: 0,
  },
  {
    id: 'ihtiyac',
    kind: 'text',
    number: 5,
    title: 'Sizin ihtiyacınız',
    prompt: (n) =>
      `Yaşadığınız bu olayda sizin tam olarak ihtiyacınız neydi? ${n || 'Eşiniz'} ne yapsaydı bu kadar büyümezdi sizin için?`,
    helper: 'Bir cümle, bir bakış, bir dokunuş olabilir. “Haklısın” değil; altındaki ihtiyaç.',
    placeholder: 'Sadece bir dakika durup beni dinlemesi…',
    examples: () => [
      'Sadece bir dakika telefonu bırakıp beni dinlemesi.',
      '“Böyle hissetmeni anlıyorum” demesi.',
      'Sesini yükseltmeden yanıma oturması.',
    ],
    textRequired: true,
    minLength: 5,
  },
  {
    id: 'partner_ihtiyac',
    kind: 'text',
    number: 6,
    title: `Onun ihtiyacı`,
    prompt: (n) =>
      `Peki sizce ${n ? genitive(n) : 'eşinizin'} ihtiyacı neydi? O, kendisine ne yapılmasını, ne söylenmesini isterdi?`,
    helper: 'Bir an onun yerine geçin. Bu soru, döngüyü kırmanın en güçlü anahtarlarından biri.',
    placeholder: 'Belki de yorgun olduğunu fark etmemi…',
    examples: () => [
      'Yorgun olduğunu fark etmemi ve biraz alan tanımamı.',
      'Suçlanmadan dinlenmeyi.',
      'Ona da güvendiğimi göstermemi.',
    ],
    textRequired: true,
    minLength: 5,
  },
  {
    id: 'degisim',
    kind: 'text',
    number: 7,
    title: 'Kendinizde değiştireceğiniz',
    prompt: () => 'Aynı konuda tekrar tartışma yaşamamanız için sizin kendinizde neye müdahale etmeniz gerekiyor?',
    helper: 'Onun değil, sizin elinizde olan küçük ama gerçek bir değişiklik.',
    placeholder: 'Sesim yükselmeye başladığında…',
    examples: () => [
      'Sesim yükselmeye başladığında mola istemek.',
      '“Sen hep…” diye başlayan cümleler kurmamak.',
      'Konuyu yorgunken değil, sakin bir anda açmak.',
    ],
    textRequired: true,
    minLength: 5,
  },
]

export const QUESTION_COUNT = Math.max(...QUESTIONS.map((q) => q.number))

/** Olay anlatımı dispute_entries tablosunda, diğerleri answers tablosunda tutulur. */
export const ANSWER_QUESTION_IDS = [
  'dusunce',
  THOUGHTS,
  FEELINGS,
  STRONGEST_FEELING,
  'ihtiyac',
  'partner_ihtiyac',
  'degisim',
] as const
export type AnswerQuestionId = (typeof ANSWER_QUESTION_IDS)[number]

/** Danışmanın his sorusundan önceki yansıtması da answers tablosunda saklanır. */
export const REFLECTION_ANSWER_ID = 'yansima'

export function allowedChipsFor(questionId: string): readonly string[] {
  if (questionId === FEELINGS || questionId === FEELING_DURING || questionId === FEELING_AFTER)
    return [...FEELING_CHIPS.map((c) => c.id), OTHER_CHIP]
  if (questionId === STRONGEST_FEELING)
    return [...FEELING_CHIPS.map((c) => c.id), OTHER_CHIP, STRONGEST_OTHER.during, STRONGEST_OTHER.after]
  if (questionId === 'dusunce') return REACTION_CHIPS.map((c) => c.id)
  if (questionId === THOUGHTS) return THOUGHT_CHIPS.map((c) => c.id)
  return []
}

export type FeelingDraft = { tags: readonly string[]; text: string }
/** when: yalnızca eski iki listeli kayıtlarda bilinir. */
export type StrongestOption = { id: string; label: string; when: 'during' | 'after' | 'both' | null }

/**
 * "En çok etkileyen his" için seçenekler: işaretlenen hisler ve yazılan "başka bir şey" metni.
 * answers içinde "hisler" varsa tek liste kullanılır; yoksa eski iki liste birleştirilir.
 */
export function strongestOptions(answers: Partial<Record<string, FeelingDraft>>): StrongestOption[] {
  // Seçim sırası korunur; eski kayıtlardaki (artık listede olmayan) hisler de adlarıyla gelir.
  const known = (id: string) => id !== OTHER_CHIP && feelingLabel(id) !== id
  const out: StrongestOption[] = []
  const merged = answers[FEELINGS]
  if (merged) {
    for (const id of new Set(merged.tags)) if (known(id)) out.push({ id, label: feelingLabel(id), when: null })
    if (merged.tags.includes(OTHER_CHIP) && merged.text.trim())
      out.push({ id: OTHER_CHIP, label: merged.text.trim(), when: null })
    return out
  }
  const during = answers[FEELING_DURING] ?? { tags: [], text: '' }
  const after = answers[FEELING_AFTER] ?? { tags: [], text: '' }
  for (const id of new Set([...during.tags, ...after.tags])) {
    if (!known(id)) continue
    const d = during.tags.includes(id)
    const a = after.tags.includes(id)
    out.push({ id, label: feelingLabel(id), when: d && a ? 'both' : d ? 'during' : 'after' })
  }
  if (during.tags.includes(OTHER_CHIP) && during.text.trim())
    out.push({ id: STRONGEST_OTHER.during, label: during.text.trim(), when: 'during' })
  if (after.tags.includes(OTHER_CHIP) && after.text.trim())
    out.push({ id: STRONGEST_OTHER.after, label: after.text.trim(), when: 'after' })
  return out
}

export const WHEN_LABEL: Record<NonNullable<StrongestOption['when']>, string> = {
  during: 'tartışma sırasında',
  after: 'tartışma sonrasında',
  both: 'hem sırasında hem sonrasında',
}

export function introMessage(partnerName: string) {
  const n = partnerName ? locative(partnerName) : 'eşinizde'
  return [
    'Merhaba, yeni mesele için ben hazırım. Bakalım neler olmuş ve neler yapabilirsiniz, birlikte değerlendirelim.',
    `Unutmayın: burada amacımız haklıyı haksızı bulmak, iyiyi kötüyü belirlemek değil. Ne yaşandığını, bunun sizde ve ${n} nasıl bir karşılık bulduğunu anlamaya çalışacağız; ilişkinizin bu tartışmada tıkandığı yerleri görüp neler yapabileceğinize bakacağız.`,
    `Size başlangıçta ${QUESTION_COUNT} sorum var. Ne kadar detaylı yanıt verir, düşüncelerinizden ve duygularınızdan ne kadar bahsederseniz bana o kadar yardımcı olur.`,
  ]
}

export function privacyNotice(partnerName: string, solo: boolean) {
  if (solo) return 'Cevaplarınız yalnızca size özel danışman raporunu hazırlamak için kullanılır; kimseyle paylaşılmaz.'
  return `Cevaplarınız ${partnerName ? dative(partnerName) : 'eşinize'} olduğu gibi gösterilmez ve üçüncü kişilerle paylaşılmaz. Danışman analizde bunları kullanır ve raporda ihtiyaç diliyle, uygun bir dille yansıtabilir. Bunu bilerek, içinizden geldiği gibi yazın.`
}

// ---------------------------------------------------------------------------
// 3. Adım: Yeniden Değerlendir (yalnızca çift modunda)
// ---------------------------------------------------------------------------

export type ReflectionId = 'itiraz' | 'dokunan' | 'altinda' | 'yeni_pay' | 'tek_cumle'

export const RECONSIDER_QUESTIONS: readonly {
  id: ReflectionId
  prompt: (partnerName: string) => string
  placeholder: string
  required: boolean
  /** "İtirazım var": ayrı bir düğmeyle açılır */
  objection?: boolean
  helper?: string
}[] = [
  {
    id: 'itiraz',
    objection: true,
    prompt: (n) =>
      `${genitive(n)} gözünden metninde ya da sizin anlatımınızın ona yansıtılışında katılmadığınız, farklı yaşadığınız ya da yanlış anlaşılmış bir şey var mı?`,
    helper:
      'İki kişi aynı anı farklı yaşayabilir; danışman da bir şeyi yanlış anlamış olabilir. Yazdıklarınız olduğu gibi gösterilmez; danışman raporda iki bakışı ayrı ayrı ele alır ve hatayı düzeltir.',
    placeholder: 'Ben aslında öyle demedim; olay şöyle gelişti…',
    required: false,
  },
  {
    id: 'dokunan',
    prompt: (n) => `${genitive(n)} gözünden okuduğunuzda sizi en çok ne şaşırttı ya da ne dokundu?`,
    placeholder: 'Onun o akşam yalnız hissettiğini hiç düşünmemiştim…',
    required: true,
  },
  {
    id: 'altinda',
    prompt: (n) => `Şimdi düşününce, ${genitive(n)} tepkisinin altında hangi duygu ya da ihtiyaç olabilir?`,
    placeholder: 'Belki de sesini yükseltirken aslında…',
    required: true,
  },
  {
    id: 'yeni_pay',
    prompt: () => 'Kendi payınıza dair yeni fark ettiğiniz bir şey var mı?',
    placeholder: 'Sustuğumda onun bunu ilgisizlik gibi algıladığını…',
    required: false,
  },
  {
    id: 'tek_cumle',
    prompt: (n) => `Şu an ${dative(n)} tek bir cümle söyleyebilseniz, ne derdiniz?`,
    placeholder: 'Seni kaybetmekten korktuğum için…',
    required: true,
  },
]

export const CLOSENESS_LABELS = ['Çok uzak', 'Uzak', 'Arada', 'Yakın', 'Çok yakın'] as const

export const LIMITS = {
  displayName: 24,
  title: 80,
  text: 3000,
  other: 160,
  reflection: 1200,
} as const
