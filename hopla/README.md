# Hopla

> **Basılı tut. Bırak. Zıpla.** Tek parmakla oynanan, minimalist 3D zıplama oyunu.

Ekrana basılı tut: kahraman ve altındaki platform ezilir. Bırak: basılı tuttuğun süreyle doğru orantılı bir
mesafeye zıplar. Bir sonraki platforma inersen +1 puan; tam ortasına inersen +2, art arda tam isabetlerde
+3, +4 … (en fazla +8). Platformu kaçırırsan oyun biter; tek dokunuşla yeniden başlarsın. Platformlar
ilerledikçe küçülür ve aralar açılır.

- **Web:** `https://<sunucu>/hopla/` (MESELE ile aynı Render servisi). Telefonda açıp _Ana Ekrana Ekle_ →
  tam ekran, bir kez açıldıktan sonra internetsiz de çalışır.
- **iOS / Android:** [`mobile/`](./mobile) — Expo uygulaması, oyun içine gömülü.

## Yapı

```
hopla/
  core/        Oyun kuralları: seed'li seviye üretimi, zıplama fiziği, puan, yeniden oynatma (istemci + sunucu ortak)
  web/         three.js istemcisi (Vite): sahne, animasyon, dokunma, arayüz, PWA
  mobile/      Expo kabuğu (iOS/Android), game/html.ts = oyunun tek dosyalık derlemesi
  scripts/     ikon üretimi
src/server/hopla/   Sıralama API'si, isim denetimi, depolar (Supabase / SQLite / bellek)
src/routes/api/hopla/$.ts   /api/hopla/v1/* uçlarını mevcut sunucuya bağlar
supabase/hopla.sql  Supabase'de bir kez çalıştırılacak tablo + fonksiyonlar (MESELE tablolarına dokunmaz)
```

**Neden bu yapı?** Mevcut altyapı (GitHub → testler → Render, Supabase) olduğu gibi kullanılır: yeni servis,
yeni veritabanı ya da ücretli hizmet yok. Oyun sunucuya ihtiyaç duymaz; sunucu yalnızca sıralama içindir ve
yanıt vermezse oyun sessizce çevrimdışı devam eder.

**Teknoloji:** TypeScript + [three.js](https://threejs.org) (WebGL 2) + Vite. Ortografik sabit kamera, tek
yönlü ışık + yumuşak gölge (PCF), yalnızca gölgeyi gösteren zemin; çizim döngüsü hareket yokken uyur (pil
dostu). Sesler WebAudio ile sentezlenir (dosya yok).

## Komutlar (kök klasörde)

| Komut                  | Ne yapar                                                                     |
| ---------------------- | ---------------------------------------------------------------------------- |
| `npm run hopla:dev`    | Oyun geliştirme sunucusu: `http://localhost:5173` (API için `npm run dev`)   |
| `npm run hopla:build`  | Web derlemesi → `dist/client/hopla` (`npm run build` bunu da yapar)          |
| `npm run hopla:native` | Uygulama için tek dosya → `hopla/mobile/game/html.ts`                        |
| `npm run hopla:icons`  | İkonları üretir (`npx -y -p playwright@1.56.1 node hopla/scripts/icons.mjs`) |
| `npm test`             | Tüm testler (oyun: `tests/hopla-*.test.ts`)                                  |

Telefonda geliştirme: `npm run dev:lan` ve `npm run hopla:dev` → telefonda `http://<bilgisayar-IP>:5173`.

## Sıralama API'si — `/api/hopla/v1`

| Uç                  | Açıklama                                                                  |
| ------------------- | ------------------------------------------------------------------------- |
| `GET /health`       | Depo türü ve kurulum durumu (gizli bilgi yok)                             |
| `POST /challenge`   | İsim kaydı için iş kanıtı (proof-of-work) bilmecesi                       |
| `POST /players`     | `{name, country, challenge, nonce}` → cihaz anahtarı (yalnızca bir kez)   |
| `GET /players/me`   | Profil, rekor, dünya ve ülke sırası (`Authorization: Bearer <anahtar>`)   |
| `PATCH /players/me` | İsim/ülke değiştir (24 saatte en fazla 3)                                 |
| `POST /runs`        | `{seed}` → imzalı oyun bileti (oyun hazırlanırken istenir)                |
| `POST /scores`      | `{ticket, holds, score}` → sunucu oyunu yeniden oynatıp doğrular          |
| `GET /leaderboard`  | `?scope=world` ya da `?scope=country&country=TR`, `&limit=50`             |
| `GET /countries`    | Ülkeler: her ülkenin en iyi 10 oyuncusunun rekor toplamı                  |
| `POST /admin/ban`   | `{name, banned}` + `x-admin-password` başlığı — ismi sıralamadan kaldırır |

CORS açıktır (kimlik çerez değil, Bearer anahtarıdır); uygulama farklı kökenden çağırabilir.

### İsimler

- 3–16 karakter; her dilin harfleri, rakam, arada boşluk `.` `_` `-`. Emoji ve simge yok.
- **Benzersiz:** büyük/küçük harf, aksan, ayraç ve birbirine benzeyen harfler yok sayılır (`Ali`, `ALİ`, `A.l.i`,
  Kiril `Аli` aynı isimdir) — kimse başkasını taklit edemez.
- **Engellenenler:** çok dilli küfür ve hakaret (TR, EN, ES, PT, FR, DE, IT, NL, PL, RU, AR, FA, HI, ID, TL, ZH,
  JA, KO, TH, EL, HE…), ırkçı ifadeler, Hitler gibi kötü şöhretli kişiler, terör örgütleri, siyasi kişi + hakaret
  birleşimleri ("… hain", "… katil"), sistem isimleri (admin, hopla…). Rakamla (`h1tl3r`), ayraçla (`f.u.c.k`),
  harf tekrarıyla (`fuuuck`) ve benzer harflerle yazılanlar da yakalanır. Liste: `src/server/hopla/blocklist.ts`.
- `OPENAI_API_KEY` tanımlıysa her yeni isim ayrıca OpenAI'nin **ücretsiz** moderasyon servisinden geçer (her dilde
  ikinci güvenlik ağı). Kapatmak için `HOPLA_NAME_AI=off`.
