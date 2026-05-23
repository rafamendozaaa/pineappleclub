/*
 * End-to-end flow test for the Parking Haus app (../parking.html).
 *
 * Setup (first time):
 *   npm install
 *   npm run test:browsers   # downloads the Chromium build Playwright drives
 *
 * Run:
 *   npm test
 *
 * parking.html loads React / ReactDOM / Babel-standalone from a CDN. To keep the
 * test hermetic (and to work in sandboxes where the CDN is blocked), those
 * requests are fulfilled from the local node_modules copies declared in
 * package.json. The app file itself is loaded unmodified over file://.
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const APP_URL = 'file://' + path.resolve(__dirname, '..', 'parking.html');

// CDN url-substring -> local file served in its place
const reactDir = path.dirname(require.resolve('react/package.json'));
const reactDomDir = path.dirname(require.resolve('react-dom/package.json'));
const LIBS = [
  { match: 'react-dom@18/umd/react-dom.production.min.js', file: path.join(reactDomDir, 'umd/react-dom.production.min.js') },
  { match: 'react@18/umd/react.production.min.js', file: path.join(reactDir, 'umd/react.production.min.js') },
  { match: '@babel/standalone/babel.min.js', file: require.resolve('@babel/standalone/babel.min.js') },
];

function ok(cond, msg) {
  if (!cond) throw new Error('ASSERT FAILED: ' + msg);
  console.log('  ✓ ' + msg);
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 780 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  // Serve CDN-hosted libs from local copies; stub fonts; swallow any other CDN call.
  await page.route('**/*', (route) => {
    const u = route.request().url();
    for (const lib of LIBS) {
      if (u.includes(lib.match)) {
        return route.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(lib.file) });
      }
    }
    if (u.includes('fonts.googleapis.com')) return route.fulfill({ contentType: 'text/css', body: '' });
    if (u.startsWith('file://')) return route.continue();
    return route.fulfill({ status: 200, body: '' });
  });

  // Start from a clean slate so assertions on balance/history are deterministic.
  await page.goto(APP_URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('.logo');

  console.log('\nFLOW 1 — Find tab loads with lots');
  ok((await page.locator('.ptitle').first().textContent()) === 'FIND PARKING', 'Find page title shown');
  const lotCount = await page.locator('.lot').count();
  ok(lotCount === 6, `6 lots listed (got ${lotCount})`);
  const bal0 = await page.locator('.topbar-meta b').textContent();
  ok(bal0 === '$125.40', `initial balance ${bal0}`);

  console.log('\nFLOW 2 — Search filters lots');
  await page.fill('.search input', 'palermo');
  await page.waitForTimeout(150);
  ok((await page.locator('.lot').count()) === 1, 'search "palermo" -> 1 lot');
  await page.fill('.search input', '');
  await page.waitForTimeout(150);

  console.log('\nFLOW 3 — Open lot, pick a free spot, park');
  await page.locator('.lot').first().click();
  await page.waitForSelector('.sheet');
  ok((await page.locator('.spot.free').count()) > 0, 'free spots available in grid');
  ok(await page.locator('.sheet .btn').isDisabled(), 'PARK button disabled before selection');
  const spotLabel = await page.locator('.spot.free').first().textContent();
  await page.locator('.spot.free').first().click();
  ok((await page.locator('.spot.sel').count()) === 1, `spot ${spotLabel} selected`);
  await page.locator('.sheet .btn').click();

  console.log('\nFLOW 4 — Active session shows live timer');
  await page.waitForSelector('.active-timer');
  ok((await page.locator('.active-status').textContent()).includes('PARKED'), 'status = PARKED · LIVE');
  ok((await page.locator('.active-info .iv').first().textContent()) === spotLabel, `session spot = ${spotLabel}`);
  const t1 = await page.locator('.active-timer').textContent();
  ok(!t1.includes('-'), `timer not negative on first render (${t1})`);
  await page.waitForTimeout(2100);
  const t2 = await page.locator('.active-timer').textContent();
  ok(t1 !== t2, `timer advances (${t1} -> ${t2})`);
  ok((await page.locator('.bn').nth(1).textContent()).includes('Active'), 'nav shows "Active"');

  console.log('\nFLOW 5 — End session charges wallet & writes history');
  await page.locator('.btn.danger').click();
  await page.waitForSelector('.hr');
  ok((await page.locator('.hr').count()) === 1, 'one history row created');
  const balAfter = await page.locator('.topbar-meta b').textContent();
  ok(parseFloat(balAfter.slice(1)) < parseFloat(bal0.slice(1)), `balance decreased (${bal0} -> ${balAfter})`);
  ok((await page.locator('.mc .mv').first().textContent()) === '1', 'sessions metric = 1');

  console.log('\nFLOW 6 — Profile: top up wallet');
  await page.locator('.bn').nth(3).click();
  await page.waitForSelector('.ptitle:has-text("PROFILE")');
  await page.locator('.btn:has-text("TOP UP")').click();
  await page.waitForSelector('.sheet');
  await page.locator('.sheet .btn.ghost:has-text("$50.00")').click();
  await page.waitForTimeout(200);
  const balTop = await page.locator('.topbar-meta b').textContent();
  ok(parseFloat(balTop.slice(1)) > parseFloat(balAfter.slice(1)), `top-up +$50 (${balAfter} -> ${balTop})`);

  console.log('\nFLOW 7 — Profile: add a vehicle');
  const vBefore = await page.locator('.vrow').count();
  await page.locator('.btn.ghost:has-text("ADD VEHICLE")').click();
  await page.fill('input[placeholder="AB 123 CD"]', 'ZZ 999 ZZ');
  await page.fill('input[placeholder="Toyota Corolla"]', 'Tesla Model 3');
  await page.locator('.btn:has-text("SAVE")').click();
  await page.waitForTimeout(200);
  ok((await page.locator('.vrow').count()) === vBefore + 1, 'vehicle added');

  console.log('\nFLOW 8 — State persists across reload (localStorage)');
  await page.reload();
  await page.waitForSelector('.logo');
  await page.locator('.bn').nth(2).click();
  await page.waitForSelector('.hr');
  ok((await page.locator('.hr').count()) === 1, 'history survived reload');

  await browser.close();

  if (errors.length) {
    console.error('\n❌ JS errors during run:\n  ' + errors.join('\n  '));
    process.exit(2);
  }
  console.log('\nALL FLOWS PASSED ✅');
}

main().catch((e) => {
  console.error('\n❌ ' + e.message);
  process.exit(1);
});
