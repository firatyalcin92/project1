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

## Hopla (oyun)

Bu depoda MESELE'nin yanında, tek parmakla oynanan minimalist 3D zıplama oyunu **Hopla** da var. Aynı Render
servisinde `/hopla/` adresinde yayınlanır; sıralama API'si `/api/hopla/v1` altındadır ve MESELE'nin
tablolarına dokunmaz. iOS/Android uygulaması `hopla/mobile` (Expo). Ayrıntılar: [`hopla/README.md`](./hopla/README.md).

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

**Sırayla anlatım:** Çift modunda meseleyi açan önce bütün soruları yanıtlar; diğer partner ancak o bitirince
başlar (başlık yeniden sorulmaz). İkinci partnerin 1. sorusunda ilk anlatanın olay anlatımı gösterilir; aynen
onaylayabilir (`olay_onay`) ya da eklemesini yazar. Bu, ham metnin partnere gösterildiği tek yerdir ve ilk anlatana
soru ekranında açıkça söylenir. Kendi ihtiyacı sorusu 16 seçenekten en fazla 5 ihtiyaç + değişen bir takip
sorusudur; soruların ifadesi her meselede (mesele kimliğine göre sabit) değişir. Genel Görüş 5 meseleden sonra
açılır ve her 5 yeni meselede kendiliğinden güncellenir.

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

## Ücretsiz test sürümü (şu anki durum)

- `MESELE_BETA=1` (varsayılan): ödeme ve teklif ekranları gizli, her şey ücretsiz. Her çift **bir** mesele açabilir;
  tüm uygulamada günde en fazla `MESELE_DAILY_LIMIT` (varsayılan 3) yeni mesele açılır (İstanbul saatiyle gece yarısı
  yenilenir). Böylece yapay zekâ harcaması günde ~30 TL ile sınırlı kalır.
- Anlatım **sohbet** biçimindedir (`src/components/dispute/chat-wizard.tsx`): çizim terapist avatarı soruları tek tek
  sorar, 1. sorudan sonra kısa içerik yansıtması, 2. sorudan sonra duygu yansıtması, ilk 3 sorudan sonra ayrıntılı
  geri bildirim verir. İlk anlatan burada partnerini bekler; partner kendi ilk 3 sorusundan sonra beklemeden son 4
  soruya geçer; ilk anlatan da ardından son 4 soruyu yanıtlar. Kimse diğerinin cevaplarını görmez.
- Rapordan sonra 3 soruluk anket (puan, tekrar kullanır mı, önerir mi). Sonuçlar `/yonetim` sayfasında
  (`MESELE_ADMIN_PASSWORD` ile); kişisel içerik gösterilmez.
- **Hak kişiye bağlıdır:** ücretsiz meseleyi açan cihaz (rastgele cihaz kimliği, çıkışta silinmez) ve 24 saat boyunca
  aynı IP adresi yeni bir çift kurup tekrar mesele açamaz. İkisi de yalnızca hash'iyle `beta_claims` tablosunda durur;
  isteğe bağlı `MESELE_HASH_SALT` ile tuzlanır.
- **Erişim kodları:** `/yonetim` → "Erişim kodu oluştur" ile N haklı kodlar (`MSL-XXXX-XXXX-XXXX`, 60 bit) üretilir.
  Ham kod yalnızca bir kez gösterilir, veritabanında hash'i saklanır; kod ilk kullanan çifte bağlanır, deneme sayısı
  sınırlıdır. Kodla açılan meseleler günlük kontenjana ve kişi sınırına takılmaz.
- Karşılama ekranındaki "Ücretli sürüme üye olmak isterim" e-postaları `waitlist` tablosuna yazılır ve `/yonetim`'de görünür.
- **Mevcut Supabase için:** `supabase/guncelleme-test-surumu.sql` dosyasını SQL Editor'de bir kez çalıştırın
  (tekrar çalıştırmak zararsızdır). Çalıştırılana kadar kişi sınırı uygulanmaz, kodlar ve bekleme listesi çalışmaz.

## Hesaplar: Apple / Google / e-posta kodu

Uygulama **hesapsız başlar**: kişi adını yazar ve hemen ilk soruya geçer. Oturum, cihazdaki gizli bir token'dır
(kullanıcı görmez). İlk rapordan sonra ve üyelik alırken "hesabınızı kaydedin" önerilir: **Apple**, **Google** ya da
**e-postaya gelen 6 haneli kod**. Kaydedilen hesapla başka bir cihazdan giriş yapılır (`/giris`); bu cihazdaki
eski oturum kapanır. Cihaz anahtarı yedeği, partnerle kurtarma kodu ve üyelik aktarım kodu kaldırıldı.

