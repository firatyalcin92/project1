// Reels render: üst bölüm grafikleri (scene.html, Playwright/Chromium ile kare kare)
// + alt bölüm avatar videosu → FFmpeg ile 1080x1920 split-screen.
//
// Kullanım:
//   NODE_PATH=$(npm root -g) node render.cjs <avatar.mp4> [final_reels.mp4]
//   NODE_PATH=$(npm root -g) node render.cjs --preview 2.5,8.6,...   (seçili anları PNG olarak kaydeder)
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const FPS = 25;
const SCENE = 'file://' + path.join(__dirname, 'scene.html');

// Avatar: 720x1280 → 1620x2880, yüz bölgesini 1620x1440 kırp, zoompan ile 1080x960'a indir.
// Vurgu anlarında ("Hemen kızmayın", "sadece 10 dakika") hafif yakınlaşma yapılır.
const bump = (a, b) =>
  `(1-cos(PI*clip((it-${a})/0.35,0,1)))/2*(1-cos(PI*clip((${b}-it)/0.35,0,1)))/2`;
const ZOOM = `1+0.03*it/40+0.08*${bump(7.75, 9.55)}+0.08*${bump(29.4, 30.75)}`;

async function launch() {
  const browser = await chromium.launch({ args: ['--font-render-hinting=none'] });
  const page = await browser.newPage({ viewport: { width: 1080, height: 960 }, deviceScaleFactor: 1 });
  await page.goto(SCENE);
  await page.evaluate(() => window.ready);
  return { browser, page };
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
  const filter = [
    `[1:v]fps=${FPS},scale=1620:2880:flags=lanczos,crop=1620:1440:0:225,` +
      `zoompan=z='${ZOOM}':x='(iw-iw/zoom)/2':y='(ih-ih/zoom)*0.47':d=1:s=1080x960:fps=${FPS},setsar=1[av]`,
    `[0:v]format=yuv420p,setsar=1[top]`,
    `[top][av]vstack=inputs=2,format=yuv420p[v]`,
    `[1:a]loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000[a]`,
  ].join(';');
  const ff = spawn('ffmpeg', [
    '-y', '-loglevel', 'error', '-stats',
    '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
    '-i', avatar,
    '-filter_complex', filter,
    '-map', '[v]', '-map', '[a]',
    '-frames:v', String(frames),
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart',
    output,
  ], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => ff.on('close', c => (c === 0 ? res() : rej(new Error('ffmpeg exit ' + c)))));

  const { browser, page } = await launch();
  for (let i = 0; i < frames; i++) {
    const buf = await frame(page, i / FPS);
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (i % 100 === 0) process.stderr.write(`\nkare ${i}/${frames}\n`);
  }
  ff.stdin.end();
  await browser.close();
  await done;
  console.log(`\nTamamlandı: ${output}`);
}

const args = process.argv.slice(2);
if (args[0] === '--preview') {
  preview(args[1].split(',').map(Number)).catch(e => { console.error(e); process.exit(1); });
} else {
  if (!args[0]) { console.error('Kullanım: node render.cjs <avatar.mp4> [final_reels.mp4]'); process.exit(1); }
  render(args[0], args[1] || 'final_reels.mp4').catch(e => { console.error(e); process.exit(1); });
}
