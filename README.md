# MESELE

> **Bir tartışmayı anlamanın daha iyi bir yolu.**

MESELE, çiftlerin kavga anındaki kısırdöngüyü — **tetikleyici → birincil duygu → savunma tepkisi** — bir mahkeme
tutanağı gibi değil, sıcak ve şefkatli bir ayna gibi görmelerini sağlayan, yapay zekâ destekli bir arabuluculuk ve
ayna tutma aracıdır. **Psk. Dan. Fırat YALÇIN** (Aile Danışmanı) tarafından, Duygu Odaklı Çift Terapisi (EFT) ve
Gottman yaklaşımlarından ilham alınarak tasarlandı.

> MESELE bir terapi, tanı ya da kriz hizmeti değildir. Şiddet, tehdit veya kendine zarar verme işaretlerinde uygulama
> uzlaşma önermek yerine güvenliği öne alır ve 112 / ALO 183 / KADES'e yönlendirir.

---

## İçindekiler

0. [Windows + iPhone (Expo Go) ile test](#windows--iphone-expo-go-ile-test)
1. [Hızlı başlangıç](#hızlı-başlangıç)
2. [Ortam değişkenleri](#ortam-değişkenleri)
3. [Supabase / Lovable Cloud kurulumu](#supabase--lovable-cloud-kurulumu)
4. [AI sağlayıcısı](#ai-sağlayıcısı)
5. [Akış ve durum makinesi](#akış-ve-durum-makinesi)
6. [Kırılmaz güvenlik kuralları — nerede uygulanıyor?](#kırılmaz-güvenlik-kuralları--nerede-uygulanıyor)
7. [Proje yapısı](#proje-yapısı)
8. [PWA, iOS ve Capacitor](#pwa-ios-ve-capacitor)
9. [Yayına alma](#yayına-alma)
10. [Testler](#testler)
11. [Şemaya yapılan eklemeler](#şemaya-yapılan-eklemeler)

---

## En kolay yol: tek linkle yayınla (Render)

**Her push'ta otomatik yayın:** `.github/workflows/render-deploy.yml` testleri ve derlemeyi çalıştırır, geçerse Render'ın
_Deploy Hook_ adresini çağırır. Bir kez: Render → servis → Settings → **Deploy Hook** adresini kopyalayın; GitHub →
repo → Settings → Secrets and variables → Actions → **New repository secret**, ad `RENDER_DEPLOY_HOOK`.

1. [Bu bağlantıya](https://render.com/deploy?repo=https://github.com/firatyalcin92/project1) tıkla, GitHub ile giriş yap.
2. `OPENAI_API_KEY` sorulunca anahtarı yapıştır → **Apply / Deploy**.
3. 3–5 dakika sonra `https://mesele-xxxx.onrender.com` gibi bir link verir. iPhone Safari'de aç → Paylaş →
   **Ana Ekrana Ekle**.

GitHub'a gönderilen her güncelleme otomatik yayınlanır. Ücretsiz planda sunucu 15 dakika kullanılmazsa uyur (ilk
açılış ~1 dk sürer) ve bellekteki veriler silinir; kalıcı veri için Supabase bağlanmalı. Kendi alan adın için
Render'da _Settings → Custom Domain_ → `mesele.firatyalcin.blog`, cPanel'de _Zone Editor_'da gösterilen CNAME kaydı.

## Windows + iPhone (Expo Go) ile test

Expo Go yalnızca React Native uygulamalarını açabilir; MESELE ise bir web uygulamasıdır. Bu yüzden `mobile/`
klasöründe, MESELE'yi telefonda yerel bir uygulama gibi açan küçük bir **Expo kabuğu** var. Bilgisayarında MESELE
çalışır, iPhone'daki Expo Go onu aynı Wi-Fi üzerinden açar. Mac gerekmez.

**Bir kez yapılacaklar**

1. [Node.js 22 LTS](https://nodejs.org) kur. PowerShell'de `node -v` yazınca `v22…` görmelisin.
2. Projeyi bir klasöre al (ör. `C:\MESELE`):
   - Git varsa: `git clone -b claude/mesele-couple-conflict-app-36jqe8 https://github.com/firatyalcin92/project1.git C:\MESELE`
   - Git yoksa: GitHub'da bu dalı seç → **Code → Download ZIP** → ZIP'i aç, içindeki `project1-…` klasörünü
     `C:\` altına taşı ve adını `MESELE` yap (içinde `package.json` görmelisin).
3. PowerShell'i aç:
   ```powershell
   cd C:\MESELE
   npm install
   npm run setup        # OpenAI API anahtarını sorar, .env dosyasına yazar ve doğrular
   cd mobile
   npm install
   ```
4. iPhone'a App Store'dan **Expo Go** uygulamasını kur.

**Her test için**

1. **1. PowerShell penceresi** (MESELE sunucusu):
   ```powershell
   cd C:\MESELE
   npm run dev:lan
   ```
   Windows Güvenlik Duvarı sorarsa **Özel ağlar** için izin ver. Ekranda `Network: http://192.168.x.x:3000` satırını
   göreceksin.
2. **2. PowerShell penceresi** (Expo):
   ```powershell
   cd C:\MESELE\mobile
   npx expo start
   ```
3. Çıkan QR kodu iPhone'un **Kamera** uygulamasıyla okut → Expo Go'da MESELE açılır.
4. Partner rolü için ikinci bir telefon kullan ya da bilgisayarın tarayıcısında `http://localhost:3000` aç.

**Sorun çıkarsa**

- _“MESELE’ye ulaşılamadı”_: Telefon ve bilgisayar aynı Wi-Fi'de mi? 1. pencerede `npm run dev:lan` açık mı?
  Güvenlik duvarı Node.js'e izin verdi mi? iPhone Safari'de `http://192.168.x.x:3000` açılıyor mu?
- Okul/iş Wi-Fi'ı cihazları birbirinden yalıtabilir: telefonun kişisel erişim noktasını kullan.
- Expo Go _“SDK uyumsuz”_ derse App Store'dan güncelle (kabuk Expo SDK 57 kullanır).
- En hızlı alternatif: Expo'suz, doğrudan iPhone Safari'de `http://192.168.x.x:3000` → Paylaş → **Ana Ekrana Ekle**.

> Geliştirme sunucusunda veriler bellekte tutulur ve sunucu kapanınca silinir. Kalıcı veri için Supabase'i bağla
> ([Supabase / Lovable Cloud kurulumu](#supabase--lovable-cloud-kurulumu)).

---

## Hızlı başlangıç

```bash
npm install
npm run setup        # OpenAI anahtarını .env'ye yazar (isteğe bağlı; yoksa örnek yanıtlar kullanılır)
npm run dev          # http://localhost:3000   ·   npm run dev:lan → aynı ağdaki telefonlardan erişim
```

Hiçbir anahtar tanımlamadan da çalışır: geliştirme ortamında **bellek içi depo** ve **örnek (mock) AI yanıtları**
devreye girer. Böylece iki tarayıcı penceresiyle (biri gizli sekme) tüm akışı — çift oluştur → koda katıl → anlat →
partnerinin gözünden gör → yeniden değerlendir → çözüm raporu — baştan sona deneyebilirsiniz.

| Komut               | Ne yapar                                                                     |
| ------------------- | ---------------------------------------------------------------------------- |
| `npm run dev`       | Geliştirme sunucusu                                                          |
| `npm run dev:lan`   | Geliştirme sunucusu, aynı Wi-Fi'deki telefonlara açık                        |
| `npm run setup`     | OpenAI API anahtarını `.env`'ye kaydeder ve doğrular                         |
| `npm run build`     | Üretim derlemesi (`dist/client`, `dist/server`)                              |
| `npm start`         | Üretim sunucusu (`server.mjs`, srvx + statik dosyalar + güvenlik başlıkları) |
| `npm test`          | Vitest: SQL (PGlite), gizlilik/eşzamanlılık akışı, Türkçe ekler              |
| `npm run typecheck` | TypeScript                                                                   |
| `npm run assets`    | PWA ikonlarını, iOS açılış ekranlarını ve OG görselini yeniden üretir        |

## Ortam değişkenleri

Tam liste ve açıklamalar: [`.env.example`](./.env.example).

| Değişken                    | Zorunlu        | Açıklama                                                                            |
| --------------------------- | -------------- | ----------------------------------------------------------------------------------- |
| `SUPABASE_URL`              | üretimde evet  | Supabase proje adresi (`VITE_SUPABASE_URL` da okunur)                               |
| `SUPABASE_SERVICE_ROLE_KEY` | üretimde evet  | **Yalnızca sunucuda** kullanılır; istemciye asla gitmez                             |
| `OPENAI_API_KEY`            | biri           | Doğrudan OpenAI                                                                     |
| `LOVABLE_API_KEY`           | biri           | Lovable AI Gateway (Lovable Cloud'da otomatik)                                      |
| `MESELE_AI_PROVIDER`        | hayır          | `openai` · `lovable` · `mock` — açık seçim                                          |
| `MESELE_AI_MODEL`           | hayır          | Ana model (varsayılan `gpt-4o`; Lovable'da `openai/gpt-5-mini`)                     |
| `MESELE_AI_MODEL_FAST`      | hayır          | "…'nın Gözünden" metinleri için hızlı model (varsayılan `gpt-4o-mini`)              |
| `MESELE_AI_STRUCTURED`      | hayır          | `json_schema` (katı şema, OpenAI varsayılanı) · `json_object` (Lovable varsayılanı) |
| `VITE_COUNSELOR_URL`        | hayır          | Çözüm raporunda "Psk. Dan. Fırat YALÇIN ile görüşme" bağlantısı                     |
| `MESELE_APP_URL`            | Capacitor için | Yerel uygulamanın açacağı yayınlanmış adres                                         |

## Supabase / Lovable Cloud kurulumu

**Kurulum çalışıyor mu?** Yayındaki adrese `/durum` ekleyin (ör. `https://mesele-xxxx.onrender.com/durum`). Sayfa,
anahtar göstermeden hangi deponun kullanıldığını ve sorun varsa ne yapılacağını söyler (tablolar yok, yanlış anahtar,
hatalı adres…).

Şema tek bir migration dosyasındadır: [`supabase/migrations/20261013000000_mesele_init.sql`](./supabase/migrations/20261013000000_mesele_init.sql).

- **Supabase CLI:** `supabase link --project-ref <ref> && supabase db push`
- **Lovable Cloud / Supabase panosu:** SQL Editor'e dosyanın içeriğini yapıştırıp çalıştırın.

Migration şunları kurar:

- 8 tablo (`couples`, `couple_members`, `disputes`, `dispute_entries`, `answers`, `reconsiderations`, `reports`,
  `relationship_reports`) — hepsinde **RLS açık, hiçbir politika yok**; `anon` ve `authenticated` rollerinden tüm
  tablo yetkileri geri alınır.
- Atomik durum fonksiyonları (yalnızca `service_role` çalıştırabilir):
  `mesele_claim_status`, `mesele_release_status`, `mesele_finish_perspectives`, `mesele_finish_reports`,
  `mesele_sync_progress`, `mesele_claim_relationship_report`, `mesele_finish_relationship_report`,
  `mesele_fail_relationship_report`.

## AI sağlayıcısı

Yapılandırma tek dosyada: [`src/server/mesele.server.ts`](./src/server/mesele.server.ts).

- **Seçim sırası:** `MESELE_AI_PROVIDER` → `OPENAI_API_KEY` → `LOVABLE_API_KEY` → (yalnızca geliştirmede) mock.
- **Katı JSON:** OpenAI'de `response_format: { type: 'json_schema', strict: true }`; şema
  [`src/lib/report-schemas.ts`](./src/lib/report-schemas.ts)'teki zod tanımlarından üretilir. Lovable'da
  `json_object` + şema istem içinde. Her yanıt zod ile doğrulanır; uymazsa bir kez "onarım" istenir.
- **Dayanıklılık:** 429/5xx'te geri çekilmeli yeniden deneme, 402'de anlaşılır kota mesajı, zaman aşımı, model
  reddi (`refusal`) için güvenlik yönlendirmesi.
- **Sıcaklık:** gpt-4 ailesinde 0.7; akıl yürütme modellerinde (gpt-5, o-serisi) varsayılan bırakılır.
- Başka bir model (ör. ileride çıkacak bir sürüm) kullanmak için yalnızca `MESELE_AI_MODEL` değerini değiştirin.

**Danışman sesi** — [`src/server/prompts.server.ts`](./src/server/prompts.server.ts): EFT (döngü düşmandır,
birincil/ikincil duygu, takip–geri çekilme dansı) ve Gottman (Dört Atlı ve panzehirleri, 20 dakikalık mola, onarım
girişimleri) üzerine kurulu; sıcak, metaforik ama sade bir Türkçe. "Diğer kişi" yasak, her zaman ad ya da
"partnerin". Tanı/etiket yok. "Kim haklı?" sorusuna hüküm değil, "ikinizin de haklı olduğu yer + asıl mesele"
cevabı. Kullanıcı metinleri `«« … »»` ile sarılır ve talimat olarak yorumlanmaz.

## Akış ve durum makinesi

```
draft ─► answers_in_progress ─► both_answers_completed ─► generating_perspectives ─► perspectives_ready
                                   (iki gönderim)            (atomik kilit, 4 dk)          │
                                                                                          ▼
completed ◄─ generating_reports ◄─ reconsideration_completed ◄─ reconsideration_in_progress
   (iki onay → ortak rapor açılır)
```

| Adım                            | Ekranda                                                                                                                                                                  |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **1. Anlat**                    | Olay · O an düşünce (+ tepki çipleri) · Tartışma sırasında / sonrasında hisler · En çok etkileyen his ve nedeni · İhtiyaç · Partnerin ihtiyacı · Kendinde değiştireceğin |
| **2. Partnerinin Gözünden Gör** | "[Ad]'ın Gözünden" metni + partnerin paylaştığı ham yanıtlar + senin anlatımının ona nasıl yansıtıldığı                                                                  |
| **3. Yeniden Değerlendir**      | Ne dokundu · Altında ne olabilir · Kendi payına dair yeni fark · Ona tek cümle · Yakınlık (1–5, yalnızca sana)                                                           |
| **4. Çözüm Raporu**             | Sana Özel Ayna (hemen) + Ortak Rapor: Ortak Döngünüz (çember), Döngüden çıkış kapıları, Kim Haklı?, Temel İhtiyaç Kesişimi, 3 onarım adımı, "Bugün için"                 |

**Gizlilik (v2):** Ayrı bir "özel/açık" seçeneği yoktur — tıpkı çift seansında olduğu gibi. Kullanıcıya "Cevaplarınız
eşinize olduğu gibi gösterilmez; danışman analizde kullanır ve ihtiyaç diliyle yansıtabilir" hatırlatması gösterilir.
Partner hiçbir zaman diğerinin ham cevabını görmez; yalnızca danışmanın yazdığı metinleri görür.

**Duygu / düşünce / davranış (v3):** 2. soruda serbest düşünce metni, isteğe bağlı _düşünce kalıpları_ ("Beni
önemsemiyor", "Hep böyle oluyor"… her birinin bilişsel çarpıtma etiketiyle; `dusunce_kalip` satırı) ve zorunlu
_davranışlar_ ("Sustum", "Üstüne gittim"…). 3. soru yalnızca **duygular**: "Tartışma sırasında ve sonrasında neler
hissettiniz?" (5 grupta 17 duygu + "Başka bir şey hissettim" metni); en az 1, en fazla 7 duygu seçilir. 4. soru,
işaretlenen hisler arasından en çok etkileyeni zorunlu olarak sorar; "Neden?" kutusu seçilen hissin hemen altında açılır. 2. soruda "O an ne yaptınız?" seçimi de zorunludur. Her soruda danışmanın sorusu, açıklaması ve cevap alanı sırayla
belirir; his sorusu, danışmanın yansıtma metni gelmeden açılmaz.

**İtiraz:** "Gözünden" adımında "İtirazım var" ile, partnerin gözünden metne ya da kendi anlatımının yansıtılışına
itiraz yazılabilir (`reconsiderations.reflections.items.itiraz`). Partnere gösterilmez; danışman raporda iki bakışı
ayrı ayrı ele alır ve yanlış anlaşılanı düzeltir.
Hepsi `answers` tablosunda ayrı satırlarda saklanır, şema değişikliği gerekmez:

| `question_id`                     | `selected_tags`                     | `text_answer`         |
| --------------------------------- | ----------------------------------- | --------------------- |
| `hisler`                          | seçilen hisler                      | "başka bir şey" metni |
| `en_etkili`                       | en çok etkileyen his (tek)          | nedeni                |
| `his_sirasinda`, `his_sonrasinda` | kısa süre kullanılan iki ayrı liste | (yalnızca okunur)     |
| `duygular`                        | v2'den kalan eski kayıtlar          | (yalnızca okunur)     |

Danışman istemleri hisleri liste olarak tekrar etmez; hisler arasındaki ilişkiyi, en çok etkileyen hissi ve
bunların olay ve ihtiyaçla bağlantısını değerlendirir (tanı koymadan, bir partnerin hissini diğerinin niyetine kanıt
saymadan, bilgi yetersizse belirsizliği söyleyerek). Kişisel raporda "Hislerinizin izi" bölümü bu yorumu taşır.

**Bireysel mod:** Partneri uygulamayı kullanmayan kişi, "Tek başıma danışmak istiyorum" ile başlar; aynı soruları
yanıtlar ve doğrudan size özel bir danışman raporu alır (partnerin olası bakış açısı, ihtiyaç dili cümlesi, bu akşamki
konuşma rehberi). Ortak rapor ve Genel Görüş yalnızca çift modundadır.

**Genel Görüş** 10 tamamlanmış meseleden sonra açılır: 9 bölümlük kalıcı ilişki dinamiği raporu (hikâye, tekrarlayan
dans, tetikleyiciler, duygu haritası, bağlanma ihtiyaçları, Dört Atlı aynası, güçlü yanlar, büyüme alanları,
önümüzdeki yol) ve iki partnerin paylaşılan çip seçimlerinin dağılımı. 5 yeni mesele sonra güncellenebilir.

## Üyelik, cihaz kurtarma ve silme

- **Bir mesele ücretsiz**, sonrası haftalık / aylık / yıllık üyelik. Üyelik **çift düzeyindedir**: birinin alması
  ikisine yeter (`subscriptions` tablosu). Bu bilgi ana sayfada, çift oluştururken ve panelde baştan söylenir.
- **Satın almadan önce** cihaz anahtarı yedeklenmiş olmalı; partner katılmadıysa çift kodunun paylaşıldığı ya da
  saklandığı onaylanmalı. Böylece satın alan kimse kayıtlarını kaybetmez.
- **Ödeme altyapısı henüz bağlı değil.** `MESELE_PAYMENTS=test` iken üyelik ödeme alınmadan başlar (yalnızca deneme);
  `none` (varsayılan) iken satın alma kapalıdır. Gerçek ödeme için: iOS uygulamasında Apple'ın uygulama içi satın
  alması (App Store kuralı), web'de iyzico/Stripe gibi bir sağlayıcı bağlanmalı (`purchase()` →
  `src/server/account.server.ts`).
- **Cihaz anahtarı yedeği:** çift kurma / katılma / kurtarma sonrasında "Cihaz anahtarınızı yedekleyin" adımı ve
  anahtar kaybolursa ne olacağının açık anlatımı; yedeklenmediyse panelde hatırlatma.
- **Partnerle kurtarma:** cihazını kaybeden partnere diğer partner Hesap sayfasından tek kullanımlık bir _yeniden
  bağlanma kodu_ üretir (`member_recovery`, yalnızca hash saklanır). Kötüye kullanıma karşı kod **12 saat sonra**
  çalışmaya başlar (`MESELE_RECOVERY_DELAY_MINUTES`, varsayılan 720) ve 2 gün geçerlidir; bu sürede hesap sahibinin
  eski cihazında uyarı çıkar ve "Ben istemedim" diyerek iptal edebilir. Kod çift koduyla birlikte `/katil?mod=kurtar`
  ekranında kullanılır; eski cihazdaki anahtar geçersiz olur.
- **Tüm verileri sil:** bireysel modda ya da partner katılmadıysa hemen; çift modunda partnerin onayıyla
  (`deletion_requests`). Silme üyeliği iptal etmez: satın alan kişiye bir **aktarım kodu** verilir ve kalan süre
  Üyelik sayfasından yeni bir çifte ya da bireysel hesaba taşınır.
- **Hazır olma durumu:** panel ve mesele ekranında "Siz hazırsınız, Ayşe bekleniyor" gibi; yalnızca aşama
  gösterilir, kimsenin cevabı ya da taslağı gösterilmez.
- **Meseleler arası bağlam:** raporlar önceki (en fazla 5) meseleyi hatırlar: ortak rapor özetleri + yalnızca
  okuyanın kendi kişisel raporu. Rapordaki "Sizi tanıdıkça" bölümü bu bağı kurar.

**Mevcut Supabase kurulumu için güncelleme:** SQL Editor'de `supabase/guncelleme-uyelik.sql` dosyasını bir kez
çalıştırın (tekrar çalıştırmak zararsızdır, veriye dokunmaz). Yeni kurulumlar için `supabase/kurulum.sql` hepsini
içerir. `/durum` sayfası güncellemenin eksik olduğunu söyler.

## Kırılmaz güvenlik kuralları — nerede uygulanıyor?

| Kural                                 | Uygulama                                                                                                                                                                                                                                                                                                                                                                        | Test                                                                       |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| **Çift kodu bir şifre değildir**      | 6 hane, karışan karakter yok (`crypto.server.ts`). Kod yalnızca `joinCouple`'da çifti bulur; B rolü dolunca kod hiçbir şey açmaz (`unique(couple_id, role)`). Kimlik doğrulama yalnızca token ile. Koda katılma IP başına hız sınırlı.                                                                                                                                          | `flow.test.ts`                                                             |
| **Cihaza özel gizli token**           | 256-bit (`crypto.getRandomValues`), base64url, yalnızca bir kez döner; istemcide `localStorage['mesele.member.v1']` (+ Capacitor Preferences yedeği). DB'de yalnızca SHA-256 `auth_token_hash`.                                                                                                                                                                                 | `flow.test.ts`, `sql.test.ts`                                              |
| **`x-mesele-member` + `memberAuth`**  | [`src/functions/middleware.ts`](./src/functions/middleware.ts): istemci başlığı ekler, sunucu hash'leyip üyeyi bulur. Her mesele erişimi `requireDispute` ile `member → couple → dispute` zincirini doğrular; yabancı mesele "bulunamadı" döner (IDOR).                                                                                                                         | `flow.test.ts`                                                             |
| **RLS + sunucu izolasyonu**           | Tüm tablolarda RLS açık, politika yok, istemci rollerine yetki yok. Tüm okuma/yazma `createServerFn` içinde service role ile. Sunucu fonksiyonlarına yalnızca aynı kökenden istek (CSRF middleware, `src/start.ts`). `*.server.ts` dosyaları istemci paketine giremez.                                                                                                          | `sql.test.ts`                                                              |
| **Ham cevaplar partnere dönmez (v2)** | Danışman iki tarafın tüm cevaplarını analizde kullanır; [`disputes.server.ts`](./src/server/disputes.server.ts) görünüm modeli partnere yalnızca AI metinlerini döner, ham cevapları asla. İstemler partner cevaplarını alıntılamayı yasaklar ve ihtiyaç diline çevirtir; ortak rapor iki onaya kadar istemciye gönderilmez. Service worker sunucu yanıtlarını önbelleğe almaz. | `flow.test.ts`                                                             |
| **Çift AI çağrısını önleme**          | `mesele_claim_status` atomik `UPDATE … WHERE status = from` + 4 dakikalık bayat kilit. Sonuçlar `mesele_finish_*` ile yalnızca kilit sahibi tarafından, tek işlemde yazılır; hata olursa kilit bırakılıp durum geri alınır.                                                                                                                                                     | `sql.test.ts`, `flow.test.ts` (eşzamanlı çağrılar → tam 2 ve 3 AI çağrısı) |
| **Geçmiş veri silinmez**              | Tamamlanan meseleler için silme yolu yok (`deleteDispute … status <> 'completed'`); yalnızca açan kişi, cevap aşamasındaki bir meseleyi kapatabilir.                                                                                                                                                                                                                            | —                                                                          |

## Proje yapısı

```
src/
  routes/               TanStack Router dosya tabanlı rotalar
    index.tsx           /             Karşılama + manifesto (token varsa /panel)
    olustur.tsx         /olustur      Çift oluştur, kodu paylaş
    katil.tsx           /katil        Koda katıl · cihaz anahtarıyla geri dön
    panel.tsx           /panel        Aktif mesele, arşiv, Genel Görüş sayacı, cihaz anahtarı
    mesele.$id.tsx      /mesele/$id   4 adımlı akış
    meseleler.tsx       /meseleler    Arşiv
    genel-gorus.tsx     /genel-gorus  9 bölümlük ilişki raporu
  functions/            createServerFn uçları + memberAuth middleware (istemci de içe aktarır)
  server/               *.server.ts — yalnızca sunucu: kimlik, depo, AI, istemler, alan mantığı
  lib/                  Paylaşılan: soru seti, durum makinesi, Türkçe ekler, görünüm tipleri, token deposu
  components/           Arayüz bileşenleri (dispute/ altında akış ekranları)
  styles.css            Tailwind v4 @theme — semantik renk tokenları (açık/koyu)
supabase/migrations/    Şema, RLS, atomik fonksiyonlar
public/                 manifest, service worker, ikonlar, iOS açılış ekranları, çevrimdışı sayfa
capacitor.config.ts     iOS/Android kabuğu (Capacitor; Mac + Xcode gerekir)
mobile/                 Expo kabuğu (Expo Go ile test; EAS ile Windows'tan iOS derlemesi)
```

## PWA, iOS ve Capacitor

**PWA:** `manifest.webmanifest` (standalone, portre, `lang: tr`, maskable ikon, kısayollar), `apple-touch-icon`,
11 iOS açılış ekranı (`apple-touch-startup-image`), `apple-mobile-web-app-*` etiketleri, `viewport-fit=cover` ve güvenli
alan dolguları, açık/koyu `theme-color`, iOS'ta odaklanınca yakınlaştırmayı önleyen 16px girişler, çevrimdışı sayfa.
Fontlar (Fraunces, Figtree) yerelde paketlenir; dış CDN'ye bağımlılık yoktur.

**Capacitor (önce iOS):** MESELE tam yığın bir uygulama olduğu için (AI ve service role sunucuda) yerel kabuk,
yayınlanmış web uygulamasını açar:

```bash
npm run build && npm start                     # ya da tercih ettiğiniz barındırmaya yayınlayın
npx cap add ios                                # bir kez (Xcode gerekir)
MESELE_APP_URL=https://mesele.example.com npx cap sync ios
npx cap open ios                               # Xcode'da imzala ve çalıştır
# Android: npx cap add android && MESELE_APP_URL=… npx cap sync android && npx cap open android
```

- `appId`: `com.firatyalcin.mesele` (`capacitor.config.ts` içinde değiştirilebilir).
- `@capacitor/preferences`: cihaz anahtarını iOS'un WebView depolamasını temizlemesine karşı yerelde yedekler.
- `@capacitor/share`: davet ve hatırlatmalar için yerel paylaşım sayfası.
- `capacitor-shell/index.html`: bağlantı yokken gösterilen yedek sayfa.
- App Store incelemesi için (yönerge 4.2) uygulamanın yerel paylaşım ve güvenli anahtar saklama gibi yerel
  yetenekler kullandığını belirtin; ileride bildirimler eklemek de önerilir.

**Expo kabuğu ile App Store (Windows'tan):** `mobile/` klasörü, Mac gerektirmeden bulutta iOS derlemesi yapabilen
EAS ile de kullanılabilir. Önce MESELE'yi https bir adreste yayınla, sonra `mobile/.env` içine
`EXPO_PUBLIC_MESELE_URL=https://…` yaz ve `npx eas-cli@latest build -p ios` çalıştır (Apple Developer hesabı gerekir).
Ayrıntılar: [`mobile/README.md`](./mobile/README.md).

## Yayına alma

`npm run build` bir fetch handler (`dist/server/server.js`) ve statik dosyalar (`dist/client`) üretir.

- **Node:** `npm start` — `server.mjs` statik dosyaları sunar; hash'li dosyalara `immutable`, `sw.js`'e `no-cache`,
  sunucu fonksiyonlarına `no-store` ve temel güvenlik başlıklarını ekler.
- **Diğer platformlar** (Cloudflare, Netlify, Vercel, Lovable): TanStack Start'ın ilgili hosting adaptörünü/Nitro'yu
  ekleyin; kod Web Crypto kullandığı için Node'a özgü bir bağımlılık yoktur.
- Üretimde `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` ve bir AI anahtarı **zorunludur**; eksikse uygulama mock'a
  düşmez, anlaşılır bir hata verir.

## Testler

```bash
npm test
```

- `tests/sql.test.ts` — migration gerçek bir Postgres'te (PGlite) çalıştırılır: istemci rollerine yetki olmadığı,
  RLS, kod biçimi, `sync_progress`, atomik kilit, bayat kilit, kilit sahipliği, raporların atomik yazımı.
- `tests/flow.test.ts` — bellek deposu + sahte OpenAI (`fetch`) ile uçtan uca: eşleştirme, kodun şifre olmadığı,
  IDOR, eksik gönderim, **istem düzeyinde gizlilik** (özel yanıtların partnerin göreceği hiçbir isteme girmediği),
  aynı anda basılan butonlarda tam 2 / 3 AI çağrısı, iki onay kilidi, Genel Görüş.
- `tests/turkish.test.ts` — özel isimlere ek getirme (Ayşe’nin, Fırat’ın, Fırat’tan, Ayşe’yle…).

## Şemaya yapılan eklemeler

Spesifikasyondaki tüm tablo ve sütunlar aynen korunmuştur. Akışın çalışması için şu sütunlar **eklenmiştir**:

| Tablo                  | Eklenen                                                     | Neden                                                     |
| ---------------------- | ----------------------------------------------------------- | --------------------------------------------------------- |
| `couples`              | `name`, `mode`, `partner_name`                              | Çift adı iki addan oluşur ("Fırat & Ayşe"); bireysel mod  |
| `disputes`             | `created_by`, `created_at`, `updated_at`                    | Meseleyi kimin açtığı (kapatma yetkisi), kronolojik arşiv |
| `dispute_entries`      | `perspective`, `submitted_at`, zaman damgaları              | "[Ad]'ın Gözünden" metni ve "anlatımı gönderdi" bilgisi   |
| `reconsiderations`     | `updated_at`                                                | Taslak kaydı                                              |
| `relationship_reports` | `dispute_count`, `status`, `status_locked_at`, `created_at` | Kaç meseleye dayandığı ve eşzamanlı üretim kilidi         |