- Doğrulamayı **Supabase Auth** yapar (`src/server/identity.server.ts`): e-posta kodu (`/auth/v1/otp` +
  `/auth/v1/verify`), Apple/Google için PKCE (`/auth/v1/authorize` → `/giris?code=…` → `/auth/v1/token`).
  Uygulama yalnızca Supabase kullanıcı kimliğini `couple_members.auth_user_id` olarak saklar.
- Supabase tanımlı değilse (yerel geliştirme / testler) sahte sağlayıcı çalışır: e-posta kodu `123456`,
  Apple/Google tek tıkla tamamlanır. Üretimde Supabase her zaman tanımlı olduğundan sahte sağlayıcı çalışmaz.
- Kaydı olmayan bir hesapla giriş yapılırsa 30 dakikalık imzalı bir bilet verilir; adlar yazılınca hesap yeni
  kayda bağlanır.

**Supabase panelinde bir kez yapılacaklar:**

1. **Authentication → URL Configuration:** *Site URL* = uygulama adresi (`https://mesele.firatyalcin.blog`);
   *Redirect URLs*'e `https://mesele.firatyalcin.blog/giris` ve `https://mesele-0zvp.onrender.com/giris` ekleyin.
2. **Authentication → Emails → Magic Link** şablonunda bağlantı yerine kodu gösterin: gövdeye `{{ .Token }}`
   yazın (ör. "MESELE giriş kodunuz: {{ .Token }}"). Supabase'in hazır e-posta gönderimi saatte birkaç e-postayla
   sınırlıdır; gerçek kullanım için **Authentication → Emails → SMTP Settings**'ten bir e-posta servisi (ör. Resend)
   bağlayın.
3. **Authentication → Sign In / Providers → Google:** Google Cloud Console'da bir OAuth istemcisi (Web) oluşturun;
   *Authorized redirect URI* olarak Supabase'in gösterdiği `https://<proje>.supabase.co/auth/v1/callback` adresini
   girin; Client ID ve Secret'ı Supabase'e yapıştırın.
4. **Apple:** Apple Developer hesabında bir *Services ID* ve *Sign in with Apple* anahtarı oluşturun; aynı
   callback adresini girin ve bilgileri Supabase'in Apple sağlayıcısına yapıştırın (Apple Developer üyeliği gerekir).

Bir sağlayıcı açılmadıysa o düğme "Bu giriş yöntemi henüz açılmadı" der; diğerleri çalışmaya devam eder.

## Üyelik ve silme

- **Bir mesele ücretsiz**, sonrası aylık ya da yıllık üyelik. Üyelik **çift düzeyindedir**: birinin alması
  ikisine yeter (`subscriptions` tablosu).
- **Fiyatlar:** aylık 249 ₺, yıllık 1.999 ₺ (`DEFAULT_PRICES`, `src/lib/plans.ts`); `MESELE_PRICE_MONTHLY` /
  `MESELE_PRICE_YEARLY` ortam değişkenleri bunları geçersiz kılar.
- **3 gün ücretsiz deneme:** yıllık üyelik çift başına bir kez 3 gün ücretsiz denenebilir (`provider = 'trial'`).
  Deneme sırasında alınan üyelik, kalan deneme günlerinin üstüne eklenir.
- **Teklif ekranları** (`src/components/offer.tsx`, aylık + yıllık, yıllık öne çıkar):
  1. ilk mesele tamamlanınca: panele dönüşte bir kez, ayrıca rapor sayfasının sonunda kart;
  2. ücretsiz hak bittiyse yeni meselede **1. sorudan sonra**: mesele açılır, 1. soru kaydedilir; sonrası
     (kayıt, yansıtma, gönderim) sunucuda `PAYMENT_REQUIRED` ile kilitlidir.
- **Üyelik hesaba bağlıdır:** satın almadan önce hesap kaydedilmelidir (`ACCOUNT_REQUIRED`). Satır
  `owner_user_id` taşır; veriler silinse de kalır ve aynı hesapla yeniden başlanınca kendiliğinden bağlanır.
