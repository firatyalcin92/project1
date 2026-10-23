// Ortak Reels motoru: yardımcılar, altyazı, arka plan, sahne geçişleri.
// Videoya özel dosya şunları tanımlar: DURATION, SCENES, CHUNKS (buildChunks ile), isteğe bağlı ZOOM_BUMPS, preload().
const W = 1080, TOP = 960;
let ctx = document.getElementById('c').getContext('2d');
// İsteğe bağlı ikinci tuval (#o): alt bölümde avatarın üstüne bindirilen saydam katman
const overlayCanvas = document.getElementById('o');
const octx = overlayCanvas ? overlayCanvas.getContext('2d') : null;

const C = {
  yellow: '#FFC93C', coral: '#FF5E6C', mint: '#34D399', sky: '#4FB3FF',
  lilac: '#A78BFA', white: '#FFFFFF', muted: 'rgba(255,255,255,0.72)', ink: '#141A3A',
};

// ---------- yardımcılar ----------
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const prog = (t, s, d) => clamp((t - s) / d);
const eOut = x => 1 - Math.pow(1 - x, 3);
const eInOut = x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const eBack = x => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
const hash = i => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const hexRgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);

function popS(t, t0, d = 0.5) { return t < t0 ? 0 : eBack(prog(t, t0, d)); }
function popA(t, t0, d = 0.18) { return prog(t, t0, d); }

function withT(x, y, s, rot, alpha, fn) {
  if (alpha <= 0 || s <= 0) return;
  ctx.save();
  ctx.translate(x, y); ctx.rotate(rot || 0); ctx.scale(s, s);
  ctx.globalAlpha *= alpha;
  fn();
  ctx.restore();
}

function font(size, weight = 800) { ctx.font = `${weight} ${size}px RD, "Noto Color Emoji"`; }

function shadow(on, blur = 24, oy = 8, col = 'rgba(0,0,0,0.35)') {
  if (on) { ctx.shadowColor = col; ctx.shadowBlur = blur; ctx.shadowOffsetY = oy; }
  else { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; }
}

function text(str, x, y, size, color, weight = 800, align = 'center') {
  font(size, weight);
  ctx.textAlign = align; ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
}

function emoji(ch, x, y, size) {
  ctx.font = `${size}px "Noto Color Emoji"`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#000'; // renkli emoji, fillStyle alfasıyla soluklaşmasın
  ctx.fillText(ch, x, y + size * 0.06);
}

function rrect(x, y, w, h, r, fill, stroke, lw = 4) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
}

// Kelime kelime yükselerek beliren metin. "*kelime" vurgu rengiyle çizilir.
function words(str, cx, y, t, t0, o = {}) {
  const { size = 50, weight = 800, color = C.white, accent = C.yellow, per = 0.11, dur = 0.42 } = o;
  font(size, weight);
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  const ws = str.split(' ').map(w => (w[0] === '*' ? { w: w.slice(1), hi: true } : { w, hi: false }));
  const sp = ctx.measureText(' ').width;
  const wd = ws.map(o2 => ctx.measureText(o2.w).width);
  const total = wd.reduce((a, b) => a + b, 0) + sp * (ws.length - 1);
  let x = cx - total / 2;
  ws.forEach((o2, i) => {
    const p = eOut(prog(t, t0 + i * per, dur));
    if (p > 0) {
      ctx.save();
      ctx.globalAlpha *= p;
      ctx.fillStyle = o2.hi ? accent : color;
      ctx.fillText(o2.w, x, y + (1 - p) * 34);
      ctx.restore();
    }
    x += wd[i] + sp;
  });
}

function star(x, y, r, color, rot = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4, rr = i % 2 === 0 ? r : r * 0.28;
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath(); ctx.fillStyle = color; ctx.fill();
  ctx.restore();
}

