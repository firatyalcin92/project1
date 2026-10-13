import '@tanstack/react-start/server-only'
import type { MyReport, Perspective, RelationshipReport, SharedReport } from '~/lib/report-schemas'
import { dative, genitive } from '~/lib/turkish'
import type { AiTask } from './mesele.server'

/**
 * AI anahtarı olmadan uygulamayı uçtan uca denemek için örnek çıktılar.
 * Gerçek bir analiz değildir; yalnızca arayüzü ve akışı göstermek içindir.
 */

const s = (v: unknown, fallback: string) => (typeof v === 'string' && v.trim() ? v : fallback)

export function mockGenerate(task: AiTask, ctx: Record<string, unknown>): unknown {
  switch (task) {
    case 'perspective':
      return mockPerspective(s(ctx.narrator, 'Partnerin'), s(ctx.reader, 'Sen'))
    case 'shared_report':
      return mockShared(s(ctx.a, 'A'), s(ctx.b, 'B'))
    case 'my_report':
      return mockMine(s(ctx.owner, 'Sen'), s(ctx.partner, 'Partnerin'))
    case 'relationship_report':
      return mockRelationship(s(ctx.a, 'A'), s(ctx.b, 'B'))
  }
}

function mockPerspective(narrator: string, reader: string): Perspective {
  return {
    headline: `${narrator} için o an, görülmeyi beklediği bir andı.`,
    story: `${narrator} o akşamı, içinde biriken yorgunluğu paylaşmak isteyerek başlattığını anlatıyor. Söyledikleri karşılık bulmadığında, sözlerinin havada asılı kaldığını hissetmiş.\n\nSonra ses tonları yükseldikçe ${narrator} kendini korumaya çalışmış; ama içinde asıl istediği şey kavga değil, yanında birinin olduğunu bilmekmiş.`,
    beneath: `Yükselen sesin altında belki de yalnız kalma korkusu vardı.`,
    need: `${narrator} en çok, "Seni duyuyorum, buradayım" cümlesine ihtiyaç duymuş.`,
    readingNote: `${reader}, bunu okurken savunmaya geçmek çok doğal; bir an durup sadece merak etmeyi dene.`,
  }
}

function mockShared(a: string, b: string): SharedReport {
  return {
    opening: `${a} ve ${b}, ikiniz de bu meseleye oturup kendi tarafınızı anlatma cesaretini gösterdiniz. Bu, döngüyü kırmanın ilk adımı.`,
    cycle: {
      name: 'Kapanan Kapı ve Çalan Zil',
      summary: `${a} içine kapandıkça ${b} üstüne geliyor; ${b} ısrar ettikçe ${a} daha çok çekiliyor.`,
      steps: [
        {
          partner: 'A',
          trigger: 'Yükselen ses tonu',
          feeling: 'Yetersiz hissetmek',
          reaction: 'Susmak, içine kapanmak',
        },
        {
          partner: 'B',
          trigger: `${genitive(a)} sessizliği`,
          feeling: 'Yalnız ve görülmemiş hissetmek',
          reaction: 'Israr etmek, sesi yükseltmek',
        },
        {
          partner: 'A',
          trigger: `${genitive(b)} ısrarı`,
          feeling: 'Köşeye sıkışmış hissetmek',
          reaction: 'Ortamı terk etmek',
        },
      ],
      enemy: `Düşmanınız birbiriniz değil; "kapanan kapı ve çalan zil" dansı. Bu dansın adını koyduğunuzda, ona karşı birlikte durabilirsiniz.`,
    },
    whoIsRight: {
      answer:
        'Bu soruya dürüst cevap şu: İkiniz de bir şeyde haklısınız ve ikiniz de aynı şeyi kaybetmekten korkuyorsunuz.',
      pointA: `${a}, sesler yükseldiğinde konuşmaya devam etmenin işe yaramadığını söylerken haklı.`,
      pointB: `${b}, bir konunun yarım bırakılmasının kendisini yalnız hissettirdiğini söylerken haklı.`,
      realIssue: 'Asıl mesele konunun kendisi değil; zor bir anda birbirinize güvenip güvenemeyeceğiniz.',
    },
    needs: {
      a: `${a} sakinleşmek için bir alana ve suçlanmadığını bilmeye ihtiyaç duyuyor.`,
      b: `${b} geri dönüleceğini bilmeye ve yalnız bırakılmamaya ihtiyaç duyuyor.`,
      commonGround: 'İkiniz de aynı şeyi arıyorsunuz: zor anda bile "biz" olduğunuzu hissetmek.',
    },
    repairSteps: [
      {
        title: 'Söz vererek mola',
        when: 'Sesler yükselmeye başladığında',
        phrase: 'Şu an çok doldum; 20 dakika ara verelim, sonra dönüp seninle konuşacağım.',
        why: 'Mola terk etmek değil; dönüş sözü verildiğinde güven korunur.',
      },
      {
        title: 'Yumuşak başlangıç',
        when: 'Konuyu yeniden açarken',
        phrase: 'Seni suçlamak istemiyorum; o an kendimi yalnız hissettim ve bunu konuşmak istiyorum.',
        why: '"Ben" dili savunmayı düşürür, kapıyı aralar.',
      },
      {
        title: 'İhtiyacı söylemek',
        when: 'Sakinleştikten sonra',
        phrase: 'Bana en çok iyi gelecek şey, sadece yanımda olduğunu bilmek.',
        why: 'Ulaşılabilir bir ihtiyaç, partnerin ne yapacağını bilmesini sağlar.',
      },
    ],
    tonight:
      'Bu akşam telefonları kenara koyup 15 dakika yan yana oturun ve birbirinize sadece şunu sorun: "O an en çok neye ihtiyacın vardı?"',
    closing: 'Bu döngüyü fark etmek, onu değiştirmenin yarısı. Gerisini birlikte, küçük adımlarla yürüyeceksiniz.',
    safety: { concern: false, message: '' },
  }
}

