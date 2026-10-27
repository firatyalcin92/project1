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
| `v5/scene.html`, `v5/clips/`, `v5/final_reels.mp4` | Video 5 — Dikkat mi, odaklanma mı? + MOXO (100 sn), altyazısız; açılışta uzman isim levhası, son 15 sn'de üst panel küçülüp konuşmacı tam ekrana geçer (`FULLSCREEN_FROM`, `FULL(t)`) |
| `v6/scene.html`, `v6/clips/`, `v6/final_reels.mp4` | Video 6 — Yemek yemeyen çocuk, 3 öneri (148 sn), altyazısız; konuşmacı başta ~14 sn, sonra ≤4,5 sn'lik kısa görünümler, aradaki süre klip akışı (`BOTTOM_PLAN`) |
| `v7/scene.html`, `v7/final_reels.mp4` | Video 7 — Çocuğunuz yerinde durmuyor (85 sn), altyazısız, bölünmüş ekran yok: tamamı `FULL(t)` ile çizilir; arka plansız HeyGen konuşmacısı (`avatar_src.webm`, alfa kanallı VP9) sahnede dekupe olarak girip çıkar, görünmediğinde köşede küçük konuşma balonu |
| `v8/scene.html`, `v8/final_reels.mp4` | Video 8 — Sağlıklı gelişimin 3 işareti (125 sn), altyazısız; ilk 6,4 sn ve son 5 sn konuşmacı tam ekran, aradaki bölünmüş ekrana animasyonlu geçiş (`FULL_RANGES`) |
| `v9/scene.html`, `v9/final_reels.mp4` | Video 9 — Ekran kapanınca kriz, 3 öneri (201 sn); v8 düzeni + altta stok görüntü akışı, açılışta veli mesajı (DM balonu) |
| `v10/scene.html`, `v10/clips/`, `v10/final_reels.mp4` | Video 10 — Çocuklarda kaygıyı artıran 12 şey, Part 1: madde 1–6 (213 sn); açılışta konuşmacı tam ekran, sonra kısa görünümler; altta yeni ve önceki videolardan karışık stok akışı, son ~23 sn konuşmacı yok |
| `v11/scene.html`, `v11/final_reels.mp4` | Video 11 — Çocuklarda kaygıyı artıran 12 şey, Part 2: madde 7–12 (165 sn); açılış yazıları konuşmacının yüzünün altında; altta önceki videoların stok/klipleri karışık, son ~20 sn konuşmacı yok, kapanışta takip kartı |
| `v12/scene.html`, `v12/clips/`, `v12/final_reels.mp4` | Video 12 — Her akşam ödev kavgası, 4 öneri + MOXO (155 sn); konuşmacı yalnızca açılışta ve 4 kısa anda; altta yeni ve önceki stoklar karışık |
| `v13/scene.html`, `v13/final_reels.mp4` | Video 13 — Dikkat dağınıklığı DEHB belirtisi mi? (106 sn); ilk 15 sn ve son 10 sn konuşmacı tam ekran, arada bölünmüş ekran; HeyGen filigranı kadraj dışında |
| `splitfull.js` | Bölünmüş ekran ↔ tam ekran konuşmacı geçişleri (v8–v13) |
| `cover_render.cjs`, `v6/cover` … `v13/cover` | Reels kapakları (HTML → `kapak.png`) |

```bash
# Video 1
NODE_PATH=$(npm root -g) node render.cjs avatar.mp4 final_reels.mp4
# Video 2
NODE_PATH=$(npm root -g) node render.cjs --scene v2/scene.html v2/avatar.mp4 v2/final_reels.mp4
# Video 3
NODE_PATH=$(npm root -g) node render.cjs --scene v3/scene.html v3/avatar.mp4 v3/final_reels.mp4
# Video 4 (uzun video: dosya GitHub'ın 100 MB sınırının altında kalsın diye bit hızı sınırlı)
REELS_CRF=19 REELS_MAXRATE=4M NODE_PATH=$(npm root -g) node render.cjs --scene v4/scene.html v4/avatar.mp4 v4/final_reels.mp4
# Video 5
REELS_CRF=19 REELS_MAXRATE=4M NODE_PATH=$(npm root -g) node render.cjs --scene v5/scene.html v5/avatar.mp4 v5/final_reels.mp4
# Video 6
REELS_CRF=19 REELS_MAXRATE=4M NODE_PATH=$(npm root -g) node render.cjs --scene v6/scene.html v6/avatar.mp4 v6/final_reels.mp4
# Video 7 (avatar_src.webm HeyGen linkinden indirilir, repoda yok)
REELS_CRF=19 REELS_MAXRATE=4M NODE_PATH=$(npm root -g) node render.cjs --scene v7/scene.html v7/avatar_src.webm v7/final_reels.mp4
# Video 8 (avatar_src.mp4 HeyGen linkinden indirilir, repoda yok)
REELS_CRF=19 REELS_MAXRATE=4M NODE_PATH=$(npm root -g) node render.cjs --scene v8/scene.html v8/avatar_src.mp4 v8/final_reels.mp4
# Video 9
REELS_CRF=20 REELS_MAXRATE=3M NODE_PATH=$(npm root -g) node render.cjs --scene v9/scene.html v9/avatar_src.mp4 v9/final_reels.mp4
# Video 10
REELS_CRF=20 REELS_MAXRATE=3M NODE_PATH=$(npm root -g) node render.cjs --scene v10/scene.html v10/avatar_src.mp4 v10/final_reels.mp4
# Video 11
REELS_CRF=20 REELS_MAXRATE=3M NODE_PATH=$(npm root -g) node render.cjs --scene v11/scene.html v11/avatar_src.mp4 v11/final_reels.mp4
# Video 12
REELS_CRF=20 REELS_MAXRATE=3M NODE_PATH=$(npm root -g) node render.cjs --scene v12/scene.html v12/avatar_src.mp4 v12/final_reels.mp4
# Video 13
REELS_CRF=20 REELS_MAXRATE=3M NODE_PATH=$(npm root -g) node render.cjs --scene v13/scene.html v13/avatar_src.mp4 v13/final_reels.mp4
# Kapak
NODE_PATH=$(npm root -g) node cover_render.cjs v8/cover/cover.html v8/cover/kapak.png
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
