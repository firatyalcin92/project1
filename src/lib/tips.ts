/**
 * Karşılama ekranında dönen kısa bilgi notları: ilişkiler ve çift terapisi üzerine.
 * source: yaklaşımın adı (Gottman, BDT, TA, DOT…) ya da genel.
 */
export type Tip = { text: string; source: string }

export const TIPS: readonly Tip[] = [
  {
    source: 'Gottman',
    text: 'Gottman’ın araştırmalarında uzun süre birlikte kalan çiftler, tartışırken bile her olumsuz etkileşime karşılık yaklaşık beş olumlu etkileşim yaşıyor.',
  },
  {
    source: 'Gottman',
    text: 'İlişkiyi en çok yıpratan dört tutum: eleştiri, aşağılama, savunma ve duvar örme. Gottman bunlara “kıyametin dört atlısı” der.',
  },
  {
    source: 'Gottman',
    text: 'Aşağılama (alay, göz devirme, küçümseme) dört atlının en zararlısıdır. Panzehiri, karşınızdakine dair takdir ve saygıyı her gün dile getirmektir.',
  },
  {
    source: 'Gottman',
    text: 'Çiftlerin anlaşmazlıklarının büyük kısmı hiç tam çözülmeyen, kalıcı farklılıklardır. Amaç onları yok etmek değil, onlar hakkında kırmadan konuşabilmektir.',
  },
  {
    source: 'Gottman',
    text: 'Bir konuşma nasıl başlarsa büyük ölçüde öyle biter. “Sen hep…” yerine “Ben … hissettim, … ihtiyacım var” diye başlamak buna yumuşak başlangıç denir.',
  },
  {
    source: 'Gottman',
    text: 'Kalbiniz hızla çarpıyor, düşünemiyor ve yalnızca kaçmak ya da saldırmak istiyorsanız “taşmış” olabilirsiniz. Bu anda en iyi şey ara vermektir.',
  },
  {
    source: 'Gottman',
    text: 'İyi bir mola, dönüş saati belli olan moladır. “Yirmi dakika ara verelim, sonra kaldığımız yerden konuşalım” demek, kaçmakla aynı şey değildir.',
  },
  {
    source: 'Gottman',
    text: 'Molada kafanızda kavgayı sürdürmeyin. Yürüyüş, nefes ya da müzik gibi sizi gerçekten sakinleştiren bir şey yapın.',
  },
  {
    source: 'Gottman',
    text: 'Partnerinizin gerginliği azaltma çabaları (bir şaka, bir dokunuş, “haklısın galiba”) onarım girişimidir. Onları fark edip kabul etmek, tartışmanın yönünü değiştirir.',
  },
  {
    source: 'Gottman',
    text: 'Gün içindeki küçük “bak şuna” anları birer bağlantı davetidir. Bu davetlere dönüp ilgi göstermek, güvenin sessizce biriktiği yerdir.',
  },
  {
    source: 'Gottman',
    text: 'Savunmanın panzehiri sorumluluk almaktır. Küçük bir pay bile olsa “Bu kısımda haklısın, ben de geç haber verdim” demek ortamı yumuşatır.',
  },
  {
    source: 'Gottman',
    text: 'Duvar örmenin panzehiri, kendinizi sakinleştirip konuşmaya geri dönmektir. Susmak bazen gerekir; ama dönüşünüzü söyleyerek susun.',
  },
  {
    source: 'Gottman',
    text: 'Birbirinizin iç dünyasını bilmek (stresleri, hayalleri, küçük sevinçleri) zor günlerde ilişkiyi ayakta tutan haritadır. Ara ara güncelleyin.',
  },
  {
    source: 'BDT',
    text: 'Bilişsel davranışçı terapiye göre bizi en çok olayın kendisi değil, olaya verdiğimiz anlam etkiler. “Yine beni umursamadı” düşüncesi, duygunun yakıtı olabilir.',
  },
  {
    source: 'BDT',
    text: 'Zihin okuma, sık görülen bir düşünce tuzağıdır: karşınızdakinin niyetini sormadan bildiğinizi varsaymak. Sormak, varsaymaktan her zaman daha ucuzdur.',
  },
  {
    source: 'BDT',
    text: '“Hep” ve “hiç” kelimeleri genellikle doğru değildir ve karşı tarafı savunmaya iter. “Bu hafta iki kez oldu” demek hem daha doğru hem daha dinlenebilir.',
  },
  {
    source: 'BDT',
    text: 'Felaketleştirme, tek bir tartışmadan “bu ilişki bitecek” sonucuna atlamaktır. Kendinize sorun: elimdeki kanıt bunu gerçekten söylüyor mu?',
  },
  {
    source: 'BDT',
    text: '“Bunu kendisi bilmeliydi” diye düşünüyorsanız durun. İhtiyaçlar söylenmeden bilinmez; söylemek zayıflık değil, açıklıktır.',
  },
  {
    source: 'BDT',
    text: 'Tartışmadan sonra not alın: ne oldu, aklımdan ne geçti, ne hissettim, daha dengeli bir düşünce ne olabilir? Bu küçük alıştırma döngüyü görünür kılar.',
  },
  {
    source: 'BDT',
    text: 'Etiketlemek (“bencilsin”, “sorumsuzsun”) kişiyi suçlar; davranışı anlatmak (“bulaşıkları bıraktın”) ise çözülebilir bir sorun ortaya koyar.',
  },
  {
    source: 'TA',
    text: 'Transaksiyonel analize göre hepimiz Ebeveyn, Yetişkin ve Çocuk ego durumlarından konuşuruz. Tartışmalar çoğu zaman eleştiren Ebeveyn ile incinen Çocuk arasında geçer.',
  },
  {
    source: 'TA',
    text: 'Yetişkin ego durumu, şu anı ve gerçekleri konuşur: “Ne oldu, ne hissediyoruz, ne yapabiliriz?” Bir taraf Yetişkin’de kalınca, diğerinin de oraya geçmesi kolaylaşır.',
  },
  {
    source: 'TA',
    text: 'Çapraz işlem: siz Yetişkin’den bir soru sorarsınız, cevap Ebeveyn’den bir azar gelir. İletişim orada tıkanır. Fark etmek, düzeltmenin ilk adımıdır.',
  },
  {
    source: 'TA',
    text: 'Karpman’ın drama üçgeninde kişiler kurban, kurtarıcı ve suçlayıcı rolleri arasında döner. Rolü fark edip ihtiyacınızı doğrudan söylemek üçgenden çıkarır.',
  },
  {
    source: 'TA',
    text: 'İnsan tanınmak ister; transaksiyonel analiz buna “okşama” der. Küçük bir teşekkür ya da “seni görüyorum” demek, ilişkinin günlük besinidir.',
  },
  {
    source: 'DOT',
    text: 'Duygu odaklı terapiye göre pek çok kavga aslında “Benim için orada mısın?” sorusunun etrafında döner. Öfkenin altında çoğu zaman bağ kurma isteği vardır.',
  },
  {
    source: 'DOT',
    text: 'Sık görülen bir dans: biri üstüne gider, diğeri geri çekilir. Biri ne kadar ısrar ederse diğeri o kadar kaçar. Sorun kişiler değil, bu dansın kendisidir.',
  },
  {
    source: 'DOT',
    text: 'Geri çekilen taraf çoğu zaman umursamadığı için değil, kavgayı büyütmekten ya da yetersiz görünmekten korktuğu için susar.',
  },
  {
    source: 'DOT',
    text: 'Üstüne giden taraf çoğu zaman kontrolcü olduğu için değil, kopukluktan ve yalnız kalmaktan korktuğu için ısrar eder.',
  },
  {
    source: 'DOT',
    text: 'Öfke çoğu zaman ikincil bir duygudur. Altında kırgınlık, korku ya da yalnızlık olabilir. Asıl duyguyu söylemek, karşı tarafın yumuşamasını kolaylaştırır.',
  },
  {
    source: 'DOT',
    text: 'Döngüyü ortak düşmanınız olarak görün: “Biz yine o kısır döngüye girdik” demek, “Sen yine başladın” demekten çok daha birleştiricidir.',
  },
  {
    source: 'İletişim',
    text: 'Ben dili: “Sen beni hiç dinlemiyorsun” yerine “Konuşurken telefona bakınca dinlenmediğimi hissediyorum” demek suçlamayı ihtiyaca çevirir.',
  },
  {
    source: 'İletişim',
    text: 'Dinlediğinizi göstermenin en güçlü yolu yansıtmaktır: “Anladığım kadarıyla şunu hissettin… Doğru mu anladım?”',
  },
  {
    source: 'İletişim',
    text: 'Anlamak, onaylamak demek değildir. Partnerinizin bakış açısını anlamak için onunla aynı fikirde olmanız gerekmez.',
  },
  {
    source: 'İletişim',
    text: 'İstek ile talep farklıdır. İstek “hayır” cevabına yer bırakır; talep bırakmaz. İsteklerinizi somut ve küçük tutun: “Cuma akşamı birlikte yürüyelim mi?”',
  },
  {
    source: 'İletişim',
    text: 'Bir tartışmada tek konu konuşun. Eski meseleleri açmak, bugünkü konuyu çözülemez hâle getirir.',
  },
  {
    source: 'İletişim',
    text: 'Ses tonu, kelimeler kadar mesaj taşır. Aynı cümle sakin bir tonla bir davet, yükselen bir tonla bir suçlama gibi duyulur.',
  },
  {
    source: 'İletişim',
    text: '“Neden?” ile başlayan sorular çoğu zaman sorgu gibi duyulur. “Ne oldu?” ya da “Neye ihtiyacın vardı?” demek kapıyı daha çok açar.',
  },
  {
    source: 'İletişim',
    text: 'Önemli konuşmalar için zamanlama önemlidir. Yorgun, aç ya da kapıdan çıkmak üzereyken açılan konular çoğu zaman kavgaya döner.',
  },
  {
    source: 'Bağlanma',
    text: 'Kişinin çocuklukta öğrendiği bağlanma biçimi, yetişkin ilişkilerindeki tepkilerini de etkiler. Kaygılı olan yakınlık arar, kaçıngan olan alan ister.',
  },
  {
    source: 'Bağlanma',
    text: 'Güvenli bir ilişki, hiç kavga edilmeyen ilişki değildir. Kavgadan sonra birbirine geri dönebilen ilişkidir.',
  },
  {
    source: 'Onarım',
    text: 'İyi bir özür üç şey içerir: neyin incittiğini görmek, kendi payını sahiplenmek ve bir dahaki sefere neyi farklı yapacağını söylemek.',
  },
  {
    source: 'Onarım',
    text: 'Tartışmadan sonra “Kim haklıydı?” yerine “İkimiz de neye ihtiyaç duyuyorduk?” diye sormak, konuşmayı rekabetten iş birliğine taşır.',
  },
  {
    source: 'Onarım',
    text: 'Kavgadan sonra yaşananları sakin bir anda birlikte konuşmak (ne hissettik, neyi tetikledi, ne yardımcı olurdu) bir sonraki kavgayı kısaltır.',
  },
  {
    source: 'Günlük yaşam',
    text: 'Günde birkaç dakikalık “bugün nasıldı?” sohbeti, stresin ilişkiye taşmasını azaltır. Bu konuşmada çözüm değil, ilgi ve anlayış sunun.',
  },
  {
    source: 'Günlük yaşam',
    text: 'Yük paylaşımı yalnızca işleri yapmak değil, onları düşünmektir. Görünmeyen planlama ve hatırlama yükünü de konuşun.',
  },
  {
    source: 'Günlük yaşam',
    text: 'Takdir, fark edildiğinde büyür. Partnerinizin yaptığı küçük bir şeyi bugün adıyla söyleyin: “Sabah çayı demlediğin için teşekkür ederim.”',
  },
  {
    source: 'Günlük yaşam',
    text: 'Birlikte keyifli vakit geçirmek, sorun konuşmak kadar önemlidir. İlişkiye yalnızca sorunlar için zaman ayrılırsa ilişki sorunla eş anlamlı olur.',
  },
  {
    source: 'Öz bakım',
    text: 'Kendi duygunuzu adlandırabilmek, onu yönetebilmenin ilk adımıdır. “Kızgınım” demek ile “kırıldım ve korktum” demek farklı konuşmalar başlatır.',
  },
  {
    source: 'Güvenlik',
    text: 'Fiziksel şiddet, tehdit ya da korku varsa bu bir iletişim sorunu değil, güvenlik sorunudur. Önce kendinizi güvene alın ve profesyonel destek isteyin.',
  },
]
