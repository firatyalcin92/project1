# Reel 2: Küçük paylaşımlar azalınca (dinlenmemek ve iletişimsizlik)

Format: 1080×1920 (9:16), 30 fps, 3:17. Görüntüde gerçek kişi yok: kadın–erkek çift animasyonu + seslendirme.

## Dosyalar

| Dosya | Ne işe yarar |
|---|---|
| `cikti/reel.mp4` | Yayına hazır video. |
| `cikti/kapak.jpg` | Reel kapağı (“İletişimsizlik bazen sessizce başlar”). |
| `altyazi.srt` | Söylenene göre düzeltilmiş, kelime zamanlamalı Türkçe altyazı. |
| `ses_final.m4a` | Temizlenmiş ses + efektler (videodaki ses). `ses.m4a` orijinal kayıt. |

## Ses

- Konuşma: uğultu kesme, RNNoise gürültü temizliği, netlik EQ'su, de-esser, hafif kompresör, −14 LUFS (Instagram).
- Efektler (`sfx.py`, hepsi kodla sentezlendi, telifsiz): sahne geçişlerinde yumuşak “whoosh”, baloncuklarda “pop”,
  telefon bildirimi, klavye tıkırtısı, kalp çıkınca yükselen ton, takip et dokunuşu, kapanışta zil. Konuşmanın 8–12 dB altında.

## Akış

| Zaman | Sahne |
|---|---|
| 0:00–0:12 | Kanepede iki telefon: “Sende bir durgunluk var…”, “Sen bir sessizleştin…” baloncukları, “iki yabancı olduk” kartı; aralarındaki mesafe açılıyor |
| 0:12–0:15 | “Bu cümleler size tanıdık geliyor mu?” |
| 0:15–0:26 | Aylar içinde küçülüp “…”ya dönüşen mesaj baloncukları (yavaş yavaş) |
| 0:26–0:33 | Siz / Partneriniz → dönen oklarla “karşılıklı döngü” |
| 0:33–0:48 | Kadın eve gelip heyecanla anlatıyor, erkek telefonda “hı hı…”, bildirim, **göz teması yok**, kadının yüzü düşüyor |
| 0:48–0:54 | “1 kez” → önemli değil · yorgunluk · kafa dolu |
| 0:54–1:02 | Takvim “✕”lerle doluyor (sık sık…) |
| 1:02–1:09 | Paylaşılmayan düşünceler: günüm nasıl geçti / neye üzüldüm / neye sevindim, sönüp gidiyor |
| 1:09–1:16 | O da telefona, sonra diziye dönüyor (“Sonraki bölüm 5 sn”), mesafe açılıyor |
| 1:16–1:28 | “hı hı / sonra anlatırsın / hmm” → **“önemsenmiyorum”** düşüncesi, “Paylaşmak” anahtarı kapanıyor |
| 1:28–1:38 | John Gottman kartı (fotoğraf, Washington Üniversitesi) |
| 1:38–1:48 | Küçük temaslar / “bağlantı teklifleri” (bids): anlatmak, soru sormak, göstermek |
| 1:48–1:57 | “Bak şuna!” → erkek telefonu bırakıp dönüyor, göz teması, kalp: *karşılık vermek* |
| 1:57–2:06 | “Paylaşma isteği” çubuğu %100 → %15 |
| 2:06–2:13 | Erkek sessizleşen eşine bakıyor, kafasında soru işaretleri |
| 2:13–2:23 | Tanıdık cümleler yeniden: “Son zamanlarda sende bir durgunluk var.” / “Birbirimizden biraz uzaklaşıyoruz sanki.” |
| 2:23–2:31 | “Sinsi bir uzaklaşma”: aradaki küçük baloncuklar sönüyor, kanepede çatlak, mesafe büyüyor |
| 2:31–2:44 | “Önemli olan”: 1) dinleyemiyorsanız söylemek 2) sonra dinlemek için zaman ayırmak |
| 2:44–2:55 | Laptoptaki erkek başını kaldırıp örnek cümleyi söylüyor → çay eşliğinde göz göze sohbet, “Olur 🙂” |
| 2:55–3:09 | Kapanış cümleleri, büyük yazıyla |
| 3:09–3:13 | Instagram profil kartı → “Takip Et”e dokunuş → “Takip Ediliyor ✓”, takipçi 1.417 → 1.418 |
| 3:13–3:17 | **Psk. Dan. Fırat YALÇIN · Aile/Çift Danışmanlığı · @firatyalcin.pd** |

## Notlar

- Profil kartında fotoğrafınız yerine “FY” monogramı var (görüntünüz kullanılmadı).
- Gottman fotoğrafı sizin gönderdiğiniz görsel. Paylaşmadan önce kullanım hakkını kontrol etmenizi öneririm;
  istenirse yerine isim kartı konabilir.
- “Bağlantı teklifleri (bids)” ifadesi metinde yok, Gottman'ın bu kavram için kullandığı terim olduğu için küçük bir alt satır olarak eklendi.

## Yeniden üretme

```bash
./ses_iyilestir.sh && ffmpeg -i ses_iyilestirilmis.m4a -af apad=whole_dur=197.5 ses_pad.m4a
python3 veri/altyazi_uret.py && python3 veri/zarf_uret.py
node -e "…window.SFX…" > veri/sfx_cues.json   # reel.html içindeki efekt listesi
python3 sfx.py veri/sfx_cues.json ses_pad.m4a ses_final.m4a
node render.mjs cikti/reel.mp4
```
