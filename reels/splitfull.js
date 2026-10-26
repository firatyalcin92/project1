// Bölünmüş ekran ↔ tam ekran konuşmacı geçişleri (açılış ve kapanış).
// Sayfa şunları tanımlar: DURATION, SRC, BAND, FULLV, AVATAR, INTRO {hold,len}, OUTRO {at,len},
// TOP_CLIPS içinde 'avIn' (açılış) ve 'avOut' (kapanış) kareleri.
function camera(t, e) {
  // e = 0: tam ekran görünüm, e = 1: alt yarı (FFmpeg zoompan ile aynı görüntü)
  const z = 1 + (0.03 * t) / DURATION;
  const vw = BAND.w / z, vh = BAND.h / z;
  const c0 = { x: FULLV.x + FULLV.w / 2, y: FULLV.y + FULLV.h / 2 }, s0 = 1080 / FULLV.w;
  const c1 = { x: BAND.x + (BAND.w - vw) / 2 + vw / 2, y: BAND.y + (BAND.h - vh) * AVATAR.focusY + vh / 2 }, s1 = 1080 / vw;
  const D = 960 * e, H = 1920 - D;
  const s = s0 + (s1 - s0) * e;
  const sw = 1080 / s, sh = H / s;
  const cx = clamp(c0.x + (c1.x - c0.x) * e, sw / 2, SRC.w - sw / 2);
  const cy = clamp(c0.y + (c1.y - c0.y) * e, sh / 2, SRC.h - sh / 2);
  return { sx: cx - sw / 2, sy: cy - sh / 2, sw, sh, D, H };
}

function nameTagFull(t) {
  const u = t - 0.7;
  if (u < 0 || u > 5.4) return;
  const a = eOut(prog(u, 0, 0.5)) * (1 - eInOut(prog(u, 4.9, 0.5)));
  const dx = -80 * (1 - eOut(prog(u, 0, 0.6))) - 80 * eInOut(prog(u, 4.9, 0.5));
  withT(60 + dx, 1560, 1, 0, a, () => {
    font(28, 800);
    const w = Math.max(ctx.measureText('Çocuk Psikolojisi & Dikkat Üzerine').width, 420) + 80;
    shadow(true, 30, 10, 'rgba(0,0,0,0.35)'); rrect(0, -70, w, 140, 24, 'rgba(12,16,40,0.86)'); shadow(false);
    rrect(0, -70, 12, 140, 6, C.yellow);
    text('Pedagog', 38, -24, 30, C.yellow, 800, 'left');
    text('Necla SAYGIN', 178, -24, 46, C.white, 900, 'left');
    text('Çocuk Psikolojisi & Dikkat Üzerine', 38, 32, 28, 'rgba(255,255,255,0.8)', 800, 'left');
  });
}

// Tam ekran kare: arka plan → konuşmacı (kamera) → kayan üst panel → açılış/kapanış bindirmeleri
function splitFull(t, introOverlay, outroOverlay) {
  const intro = t < OUTRO.at - 1;
  const e = intro ? eInOut(prog(t, INTRO.hold, INTRO.len)) : 1 - eInOut(prog(t, OUTRO.at, OUTRO.len));
  ctx.fillStyle = '#0A0F27'; ctx.fillRect(0, 0, 1080, 1920);
  const im = clipFrame(intro ? 'avIn' : 'avOut');
  const cam = camera(t, e);
  if (im) ctx.drawImage(im, cam.sx, cam.sy, cam.sw, cam.sh, 0, cam.D, 1080, cam.H);
  // üst panel: yukarıdan kayarak gelir / yukarı kayarak gider
  if (e > 0.001) {
    const y = -960 * (1 - e);
    ctx.save();
    ctx.globalAlpha = clamp(e * 1.4);
    shadow(true, 40, 10, 'rgba(0,0,0,0.45)');
    ctx.beginPath(); ctx.roundRect(0, y, 1080, 960, [0, 0, 60 * (1 - e), 60 * (1 - e)]); ctx.fillStyle = '#0A0F27'; ctx.fill();
    shadow(false);
    ctx.clip();
    ctx.drawImage(topCanvas, 0, y, 1080, 960);
    ctx.restore();
  }
  if (intro) introOverlay(t);
  else outroOverlay(t);
}
