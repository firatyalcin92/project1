// Ortak takip et (Instagram) parçaları ve sık kullanılan çizim yardımcıları.
// Sayfa, engine.js'ten sonra yükler; profil fotoğrafını preloadFollow() ile yükler.

const USERNAME = 'pedagog.kaleminden';
const IG_BLUE = '#0095F6';
const IMG = {};

function preloadFollow(base) {
  return loadImage(base + 'assets/profile.png').then(im => { IMG.profile = im; });
}

// ---------- ortak parçalar ----------
function circle(x, y, r, fill) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill(); }

// Dönen degrade halkalı profil fotoğrafı
function profilePic(x, y, r, t) {
  const g = ctx.createConicGradient(t * 1.2, x, y);
  ['#FEDA75', '#FA7E1E', '#D62976', '#962FBF', '#4F5BD5', '#FEDA75'].forEach((c, i, a) => g.addColorStop(i / (a.length - 1), c));
  circle(x, y, r * 1.14, g);
  circle(x, y, r * 1.06, '#FFFFFF');
  ctx.save();
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.clip();
  ctx.drawImage(IMG.profile, x - r, y - r, r * 2, r * 2);
  ctx.restore();
}

// Takip butonu, merkez (x, y). followed: 0→1 geçiş, press: 0..1 basılma
function followButton(x, y, w, h, size, followed, press, dark) {
  const s = 1 - 0.08 * press;
  withT(x, y, s, 0, 1, () => {
    const on = followed >= 0.5;
    const bg = on ? (dark ? 'rgba(255,255,255,0.16)' : '#EFEFEF') : IG_BLUE;
    rrect(-w / 2, -h / 2, w, h, h * 0.28, bg, on && dark ? 'rgba(255,255,255,0.35)' : null, 2);
    const label = on ? 'Takip ediliyor' : 'Takip Et';
    const col = on ? (dark ? C.white : '#111111') : C.white;
    if (on) {
      font(size, 800);
      const tw = ctx.measureText(label).width;
      const ck = eBack(clamp((followed - 0.5) * 2));
      tick(-tw / 2 - size * 0.25, 0, size * 0.85, ck, col);
      text(label, size * 0.35, 1, size, col, 800);
    } else {
      text(label, 0, 1, size, col, 800);
    }
  });
}

// Tik işareti (p: çizim oranı)
function tick(x, y, s, p, col) {
  if (p <= 0) return;
  const pts = [[-0.38, 0.02], [-0.12, 0.28], [0.4, -0.3]];
  const l1 = Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]);
  const l2 = Math.hypot(pts[2][0] - pts[1][0], pts[2][1] - pts[1][1]);
  const d = clamp(p) * (l1 + l2);
  ctx.save(); ctx.translate(x, y);
  ctx.strokeStyle = col; ctx.lineWidth = s * 0.17; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(pts[0][0] * s, pts[0][1] * s);
  if (d <= l1) {
    const k = d / l1; ctx.lineTo((pts[0][0] + (pts[1][0] - pts[0][0]) * k) * s, (pts[0][1] + (pts[1][1] - pts[0][1]) * k) * s);
  } else {
    const k = (d - l1) / l2;
    ctx.lineTo(pts[1][0] * s, pts[1][1] * s);
    ctx.lineTo((pts[1][0] + (pts[2][0] - pts[1][0]) * k) * s, (pts[1][1] + (pts[2][1] - pts[1][1]) * k) * s);
  }
  ctx.stroke(); ctx.restore();
}

// Ekrana dokunan el: tap anında hedefe ulaşır ve küçülür
function tapHand(x, y, t, tap) {
  const a = popA(t, tap - 0.6, 0.2) * (1 - prog(t, tap + 0.6, 0.25));
  if (a <= 0) return;
  const k = eOut(prog(t, tap - 0.6, 0.55));
  const press = Math.sin(prog(t, tap - 0.05, 0.3) * Math.PI);
  withT(x + 70 * (1 - k) + 18, y + 110 * (1 - k) + 38, 1 - 0.15 * press, -0.2, a, () => {
    shadow(true, 16, 6); emoji('👆', 0, 0, 70); shadow(false);
  });
  // dokunma dalgası
  const r = prog(t, tap, 0.45);
  if (r > 0 && r < 1) {
    ctx.strokeStyle = `rgba(255,255,255,${0.8 * (1 - r)})`; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(x, y, 20 + 60 * r, 0, Math.PI * 2); ctx.stroke();
  }
}

function hearts(x, y, t, t0, n = 6, spread = 1, rise = 1) {
  if (t < t0) return;
  for (let i = 0; i < n; i++) {
    const ph = prog(t, t0 + i * 0.08, 1.3);
    if (ph <= 0 || ph >= 1) continue;
    const side = i % 2 ? 1 : -1;
    const dx = side * (60 + 120 * hash(i + 11)) * spread, dy = (-160 - 140 * hash(i + 4)) * rise;
    ctx.save(); ctx.globalAlpha *= Math.sin(ph * Math.PI);
    emoji(['❤️', '💛', '💚', '💜'][i % 4], x + dx * eOut(ph), y + dy * eOut(ph), 34 + 18 * hash(i + 2));
    ctx.restore();
  }
}

// Numaralı adım başlığı
function stepTitle(n, label, t, t0, col, size = 50) {
  font(size, 900);
  const tw = ctx.measureText(label).width;
  const x0 = 540 - (tw + 84) / 2;
  withT(x0 + 32, 275, popS(t, t0, 0.5), 0, popA(t, t0), () => {
    circle(0, 0, 34, col); text(String(n), 0, 2, 40, C.ink, 900);
  });
  words(label, x0 + 84 + tw / 2, 275, t, t0 + 0.12, { size, weight: 900 });
}

function phase(t, s, e, fade = 0.3) { return Math.min(popA(t, s, fade), 1 - prog(t, e, fade)); }

// Avatarın üstünde beliren kompakt takip kartı (start'tan itibaren 4.7 sn), cy: kartın dikey merkezi,
// heartRise: kalplerin ne kadar yükseleceği (yüze taşmasın diye küçültülebilir)
function followCardOverlay(t, start, cy, heartRise = 1) {
  const u = t - start;
  if (u < 0 || u > 4.7) return;
  const a = eOut(prog(u, 0, 0.45)) * (1 - eInOut(prog(u, 4.15, 0.45)));
  const dy = 70 * (1 - eOut(prog(u, 0, 0.5))) + 70 * eInOut(prog(u, 4.15, 0.45));
  const CX = 540, CY = cy, CW = 700, CH = 132;
  withT(CX, CY + dy, 1, 0, a, () => {
    shadow(true, 36, 12, 'rgba(0,0,0,0.35)');
    rrect(-CW / 2, -CH / 2, CW, CH, 34, 'rgba(255,255,255,0.96)');
    shadow(false);
    const px = -CW / 2 + 24 + 46;
    profilePic(px, 0, 44, t);
    text(USERNAME, px + 64, -16, 30, '#111111', 800, 'left');
    text('Yeni videolar için takip et', px + 64, 22, 23, '#6B7280', 700, 'left');
    const bx = CW / 2 - 22 - 105;
    followButton(bx, 0, 210, 60, 26, prog(u, 2.05, 0.35), Math.sin(prog(u, 1.95, 0.3) * Math.PI), false);
    tapHand(bx, 0, u, 2.0);
    hearts(bx, -20, u, 2.1, 5, heartRise < 1 ? 1.3 : 0.8, heartRise);
  });
}
