// Saves still frames at given times for review: node snap.mjs 5 14 18 ...
import { chromium } from 'playwright';
import path from 'path';
const b = await chromium.launch();
const pg = await b.newPage({ viewport: { width: 1080, height: 1920 } });
pg.on('pageerror', e => console.log('ERR', e.message)); pg.on('console', m => m.type()==='error' && console.log('CONSOLE', m.text()));
await pg.goto('file://' + path.resolve('reel.html'));
await pg.evaluate(() => document.fonts.ready);
for (const t of process.argv.slice(2)) { await pg.evaluate(x => seek(x), +t); await pg.screenshot({ path: `/tmp/claude-0/-home-user-project1/ef193777-f167-514d-b946-a720cae6a244/scratchpad/f_${t}.jpg`, type: 'jpeg', quality: 80 }); }
await b.close();
