// Kapak HTML'ini 1080x1920 PNG'ye çevirir: node cover_render.cjs <cover.html> <kapak.png>
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const [src, out] = process.argv.slice(2).map(p => path.resolve(p));
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  await page.goto('file://' + src);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  await page.screenshot({ path: out });
  await browser.close();
})();
