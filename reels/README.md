# Split-screen Reels (1080x1920)

- **Üst (1080x960):** metne senkron canvas animasyonları, kelime vurgulu altyazı, ilerleme çubuğu.
- **Alt (1080x960):** avatar videosu yüze göre kırpılır, vurgu anlarında hafif yakınlaşma (zoom punch-in) yapılır.
- Ses: avatar sesi, Reels için -14 LUFS'a normalize edilir.

| Dosya | İçerik |
| --- | --- |
| `engine.js` | Ortak motor: yardımcılar, altyazı, arka plan, sahne geçişleri, saydam bindirme katmanı |
| `follow.js`, `assets/profile.png` | Ortak takip et animasyonları (avatar üstü kompakt kart, kapanış kartı) |
| `render.cjs` | Playwright ile kare kare çizim + FFmpeg birleştirme |
| `scene.html`, `final_reels.mp4` | Video 1 — “Hadi ders çalış” yerine 10 dakika kuralı (40 sn) |
| `v2/scene.html`, `v2/final_reels.mp4` | Video 2 — Çocuk masada neden duramıyor? (102 sn), ortada ve sonda takip et animasyonu |
| `v2/align.py`, `v2/script.txt`, `v2/words.js` | Seslendirme metninin sesle kelime düzeyinde hizalanması |
| `v3/scene.html`, `v3/final_reels.mp4` | Video 3 — Planı çocuk yapsın, 3 soru yöntemi (68 sn), altyazısız, fotoğraf ve illüstrasyonlu |
| `v4/scene.html`, `v4/clips/`, `v4/final_reels.mp4` | Video 4 — Mükemmeliyetçi çocuklar (162 sn), altyazısız; hazır çocuk klipleri üstte kart içinde (`TOP_CLIPS`) ve altta avatarın yerinde (`BOTTOM_CLIPS`) |

```bash
# Video 1
NODE_PATH=$(npm root -g) node render.cjs avatar.mp4 final_reels.mp4
# Video 2
NODE_PATH=$(npm root -g) node render.cjs --scene v2/scene.html v2/avatar.mp4 v2/final_reels.mp4
# Video 3
NODE_PATH=$(npm root -g) node render.cjs --scene v3/scene.html v3/avatar.mp4 v3/final_reels.mp4
# Video 4 (uzun video: dosya GitHub'ın 100 MB sınırının altında kalsın diye bit hızı sınırlı)
REELS_CRF=19 REELS_MAXRATE=4M NODE_PATH=$(npm root -g) node render.cjs --scene v4/scene.html v4/avatar.mp4 v4/final_reels.mp4
# hızlı kontrol: seçili anları preview/ altına PNG olarak kaydeder (o_*.png = alt bindirme katmanı)
NODE_PATH=$(npm root -g) node render.cjs --scene v2/scene.html --preview 1,54.5,98
```

Zamanlama:

- Video 1'de sahne zamanları avatar sesindeki sessizlik analizinden (`ffmpeg silencedetect`) çıkarıldı.
- Video 2'de `align.py`, metni hece sayılarına göre sesteki konuşma bölümlerine dinamik programlama ile hizalar. Yavaş okunan sayı listesi için zaman çapaları verilir:

```bash
python3 v2/align.py v2/avatar.mp4 v2/script.txt 7-8@18.15 10-15@19.40 9-10@20.79 15-20@22.03 11-12@23.58 20-30@24.93 Buna@28.43
python3 -c "import json; open('v2/words.js','w').write('const WORDS = '+json.dumps(json.load(open('words.json')),ensure_ascii=False)+';\n')"
```

Video 3'te seslendirme metni verilmediği için konuşma, sherpa-onnx ile çalışan Whisper (medium) modeliyle yazıya döküldü, elle düzeltildi (`v3/script.txt`) ve `align.py` ile hizalandı. Video 4'te metin verildi; Whisper dökümünün parça başlangıçları `align.py`'ye zaman çapası olarak verildi.

Gereksinimler: Node + Playwright (Chromium), FFmpeg, Python 3, Inter Display ve Noto Color Emoji fontları.
