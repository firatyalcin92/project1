import { z } from 'zod'
import { FEELING_CHIPS, NEED_CHIPS } from './questions'

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
// 1. Adım: Danışmanın yansıtması (3. sorudan önce)
// ---------------------------------------------------------------------------

export const ReflectionSchema = z.object({
  reflection: z
    .string()
    .min(1)
    .describe(
      'Kişinin anlattıklarına 2-3 cümlelik, "siz" hitaplı, sıcak bir yansıtma. Soru sorma, yorum ya da tavsiye verme.',
    ),
  title: z
    .string()
    .min(1)
    .describe(
      'Meseleye 2-4 kelimelik, suçlamasız, tarafsız bir ad (ör. "Cumartesi akşamı planı", "Annemlerin ziyareti"). Kimseyi suçlamaz, duygu içermez.',
    ),
  suggestedFeelings: z
    .array(z.enum(FEELING_CHIPS.map((c) => c.id) as [string, ...string[]]))
    .max(4)
    .describe('Anlatılana göre kişinin muhtemelen yaşadığı 2-4 duygu (listeden kimlik). Anlatım desteklemiyorsa boş.'),
  suggestedNeeds: z
    .array(z.enum(NEED_CHIPS.map((c) => c.id) as [string, ...string[]]))
    .max(4)
    .describe('Anlatılana göre kişinin muhtemel 2-4 ihtiyacı (listeden kimlik). Anlatım desteklemiyorsa boş.'),
})

export type Reflection = z.infer<typeof ReflectionSchema>

// ---------------------------------------------------------------------------
// 2. Adım: "[Partner]'ın Gözünden"
// ---------------------------------------------------------------------------

export const PerspectiveSchema = z.object({
  headline: z
    .string()
    .min(1)
    .describe(
      "Anlatanın o an yaşadığını özetleyen, öznesi ve yüklemi tam, dilbilgisi açısından kusursuz tek cümle. Örn: 'Ayşe o akşam görülmeyi bekledi.' ('X için o akşam … bir andı' gibi düşük cümleler kurma)",
    ),
  story: z
    .string()
    .min(1)
    .describe(
      'Anlatan kişinin yaşadıklarının iki kısa paragraflık şefkatli yeniden anlatımı. Anlatandan adıyla, üçüncü şahısla bahset; okuyan kişiye "sen" diye hitap et ve ondan bahsederken adını değil "sen / senin / sana" kullan (ör. "senin çıkardığın sözler onu derinden etkiledi"). Paragrafları boş satırla ayır. Suçlayıcı ifadeleri yumuşat ama anlamı değiştirme.',
    ),
  beneath: z
    .string()
    .min(1)
    .describe(
      "Görünen tepkinin altındaki birincil duygu. Örn: 'Sesinin yükselmesinin altında belki de yalnız kalma korkusu vardı.'",
    ),
  need: z.string().min(1).describe('O an en çok neye ihtiyaç duyduğu, tek cümle.'),
})

export type Perspective = z.infer<typeof PerspectiveSchema>

// ---------------------------------------------------------------------------
// 4. Adım: Ortak Rapor — Döngü Analizi ve İhtiyaç Aynası
// ---------------------------------------------------------------------------

