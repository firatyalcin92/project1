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

## Hızlı başlangıç

```bash
npm install          # npm ≥ 11 önerilir (npm 10'daki bir arborist hatası için: npx npm@11 install)
npm run dev          # http://localhost:3000
```

Hiçbir anahtar tanımlamadan da çalışır: geliştirme ortamında **bellek içi depo** ve **örnek (mock) AI yanıtları**
devreye girer. Böylece iki tarayıcı penceresiyle (biri gizli sekme) tüm akışı — çift oluştur → koda katıl → anlat →
partnerinin gözünden gör → yeniden değerlendir → çözüm raporu — baştan sona deneyebilirsiniz.

| Komut               | Ne yapar                                                             |
| ------------------- | -------------------------------------------------------------------- |
| `npm run dev`       | Geliştirme sunucusu                                                  |
| `npm run build`     | Üretim derlemesi (`dist/client`, `dist/server`)                      |
| `npm start`         | Üretim sunucusu (`server.mjs`, srvx + statik dosyalar + güvenlik başlıkları) |
| `npm test`          | Vitest: SQL (PGlite), gizlilik/eşzamanlılık akışı, Türkçe ekler      |
| `npm run typecheck` | TypeScript                                                           |
| `npm run assets`    | PWA ikonlarını, iOS açılış ekranlarını ve OG görselini yeniden üretir |

## Ortam değişkenleri

Tam liste ve açıklamalar: [`.env.example`](./.env.example).

