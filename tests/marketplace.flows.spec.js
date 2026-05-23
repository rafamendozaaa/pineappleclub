/*
 * End-to-end flow test for the Parking Hub marketplace (../marketplace.html):
 * hero + dual CTAs, the 4-step sign-up wizard, listing-card image fallback,
 * design-token usage, and responsive (mobile) CTA stacking.
 *
 * Setup / run: see tests/parking.flows.spec.js (npm install, npm run test:browsers, npm test).
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const APP_URL = 'file://' + path.resolve(__dirname, '..', 'marketplace.html');
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

async function route(page) {
  await page.route('**/*', (r) => {
    const u = r.request().url();
    for (const lib of LIBS) if (u.includes(lib.match)) return r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(lib.file) });
    if (u.includes('fonts.googleapis.com') || u.includes('fonts.gstatic.com')) return r.fulfill({ contentType: 'text/css', body: '' });
    if (u.startsWith('file://') || u.startsWith('data:')) return r.continue();
    return r.fulfill({ status: 200, body: '' });
  });
}

async function main() {
  const browser = await chromium.launch();
  const errors = [];
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await route(page);
  await page.goto(APP_URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('.hero h1');

  console.log('\nFLOW 1 — Hero: headline + dual CTAs sized per spec');
  ok((await page.locator('.hero h1').textContent()).includes('Park Smart'), 'headline "Park Smart. Earn More."');
  const driverCta = page.locator('.cta-row .btn-primary');
  const hostCta = page.locator('.cta-row .btn-secondary');
  ok((await driverCta.textContent()).includes('Find a Parking Spot'), 'driver CTA present');
  ok((await hostCta.textContent()).includes('List My Parking Spot'), 'host CTA present');
  const bb = await driverCta.boundingBox();
  ok(bb.width >= 200 && bb.height >= 56, `driver CTA >= 200x56 (got ${Math.round(bb.width)}x${Math.round(bb.height)})`);
  // Tokens applied (no hardcoded color): primary CTA background == --color-primary
  const primaryToken = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim());
  const ctaBg = await driverCta.evaluate((el) => getComputedStyle(el).backgroundColor);
  ok(primaryToken === '#1A6BF0' && ctaBg === 'rgb(26, 107, 240)', `driver CTA uses --color-primary (${ctaBg})`);

  console.log('\nFLOW 2 — Benefit tiles: 3 per user type');
  ok((await page.locator('.bn-group').nth(0).locator('.tile').count()) === 3, 'Drivers: 3 benefit tiles');
  ok((await page.locator('.bn-group').nth(1).locator('.tile').count()) === 3, 'Hosts: 3 benefit tiles');

  console.log('\nFLOW 3 — Listing card image fallback (broken src -> placeholder)');
  ok((await page.locator('.lc').count()) === 6, '6 listing cards');
  ok((await page.locator('.lc-placeholder').count()) === 1, 'one card shows grey placeholder for broken image');
  ok((await page.locator('.lc-img').count()) === 5, 'five cards render an <img>');
  const imgFit = await page.locator('.lc-img').first().evaluate((el) => getComputedStyle(el).objectFit);
  ok(imgFit === 'cover', 'listing image uses object-fit: cover');
  const favLabel = await page.locator('.lc-fav').first().getAttribute('aria-label');
  ok(!!favLabel, `icon-only save button has aria-label ("${favLabel}")`);

  console.log('\nFLOW 4 — CTA opens wizard with role pre-selected, auto-advances');
  await hostCta.click();
  await page.waitForSelector('.wiz');
  ok((await page.locator('.role-card.sel-host').count()) === 1, 'host role pre-selected from CTA');
  await page.locator('.role-card').first().click(); // pick driver -> auto-advance
  await page.waitForSelector('.oauth');
  ok((await page.locator('.step.done').count()) === 1, 'Role step marked done after selection');

  console.log('\nFLOW 5 — Account step: validation + password strength gate Continue');
  const cont = page.locator('.wiz-actions .btn-primary');
  ok(await cont.isDisabled(), 'Continue disabled before valid input');
  await page.fill('#su-email', 'not-an-email');
  await page.locator('#su-email').blur();
  ok((await page.locator('.hint.err').count()) >= 1, 'invalid email shows error hint');
  await page.fill('#su-email', 'alex@email.com');
  await page.fill('#su-pw', 'short');
  ok(await cont.isDisabled(), 'Continue still disabled with <8 char password');
  await page.fill('#su-pw', 'Sup3rSafe!');
  await page.waitForTimeout(100);
  ok(!(await cont.isDisabled()), 'Continue enabled once email + 8+ char password valid');

  console.log('\nFLOW 6 — Profile (driver) then Done screen');
  await cont.click();
  await page.waitForSelector('#p-name');
  ok((await page.locator('.field').count()) === 3, 'driver profile shows 3 fields (<=4 rule)');
  await page.fill('#p-name', 'Alex Driver');
  await page.locator('.wiz-actions .btn-primary').click();
  await page.waitForSelector('.success');
  ok((await page.locator('.success h3').textContent()).includes('Alex'), 'success greets by first name');
  ok((await page.locator('.success .btn-primary').textContent()).includes('Find Parking'), 'driver next-best-action CTA');

  console.log('\nFLOW 7 — Partial progress persists across reload (localStorage)');
  const saved = await page.evaluate(() => localStorage.getItem('mkt_signup'));
  ok(saved && JSON.parse(saved).email === 'alex@email.com', 'wizard state saved to localStorage (no password)');
  ok(saved && !('password' in JSON.parse(saved)), 'password is NOT persisted');

  console.log('\nFLOW 8 — Host path profile is role-specific (4 fields)');
  await page.reload();
  await page.waitForSelector('.hero h1');
  await page.evaluate(() => localStorage.clear());
  await page.locator('.cta-row .btn-secondary').click();
  await page.waitForSelector('.wiz');
  await page.locator('.role-card').nth(1).click(); // host
  await page.waitForSelector('.oauth');
  await page.locator('.oauth-btn').first().click(); // OAuth shortcut -> profile
  await page.waitForSelector('#p-name');
  ok((await page.locator('.field').count()) === 4, 'host profile shows 4 fields');
  ok((await page.locator('#p-addr').count()) === 1, 'host asked for spot address');

  console.log('\nFLOW 9 — Mobile: CTAs stack vertically, full-width');
  const mob = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await route(mob);
  await mob.goto(APP_URL);
  await mob.waitForSelector('.cta-row');
  const dim = await mob.locator('.cta-row .btn-primary').boundingBox();
  ok(dim.width > 300, `driver CTA spans width on mobile (${Math.round(dim.width)}px)`);
  const flexDir = await mob.locator('.cta-row').evaluate((el) => getComputedStyle(el).flexDirection);
  ok(flexDir === 'column', 'CTA row stacks (flex-direction: column) on mobile');

  await browser.close();
  if (errors.length) {
    console.error('\n❌ JS errors during run:\n  ' + errors.join('\n  '));
    process.exit(2);
  }
  console.log('\nALL MARKETPLACE FLOWS PASSED ✅');
}

main().catch((e) => { console.error('\n❌ ' + e.message); process.exit(1); });