export const SharedReportSchema = z.object({
  opening: z.string().min(1).describe('İkisine birlikte seslenen, 2-3 cümlelik sıcak açılış.'),
  history: z
    .string()
    .describe(
      'Sizi tanıdıkça: önceki meselelerle gerçekten tekrar eden örüntü ya da görülen ilerleme, meselenin adını anarak 2-4 cümle. Gerçek bir bağ yoksa ya da önceki mesele yoksa boş metin.',
    ),
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
          short: z
            .string()
            .min(1)
            .describe(
              'Döngü çemberinde kişinin adının altında gösterilecek 2-5 kelimelik özet, ad OLMADAN. Örn: "odadan çıkıyor"',
            ),
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
      .describe(
        'Döngüyü dışsallaştıran cümle: düşmanınız birbiriniz değil, aranıza yerleşen bu döngü. ("dans" kelimesini kullanma)',
      ),
  }),
  breakCycle: z
    .object({
      explain: z
        .string()
        .min(1)
        .describe(
          'Bu çift için döngüyü kırmanın ne demek olduğu, 2-3 sade cümle: çatışmayı yok etmek değil biçimini değiştirmek; birinin fark edip adını koyması bile yeter.',
        ),
      namingPhrase: z
        .string()
        .min(1)
        .describe(
          'Döngü başladığında ikisinden birinin söyleyeceği, döngünün adını anan kısa, gündelik cümle, tırnaksız.',
        ),
      exits: z
        .array(
          z.object({
            partner: z.enum(['A', 'B']),
            moment: z.string().min(1).describe('Döngüde bu kişinin kendi otomatik tepkisine geçmek üzere olduğu an'),
            instead: z
              .string()
              .min(1)
              .describe('O an bunun yerine yapacağı küçük, gündelik, bu meseleye özgü davranış'),
            say: z.string().min(1).describe('O an söyleyeceği kısa cümle, tırnaksız, "sen" hitabıyla partnerine'),
          }),
        )
        .min(2)
        .max(2)
        .describe('Her partnerin döngüden çıkış kapısı: önce A, sonra B. Kendi payını görmek.'),
    })
    .describe('Döngüyü kırmak: isimlendirme ve her birinin kendi çıkış kapısı.'),
  whoIsRight: z.object({
    answer: z.string().min(1).describe("'Kim haklı?' sorusuna dürüst ama hüküm vermeyen, 2-3 cümlelik cevap."),
    pointA: z
      .string()
      .min(1)
      .describe('A kişisinin bu olayda somut olarak haklı olduğu davranış/tutum, adıyla. İhtiyaç kelimesi kullanma.'),
    pointB: z
      .string()
      .min(1)
      .describe('B kişisinin bu olayda somut olarak haklı olduğu davranış/tutum, adıyla. İhtiyaç kelimesi kullanma.'),
    realIssue: z
      .string()
      .min(1)
      .describe(
        'Görünen konu ile asıl dönen şey arasındaki fark, tek cümle. İhtiyaçları sayma (onlar needs alanında).',
      ),
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
    .describe(
      'Döngü yeniden başladığında kullanılacak tam 3 adım: yumuşak başlangıç, mola, onarım girişimini kabul etmek.',
    ),
  tonight: z.string().min(1).describe('Bugün için somut, küçük bir yeniden bağlanma önerisi.'),
  closing: z.string().min(1).describe('Umut veren, kısa kapanış.'),
  safety: Safety,
})

export type SharedReport = z.infer<typeof SharedReportSchema>

// ---------------------------------------------------------------------------
// 4. Adım: Kişisel Rapor — Size Özel Ayna ve Yönlendirme
// ---------------------------------------------------------------------------
// Ortak rapordan farkı: döngüyü yeniden anlatmaz; kişiye ne yapacağını, ne
// söyleyeceğini ve hangi düşünce kalıbına dikkat edeceğini söyler.

