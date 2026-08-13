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
  { file: 'ad11_fun_mechanic.html',     w: 1080, h: 1080 },
  { file: 'ad12_fun_barber.html',       w: 1080, h: 1080 },
  { file: 'ad13_fun_landscaper.html',   w: 1080, h: 1080 },
  { file: 'ad14_fun_plumber.html',      w: 1080, h: 1080 },
  { file: 'ad15_fun_restaurant.html',   w: 1080, h: 1080 },
  { file: 'ad16_fun_slowgrowth.html',   w: 1080, h: 1080 },
  { file: 'ad21_poster_sloth.html', w: 1080, h: 1080 },
  { file: 'ad22_poster_snail.html', w: 1080, h: 1080 },
  { file: 'ad23_poster_rocketdog.html', w: 1080, h: 1080 },
  { file: 'ad24_poster_shark.html', w: 1080, h: 1080 },
  { file: 'ad25_poster_race.html', w: 1080, h: 1080 },
  { file: 'ad26_poster_giraffe.html', w: 1080, h: 1080 },
  { file: 'ad27_poster_boost.html', w: 1080, h: 1080 },
  { file: 'ad28_poster_empower.html', w: 1080, h: 1080 },
  { file: 'ad29_poster_maildog.html', w: 1080, h: 1080 },
  { file: 'ad30_poster_pigeon.html', w: 1080, h: 1080 },
  { file: 'ad31_card_reveal.html', w: 1080, h: 1080 },
  { file: 'ad32_optin_loop.html', w: 1080, h: 1080 },
  { file: 'ad33_fridge.html', w: 1080, h: 1080 },
  { file: 'ad34_scan_save_win.html', w: 1080, h: 1080 },
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