- Gözden kaçan bir isim: `curl -X POST https://<sunucu>/api/hopla/v1/admin/ban -H "x-admin-password: <şifre>"
-H "content-type: application/json" -d '{"name":"…"}'` (şifre: `HOPLA_ADMIN_PASSWORD` ya da
  `MESELE_ADMIN_PASSWORD`).

### Toplu isim almaya karşı

Cihaz başına tek isim (değiştirince eskisi serbest kalır) · her kayıtta telefonda ~1 sn süren iş kanıtı ·
aynı IP'den 24 saatte en fazla 10 kayıt (IP yalnızca tuzlu özetiyle saklanır) · 24 saatte en fazla 3 isim
değişikliği · 7 gün içinde hiç skor göndermeyen isimler serbest bırakılır.

### Hileye karşı

Her oyunun seed'i sunucuda imzalanır; skor, oyunun basılı tutma süreleriyle birlikte gönderilir ve sunucu
oyunu `hopla/core/sim.ts` ile **birebir yeniden oynatarak** puanı hesaplar (yalnızca + − × ÷ ve √ kullanıldığı
için her cihazda aynı sonuç). Oyunun gerçek zamanda sürebileceği en kısa süre dolmadan gelen, başka oyuncunun
biletini kullanan ya da 3 günden eski skorlar reddedilir. (Gerçek zamanlı oynayan bir bot tamamen
engellenemez; şüpheli isimler yönetici ucundan kaldırılabilir.)

## Veritabanı

| Ortam                              | Depo                                                      |
| ---------------------------------- | --------------------------------------------------------- |
| Render + Supabase bilgileri        | Supabase: **bir kez** `supabase/hopla.sql` çalıştırılmalı |
| cPanel (Supabase yok)              | SQLite: `~/mesele-veri/hopla.db` (kendiliğinden kurulur)  |
| Geliştirme / `MESELE_STORE=memory` | Bellek (sunucu yeniden başlayınca sıfırlanır)             |

**Supabase kurulumu:** Supabase → SQL Editor → New query → `supabase/hopla.sql` dosyasının tamamını yapıştır →
Run. Tekrar çalıştırmak zararsızdır. Kontrol: `https://<sunucu>/api/hopla/v1/health` → `"ready": true`.

## İsteğe bağlı ortam değişkenleri

| Değişken                        | Varsayılan                                                                              |
| ------------------------------- | --------------------------------------------------------------------------------------- |
| `HOPLA_SECRET`                  | Bilet imza anahtarı; yoksa `SUPABASE_SERVICE_ROLE_KEY`/`MESELE_HASH_SALT`'tan türetilir |
| `HOPLA_POW_BITS`                | `17` (iş kanıtı zorluğu; her +1 süreyi ikiye katlar)                                    |
| `HOPLA_MAX_PLAYERS_PER_IP`      | `10` (24 saatte aynı IP'den yeni isim)                                                  |
| `HOPLA_ADMIN_PASSWORD`          | yoksa `MESELE_ADMIN_PASSWORD`; ikisi de yoksa yönetici ucu kapalı                       |
| `HOPLA_NAME_AI`                 | `off` → OpenAI moderasyonu kapalı                                                       |
| `HOPLA_STORE` / `HOPLA_DB_PATH` | `memory` → bellek; SQLite dosya yolu                                                    |
