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
    case 'reflection':
      return {
        title: s(ctx.title, 'Akşamki tartışma'),
        suggestedFeelings: ['kirildim', 'gorulmedim'],
        suggestedNeeds: ['duyulmak', 'onemsenmek'],
        reflection: `${s(ctx.owner, 'Siz')}, anlattıklarınızı okudum. O an söylediklerinizin karşılık bulmadığını ve içinizde “yine aynı yerdeyiz” duygusunun büyüdüğünü hissediyorum. Bu sizin için kolay bir an olmamış.`,
      }
    case 'event_reflection':
      return {
        reflection: `Anladığım kadarıyla ${s(ctx.owner, 'siz')}, küçük bir konuşma olarak başlayan şey kısa sürede büyüyen bir tartışmaya dönüşmüş ve sonunda ikiniz de birbirinizden uzaklaşmışsınız.`,
      }
    case 'feedback':
      return {
        feedback: `${s(ctx.owner, 'Siz')}, anlattıklarınızdan o akşam söylediklerinizin karşılık bulmadığını, içinizden "yine aynı yerdeyiz" diye geçtiğini anlıyorum. Sesinizin yükselmesi, aslında duyulmak için verdiğiniz bir çaba gibi görünüyor.\n\nSeçtiğiniz hislerin arasında öfke var, ama onun hemen altında bir kırgınlık ve yalnızlık duygusu da seziliyor. Böyle bir anda hem kızgın hem kırgın olmak çok anlaşılır; bu iki duygu sık sık birlikte gelir.`,
      }
    case 'perspective':
      return mockPerspective(s(ctx.narrator, 'Partnerin'), s(ctx.reader, 'Sen'))
    case 'shared_report':
      return { ...mockShared(s(ctx.a, 'A'), s(ctx.b, 'B')), history: mockHistory(ctx.history) }
    case 'my_report':
      return {
        ...mockMine(s(ctx.owner, 'Siz'), s(ctx.partner, 'Eşiniz'), ctx.solo === true),
        history: mockHistory(ctx.history),
      }
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
  }
}

function mockHistory(previous: unknown) {
  return typeof previous === 'string' && previous
    ? `“${previous}” meselesinde de benzer bir an vardı: biri susunca diğeri üstüne gelmişti. Bu kez ikiniz de durmaya biraz daha erken karar verdiniz; bu küçük ama gerçek bir ilerleme.`
    : ''
}