function mockMine(owner: string, partner: string): MyReport {
  return {
    greeting: `${owner}, bu meseleye dürüstçe baktığın için teşekkürler. Şimdi sadece senin göreceğin bir aynaya bakalım.`,
    mirror: {
      partnerWords: 'Hiç umursamıyorsun',
      meaning: `${partner} "Hiç umursamıyorsun" derken aslında hissettiği, senin için önemli olup olmadığına dair bir korkuydu.`,
    },
    yourPlace: `Bu dansta sen daha çok geri çekilen taraftasın: gerginlik arttığında susmak seni korumanın yolu. Ama bu sessizlik ${dative(partner)} kapanan bir kapı gibi görünüyor.`,
    blindSpots: [
      {
        title: 'Sessizliğin yankısı',
        insight: `Senin için mola olan sessizlik, ${partner} için terk edilmişlik gibi yankılanabiliyor.`,
      },
      { title: 'Çözüm acelesi', insight: 'Hemen çözüm önermek bazen "seni duymadım" gibi algılanabiliyor.' },
    ],
    strength: 'Kendi payını görmeye istekli olman, bu ilişkideki en değerli kaynaklardan biri.',
    repair: {
      suggestion: 'Bir dahaki sefere çekilmeden önce, ne zaman döneceğini söyleyerek çekil.',
      phrase: 'Seni bırakmıyorum; biraz sakinleşip yanına geleceğim.',
    },
    selfCompassion: 'Kendini korumaya çalışman bir kusur değil; sadece daha iyi bir yol öğreniyorsun.',
    safety: { concern: false, message: '' },
  }
}

function mockRelationship(a: string, b: string): RelationshipReport {
  const section = (body: string, highlights: string[] = []) => ({ body, highlights })
  return {
    headline: `${a} ve ${b}, birbirine dönmeyi öğrenen bir çift.`,
    story: section(
      `Birlikte tamamladığınız meselelere bakınca, kavgalarınızın konuları değişse de altındaki duygunun benzer kaldığını görüyoruz.\n\nHer seferinde masaya oturmanız, ilişkinize verdiğiniz değerin en açık göstergesi.`,
      ['Konular değişiyor, döngü benziyor', 'Masaya oturma isteği güçlü'],
    ),
    coreCycle: {
      ...section(`${a} çekildikçe ${b} yaklaşıyor; ${b} yaklaştıkça ${a} çekiliyor.`, ['Takip – geri çekilme dansı']),
      cycleName: 'Kapanan Kapı ve Çalan Zil',
    },
    triggers: section('En sık tetikleyiciler yorgun akşamlar ve yarım kalan konuşmalar.', [
      'Yorgun akşamlar',
      'Yarım kalan konuşmalar',
    ]),
    emotionMap: section(`${a} daha çok yetersiz ve eleştirilmiş, ${b} daha çok yalnız ve görülmemiş hissediyor.`),
    attachmentNeeds: section(`${a} için güven ve kabul, ${b} için yakınlık ve ulaşılabilirlik öne çıkıyor.`),
    horsemen: {
      ...section('Dört Atlı ilişkinizde zaman zaman beliriyor ama yerleşmiş değil.'),
      items: [
        {
          name: 'Eleştiri',
          level: 'zaman zaman',
          note: 'Şikâyet bazen kişiliğe yöneliyor.',
          antidote: '"Sen hep" yerine "Ben o an…" ile başlamak.',
        },
        {
          name: 'Aşağılama',
          level: 'nadiren',
          note: 'Alaycı cümleler seyrek.',
          antidote: 'Gün içinde küçük takdirleri dile getirmek.',
        },
        {
          name: 'Savunma',
          level: 'zaman zaman',
          note: 'Suçlanınca hemen kendini açıklama.',
          antidote: 'Küçük bir payı sahiplenmek: "Haklısın, bu kısmı ben yaptım."',
        },
        {
          name: 'Duvar Örme',
          level: 'sık',
          note: 'Gerginlikte susma ve uzaklaşma belirgin.',
          antidote: 'Dönüş sözüyle verilen 20 dakikalık mola.',
        },
      ],
    },
    strengths: section('Kendi payınızı görebiliyorsunuz ve onarım cümlelerine açıksınız.', [
      'Sorumluluk alma',
      'Merak',
    ]),
    growth: section('Molayı terk etmeden almak ve ihtiyacı suçlamadan söylemek.', [
      'Söz vererek mola',
      'Yumuşak başlangıç',
    ]),
    path: {
      ...section('Önümüzdeki dönemde küçük ama düzenli ritüeller, büyük konuşmalardan daha çok işe yarayacak.'),
      rituals: [
        { title: 'Akşam 10 dakikası', description: 'Günün en zor ve en güzel anını birbirinize anlatın.' },
        {
          title: 'Haftalık "biz" saati',
          description: 'Haftada bir kez, sorun konuşmadan sadece birlikte vakit geçirin.',
        },
      ],
      professionalNote:
        'Aynı döngü sık tekrar ediyor ve sizi yoruyorsa, bir aile ya da çift danışmanıyla birkaç seans çalışmak bu dansı çok daha hızlı değiştirebilir.',
    },
    safety: { concern: false, message: '' },
  }
}
