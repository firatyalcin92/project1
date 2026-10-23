# Split-screen Reels (1080x1920)

- **Üst (1080x960):** `scene.html` — metne senkron canvas animasyonları (9 sahne, kelime vurgulu altyazı, ilerleme çubuğu).
- **Alt (1080x960):** `avatar.mp4` — yüze göre kırpılır, vurgu anlarında hafif yakınlaşma (zoom punch-in) uygulanır.
- Ses: avatar sesi, Reels için -14 LUFS'a normalize edilir.

```bash
NODE_PATH=$(npm root -g) node render.cjs avatar.mp4 final_reels.mp4
# hızlı kontrol: seçili anları preview/ altına PNG olarak kaydeder
NODE_PATH=$(npm root -g) node render.cjs --preview 1,8.9,20.5
```

Gereksinimler: Node + Playwright (Chromium), FFmpeg, Inter Display ve Noto Color Emoji fontları.
Sahne zamanlamaları, avatar sesindeki sessizlik analizinden (`ffmpeg silencedetect`) çıkarılmıştır.
