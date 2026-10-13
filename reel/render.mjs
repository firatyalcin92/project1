// Renders reel.html frame by frame with headless Chromium and pipes the frames into ffmpeg.
// Usage: node render.mjs <out.mp4> [--from s] [--to s] [--fps n] [--nocap]
import { chromium } from 'playwright';
import { spawn } from 'child_process';
import path from 'path';

const args = process.argv.slice(2);
const out = args[0] || 'out.mp4';
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? Number(args[i + 1]) : d; };
const fps = opt('--fps', 30);
const audio = path.resolve('ses_iyilestirilmis.m4a');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
await page.goto('file://' + path.resolve('reel.html') + (args.includes('--nocap') ? '?nocap' : ''));
await page.evaluate(() => document.fonts.ready);
const total = await page.evaluate(() => window.DURATION);
const from = opt('--from', 0), to = Math.min(opt('--to', total), total);

const enc = ['-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart'];
const audioIn = ['-ss', String(from), '-t', String(to - from), '-i', audio];
const audioEnc = ['-c:a', 'aac', '-b:a', '192k', '-shortest'];
const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps),
  '-i', '-', ...audioIn, ...enc, ...audioEnc, out], { stdio: ['pipe', 'inherit', 'inherit'] });

const n = Math.round((to - from) * fps);
for (let i = 0; i < n; i++) {
  await page.evaluate(t => window.seek(t), from + i / fps);
  const buf = await page.screenshot({ type: 'jpeg', quality: 95 });
  if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
  if (i % 150 === 0) process.stderr.write(`frame ${i}/${n}\n`);
}
ff.stdin.end();
await new Promise(r => ff.on('close', r));
await browser.close();
