// Renders every ad template to a PNG. Usage: node render.js [outDir]
// Requires playwright-core; uses the preinstalled Chromium at /opt/pw-browsers/chromium.
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const ADS = [
  { file: 'ad01_what_is_zippilot.html', w: 1080, h: 1080 },
  { file: 'ad02_cost_split.html',       w: 1080, h: 1080 },
  { file: 'ad03_exclusivity.html',      w: 1080, h: 1080 },
  { file: 'ad04_spot_board.html',       w: 1080, h: 1080 },
  { file: 'ad05_qr_tracking.html',      w: 1080, h: 1080 },
  { file: 'ad06_ltv_math.html',         w: 1080, h: 1080 },
  { file: 'ad07_community.html',        w: 1080, h: 1080 },
  { file: 'ad08_own_your_zip.html',     w: 1080, h: 1080 },
  { file: 'ad09_reach.html',            w: 1080, h: 1350 },
  { file: 'ad10_pricing.html',          w: 1080, h: 1080 },
];

(async () => {
  const outDir = process.argv[2] || '.';
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  for (const ad of ADS) {
    const page = await browser.newPage({ viewport: { width: ad.w, height: ad.h } });
    await page.goto('file://' + path.resolve(__dirname, ad.file));
    await page.waitForTimeout(400); // fonts/images settle
    const out = path.join(outDir, ad.file.replace('.html', '.png'));
    await page.screenshot({ path: out });
    await page.close();
    console.log('rendered', out);
  }
  await browser.close();
})();
