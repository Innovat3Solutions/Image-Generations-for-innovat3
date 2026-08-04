// Renders every templates/post-*.html to a 2160x2700 PNG in output/.
// Usage: npm i playwright-core && node render.js
// Set CHROMIUM_PATH if Chromium isn't at the default location.
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

(async () => {
  const executablePath = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
  const browser = await chromium.launch({ executablePath });
  const page = await browser.newPage({
    viewport: { width: 1080, height: 1350 },
    deviceScaleFactor: 2,
  });

  const tplDir = path.join(__dirname, 'templates');
  const outDir = path.join(__dirname, 'output');
  fs.mkdirSync(outDir, { recursive: true });

  const files = fs.readdirSync(tplDir).filter(f => f.startsWith('post-') && f.endsWith('.html')).sort();
  for (const f of files) {
    await page.goto('file://' + path.join(tplDir, f), { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(150);
    const out = path.join(outDir, f.replace('.html', '.png'));
    await page.screenshot({ path: out, clip: { x: 0, y: 0, width: 1080, height: 1350 } });
    console.log('rendered', out);
  }

  await browser.close();
})();