| Değişken                    | Zorunlu        | Açıklama                                                                 |
| --------------------------- | -------------- | ------------------------------------------------------------------------ |
| `SUPABASE_URL`              | üretimde evet  | Supabase proje adresi (`VITE_SUPABASE_URL` da okunur)                     |
| `SUPABASE_SERVICE_ROLE_KEY` | üretimde evet  | **Yalnızca sunucuda** kullanılır; istemciye asla gitmez                   |
| `OPENAI_API_KEY`            | biri           | Doğrudan OpenAI                                                          |
| `LOVABLE_API_KEY`           | biri           | Lovable AI Gateway (Lovable Cloud'da otomatik)                           |
| `MESELE_AI_PROVIDER`        | hayır          | `openai` · `lovable` · `mock` — açık seçim                               |
| `MESELE_AI_MODEL`           | hayır          | Ana model (varsayılan `gpt-4o`; Lovable'da `openai/gpt-5-mini`)          |
| `MESELE_AI_MODEL_FAST`      | hayır          | "…'nın Gözünden" metinleri için hızlı model (varsayılan `gpt-4o-mini`)   |
| `MESELE_AI_STRUCTURED`      | hayır          | `json_schema` (katı şema, OpenAI varsayılanı) · `json_object` (Lovable varsayılanı) |
| `VITE_COUNSELOR_URL`        | hayır          | Çözüm raporunda "Psk. Dan. Fırat YALÇIN ile görüşme" bağlantısı          |
| `MESELE_APP_URL`            | Capacitor için | Yerel uygulamanın açacağı yayınlanmış adres                              |

## Supabase / Lovable Cloud kurulumu

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

| Adım                           | Ekranda                                                                                   |
| ------------------------------ | ----------------------------------------------------------------------------------------- |
| **1. Anlat**                   | Olay (açık uçlu) · Birincil duygular (çip) · Otomatik tepki (çip) · Gerçek ihtiyaç · Kendi payın · Gizlilik tercihi |
| **2. Partnerinin Gözünden Gör** | "[Ad]'ın Gözünden" metni + partnerin paylaştığı ham yanıtlar + senin anlatımının ona nasıl yansıtıldığı |
| **3. Yeniden Değerlendir**     | Ne dokundu · Altında ne olabilir · Kendi payına dair yeni fark · Ona tek cümle · Yakınlık (1–5, yalnızca sana) |
| **4. Çözüm Raporu**            | Sana Özel Ayna (hemen) + Ortak Rapor: Ortak Döngünüz, Kim Haklı?, Temel İhtiyaç Kesişimi, 3 onarım adımı, "Bugün için" |

**Genel Görüş** 10 tamamlanmış meseleden sonra açılır: 9 bölümlük kalıcı ilişki dinamiği raporu (hikâye, tekrarlayan
dans, tetikleyiciler, duygu haritası, bağlanma ihtiyaçları, Dört Atlı aynası, güçlü yanlar, büyüme alanları,
önümüzdeki yol) ve iki partnerin paylaşılan çip seçimlerinin dağılımı. 5 yeni mesele sonra güncellenebilir.

## Kırılmaz güvenlik kuralları — nerede uygulanıyor?

| Kural                                    | Uygulama                                                                                                    | Test |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ---- |
| **Çift kodu bir şifre değildir**         | 6 hane, karışan karakter yok (`crypto.server.ts`). Kod yalnızca `joinCouple`'da çifti bulur; B rolü dolunca kod hiçbir şey açmaz (`unique(couple_id, role)`). Kimlik doğrulama yalnızca token ile. Koda katılma IP başına hız sınırlı. | `flow.test.ts` |
| **Cihaza özel gizli token**              | 256-bit (`crypto.getRandomValues`), base64url, yalnızca bir kez döner; istemcide `localStorage['mesele.member.v1']` (+ Capacitor Preferences yedeği). DB'de yalnızca SHA-256 `auth_token_hash`. | `flow.test.ts`, `sql.test.ts` |
| **`x-mesele-member` + `memberAuth`**     | [`src/functions/middleware.ts`](./src/functions/middleware.ts): istemci başlığı ekler, sunucu hash'leyip üyeyi bulur. Her mesele erişimi `requireDispute` ile `member → couple → dispute` zincirini doğrular; yabancı mesele "bulunamadı" döner (IDOR). | `flow.test.ts` |
| **RLS + sunucu izolasyonu**              | Tüm tablolarda RLS açık, politika yok, istemci rollerine yetki yok. Tüm okuma/yazma `createServerFn` içinde service role ile. Sunucu fonksiyonlarına yalnızca aynı kökenden istek (CSRF middleware, `src/start.ts`). `*.server.ts` dosyaları istemci paketine giremez. | `sql.test.ts` |
| **Gizlilik ayrımı (partner / private)**  | [`prompts.server.ts`](./src/server/prompts.server.ts) `describeMember(includePrivate)`: partnerin göreceği hiçbir isteme "private" içerik girmez; görünüm modeli partnere yalnızca `visibility = 'partner'` yanıtları döner; ortak rapor iki onaya kadar istemciye hiç gönderilmez. Service worker sunucu yanıtlarını asla önbelleğe almaz. | `flow.test.ts` (istem düzeyinde) |
| **Çift AI çağrısını önleme**             | `mesele_claim_status` atomik `UPDATE … WHERE status = from` + 4 dakikalık bayat kilit. Sonuçlar `mesele_finish_*` ile yalnızca kilit sahibi tarafından, tek işlemde yazılır; hata olursa kilit bırakılıp durum geri alınır. | `sql.test.ts`, `flow.test.ts` (eşzamanlı çağrılar → tam 2 ve 3 AI çağrısı) |
| **Geçmiş veri silinmez**                 | Tamamlanan meseleler için silme yolu yok (`deleteDispute … status <> 'completed'`); yalnızca açan kişi, cevap aşamasındaki bir meseleyi kapatabilir. | — |

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
capacitor.config.ts     iOS/Android kabuğu
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

| Tablo                  | Eklenen                                   | Neden                                                                   |
| ---------------------- | ----------------------------------------- | ----------------------------------------------------------------------- |
| `couples`              | `name`                                    | `/olustur` ekranındaki "çift adı"                                       |
| `disputes`             | `created_by`, `created_at`, `updated_at`  | Meseleyi kimin açtığı (kapatma yetkisi), kronolojik arşiv              |
| `dispute_entries`      | `perspective`, `submitted_at`, zaman damgaları | "[Ad]'ın Gözünden" metni ve "anlatımı gönderdi" bilgisi            |
| `reconsiderations`     | `updated_at`                              | Taslak kaydı                                                            |
| `relationship_reports` | `dispute_count`, `status`, `status_locked_at`, `created_at` | Kaç meseleye dayandığı ve eşzamanlı üretim kilidi    |
