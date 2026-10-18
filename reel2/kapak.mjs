import { chromium } from 'playwright'; import path from 'path';
const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1080, height: 1920 } });
await pg.goto('file://' + path.resolve('kapak.html')); await pg.evaluate(() => document.fonts.ready);
await pg.screenshot({ path: 'cikti/kapak.jpg', type: 'jpeg', quality: 92 }); await b.close();