function mockShared(a: string, b: string): SharedReport {
  return {
    history: '',
    opening: `${a} ve ${b}, ikiniz de bu meseleye oturup kendi tarafınızı anlatma cesaretini gösterdiniz. Bu, döngüyü kırmanın ilk adımı.`,
    cycle: {
      name: 'Kapanan Kapı ve Çalan Zil',
      summary: `${a} içine kapandıkça ${b} üstüne geliyor; ${b} ısrar ettikçe ${a} daha çok çekiliyor.`,
      steps: [
        {
          partner: 'A',
          short: 'susup içine kapanıyor',
          trigger: 'Yükselen ses tonu',
          feeling: 'Yetersiz hissetmek',
          reaction: 'Susmak, içine kapanmak',
        },
        {
          partner: 'B',
          short: 'üstüne gidiyor',
          trigger: `${genitive(a)} sessizliği`,
          feeling: 'Yalnız ve görülmemiş hissetmek',
          reaction: 'Israr etmek, sesi yükseltmek',
        },
        {
          partner: 'A',
          short: 'odadan çıkıyor',
          trigger: `${genitive(b)} ısrarı`,
          feeling: 'Köşeye sıkışmış hissetmek',
          reaction: 'Ortamı terk etmek',
        },
      ],
      enemy: `Düşmanınız birbiriniz değil; "kapanan kapı ve çalan zil" döngüsü. Bu döngünün adını koyduğunuzda, ona karşı birlikte durabilirsiniz.`,
    },
    breakCycle: {
      explain: `Bu döngüyü kırmak hiç tartışmamak demek değil; tartışmanın gidişini değiştirmek demek. İkinizden biri "yine başladık" diye fark edip adını koyduğunda bile döngü biraz gevşer.`,
      namingPhrase: 'Dur bir, yine kapı-zil döngüsüne giriyoruz.',
      exits: [
        {
          partner: 'A',
          moment: 'Susup içine kapanmak üzereyken',
          instead: 'Kapıyı çarpıp çıkmak yerine ne zaman döneceğini söyleyip mutfağa geçmek',
          say: 'Şu an susacağım ama gitmiyorum; çayı koyup on dakikaya geliyorum.',
        },
        {
          partner: 'B',
          moment: 'Arkasından gidip sesini yükseltmek üzereyken',
          instead: 'Peşinden gitmek yerine onun döneceğine güvenip beklemek',
          say: 'Tamam, bekliyorum. Döndüğünde konuşalım.',
        },
      ],
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
    lenses: {
      cbt: {
        reading: `${a} "beni dinlemiyor" diye düşündüğünde kırgınlık öfkeye dönüşüyor ve sesini yükseltiyor; ${b} "yine eleştiriliyorum" diye düşündüğünde geri çekiliyor. İkinizde de zihin okuma var: diğerinin niyetini sormadan biliyormuş gibi davranıyorsunuz.`,
        practice: `Bu hafta, aynı his geldiğinde bir not alın: durum, aklınızdan geçen cümle, hissettiğiniz ve daha dengeli bir alternatif ("Belki o an yorgundu"). Akşam bu notlardan birini birbirinize okuyun.`,
      },
      ta: {
        reading: `${a} o an Eleştirel Ebeveyn'den ("Sen hep…") konuşuyor; ${b} ise Uyumlu Çocuk gibi susup çekiliyor. Bu çapraz işlem konuşmayı tıkıyor; ikiniz de Yetişkin'e geçemiyorsunuz.`,
        practice: `"Sen hep…" yerine Yetişkin cümlesi deneyin: "Şu an konuşmak istediğim şey şu; senin için uygun mu?" ${b} de susmak yerine "Şu an bunaldım, yarım saat sonra konuşalım" desin.`,
      },
      gottman: {
        reading: `Bu tartışmada eleştiri ve duvar örme birlikte görünüyor: biri suçlayarak başlıyor, diğeri bunalıp sessizleşiyor. Sesler yükseldiğinde ikiniz de duygusal taşma yaşıyor, gelen küçük onarım girişimlerini kaçırıyorsunuz.`,
        practice: `Bir sonraki konuşmayı yumuşak başlangıçla açın: "Ben … hissettim, … ihtiyacım var." Taşma hissedildiğinde mola verin ama dönüş saatini söyleyin ve o saatte gerçekten geri dönün.`,
      },
    },
    repairSteps: [
      {
        title: 'Konuyu suçlamadan açmak',
        who: 'A',
        moment: 'Akşam yemekte hafta sonu planı açıldığında',
        action: 'Telefonlar masadan kalkar; önce kendi hissinizi söyleyin, sonra soru sorun.',
        phrase: 'Hafta sonu planını konuşurken telefona bakınca kendimi yalnız hissettim; şimdi beş dakika sadece bunu konuşabilir miyiz?',
        why: 'Konuşma suçlamayla değil hisle başlayınca karşı taraf savunmaya geçmez.',
      },
      {
        title: 'Geri dönüşü söyleyen mola',
        who: 'B',
        moment: 'Sesler yükselip odadan çıkmak istediğinizde',
        action: 'Kapıyı çarpmadan, ne zaman döneceğinizi söyleyerek çıkın.',
        phrase: 'Şu an bunaldım, mutfağı toplayıp yarım saat sonra yanına geleceğim ve konuşacağız.',
        why: 'Dönüş sözü verilen mola terk edilmek gibi hissettirmez.',
      },
      {
        title: 'Küçük onarımı görmek',
        who: 'ikisi',
        moment: 'Ertesi sabah kahvaltıda sessizlik olduğunda',
        action: 'Diğerinin attığı küçük adımı (çay getirmek, bir soru) geri çevirmeyin, karşılık verin.',
        phrase: 'Çayı getirmen iyi geldi; dünkü konuşmaya akşam birlikte dönelim mi?',
        why: 'Onarım girişimi karşılık bulunca döngü sıfırlanır.',
      },
    ],
    tonight:
      'Bu akşam telefonları kenara koyup 15 dakika yan yana oturun ve birbirinize sadece şunu sorun: "O an en çok neye ihtiyacın vardı?"',
    closing: 'Bu döngüyü fark etmek, onu değiştirmenin yarısı. Gerisini birlikte, küçük adımlarla yürüyeceksiniz.',
    safety: { concern: false, message: '' },
  }
}

function mockMine(owner: string, partner: string, solo: boolean): MyReport {
  return {
    history: '',
    greeting: `${owner}, bu meseleye dürüstçe baktığınız için teşekkürler. Şimdi yalnızca sizin göreceğiniz bir aynaya ve bu akşam için bir yol haritasına bakalım.`,
    feelings: `Tartışmanın içinde daha çok öfke ve haksızlık duygusu öne çıkmış; tartışma bittikten sonra ise yerini yalnızlığa ve kırgınlığa bırakmış görünüyor. Bu sık görülen bir geçiş: öfke çoğu zaman daha kırılgan bir duygunun önünde durur ve ses kesilince o duygu görünür olur. Sizi en çok etkileyen his, ${dative(partner)} ulaşamadığınız o anla bağlantılı görünüyor; altında görülmek ve önemsenmek ihtiyacı var gibi.`,
    partnerInner: `${solo ? 'Anlattıklarınızdan yola çıkarsak, muhtemelen ' : ''}${partner} o an önemsenmediğini hissediyordu; asıl ihtiyacı, sizin için öncelikli olduğunu bilmekti.`,
    partnerNeed: `${genitive(partner)} en çok ihtiyacı, sizin için öncelikli olduğunu bilmekti.`,
    needGuess: {
      match: solo ? 'tahmin' : 'kısmen',
      text: `Siz ${dative(partner)} biraz yalnız kalmak istediğini düşünmüşsünüz. Bu kısmen doğru; ama ${partner} aynı zamanda geri dönüleceğini, konunun yarım bırakılmayacağını bilmek istiyordu.`,
    },
    yourPlace: `Bu döngüde siz daha çok geri çekilen taraftasınız. Sessizliğiniz sizin için mola, ${genitive(partner)} içinse kapanan bir kapı.`,
    patterns: [
      {
        name: 'Genelleme',
        seenIn: '“Bu hep böyle olacak” düşüncenizde.',
        reframe: 'Bu kez böyle oldu; bir dahakini farklı yönetebiliriz.',
      },
      {
        name: 'Zihin okuma',
        seenIn: 'Onun sizi bilerek dinlemediğini varsaymanızda.',
        reframe: 'Belki o da yorgundu; ona sormadan bilemem.',
      },
    ],
    needsLanguage: {
      explain:
        'İhtiyacınızı suçlamadan söylemek için önce ne gördüğünüzü, sonra ne hissettiğinizi, en son neye ihtiyaç duyduğunuzu ve küçük bir ricayı söyleyin.',
      insteadOf: 'Sen beni hiç dinlemiyorsun.',
      say: 'Konuşurken telefona baktığında kendimi önemsiz hissettim; beni dinlediğini bilmeye ihtiyacım var. Birkaç dakika sadece bana odaklanabilir misin?',
    },
    understanding: `Senin o akşam çok yorgun olduğunu ve benim ısrarımın sana yük gibi geldiğini şimdi daha iyi anlıyorum.`,
    tonight: {
      opener: 'Dünkü konuşmayı kavga etmeden, sadece birbirimizi anlamak için bir kez daha konuşabilir miyiz?',
      steps: [
        'Önce onu dinleyin, araya girmeden.',
        'Duyduğunuzu kendi cümlelerinizle geri söyleyin.',
        'Sonra kendi ihtiyacınızı yukarıdaki cümleyle söyleyin.',
      ],
      avoid: '“Sen hep…” ya da “Sen hiç…” ile başlayan cümleler.',
    },
    selfChange: 'Sesiniz yükselmeye başladığında “20 dakika ara verip döneceğim” deyip gerçekten geri dönmek.',
    strength: 'Kendi payınızı görmeye istekli olmanız bu ilişkideki en değerli kaynaklardan biri.',
    closing: 'Kendinizi korumaya çalışmanız bir kusur değil; sadece daha iyi bir yol öğreniyorsunuz.',
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
      ...section(`${a} çekildikçe ${b} yaklaşıyor; ${b} yaklaştıkça ${a} çekiliyor.`, ['Takip – geri çekilme döngüsü']),
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
        'Aynı döngü sık tekrar ediyor ve sizi yoruyorsa, bir aile ya da çift danışmanıyla birkaç seans çalışmak bu döngüyü çok daha hızlı değiştirebilir.',
    },
    safety: { concern: false, message: '' },
  }
}
