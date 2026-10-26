// Reels render: üst bölüm grafikleri (scene.html, Playwright/Chromium ile kare kare)
// + alt bölüm avatar videosu → FFmpeg ile 1080x1920 split-screen.
//
// Kullanım:
//   NODE_PATH=$(npm root -g) node render.cjs [--scene v2/scene.html] <avatar.mp4> [final_reels.mp4]
//   NODE_PATH=$(npm root -g) node render.cjs [--scene ...] --preview 2.5,8.6,...   (seçili anları PNG olarak kaydeder)
//
// Sahne sayfası isteğe bağlı olarak şunları tanımlar:
//   ZOOM_BUMPS = [[başlangıç, bitiş], ...]      avatarın hafifçe yakınlaştığı vurgu anları
//   AVATAR = { chain, focusY }                   avatarı 1620x1440'a getiren FFmpeg zinciri + yüzün dikey konumu
//   OVERLAYS = [[başlangıç, bitiş], ...]         alt bölüme bindirilen saydam katmanın (OVERLAY) aktif olduğu aralıklar
//   BOTTOM_CLIPS = [{ src, start, end, from, focusY, fadeIn?, fadeOut? }, ...]
//                                                alt bölümde avatarın yerine oynatılan klipler (src sahne klasörüne göre)
//   TOP_CLIPS = [{ name, src, from, start, end, alpha?, vf? }, ...]  kare kare tuvale çizilen klipler (clipFrame(name))
//   FULLSCREEN_FROM = saniye                     bu andan sonra kareler tamamen FULL(t) ile (1080x1920) çizilir
//   FULL_RANGES = [[başlangıç, bitiş], ...]      FULL(t) ile çizilen aralıklar (FULLSCREEN_FROM'un genel hali)
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const FPS = 25;
let SCENE = 'file://' + path.join(__dirname, 'scene.html');

// Varsayılan avatar işleme: 720x1280 → 1620x2880, yüz bölgesini 1620x1440 kırp.
// Ardından zoompan ile 1080x960'a inilir; vurgu anlarında hafif yakınlaşma yapılır.
const DEFAULT_AVATAR = { chain: 'scale=1620:2880:flags=lanczos,crop=1620:1440:0:225', focusY: 0.47 };
const bump = (a, b) =>
  `(1-cos(PI*clip((it-${a})/0.35,0,1)))/2*(1-cos(PI*clip((${b}-it)/0.35,0,1)))/2`;
const zoomExpr = (bumps, duration) =>
  [`1+0.03*it/${duration.toFixed(2)}`, ...bumps.map(([a, b]) => `0.08*${bump(a, b)}`)].join('+');

async function launch() {
  const browser = await chromium.launch({ args: ['--font-render-hinting=none'] });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  await page.goto(SCENE);
  await page.evaluate(() => window.ready);
  const config = await page.evaluate(() => ({
    zoom: typeof ZOOM_BUMPS !== 'undefined' ? ZOOM_BUMPS : [],
    avatar: typeof AVATAR !== 'undefined' ? AVATAR : null,
    overlays: typeof OVERLAYS !== 'undefined' ? OVERLAYS : [],
    bottomClips: typeof BOTTOM_CLIPS !== 'undefined' ? BOTTOM_CLIPS : [],
    topClips: typeof TOP_CLIPS !== 'undefined' ? TOP_CLIPS : [],
    fullRanges: typeof FULL_RANGES !== 'undefined' ? FULL_RANGES
      : typeof FULLSCREEN_FROM !== 'undefined' ? [[FULLSCREEN_FROM, 1e9]] : [],
  }));
  if (config.topClips.length) await page.evaluate(base => { window.CLIP_BASE = base; }, extractTopClips(config.topClips));
  return { browser, page, config };
}

// Üst bölüm klip pencerelerini 25 fps JPG karelerine çıkarır (aynı ayar için tekrar kullanılır)
function extractTopClips(clips) {
  const sceneDir = path.dirname(new URL(SCENE).pathname);
  const key = require('crypto').createHash('md5').update(SCENE + JSON.stringify(clips)).digest('hex').slice(0, 10);
  const base = path.join(require('os').tmpdir(), `reels-clips-${key}`);
  for (const c of clips) {
    const dir = path.join(base, c.name);
    const ext = c.alpha ? 'webp' : 'jpg';
    if (fs.existsSync(path.join(dir, `00001.${ext}`))) continue;
    fs.mkdirSync(dir, { recursive: true });
    // alpha: saydam VP9 (HeyGen arka plansız) → libvpx-vp9 ile çözülüp saydam WebP karelerine
    require('child_process').execFileSync('ffmpeg', [
      '-v', 'error', '-y', ...(c.alpha ? ['-c:v', 'libvpx-vp9'] : []),
      '-ss', String(c.from), '-t', String(c.end - c.start + 0.2), '-i', path.join(sceneDir, c.src),
      '-vf', [c.vf, `fps=${FPS}`].filter(Boolean).join(','),
      ...(c.alpha ? ['-c:v', 'libwebp', '-quality', '88', '-pix_fmt', 'yuva420p'] : ['-q:v', '3']),
      path.join(dir, `%05d.${ext}`),
    ]);
  }
  return 'file://' + base;
}

