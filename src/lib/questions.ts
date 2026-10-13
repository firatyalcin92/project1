import { ablative, dative, genitive, withName } from './turkish'

/**
 * MESELE soru seti — döngü odaklı (EFT & Gottman).
 * tetikleyici (olay) -> birincil duygu -> otomatik tepki -> gerçek ihtiyaç -> kendi payın
 *
 * Bu dosya hem istemcide (form) hem sunucuda (doğrulama + AI istemleri) kullanılır.
 * Çip kimlikleri veritabanına yazılır; etiketleri değiştirmek eski kayıtları bozmaz.
 */

export type Visibility = 'private' | 'partner'

export const VISIBILITY_LABEL: Record<Visibility, string> = {
  partner: 'Partnerimle paylaş',
  private: 'Yalnızca Danışman AI',
}

export type Chip = { id: string; label: string; hint?: string }

export const EMOTION_CHIPS = [
  { id: 'anlasilmamis', label: 'Anlaşılmamış' },
  { id: 'gorulmemis', label: 'Görülmemiş' },
  { id: 'yalniz', label: 'Yalnız / Terk Edilmiş' },
  { id: 'haksizlik', label: 'Haksızlığa Uğramış' },
  { id: 'yetersiz', label: 'Yetersiz / Eleştirilmiş' },
  { id: 'onemsiz', label: 'Önemsiz / İkincil Planda' },
  { id: 'ofkeli', label: 'Öfkeli' },
  { id: 'kirilmis', label: 'Kırılmış / Hayal Kırıklığı' },
] as const satisfies readonly Chip[]

/**
 * pattern: EFT dansındaki yeri. AI'ya ipucu olarak gider, kullanıcıya gösterilmez.
 *  - geri_cekilme: kapanma, uzaklaşma (withdraw)
 *  - takip: üstüne gitme, ısrar, yükselme (pursue)
 *  - savunma: kendini koruma (Gottman: savunma)
 *  - asagilama: alay, ironi (Gottman: aşağılama)
 */
export const REACTION_CHIPS = [
  { id: 'sessizlesme', label: 'Sessizleştim / İçime Kapandım', pattern: 'geri_cekilme' },
  { id: 'savunma', label: 'Savunmaya Geçtim', pattern: 'savunma' },
  { id: 'israr', label: 'Üstüne Gittim / Israr Ettim', pattern: 'takip' },
  { id: 'terk', label: 'Ortamı Terk Ettim', pattern: 'geri_cekilme' },
  { id: 'ofke', label: 'Öfkeyle Tepki Verdim', pattern: 'takip' },
  { id: 'ironi', label: 'İronik / Alaycı Konuştum', pattern: 'asagilama' },
] as const satisfies readonly (Chip & { pattern: string })[]

export type EmotionId = (typeof EMOTION_CHIPS)[number]['id']
export type ReactionId = (typeof REACTION_CHIPS)[number]['id']

export const PATTERN_LABEL: Record<string, string> = {
  geri_cekilme: 'geri çekilme',
  takip: 'üstüne gitme / takip',
  savunma: 'savunma',
  asagilama: 'alay / küçümseme',
}

export function chipLabel(questionId: string, chipId: string): string {
  const list: readonly Chip[] = questionId === 'duygular' ? EMOTION_CHIPS : REACTION_CHIPS
  return list.find((c) => c.id === chipId)?.label ?? chipId
}

export type QuestionId = 'olay' | 'duygular' | 'tepkiler' | 'ihtiyac' | 'pay'

export type Question = {
  id: QuestionId
  /** Kısa başlık (ilerleme çubuğu, gizlilik özeti) */
  title: string
  /** Asıl soru. Partner adıyla kişiselleştirilebilir. */
  prompt: (partnerName: string) => string
  helper?: string
  placeholder?: string
  chips?: readonly Chip[]
  /** Çiplerin altındaki açık uçlu alanın sorusu */
  textPrompt?: string
  textRequired: boolean
  chipsRequired: boolean
  minLength: number
}

