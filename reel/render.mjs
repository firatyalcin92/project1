// Renders reel.html frame by frame with headless Chromium and pipes the frames into ffmpeg.
// Usage: node render.mjs <out.mp4> [--from s] [--to s] [--fps n] [--overlay]
//   --overlay  renders only graphics + captions on a transparent background (ProRes 4444 .mov),
//              to lay over a real / lip-synced talking-head recording in an editor.
import { chromium } from 'playwright';
import { spawn } from 'child_process';
import path from 'path';

const args = process.argv.slice(2);
const out = args[0] || 'out.mp4';
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? Number(args[i + 1]) : d; };
const overlay = args.includes('--overlay');
const fps = opt('--fps', 30);
const audio = path.resolve('ses.m4a');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
await page.goto('file://' + path.resolve('reel.html') + (overlay ? '?overlay' : args.includes('--nocap') ? '?nocap' : ''));
await page.evaluate(() => document.fonts.ready);
const total = await page.evaluate(() => window.DURATION);
const from = opt('--from', 0), to = Math.min(opt('--to', total), total);

const enc = overlay
  ? ['-c:v', 'prores_ks', '-profile:v', '4444', '-pix_fmt', 'yuva444p10le']
  : ['-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart'];
const audioIn = overlay ? [] : ['-ss', String(from), '-t', String(to - from), '-i', audio];
const audioEnc = overlay ? [] : ['-c:a', 'aac', '-b:a', '192k', '-shortest'];
const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps),
  '-i', '-', ...audioIn, ...enc, ...audioEnc, out], { stdio: ['pipe', 'inherit', 'inherit'] });

const n = Math.round((to - from) * fps);
for (let i = 0; i < n; i++) {
  await page.evaluate(t => window.seek(t), from + i / fps);
  const buf = await page.screenshot({ type: overlay ? 'png' : 'jpeg', quality: overlay ? undefined : 95, omitBackground: overlay });
  if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
  if (i % 150 === 0) process.stderr.write(`frame ${i}/${n}\n`);
}
ff.stdin.end();
await new Promise(r => ff.on('close', r));
await browser.close();
