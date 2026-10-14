import { dative, genitive, locative } from './turkish'

/**
 * MESELE soru seti (v2) — danışman sesiyle, adım adım.
 *
 * olay -> içten geçen düşünce (+ o an ne yapıldı) -> [danışman yansıtması] -> duygular
 *      -> kendi ihtiyacı -> partnerin ihtiyacı (bakış açısı alma) -> kendinde değiştireceği
 *
 * Gizlilik seçeneği yoktur: cevaplar partnere olduğu gibi gösterilmez; danışman onları
 * analizde kullanır ve partnerin okuyacağı metinlerde ihtiyaç diliyle yansıtır.
 *
 * Bu dosya hem istemcide (form) hem sunucuda (doğrulama + AI istemleri) kullanılır.
 * Çip kimlikleri veritabanına yazılır; etiketleri değiştirmek eski kayıtları bozmaz.
 */

export type Chip = { id: string; label: string }

export const EMOTION_CHIPS = [
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
 * pattern: EFT dansındaki ve Gottman çerçevesindeki yeri. AI'ya ipucu olarak gider.
 */
export const REACTION_CHIPS = [
  { id: 'sessizlesme', label: 'Sessizleştim / İçime Kapandım', pattern: 'geri_cekilme' },
  { id: 'savunma', label: 'Savunmaya Geçtim', pattern: 'savunma' },
  { id: 'israr', label: 'Üstüne Gittim / Israr Ettim', pattern: 'takip' },
  { id: 'terk', label: 'Ortamı Terk Ettim', pattern: 'geri_cekilme' },
  { id: 'ofke', label: 'Öfkeyle Tepki Verdim', pattern: 'takip' },
  { id: 'suclama', label: 'Suçladım / Eleştirdim', pattern: 'elestiri' },
  { id: 'ironi', label: 'İronik / Alaycı Konuştum', pattern: 'asagilama' },
  { id: 'gecistirme', label: 'Geçiştirdim / Konuyu Değiştirdim', pattern: 'geri_cekilme' },
] as const satisfies readonly (Chip & { pattern: string })[]

export const PATTERN_LABEL: Record<string, string> = {
  geri_cekilme: 'geri çekilme',
  takip: 'üstüne gitme / takip',
  savunma: 'savunma',
  elestiri: 'eleştiri',
  asagilama: 'alay / küçümseme',
}

/** Duygularda "Diğer" seçilince kısa metin alanı açılır; metin text_answer'da tutulur. */
export const OTHER_CHIP = 'diger'

export function chipLabel(questionId: string, chipId: string): string {
  if (chipId === OTHER_CHIP) return 'Diğer'
  const list: readonly Chip[] = questionId === 'duygular' ? EMOTION_CHIPS : REACTION_CHIPS
  return list.find((c) => c.id === chipId)?.label ?? chipId
}

export type QuestionId = 'olay' | 'dusunce' | 'duygular' | 'ihtiyac' | 'partner_ihtiyac' | 'degisim'

export type Question = {
  id: QuestionId
  /** Kısa başlık (ilerleme, özet, rapor kayıtları) */
  title: string
  /** Danışmanın sorusu; partner adıyla kişiselleşir. */
  prompt: (partnerName: string) => string
  helper?: string
  placeholder: string
  /** Kutunun altında dokunarak başlanabilen örnek yönlendirmeler */
  examples: (partnerName: string) => string[]
  chips?: readonly Chip[]
  chipsPrompt?: string
  chipsRequired: boolean
  allowOther?: boolean
  textRequired: boolean
  minLength: number
}

const p = (name: string) => name || 'partneriniz'

export const QUESTIONS: readonly Question[] = [
  {
    id: 'olay',
    title: 'Ne oldu?',
    prompt: () => 'Tam olarak ne oldu, detaylıca anlatır mısınız? Sesle de yazabilirsiniz, dinliyorum.',
    helper: 'Neredeydiniz, kim ne dedi, ilk ne oldu, sonra nasıl büyüdü? Bir film sahnesi gibi anlatın.',
    placeholder: 'Akşam eve geldiğimde…',
    examples: (n) => [
      `Akşam yemeğinde hafta sonu planını konuşurken ${p(n)} telefona bakıyordu, ben de…`,
      'Eve geç geldiğimde ortam gergindi; ilk cümle şuydu…',
      'Küçük bir konu gibi başladı ama birden sesler yükseldi…',
    ],
    chipsRequired: false,
    textRequired: true,
    minLength: 20,
  },
  {
    id: 'dusunce',
    title: 'O an ne düşündünüz?',
    prompt: () => 'Peki siz o esnada ne düşündünüz, içinizden geçen düşünce ne oldu?',
    helper: 'Aklınızdan geçen cümleyi olduğu gibi yazın; burada doğru ya da yanlış yok.',
    placeholder: '“Yine beni dinlemiyor” diye düşündüm…',
    examples: () => [
      '“Yine beni dinlemiyor” diye düşündüm.',
      '“Ne yapsam yetmiyor” dedim içimden.',
      '“Bu hep böyle olacak” diye korktum.',
    ],
    chips: REACTION_CHIPS,
    chipsPrompt: 'O an ne yaptınız? (isteğe bağlı)',
    chipsRequired: false,
    textRequired: true,
    minLength: 5,
  },
  {
    id: 'duygular',
    title: 'Nasıl hissettiniz?',
    prompt: () => 'Peki kendinizi nasıl hissettiniz bu tartışmada?',
    helper: 'Birden fazla seçebilirsiniz. Öfke çoğu zaman daha kırılgan bir duygunun kapısıdır.',
    placeholder: 'Başka bir duygu…',
    examples: () => [],
    chips: EMOTION_CHIPS,
    chipsRequired: true,
    allowOther: true,
    textRequired: false,
    minLength: 0,
  },
  {
    id: 'ihtiyac',
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
    chipsRequired: false,
    textRequired: true,
    minLength: 5,
  },
  {
    id: 'partner_ihtiyac',
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
    chipsRequired: false,
    textRequired: true,
    minLength: 5,
  },
  {
    id: 'degisim',
    title: 'Kendinizde değiştireceğiniz',
    prompt: () => 'Aynı konuda tekrar tartışma yaşamamanız için sizin kendinizde neye müdahale etmeniz gerekiyor?',
    helper: 'Onun değil, sizin elinizde olan küçük ama gerçek bir değişiklik.',
    placeholder: 'Sesim yükselmeye başladığında…',
    examples: () => [
      'Sesim yükselmeye başladığında mola istemek.',
      '“Sen hep…” diye başlayan cümleler kurmamak.',
      'Konuyu yorgunken değil, sakin bir anda açmak.',
    ],
    chipsRequired: false,
    textRequired: true,
    minLength: 5,
  },
]

/** Olay anlatımı dispute_entries tablosunda, diğerleri answers tablosunda tutulur. */
export const ANSWER_QUESTION_IDS = ['dusunce', 'duygular', 'ihtiyac', 'partner_ihtiyac', 'degisim'] as const
export type AnswerQuestionId = (typeof ANSWER_QUESTION_IDS)[number]

/** Danışmanın 3. sorudan önceki yansıtması da answers tablosunda saklanır. */
export const REFLECTION_ANSWER_ID = 'yansima'

export function allowedChipsFor(questionId: string): readonly string[] {
  if (questionId === 'duygular') return [...EMOTION_CHIPS.map((c) => c.id), OTHER_CHIP]
  if (questionId === 'dusunce') return REACTION_CHIPS.map((c) => c.id)
  return []
}

export function introMessage(partnerName: string) {
  const n = partnerName ? locative(partnerName) : 'eşinizde'
  return [
    'Merhaba, yeni mesele için ben hazırım. Bakalım neler olmuş ve neler yapabilirsiniz, birlikte değerlendirelim.',
    `Unutmayın: burada amacımız haklıyı haksızı bulmak, iyiyi kötüyü belirlemek değil. Ne yaşandığını, bunun sizde ve ${n} nasıl bir karşılık bulduğunu anlamaya çalışacağız; ilişkinizin bu tartışmada tıkandığı yerleri görüp neler yapabileceğinize bakacağız.`,
    'Size başlangıçta 6 sorum var. Ne kadar detaylı yanıt verir, düşüncelerinizden ve duygularınızdan ne kadar bahsederseniz bana o kadar yardımcı olur.',
  ]
}

export function privacyNotice(partnerName: string, solo: boolean) {
  if (solo) return 'Cevaplarınız yalnızca size özel danışman raporunu hazırlamak için kullanılır.'
  return `Cevaplarınız ${partnerName ? dative(partnerName) : 'eşinize'} olduğu gibi gösterilmez. Ancak danışman analizde bunları kullanır ve raporda ihtiyaç diliyle, uygun bir dille yansıtabilir. Bunu bilerek, içinizden geldiği gibi yazın.`
}

// ---------------------------------------------------------------------------
// 3. Adım: Yeniden Değerlendir (yalnızca çift modunda)
// ---------------------------------------------------------------------------

export type ReflectionId = 'dokunan' | 'altinda' | 'yeni_pay' | 'tek_cumle'

export const RECONSIDER_QUESTIONS: readonly {
  id: ReflectionId
  prompt: (partnerName: string) => string
  placeholder: string
  required: boolean
}[] = [
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
  coupleName: 40,
  displayName: 24,
  title: 80,
  text: 3000,
  other: 80,
  reflection: 1200,
} as const