export const QUESTIONS: readonly Question[] = [
  {
    id: 'olay',
    title: 'Olay ne idi?',
    prompt: () => 'Sence bu mesele tam olarak nerede ve nasıl başladı?',
    helper:
      'Kimin haklı olduğunu değil, senin gözünden ne yaşandığını anlat. Bir film sahnesi gibi: neredeydiniz, ne söylendi, ilk ne oldu?',
    placeholder: 'O akşam eve geldiğimde…',
    textRequired: true,
    chipsRequired: false,
    minLength: 20,
  },
  {
    id: 'duygular',
    title: 'Hissettiğin birincil duygular',
    prompt: () => 'O an içinde en çok hangileri vardı?',
    helper: 'Birden fazla seçebilirsin. Öfke çoğu zaman daha kırılgan bir duygunun kapısıdır.',
    chips: EMOTION_CHIPS,
    textPrompt: 'Bu hislerin altında yatanı biraz açmak ister misin?',
    placeholder: 'Aslında en çok…',
    textRequired: false,
    chipsRequired: true,
    minLength: 0,
  },
  {
    id: 'tepkiler',
    title: 'Otomatik tepkin',
    prompt: () => 'O duygular yükseldiğinde ne yaptın?',
    helper: 'Tepkilerimiz çoğu zaman düşünmeden, kendimizi korumak için gelir. Burada yargı yok.',
    chips: REACTION_CHIPS,
    textPrompt: 'İstersen o anki hâlini biraz anlat.',
    placeholder: 'O an içimden…',
    textRequired: false,
    chipsRequired: true,
    minLength: 0,
  },
  {
    id: 'ihtiyac',
    title: 'Gerçek ihtiyacın',
    prompt: (p) =>
      `O anda ${p ? ablative(p) : 'partnerinden'} duymaya ya da görmeye en çok ihtiyaç duyduğun şey neydi?`,
    helper: 'Bir cümle, bir bakış, bir dokunuş olabilir. "Haklısın" değil; altındaki ihtiyaç.',
    placeholder: 'Sadece bir kere “seni duyuyorum” demesini…',
    textRequired: true,
    chipsRequired: false,
    minLength: 5,
  },
  {
    id: 'pay',
    title: 'Kendi payın',
    prompt: () => 'Tartışmanın tırmanmasında senin hangi cümlen veya tavrın etkili olmuş olabilir?',
    helper: 'Bu bir suçlama değil. Döngüdeki kendi adımını görmek, onu değiştirebilmenin ilk ve en cesur adımı.',
    placeholder: 'Sesimi yükselttiğimde…',
    textRequired: true,
    chipsRequired: false,
    minLength: 5,
  },
]

export const QUESTION_IDS = QUESTIONS.map((q) => q.id)

/** Olay anlatımı dispute_entries tablosunda, diğerleri answers tablosunda tutulur. */
export const ANSWER_QUESTION_IDS = ['duygular', 'tepkiler', 'ihtiyac', 'pay'] as const
export type AnswerQuestionId = (typeof ANSWER_QUESTION_IDS)[number]

export function allowedChipsFor(questionId: string): readonly string[] {
  if (questionId === 'duygular') return EMOTION_CHIPS.map((c) => c.id)
  if (questionId === 'tepkiler') return REACTION_CHIPS.map((c) => c.id)
  return []
}

export const PRIVACY_STEP = {
  title: 'Gizlilik tercihin',
  prompt: (p: string) => `Bu yanıtlarının hangilerini ${p ? withName(p) : 'partnerinle'} paylaşıma açmak istiyorsun?`,
  helper:
    '“Yalnızca Danışman AI” seçtiğin yanıtlar partnerine asla gösterilmez ve onun okuyacağı hiçbir rapora girmez. Yalnızca sana özel aynanı derinleştirmek için kullanılır.',
}

// ---------------------------------------------------------------------------
// 3. Adım: Yeniden Değerlendir
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
    prompt: (p) => `${genitive(p)} gözünden okuduğunda seni en çok ne şaşırttı ya da ne dokundu?`,
    placeholder: 'Onun o akşam yalnız hissettiğini hiç düşünmemiştim…',
    required: true,
  },
  {
    id: 'altinda',
    prompt: (p) => `Şimdi düşününce, ${genitive(p)} tepkisinin altında hangi duygu ya da ihtiyaç olabilir?`,
    placeholder: 'Belki de sesini yükseltirken aslında…',
    required: true,
  },
  {
    id: 'yeni_pay',
    prompt: () => 'Kendi payına dair yeni fark ettiğin bir şey var mı?',
    placeholder: 'Sustuğumda onun bunu ilgisizlik gibi algıladığını…',
    required: false,
  },
  {
    id: 'tek_cumle',
    prompt: (p) => `Şu an ${dative(p)} tek bir cümle söyleyebilsen, ne derdin?`,
    placeholder: 'Seni kaybetmekten korktuğum için…',
    required: true,
  },
]

export const CLOSENESS_LABELS = ['Çok uzak', 'Uzak', 'Arada', 'Yakın', 'Çok yakın'] as const

export const LIMITS = {
  coupleName: 40,
  displayName: 24,
  title: 80,
  text: 2000,
  reflection: 1200,
} as const