- **Ödeme altyapısı henüz bağlı değil.** `MESELE_PAYMENTS=test` iken üyelik ödeme alınmadan başlar (yalnızca deneme);
  `none` (varsayılan) iken satın alma kapalıdır. Gerçek ödeme için: iOS uygulamasında Apple'ın uygulama içi satın
  alması (App Store kuralı), web'de iyzico/Stripe gibi bir sağlayıcı bağlanmalı (`purchase()` →
  `src/server/account.server.ts`).
- **Tüm verileri sil:** bireysel modda ya da partner katılmadıysa hemen; çift modunda partnerin onayıyla
  (`deletion_requests`).
- **Hazır olma durumu:** panel ve mesele ekranında yalnızca aşama gösterilir, kimsenin cevabı gösterilmez.
- **Meseleler arası bağlam:** raporlar önceki (en fazla 5) meseleyi hatırlar.

**Mevcut Supabase kurulumu için güncelleme:** SQL Editor'de `supabase/guncelleme-hesap.sql` dosyasını bir kez
çalıştırın (tekrar çalıştırmak zararsızdır, veriye dokunmaz). Yeni kurulumlar için `supabase/kurulum.sql` hepsini
içerir.

## Kırılmaz güvenlik kuralları — nerede uygulanıyor?

| Kural                                 | Uygulama                                                                                                                                                                                                                                                                                                                                                                        | Test                                                                       |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| **Çift kodu bir şifre değildir**      | 6 hane, karışan karakter yok (`crypto.server.ts`). Kod yalnızca `joinCouple`'da çifti bulur; B rolü dolunca kod hiçbir şey açmaz (`unique(couple_id, role)`). Kimlik doğrulama yalnızca token ile. Koda katılma IP başına hız sınırlı.                                                                                                                                          | `flow.test.ts`                                                             |
| **Cihaza özel gizli token**           | 256-bit (`crypto.getRandomValues`), base64url, yalnızca bir kez döner; hesaba giriş yeni bir token üretir ve eskisini geçersiz kılar; istemcide `localStorage['mesele.member.v1']` (+ Capacitor Preferences yedeği). DB'de yalnızca SHA-256 `auth_token_hash`.                                                                                                                                                                                 | `flow.test.ts`, `sql.test.ts`                                              |
| **`x-mesele-member` + `memberAuth`**  | [`src/functions/middleware.ts`](./src/functions/middleware.ts): istemci başlığı ekler, sunucu hash'leyip üyeyi bulur. Her mesele erişimi `requireDispute` ile `member → couple → dispute` zincirini doğrular; yabancı mesele "bulunamadı" döner (IDOR).                                                                                                                         | `flow.test.ts`                                                             |
| **RLS + sunucu izolasyonu**           | Tüm tablolarda RLS açık, politika yok, istemci rollerine yetki yok. Tüm okuma/yazma `createServerFn` içinde service role ile. Sunucu fonksiyonlarına yalnızca aynı kökenden istek (CSRF middleware, `src/start.ts`). `*.server.ts` dosyaları istemci paketine giremez.                                                                                                          | `sql.test.ts`                                                              |
| **Ham cevaplar partnere dönmez (v2)** | Danışman iki tarafın tüm cevaplarını analizde kullanır; [`disputes.server.ts`](./src/server/disputes.server.ts) görünüm modeli partnere yalnızca AI metinlerini döner, ham cevapları asla. İstemler partner cevaplarını alıntılamayı yasaklar ve ihtiyaç diline çevirtir; ortak rapor iki onaya kadar istemciye gönderilmez. Service worker sunucu yanıtlarını önbelleğe almaz. | `flow.test.ts`                                                             |
| **Çift AI çağrısını önleme**          | `mesele_claim_status` atomik `UPDATE … WHERE status = from` + 4 dakikalık bayat kilit. Sonuçlar `mesele_finish_*` ile yalnızca kilit sahibi tarafından, tek işlemde yazılır; hata olursa kilit bırakılıp durum geri alınır.                                                                                                                                                     | `sql.test.ts`, `flow.test.ts` (eşzamanlı çağrılar → tam 2 ve 3 AI çağrısı) |
| **Geçmiş veri silinmez**              | Tamamlanan meseleler için silme yolu yok (`deleteDispute … status <> 'completed'`); yalnızca açan kişi, cevap aşamasındaki bir meseleyi kapatabilir.                                                                                                                                                                                                                            | —                                                                          |

## Proje yapısı

