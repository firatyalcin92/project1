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
  }));
  return { browser, page, config };
}

async function overlayFrame(page, t) {
  await page.evaluate(tt => window.renderOverlay(tt), t);
  return page.screenshot({ type: 'png', omitBackground: true, clip: { x: 0, y: 960, width: 1080, height: 960 } });
}

async function frame(page, t) {
  await page.evaluate(tt => window.renderFrame(tt), t);
  return page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: 1080, height: 960 } });
}

async function preview(times) {
  const { browser, page } = await launch();
  fs.mkdirSync(path.join(__dirname, 'preview'), { recursive: true });
  for (const t of times) {
    fs.writeFileSync(path.join(__dirname, 'preview', `t_${t.toFixed(2)}.png`), await frame(page, t));
    fs.writeFileSync(path.join(__dirname, 'preview', `o_${t.toFixed(2)}.png`), await overlayFrame(page, t));
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
  for (const [k, [s, e]] of config.overlays.entries()) {
    const dir = path.join(ovDir, String(k));
    fs.mkdirSync(dir);
    const f0 = Math.floor(s * FPS), f1 = Math.ceil(e * FPS);
    for (let f = f0; f <= f1; f++) {
      fs.writeFileSync(path.join(dir, `${String(f - f0).padStart(5, '0')}.png`), await overlayFrame(page, f / FPS));
    }
    ovInputs.push('-framerate', String(FPS), '-i', path.join(dir, '%05d.png'));
    ovFilters.push(`[${k + 2}:v]format=rgba,setpts=PTS+${(f0 / FPS).toFixed(3)}/TB[ov${k}]`);
    ovFilters.push(`[${avLabel}][ov${k}]overlay=0:0:eof_action=pass:enable='between(t,${(f0 / FPS).toFixed(3)},${(f1 / FPS).toFixed(3)})'[av${k}]`);
    avLabel = `av${k}`;
  }

  const filter = [
    `[1:v]fps=${FPS},${av.chain},` +
      `zoompan=z='${zoomExpr(config.zoom, duration)}':x='(iw-iw/zoom)/2':y='(ih-ih/zoom)*${av.focusY}':d=1:s=1080x960:fps=${FPS},setsar=1[av]`,
    ...ovFilters,
    `[0:v]format=yuv420p,setsar=1[top]`,
    `[top][${avLabel}]vstack=inputs=2,format=yuv420p[v]`,
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
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
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