// Konuşma balonu (emoji + metin), merkez (0,0)
function pill(label, em, size = 40, bg = C.white, fg = C.ink) {
  font(size, 800);
  const tw = ctx.measureText(label).width;
  const w = tw + size * 1.25 + 70, h = size * 2.1;
  shadow(true, 30, 12, 'rgba(0,0,0,0.35)');
  rrect(-w / 2, -h / 2, w, h, h / 2, bg);
  shadow(false);
  emoji(em, -w / 2 + 34 + size * 0.55, 0, size * 1.1);
  text(label, -w / 2 + 50 + size * 1.15, 0, size, fg, 800, 'left');
}


// ---------- altyazı ----------
// phrases: [[başlangıç, bitiş, 'metin'], ...] → kelimelere orantılı zaman dağıtılır
function phrasesToWords(phrases) {
  const out = [];
  for (const [s, e, txt] of phrases) {
    const ws = txt.split(' ');
    const tot = ws.reduce((a, w) => a + w.length + 1, 0);
    let acc = s;
    ws.forEach(w => { const d = ((e - s) * (w.length + 1)) / tot; out.push([acc, acc + d, w]); acc += d; });
  }
  return out;
}

// words: [[başlangıç, bitiş, 'kelime'], ...] → en fazla maxLen karakterlik altyazı parçaları.
// Cümle sonu ya da uzun duraklama yeni parça başlatır.
function buildChunks(words, maxLen = 26) {
  const chunks = [];
  let cur = [], len = 0;
  words.forEach(([s, e, w], i) => {
    const o = { w, s, e };
    const prev = cur[cur.length - 1];
    if (cur.length && (len + w.length + 1 > maxLen || s - prev.e > 0.35 || /[.?!:]["”]?$/.test(prev.w))) {
      chunks.push(cur); cur = []; len = 0;
    }
    cur.push(o); len += w.length + 1;
  });
  if (cur.length) chunks.push(cur);
  return chunks;
}

function captions(t) {
  let idx = -1;
  for (let i = 0; i < CHUNKS.length; i++) if (CHUNKS[i][0].s <= t) idx = i;
  if (idx < 0) return;
  const ch = CHUNKS[idx];
  const next = CHUNKS[idx + 1];
  const end = Math.min(next ? next[0].s : 99, ch[ch.length - 1].e + 0.7);
  if (t > end) return;
  const a = popA(t, ch[0].s, 0.12) * (1 - prog(t, end - 0.12, 0.12));
  const s = 0.92 + 0.08 * eBack(prog(t, ch[0].s, 0.25));
  const size = 46;
  font(size, 800);
  const sp = ctx.measureText(' ').width;
  const wd = ch.map(o => ctx.measureText(o.w).width);
  const total = wd.reduce((x, y) => x + y, 0) + sp * (ch.length - 1);
  withT(540, 878, s, 0, a, () => {
    shadow(true, 24, 8, 'rgba(0,0,0,0.4)');
    rrect(-total / 2 - 34, -42, total + 68, 84, 42, 'rgba(8,12,32,0.82)', 'rgba(255,255,255,0.14)', 2);
    shadow(false);
    let x = -total / 2;
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ch.forEach((o, i) => {
      const active = t >= o.s && t < o.e + 0.05;
      ctx.fillStyle = active ? C.yellow : t >= o.s ? C.white : 'rgba(255,255,255,0.45)';
      ctx.fillText(o.w, x, 2);
      x += wd[i] + sp;
    });
  });
}

// ---------- arka plan & çerçeve ----------
function sceneAt(t) { let i = 0; SCENES.forEach((sc, k) => { if (t >= sc.s) i = k; }); return i; }

function background(t) {
  const g = ctx.createLinearGradient(0, 0, 0, TOP);
  g.addColorStop(0, '#0A0F27'); g.addColorStop(1, '#1B1748');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, TOP);
  const i = sceneAt(t);
  const k = eInOut(prog(t, SCENES[i].s, 0.6));
  const prev = SCENES[Math.max(0, i - 1)];
  const a1 = mix(hexRgb(prev.acc), hexRgb(SCENES[i].acc), k);
  const a2 = mix(hexRgb(prev.acc2), hexRgb(SCENES[i].acc2), k);
  const blob = (x, y, r, c, al) => {
    const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, `rgba(${c.map(Math.round).join(',')},${al})`);
    rg.addColorStop(1, `rgba(${c.map(Math.round).join(',')},0)`);
    ctx.fillStyle = rg; ctx.fillRect(0, 0, W, TOP);
  };
  blob(220 + 90 * Math.sin(t * 0.5), 320 + 70 * Math.cos(t * 0.4), 480, a1, 0.30);
  blob(860 + 80 * Math.cos(t * 0.45), 700 + 60 * Math.sin(t * 0.6), 520, a2, 0.24);
  // yüzen parçacıklar
  for (let n = 0; n < 36; n++) {
    const x = ((hash(n) * W + Math.sin(t * 0.7 + n) * 20) % W + W) % W;
    const y = (((hash(n + 1) * TOP - t * (12 + 26 * hash(n + 2))) % TOP) + TOP) % TOP;
    ctx.beginPath(); ctx.arc(x, y, 1.5 + 2.5 * hash(n + 5), 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,255,255,${0.12 + 0.18 * hash(n + 7)})`; ctx.fill();
  }
}

function chrome(t) {
  // üst etiket
  withT(540, 150, 1, 0, 1, () => {
    font(28, 800);
    const label = 'EBEVEYN İPUCU';
    const w = ctx.measureText(label).width + 110;
    rrect(-w / 2, -30, w, 60, 30, 'rgba(255,255,255,0.10)', 'rgba(255,255,255,0.18)', 2);
    emoji('💡', -w / 2 + 38, 0, 30);
    text(label, -w / 2 + 66, 1, 28, C.white, 800, 'left');
  });
  // alt kenarda kayan ilerleme çubuğu (ekran ayrımı)
  ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.fillRect(0, TOP - 10, W, 10);
  const g = ctx.createLinearGradient(0, 0, W, 0);
  g.addColorStop(0, C.yellow); g.addColorStop(1, C.coral);
  ctx.fillStyle = g; ctx.fillRect(0, TOP - 10, W * clamp(t / DURATION), 10);
}

function scenes(t) {
  for (const sc of SCENES) {
    if (t < sc.s || t > sc.e + 0.35) continue;
    const ain = eOut(prog(t, sc.s, 0.35));
    const aout = 1 - eInOut(prog(t, sc.e, 0.3));
    const a = Math.min(ain, aout);
    if (a <= 0) continue;
    ctx.save();
    ctx.globalAlpha = a;
    const s = (0.94 + 0.06 * ain) * (1 + 0.05 * (1 - aout));
    ctx.translate(540, 520 - 30 * (1 - aout)); ctx.scale(s, s); ctx.translate(-540, -520);
    sc.draw(t);
    ctx.restore();
  }
}

window.renderFrame = function (t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  shadow(false);
  background(t);
  scenes(t);
  captions(t);
  chrome(t);
};

// Saydam bindirme katmanı; videoya özel OVERLAY(t) tanımlıysa çizer
window.renderOverlay = function (t) {
  if (!octx) return;
  const main = ctx;
  ctx = octx;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, TOP);
  ctx.globalAlpha = 1;
  shadow(false);
  if (window.OVERLAY) window.OVERLAY(t);
  ctx = main;
};

function loadImage(src) {
  return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; });
}

window.ready = Promise.all([600, 700, 800, 900].map(w => document.fonts.load(`${w} 40px RD`, 'ÇĞİÖŞÜçğıöşü')))
  .then(() => document.fonts.load('40px "Noto Color Emoji"', '📚'))
  .then(() => (window.preload ? window.preload() : null))
  .then(() => { window.renderFrame(0); return true; });
