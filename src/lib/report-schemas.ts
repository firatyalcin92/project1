import { z } from 'zod'

/**
 * AI çıktı şemaları. Sunucu, modelden gelen JSON'u bu şemalarla doğrular;
 * istemci yalnızca türleri (import type) kullanır.
 *
 * Açıklamalar (describe) modele giden JSON şemasına da yazılır; bu yüzden
 * Türkçe ve yönlendiricidir.
 */

const Safety = z
  .object({
    concern: z
      .boolean()
      .describe(
        'Metinlerde fiziksel şiddet, tehdit, zorlama, korkutma, kontrol, kendine zarar verme ya da intihar düşüncesi işareti varsa true.',
      ),
    message: z.string().describe('concern true ise nazik, net ve yönlendirici bir güvenlik notu; değilse boş metin.'),
  })
  .describe('Güvenlik değerlendirmesi')

export type Safety = z.infer<typeof Safety>

// ---------------------------------------------------------------------------
// 2. Adım: "[Partner]'ın Gözünden"
// ---------------------------------------------------------------------------

export const PerspectiveSchema = z.object({
  headline: z
    .string()
    .min(1)
    .describe("Tek cümlelik sıcak başlık. Örn: 'Ayşe için o akşam, görülmeyi beklediği bir akşamdı.'"),
  story: z
    .string()
    .min(1)
    .describe(
      'Anlatan kişinin yaşadıklarının, üçüncü tekil şahısla, iki kısa paragraflık şefkatli yeniden anlatımı. Paragrafları boş satırla ayır. Suçlayıcı ifadeleri yumuşat ama anlamı değiştirme.',
    ),
  beneath: z
    .string()
    .min(1)
    .describe(
      "Görünen tepkinin altındaki birincil duygu. Örn: 'Sesinin yükselmesinin altında belki de yalnız kalma korkusu vardı.'",
    ),
  need: z.string().min(1).describe('O an en çok neye ihtiyaç duyduğu, tek cümle.'),
  readingNote: z
    .string()
    .min(1)
    .describe('Okuyan partnere tek cümlelik nazik not: savunmaya geçmeden, merakla okuması için.'),
})

export type Perspective = z.infer<typeof PerspectiveSchema>

// ---------------------------------------------------------------------------
// 4. Adım: Ortak Rapor — Döngü Analizi ve İhtiyaç Aynası
// ---------------------------------------------------------------------------

export const SharedReportSchema = z.object({
  opening: z.string().min(1).describe('İkisine birlikte seslenen, 2-3 cümlelik sıcak açılış.'),
  cycle: z.object({
    name: z.string().min(1).describe("Döngüye verilen sıcak, akılda kalıcı bir ad. Örn: 'Kapanan Kapı ve Çalan Zil'"),
    summary: z
      .string()
      .min(1)
      .describe(
        "Kısırdöngü cümlesi, adlarla: 'Fırat içine kapandıkça Ayşe üstüne geliyor; Ayşe ısrar ettikçe Fırat daha çok çekiliyor.'",
      ),
    steps: z
      .array(
        z.object({
          partner: z.enum(['A', 'B']).describe('Bu adımdaki kişi'),
          trigger: z.string().min(1).describe('Bu adımı tetikleyen şey (olay ya da partnerin bir önceki tepkisi)'),
          feeling: z.string().min(1).describe('İçeride hissedilen birincil duygu'),
          reaction: z.string().min(1).describe('Dışarıya yansıyan otomatik tepki'),
        }),
      )
      .min(2)
      .max(4)
      .describe('Döngünün adımları; A ve B sırayla. Son adım ilk adımı yeniden tetikler.'),
    enemy: z
      .string()
      .min(1)
      .describe('Döngüyü dışsallaştıran cümle: düşmanınız birbiriniz değil, aranıza yerleşen bu dans.'),
  }),
  whoIsRight: z.object({
    answer: z.string().min(1).describe("'Kim haklı?' sorusuna dürüst ama hüküm vermeyen, 2-3 cümlelik cevap."),
    pointA: z.string().min(1).describe('A kişisinin gerçekten haklı olduğu nokta, adıyla.'),
    pointB: z.string().min(1).describe('B kişisinin gerçekten haklı olduğu nokta, adıyla.'),
    realIssue: z.string().min(1).describe('Asıl mesele: tartışmanın konusu değil, altındaki bağ ihtiyacı.'),
  }),
  needs: z.object({
    a: z.string().min(1).describe('A kişisinin temel ihtiyacı, adıyla.'),
    b: z.string().min(1).describe('B kişisinin temel ihtiyacı, adıyla.'),
    commonGround: z
      .string()
      .min(1)
      .describe('İkisinin de aslında aradığı ortak zemin (güven, görülmek, önemli olmak...).'),
  }),
  repairSteps: z
    .array(
      z.object({
        title: z.string().min(1).describe('Kısa başlık'),
        when: z.string().min(1).describe('Döngünün hangi anında kullanılacağı'),
        phrase: z.string().min(1).describe('O an söylenecek tek cümle, tırnaksız'),
        why: z.string().min(1).describe('Bu cümle neden işe yarar, tek cümle'),
      }),
    )
    .min(3)
    .max(3)
    .describe('Döngü yeniden başladığında kullanılacak tam 3 pratik mola / onarım adımı.'),
  tonight: z.string().min(1).describe('Bugün için somut, küçük bir yeniden bağlanma önerisi.'),
  closing: z.string().min(1).describe('Umut veren, kısa kapanış.'),
  safety: Safety,
})