async function overlayFrame(page, t) {
  await page.evaluate(tt => window.renderOverlay(tt), t);
  return page.screenshot({ type: 'png', omitBackground: true, clip: { x: 0, y: 960, width: 1080, height: 960 } });
}

async function frame(page, t) {
  await page.evaluate(async tt => {
    if (window.prepareFrame) await window.prepareFrame(tt);
    window.renderFrame(tt);
  }, t);
  return page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: 1080, height: 960 } });
}

// Tam ekran kare: #f tuvali geçici olarak görünür yapılıp ekran görüntüsü alınır
// (yerel görüntüler tuvali "kirlettiği" için toDataURL kullanılamaz)
async function fullFrame(page, t) {
  await page.evaluate(async tt => {
    if (window.prepareFrame) await window.prepareFrame(tt);
    window.renderFrame(tt);
    window.renderFull(tt);
    document.getElementById('f').style.visibility = 'visible';
  }, t);
  const buf = await page.screenshot({ type: 'jpeg', quality: 92, clip: { x: 0, y: 0, width: 1080, height: 1920 } });
  await page.evaluate(() => { document.getElementById('f').style.visibility = 'hidden'; });
  return buf;
}

async function preview(times) {
  const { browser, page, config } = await launch();
  fs.mkdirSync(path.join(__dirname, 'preview'), { recursive: true });
  for (const t of times) {
    fs.writeFileSync(path.join(__dirname, 'preview', `t_${t.toFixed(2)}.png`), await frame(page, t));
    fs.writeFileSync(path.join(__dirname, 'preview', `o_${t.toFixed(2)}.png`), await overlayFrame(page, t));
    if (config.fullRanges.some(([a, b]) => t >= a && t <= b)) {
      fs.writeFileSync(path.join(__dirname, 'preview', `f_${t.toFixed(2)}.jpg`), await fullFrame(page, t));
    }
  }
  await browser.close();
}

function probeDuration(file) {
  const out = require('child_process').execFileSync('ffprobe', [
    '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'format=duration', '-of', 'csv=p=0', file,
  ]);
  return parseFloat(out.toString());
}