```
src/
  routes/               TanStack Router dosya tabanlı rotalar
    index.tsx           /             Karşılama (oturum varsa /panel)
    olustur.tsx         /olustur      İki ad → doğrudan ilk meselenin ilk sorusu
    katil.tsx           /katil        Davet linkiyle katıl (ad hazır gelir)
    giris.tsx           /giris        Apple / Google / e-posta kodu; Apple/Google dönüşü
    panel.tsx           /panel        Şu an yapılacak tek şey + önceki meseleler
    hesap.tsx           /hesap        Ayarlar: hesap, davet, üyelik, gizlilik, silme
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

## cPanel'e kurulum (Supabase ve Render olmadan)

Sunucu Node 22.5+ ile gelen yerleşik **SQLite** veritabanını kullanır: ayrı bir veritabanı kurmak gerekmez,
veriler ev dizinindeki tek bir dosyada durur (`~/mesele-veri/mesele.db`). E-postayla giriş kodları cPanel'deki
bir e-posta hesabından SMTP ile gönderilir. Google ile giriş bu kipte kapalıdır.

**Paket:** `npm run paket:cpanel` → `paket/mesele-cpanel.zip`. İçindeki sunucu bağımlılıkları gömülüdür;
cPanel'de *Run NPM Install* gerekmez.

1. **Alt alan adı:** cPanel → *Alan Adları* → `mesele.firatyalcin.blog` oluşturun. (Daha önce DNS'e Render için
   `mesele` CNAME kaydı eklediyseniz önce onu silin.)
2. **E-posta hesabı:** cPanel → *E-posta Hesapları* → `mesele@firatyalcin.blog` (güçlü bir şifreyle).
3. **Dosyalar:** *Dosya Yöneticisi* → ev dizininde (public_html'in dışında) `mesele` klasörü → zip'i yükleyin →
   *Extract* → zip'i silin.
4. **Node.js → Create Application:** sürüm 24, *Application mode* = Production, *Application root* = `mesele`,
   *Application URL* = `mesele.firatyalcin.blog`, *Application startup file* = `app.js`. Ortam değişkenleri:

   | Değişken | Değer |
   | --- | --- |
   | `OPENAI_API_KEY` | OpenAI anahtarı |
   | `MESELE_ADMIN_PASSWORD` | /yonetim şifresi |
   | `SMTP_HOST` | `mail.firatyalcin.blog` (E-posta Hesapları → *Connect Devices*'ta yazan sunucu) |
   | `SMTP_PORT` | `465` |
   | `SMTP_USER` | `mesele@firatyalcin.blog` |
   | `SMTP_PASS` | e-posta hesabının şifresi |
   | `MESELE_HASH_SALT` | isteğe bağlı, rastgele uzun bir metin |

5. **SSL:** cPanel → *SSL/TLS Status* → alt alan adı için *Run AutoSSL*.
6. Kontrol: `https://mesele.firatyalcin.blog/durum` → `"ok": true`, `"depo": "sqlite"`, `"eposta": "smtp"`.

**Güncelleme:** yeni zip'i aynı klasöre yükleyip *Extract* (üzerine yaz) → Node.js sayfasında *Restart*.
Veriler `~/mesele-veri` klasöründe olduğu için güncellemeden etkilenmez; yedek için bu klasörü indirin.

## Alan adı: mesele.firatyalcin.blog

Kodda sabit bir adres yoktur (davet linkleri ve giriş dönüşleri açık olan adresten üretilir), bu yüzden yalnızca
ayar gerekir:

1. **Render** → servis → *Settings* → *Custom Domains* → `mesele.firatyalcin.blog` ekleyin.
2. **Alan adının DNS'i** (firatyalcin.blog'un yönetildiği yer): `CNAME` kaydı — ad/host `mesele`, değer
   `mesele-0zvp.onrender.com`. Varsa `mesele` için başka bir A/AAAA/CNAME kaydını silin.
3. Render'da *Verify*'a basın; doğrulanınca HTTPS sertifikası kendiliğinden gelir (birkaç dakika – birkaç saat).
4. **Supabase** → *Authentication* → *URL Configuration*: yukarıdaki gibi Site URL ve Redirect URL'i güncelleyin.
5. `https://mesele.firatyalcin.blog/durum` ile kontrol edin.

Not: Kayıtlar tarayıcıda adrese göre tutulur; eski `onrender.com` adresinde başlayan biri yeni adreste kayıtlarını
görmez (hesabını kaydettiyse giriş yaparak ulaşır). Eski adres çalışmaya devam eder.
