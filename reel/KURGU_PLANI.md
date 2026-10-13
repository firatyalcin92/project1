# Reel: “Birini sevmekle, sevmeyi bilmek aynı şey değil”

Format: 1080×1920 (9:16), 30 fps, 2:41. Ses: kendi kaydınız (`ses.m4a`).

## Dosyalar

| Dosya | Ne işe yarar |
|---|---|
| `cikti/reel_taslak.mp4` | Tam kurgu taslağı: ses + görseller + altyazı. Konuşan bölümlerde şimdilik **fotoğrafınız** var (dudak hareketi yok). |
| `cikti/broll/*.mp4` | Her ara görsel ayrı klip olarak (altyazısız), CapCut / Premiere'e sürükleyip bırakmak için. |
| `altyazi.srt` | Kelime zamanlamalı Türkçe altyazı (sesinizden çıkarıldı, Fromm vb. yazımlar düzeltildi). |
| `cikti/kapak.jpg` | Reel kapağı. |
| `reel.html`, `render.mjs` | Kurgunun kaynağı; görsel/zaman değişince video yeniden üretilir. |

## Kurgu akışı (A = siz kamerada, B = ara görsel)

| Zaman | Tür | İçerik |
|---|---|---|
| 0:00–0:13 | **A** yakın | “Birini çok seviyor olmanız…” → durak → “Kulağa sert gelmiş olabilir…” → Fromm cümlesi |
| 0:13–0:17 | B | *Sevme Sanatı* kitap kapağı (1956) |
| 0:17–0:22 | B | Alıntı: “Sevgi bir sanat mıdır? O hâlde bilgi ve çaba gerektirir.” |
| 0:22–0:23 | B | “Şimdi bir düşünün.” |
| 0:23–0:27 | B | Tuvale çizilen resim (resim yapmayı öğrenmek) |
| 0:27–0:31 | B | Piyano tuşları + notalar, “Pratik · Tekrar · Emek” |
| 0:31–0:37 | **A** geniş | “Peki neden sevginin kendiliğinden öğrenilen bir şey olduğunu düşünüyoruz?” |
| 0:37–0:47 | B | Yanlış sorular: “Nasıl daha çekici olurum? / Nasıl sevilirim? / Nasıl vazgeçilmez olurum?” → üstleri çiziliyor |
| 0:47–0:54 | **A** yakın | “Oysa asıl soru…” + kart: *Ben bir insanı sevmeyi ne kadar biliyorum?* |
| 0:54–1:00 | B | Telefon kilit ekranı, büyüteç, “Bugün 9. kez” → **“Merak” mı?** |
| 1:00–1:06 | B | Mesajlaşma: “Bu akşam arkadaşlarla buluşacağım” → “Gitmesen olmaz mı?” → “Sadece seni kaybetmek istemiyorum.” |
| 1:06–1:14 | B | Terazi: *Benim ihtiyaçlarım* ağır basıyor, *Onun hissettikleri* → “?” |
| 1:14–1:25 | **A** geniş | “Peki burada gerçekten sevgi mi var, yoksa…kontrol ihtiyacı mı?” + “dört temel unsur” |
| 1:25–1:31 | B | Sırayla: **İlgi · Sorumluluk · Saygı · Tanımak** |
| 1:31–1:36 | **A** yakın | “Yani sevgi yalnızca ‘Seni seviyorum’ demek değildir.” |
| 1:36–1:45 | B | İki daire (Siz / O): farklı birey → sınırlar → onu dönüştürmeye çalışmamak |
| 1:45–1:53 | **A** geniş | “Ama burada önemli bir ayrım var…” + kart: *Çaba ≠ Katlanmak* |
| 1:53–2:00 | B | Koyu ekran: ~~Şiddet~~ ~~Aşağılanma~~ ~~Sürekli kontrol~~: *sevginin bedeli değildir.* |
| 2:00–2:11 | **A** yakın | “Şimdi size bir soru soracağım…” |
| 2:11–2:24 | B | İki soru kartı: “…beni gerçekten *tanımaya* çalışıyor mu?” / “Ben onu *tanımaya* çalışıyor muyum?” |
| 2:24–2:31 | B | “Eksik olan şey aşk değil, *sevgiyi yaşama biçimimizdir.*” |
| 2:31–2:41 | **A** geniş | Kapanış sorusu + anket kartı (A: duygu mu / B: beceri mi) + “Yorumlara yazın ↓” |

Konuşan bölümler toplam ~77 sn, ara görseller ~84 sn. Geçişler sesteki nefes aralarına denk getirildi.

## Konuşan bölümler (A) neden fotoğraf, ne yapmalı?

Bu ortamda dudak senkronu (lip-sync) yapan bir model çalıştırılamadı, internet erişimi bu tür modellere kapalı.
Tek bir fotoğraftan üretilen konuşan yüzler (HeyGen, Hedra, D-ID vb.) hâlâ çoğu izleyicinin fark edeceği kadar
yapay duruyor. Sizin amacınız da tam tersi: güven veren, gerçek bir aile danışmanı.

**Önerim (en doğal sonuç):** A bölümlerini kendiniz çekin. Toplam ~77 saniye, 8 kısa parça.
1. Ses kaydınız zaten hazır. Telefonu dikey sabitleyin, ikinci fotoğraftaki gibi kitaplık + bitki + koltuk önünde,
   pencereden gelen yumuşak ışıkla oturun.
2. Kulaklıktan kendi ses kaydınızı dinleyerek (veya metni yeniden okuyarak) yukarıdaki A satırlarını kameraya bakarak söyleyin.
3. Çekimi taslağın A bölümlerinin yerine koyun. B klipleri (`cikti/broll/`) ve `altyazi.srt` olduğu gibi kullanılabilir.
   Videoyu yeniden okursanız yeni sesten altyazıyı yeniden üretmek dakikalar sürer.

**Alternatif:** Bir lip-sync servisine `ses.m4a` + fotoğrafınızı verip konuşan video alın, sonra A bölümlerine yerleştirin.
Bu yolda da arka planı ikinci fotoğraftaki konsepte taşımak için servisin “sahne/arka plan” özelliğini kullanmanız gerekir.

## Notlar

- Kitap kapağı, gerçek baskının birebir kopyası değil, stilize bir tasarım. Gerçek baskının fotoğrafını kullanmak isterseniz
  sadece o 4 saniyelik klibi değiştirmek yeterli.
- Kayıtta metinden küçük sapmalar var (ör. “partnerim, eşim” eklemesi, kapanışta “Yorumlarınızı bekliyorum”).
  Altyazı, yazılı metne göre değil, **söylenene** göre yazıldı.
- Instagram arayüzünün kapattığı alanlar (alt ~%20, sağdaki butonlar) boş bırakıldı.

## Yeniden üretme

```bash
npm install
python3 veri/altyazi_uret.py                 # kelime zamanlarından altyazı
node render.mjs cikti/reel_taslak.mp4         # tam video
node render.mjs b.mp4 --nocap --from 13.2 --to 31.55   # altyazısız aralık
```
