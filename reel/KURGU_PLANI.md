# Reel: “Birini sevmekle, sevmeyi bilmek aynı şey değil”

Format: 1080×1920 (9:16), 30 fps, 2:41. Görüntüde kişi yok, yalnızca ses (seslendirme) + görseller.

## Dosyalar

| Dosya | Ne işe yarar |
|---|---|
| `cikti/reel_taslak.mp4` | Yayına hazır video (tam kalite). |
| `cikti/reel_taslak_onizleme.mp4` | Aynı videonun sıkıştırılmış önizlemesi. |
| `cikti/broll/*.mp4` | Görsel sahneler ayrı klipler hâlinde, altyazısız (başka bir editörde kullanmak için). |
| `cikti/kapak.jpg` | Reel kapağı. |
| `altyazi.srt` | Kelime zamanlamalı Türkçe altyazı. |
| `ses_iyilestirilmis.m4a` | Temizlenmiş ses (videoda kullanılan). `ses.m4a` orijinal kayıt. |

## Ses iyileştirme (`ses_iyilestir.sh`)

1. 80 Hz altı uğultu kesildi.
2. RNNoise ile oda gürültüsü / hışırtı temizlendi (%90 karışım, ses doğal kalsın diye).
3. EQ: 220 Hz çamurluk −2,5 dB, 3,2 kHz netlik +2,5 dB, 9 kHz üstü hava +1,5 dB.
4. De-esser (sert “s/ş” sesleri yumuşatıldı), hafif kompresör (3:1).
5. İki geçişli ses yüksekliği normalizasyonu: **−14 LUFS**, tepe −1 dBTP (Instagram/Reels standardı).

Ölçüm: konuşma ~6 dB daha yüksek, duraklardaki arka plan gürültüsü ~6 dB daha düşük (konuşma/gürültü farkı ~12 dB arttı).

## Kurgu akışı (S = seslendirme sahnesi, G = görsel sahne)

Seslendirme sahneleri: koyu, sıcak tonlu, yavaş hareket eden ışık; söylenen cümle ekranda büyük yazıyla, kelime kelime aydınlanarak ilerliyor. Altında sesin şiddetine göre hareket eden ince ses çubukları var.

| Zaman | Tür | İçerik |
|---|---|---|
| 0:00–0:13 | **S** | “Birini çok seviyor olmanız…” → durak → “Kulağa sert gelmiş olabilir…” → Fromm cümlesi |
| 0:13–0:17 | G | *Sevme Sanatı* kitap kapağı (1956) |
| 0:17–0:22 | G | Alıntı: “Sevgi bir sanat mıdır? O hâlde bilgi ve çaba gerektirir.” |
| 0:22–0:23 | G | “Şimdi bir düşünün.” |
| 0:23–0:27 | G | Tuvale çizilen resim |
| 0:27–0:31 | G | Piyano tuşları + notalar, “Pratik · Tekrar · Emek” |
| 0:31–0:37 | **S** | “Peki neden sevginin kendiliğinden öğrenilen bir şey olduğunu düşünüyoruz?” |
| 0:37–0:47 | G | Yanlış sorular, üstleri çiziliyor |
| 0:47–0:54 | **S** | “Oysa asıl soru…” + kart: *Ben bir insanı sevmeyi ne kadar biliyorum?* |
| 0:54–1:00 | G | Telefon kilit ekranı, büyüteç → **“Merak” mı?** |
| 1:00–1:06 | G | Mesajlaşma: “Gitmesen olmaz mı?” / “Sadece seni kaybetmek istemiyorum.” |
| 1:06–1:14 | G | Terazi: *Benim ihtiyaçlarım* ↔ *Onun hissettikleri* |
| 1:14–1:25 | **S** | “Sevgi mi var, yoksa…kontrol ihtiyacı mı?” + “dört temel unsur” |
| 1:25–1:31 | G | Sırayla: **İlgi · Sorumluluk · Saygı · Tanımak** |
| 1:31–1:36 | **S** | “Yani sevgi yalnızca ‘Seni seviyorum’ demek değildir.” |
| 1:36–1:45 | G | İki daire (Siz / O): farklı birey → sınırlar → dönüştürmeye çalışmamak |
| 1:45–1:53 | **S** | “Ama burada önemli bir ayrım var…” + kart: *Çaba ≠ Katlanmak* |
| 1:53–2:00 | G | ~~Şiddet~~ ~~Aşağılanma~~ ~~Sürekli kontrol~~: *sevginin bedeli değildir.* |
| 2:00–2:11 | **S** | “Şimdi size bir soru soracağım…” |
| 2:11–2:24 | G | İki soru kartı: “…beni gerçekten *tanımaya* çalışıyor mu?” / “Ben onu *tanımaya* çalışıyor muyum?” |
| 2:24–2:31 | G | “Eksik olan şey aşk değil, *sevgiyi yaşama biçimimizdir.*” |
| 2:31–2:41 | **S** | Kapanış sorusu + anket kartı (A: duygu mu / B: beceri mi) + “Yorumlara yazın ↓” |

## Notlar

- Kitap kapağı gerçek baskının kopyası değil, stilize bir tasarım.
- Altyazılar yazılı metne göre değil, kayıtta **söylenene** göre (ör. “partnerim, eşim” eklemesi).
- Instagram arayüzünün kapattığı alanlar (alt ~%20, sağdaki butonlar) boş bırakıldı.
- Görsel sahnelerin hepsi animasyon; stok video sitelerine bu ortamdan erişilemedi.

## Yeniden üretme

```bash
npm install
./ses_iyilestir.sh                         # ses.m4a -> ses_iyilestirilmis.m4a
python3 veri/zarf_uret.py                  # ses çubukları için ses şiddeti verisi
python3 veri/altyazi_uret.py               # kelime zamanlarından altyazı
node render.mjs cikti/reel_taslak.mp4      # tam video (~7 dk)
./broll.sh                                 # altyazısız görsel klipler
```