export type SharedReport = z.infer<typeof SharedReportSchema>

// ---------------------------------------------------------------------------
// 4. Adım: Kişisel Rapor — Sana Özel Ayna
// ---------------------------------------------------------------------------

export const MyReportSchema = z.object({
  greeting: z.string().min(1).describe('Raporu okuyan kişiye adıyla seslenen, 2 cümlelik sıcak açılış.'),
  mirror: z.object({
    partnerWords: z
      .string()
      .describe(
        "Partnerin paylaştığı anlatımdan kısa bir söz ya da davranış (örn. 'Hiç umursamıyorsun'). Yoksa boş metin.",
      ),
    meaning: z
      .string()
      .min(1)
      .describe(
        "Ayna: 'Ayşe ... derken aslında hissettiği ... idi.' Partnerin yüzeydeki sözünün altındaki duygu ve ihtiyaç.",
      ),
  }),
  yourPlace: z.string().min(1).describe('Okuyan kişinin döngüdeki yeri; şefkatle, suçlamadan.'),
  blindSpots: z
    .array(
      z.object({
        title: z.string().min(1),
        insight: z.string().min(1).describe('Şefkatli ama dürüst geri bildirim, 1-2 cümle.'),
      }),
    )
    .min(1)
    .max(3)
    .describe('İletişim kör noktaları'),
  strength: z.string().min(1).describe('Bu meselede gösterdiği bir güç ya da iyi niyet.'),
  repair: z.object({
    suggestion: z.string().min(1).describe('Yalnızca onun görebileceği kişisel onarım önerisi.'),
    phrase: z.string().min(1).describe('Partnerine söyleyebileceği tek bir onarım cümlesi, tırnaksız.'),
  }),
  selfCompassion: z.string().min(1).describe('Kendine şefkat notu, tek cümle.'),
  safety: Safety,
})

export type MyReport = z.infer<typeof MyReportSchema>

// ---------------------------------------------------------------------------
// Genel Görüş — 9 bölümlük kalıcı ilişki dinamiği raporu
// ---------------------------------------------------------------------------

const Section = z.object({
  body: z.string().min(1).describe('2-4 kısa paragraf; boş satırla ayır.'),
  highlights: z.array(z.string()).max(5).describe('En fazla 5 kısa vurgu maddesi.'),
})

export const RelationshipReportSchema = z.object({
  headline: z.string().min(1).describe('İlişkinin bugünkü hâlini anlatan tek cümle.'),
  story: Section.describe('1. İlişkinizin hikâyesi: meseleler boyunca görülen genel resim.'),
  coreCycle: Section.extend({
    cycleName: z.string().min(1).describe('En sık tekrarlayan döngünün adı'),
  }).describe('2. Tekrarlayan dansınız: ana kısırdöngü (takip/geri çekilme vb.).'),
  triggers: Section.describe('3. Sık tetikleyiciler: tekrar eden konular ve anlar.'),
  emotionMap: Section.describe('4. Birincil duygu haritası: her birinin en sık hissettiği duygular.'),
  attachmentNeeds: Section.describe('5. Bağlanma ihtiyaçlarınız: her birinin derindeki ihtiyacı.'),
  horsemen: Section.extend({
    items: z
      .array(
        z.object({
          name: z.enum(['Eleştiri', 'Aşağılama', 'Savunma', 'Duvar Örme']),
          level: z.enum(['nadiren', 'zaman zaman', 'sık']),
          note: z.string().min(1),
          antidote: z.string().min(1).describe('Gottman panzehiri, günlük dille'),
        }),
      )
      .min(4)
      .max(4),
  }).describe('6. Dört Atlı aynası (Gottman): yumuşak bir dille.'),
  strengths: Section.describe('7. Güçlü yanlarınız ve onarım becerileriniz.'),
  growth: Section.describe('8. Büyüme alanlarınız.'),
  path: Section.extend({
    rituals: z
      .array(z.object({ title: z.string().min(1), description: z.string().min(1) }))
      .min(2)
      .max(4)
      .describe('Bağ kurma ritüelleri'),
    professionalNote: z
      .string()
      .min(1)
      .describe('Ne zaman bir aile/çift danışmanından destek almanın iyi geleceğine dair nazik not.'),
  }).describe('9. Önümüzdeki yol.'),
  safety: Safety,
})

export type RelationshipReport = z.infer<typeof RelationshipReportSchema>

/**
 * Model sağlayıcılarına gönderilecek JSON şeması. Katı (strict) modda
 * desteklenmeyen kısıt anahtarları ayıklanır; sınırları zod zaten doğrular.
 */
export function toModelJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const raw = z.toJSONSchema(schema, { target: 'draft-7', io: 'output' }) as Record<string, unknown>
  const DROP = new Set([
    '$schema',
    'minLength',
    'maxLength',
    'minItems',
    'maxItems',
    'minimum',
    'maximum',
    'pattern',
    'format',
  ])
  const walk = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(walk)
    if (node && typeof node === 'object') {
      const out: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(node)) {
        if (DROP.has(k)) continue
        if (k === 'properties' && v && typeof v === 'object') {
          // Alan adları kısıt anahtarlarıyla çakışabilir; onları silmeden yalnızca içlerini gez.
          out[k] = Object.fromEntries(Object.entries(v).map(([name, child]) => [name, walk(child)]))
          continue
        }
        out[k] = walk(v)
      }
      return out
    }
    return node
  }
  return walk(raw) as Record<string, unknown>
}