export const MyReportSchema = z.object({
  greeting: z.string().min(1).describe('Okuyana adıyla, "siz" diye seslenen 2 cümlelik sıcak açılış.'),
  history: z
    .string()
    .describe(
      'Okuyanın önceki meselelerinden bu meseleye taşınan kendi kalıbı ya da ilerlemesi (ör. geçen sefer kurduğu cümleyi denedi mi), 2-3 cümle. Gerçek bir bağ yoksa ya da önceki mesele yoksa boş metin.',
    ),
  feelings: z
    .string()
    .min(1)
    .describe(
      'Okuyanın tartışma sırasında ve sonrasında hissettiklerinin yorumu, 3-5 cümle: hisler arasındaki ilişki, en çok etkileyen his ve nedeni; olay ve karşılanmamış ihtiyaçla bağlantısı. Hisleri liste hâlinde sayma; tanı koyma; bilgi yetersizse belirsizliği söyle.',
    ),
  partnerInner: z
    .string()
    .min(1)
    .describe(
      'Partnerin o an iç dünyasında olan: hissettiği birincil duygu ve ihtiyacı, ihtiyaç diliyle. Partnerin cümlelerini ASLA aynen alıntılama.',
    ),
  partnerNeed: z
    .string()
    .min(1)
    .describe(
      'Partnerin bu tartışmadaki duygusal ihtiyacı; tek, doğrudan cümle (ör. "Ayşe’nin en çok ihtiyacı, sizin için öncelikli olduğunu bilmekti."). Bireysel modda olası ihtiyaç.',
    ),
  needGuess: z
    .object({
      match: z
        .enum(['yakın', 'kısmen', 'uzak', 'tahmin'])
        .describe('Okuyanın partner ihtiyacı tahmini gerçeğe ne kadar yakın; bireysel modda "tahmin".'),
      text: z
        .string()
        .min(1)
        .describe(
          'Okuyanın partnerin ihtiyacına dair tahmini ile partnerin asıl ihtiyacının karşılaştırması, 2-3 cümle.',
        ),
    })
    .describe('Bakış açısı alma: "Siz onun şuna ihtiyaç duyduğunu düşünmüşsünüz; aslında…"'),
  yourPlace: z
    .string()
    .min(1)
    .describe('Okuyanın döngüdeki yeri, 2 cümle. Ortak rapordaki döngü anlatımını tekrar etme.'),
  patterns: z
    .array(
      z.object({
        name: z
          .string()
          .min(1)
          .describe(
            'Kalıbın adı: Felaketleştirme, Genelleme (hep/hiç), Zihin okuma, Etiketleme, Kişiselleştirme, Meli-malı düşüncesi, Cezalandırma isteği, Talep dili, Suçlama, Savunma, Duvar örme vb.',
          ),
        seenIn: z.string().min(1).describe('Okuyanın KENDİ anlatımında bunun nerede göründüğü, kısaca.'),
        reframe: z.string().min(1).describe('Aynı düşüncenin yapıcı, gerçekçi hâli.'),
      }),
    )
    .max(3)
    .describe('Okuyanın kendi cevaplarında görülen bilişsel çarpıtmalar ve iletişim kalıpları (yoksa boş dizi).'),
  needsLanguage: z.object({
    explain: z
      .string()
      .min(1)
      .describe('İhtiyacını partnerine suçlamadan nasıl söyleyeceği: gözlem → duygu → ihtiyaç → rica, 2-3 cümle.'),
    insteadOf: z.string().min(1).describe('Muhtemelen kurduğu ya da kuracağı suçlayıcı/talep cümlesi, tırnaksız.'),
    say: z
      .string()
      .min(1)
      .describe('Bunun yerine birebir kurması gereken ihtiyaç dili cümlesi, tırnaksız, "sen" hitabıyla partnere.'),
  }),
  understanding: z
    .string()
    .min(1)
    .describe('Partnerine onun bakış açısını anladığını gösteren, birebir söylenecek cümle, tırnaksız.'),
  tonight: z.object({
    opener: z.string().min(1).describe('Bu akşam konuşmayı açacağı ilk cümle, tırnaksız.'),
    steps: z.array(z.string().min(1)).min(3).max(3).describe('Konuşmayı yönetmek için 3 kısa adım.'),
    avoid: z.string().min(1).describe('Bu konuşmada kesinlikle kaçınması gereken tek şey.'),
  }),
  selfChange: z
    .string()
    .min(1)
    .describe('Kendinde değiştirmek istediği şeyi somut, uygulanabilir bir alışkanlığa çevir.'),
  strength: z.string().min(1).describe('Bu meselede gösterdiği bir güç ya da iyi niyet, tek cümle.'),
  closing: z.string().min(1).describe('Kısa, umut veren kapanış; tek cümle.'),
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
  }).describe('2. Tekrarlayan döngünüz: ana kısırdöngü (takip/geri çekilme vb.).'),
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