async function render(avatar, output) {
  const duration = probeDuration(avatar);
  const frames = Math.round(duration * FPS);
  const { browser, page, config } = await launch();
  const av = config.avatar || DEFAULT_AVATAR;

  // Bindirme aralıklarını önce saydam PNG dizilerine çiz
  const ovDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'reels-ov-'));
  const ovInputs = [], ovFilters = [];
  let avLabel = 'av';
  let nextInput = 2;

  // Alt bölümde avatarın yerine geçen klipler (yumuşak geçişle)
  const sceneDir = path.dirname(new URL(SCENE).pathname);
  for (const [k, c] of config.bottomClips.entries()) {
    const dur = c.end - c.start;
    ovInputs.push('-i', path.join(sceneDir, c.src));
    ovFilters.push(
      `[${nextInput++}:v]trim=start=${c.from}:duration=${dur.toFixed(3)},setpts=PTS-STARTPTS+${c.start}/TB,fps=${FPS},` +
        `scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:960:(iw-1080)/2:(ih-960)*${c.focusY},setsar=1,format=yuva420p,` +
        [
          c.fadeIn !== false ? `fade=t=in:st=${c.start}:d=0.35:alpha=1` : null,
          c.fadeOut !== false ? `fade=t=out:st=${(c.end - 0.35).toFixed(3)}:d=0.35:alpha=1` : null,
          'null',
        ].filter(Boolean).join(',') + `[bc${k}]`,
    );
    ovFilters.push(`[${avLabel}][bc${k}]overlay=0:0:eof_action=pass:enable='between(t,${c.start},${c.end})'[avc${k}]`);
    avLabel = `avc${k}`;
  }

  for (const [k, [s, e]] of config.overlays.entries()) {
    const dir = path.join(ovDir, String(k));
    fs.mkdirSync(dir);
    const f0 = Math.floor(s * FPS), f1 = Math.ceil(e * FPS);
    for (let f = f0; f <= f1; f++) {
      fs.writeFileSync(path.join(dir, `${String(f - f0).padStart(5, '0')}.png`), await overlayFrame(page, f / FPS));
    }
    ovInputs.push('-framerate', String(FPS), '-i', path.join(dir, '%05d.png'));
    ovFilters.push(`[${nextInput++}:v]format=rgba,setpts=PTS+${(f0 / FPS).toFixed(3)}/TB[ov${k}]`);
    ovFilters.push(`[${avLabel}][ov${k}]overlay=0:0:eof_action=pass:enable='between(t,${(f0 / FPS).toFixed(3)},${(f1 / FPS).toFixed(3)})'[av${k}]`);
    avLabel = `av${k}`;
  }

  // Tam ekran aralıkları: bu aralıklarda kareler FULL(t) ile 1080x1920 çizilip üste bindirilir
  // (ör. açılışta/kapanışta konuşmacının tam ekran olduğu bölümler ve bölünmüş ekrana geçişler)
  let fullFilters = [], vLabel = 'v';
  if (config.fullRanges.length) {
    vLabel = 'vs';
    let cur = 'vs';
    for (const [k, [s, e]] of config.fullRanges.entries()) {
      const dir = path.join(ovDir, `full${k}`);
      fs.mkdirSync(dir);
      const f0 = Math.floor(s * FPS), f1 = Math.min(frames - 1, Math.ceil(e * FPS));
      for (let f = f0; f <= f1; f++) {
        fs.writeFileSync(path.join(dir, `${String(f - f0).padStart(5, '0')}.jpg`), await fullFrame(page, f / FPS));
        if ((f - f0) % 100 === 0) process.stderr.write(`\ntam ekran kare ${f - f0}/${f1 - f0 + 1}\n`);
      }
      ovInputs.push('-framerate', String(FPS), '-i', path.join(dir, '%05d.jpg'));
      const out = k === config.fullRanges.length - 1 ? 'v' : `vf${k}`;
      fullFilters.push(
        `[${nextInput++}:v]setpts=PTS+${(f0 / FPS).toFixed(3)}/TB,format=yuv420p,setsar=1[full${k}]`,
        `[${cur}][full${k}]overlay=0:0:eof_action=pass:enable='between(t,${(f0 / FPS).toFixed(3)},${(f1 / FPS).toFixed(3)})',format=yuv420p[${out}]`,
      );
      cur = out;
    }
  }

  const filter = [
    `[1:v]fps=${FPS},${av.chain},` +
      `zoompan=z='${zoomExpr(config.zoom, duration)}':x='(iw-iw/zoom)/2':y='(ih-ih/zoom)*${av.focusY}':d=1:s=1080x960:fps=${FPS},setsar=1[av]`,
    ...ovFilters,
    `[0:v]format=yuv420p,setsar=1[top]`,
    `[top][${avLabel}]vstack=inputs=2,format=yuv420p[${vLabel}]`,
    ...fullFilters,
    `[1:a]loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000[a]`,
  ].join(';');
  const ff = spawn('ffmpeg', [
    '-y', '-loglevel', 'error', '-stats',
    '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
    '-i', avatar,
    ...ovInputs,
    '-filter_complex', filter,
    '-map', '[v]', '-map', '[a]',
    '-frames:v', String(frames),
    '-c:v', 'libx264', '-preset', 'slow', '-crf', process.env.REELS_CRF || '17', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
    // Uzun videolarda dosya boyutunu sınırlamak için: REELS_MAXRATE=4M
    ...(process.env.REELS_MAXRATE ? ['-maxrate', process.env.REELS_MAXRATE, '-bufsize', String(parseInt(process.env.REELS_MAXRATE) * 2) + 'M'] : []),
    '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart',
    output,
  ], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => ff.on('close', c => (c === 0 ? res() : rej(new Error('ffmpeg exit ' + c)))));

  for (let i = 0; i < frames; i++) {
    const buf = await frame(page, i / FPS);
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (i % 100 === 0) process.stderr.write(`\nkare ${i}/${frames}\n`);
  }
  ff.stdin.end();
  await browser.close();
  await done;
  fs.rmSync(ovDir, { recursive: true, force: true });
  console.log(`\nTamamlandı: ${output}`);
}

const args = process.argv.slice(2);
if (args[0] === '--scene') { SCENE = 'file://' + path.resolve(args[1]); args.splice(0, 2); }
if (args[0] === '--preview') {
  preview(args[1].split(',').map(Number)).catch(e => { console.error(e); process.exit(1); });
} else {
  if (!args[0]) { console.error('Kullanım: node render.cjs <avatar.mp4> [final_reels.mp4]'); process.exit(1); }
  render(args[0], args[1] || 'final_reels.mp4').catch(e => { console.error(e); process.exit(1); });
}
