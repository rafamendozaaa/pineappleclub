/*
 * End-to-end flow test for the Parking Haus marketplace (../marketplace.html):
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
  // Tokens applied (no hardcoded color): primary CTA background must equal whatever
  // --color-primary resolves to (brand-agnostic — works for any theme).
  const { tokenRgb, ctaBg } = await driverCta.evaluate((el) => {
    const probe = document.createElement('span');
    probe.style.color = 'var(--color-primary)';
    document.body.appendChild(probe);
    const tokenRgb = getComputedStyle(probe).color;
    probe.remove();
    return { tokenRgb, ctaBg: getComputedStyle(el).backgroundColor };
  });
  ok(ctaBg === tokenRgb, `driver CTA background == --color-primary (${ctaBg})`);

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

  console.log('\nFLOW 10 — Host completes signup, lists a spot, it appears on home');
  await page.goto(APP_URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('.hero h1');
  await page.locator('.cta-row .btn-secondary').click(); // List My Parking Spot -> host
  await page.waitForSelector('.wiz');
  await page.locator('.role-card').nth(1).click(); // host -> advance
  await page.waitForSelector('.oauth');
  await page.locator('.oauth-btn').first().click(); // OAuth shortcut -> profile
  await page.waitForSelector('#p-name');
  await page.fill('#p-name', 'Jordan Vega');
  await page.fill('#p-addr', 'Calle Falsa 123');
  await page.fill('#p-price', '15');
  await page.locator('.wiz-actions .btn-primary').click(); // Finish -> Done screen
  await page.waitForSelector('.success');
  await page.locator('.success .btn-primary').click(); // List Your First Spot -> list-spot form
  await page.waitForSelector('.ls-form');
  ok((await page.locator('#ls-addr').inputValue()) === 'Calle Falsa 123', 'listing form prefilled host address');
  ok((await page.locator('#ls-price').inputValue()) === '15', 'listing form prefilled price');
  await page.fill('#ls-title', 'Gated garage by the arena');
  ok((await page.locator('.ls-preview .lc-title').textContent()).includes('Gated garage'), 'live preview updates as you type');
  await page.locator('.ls-form .btn-primary', { hasText: 'Publish' }).click();
  await page.waitForSelector('.ls-success');
  ok((await page.locator('.ls-success .lc-title').textContent()).includes('Gated garage'), 'success screen shows the published card');
  await page.locator('.ls-success .btn-primary', { hasText: 'View on home' }).click();
  await page.waitForSelector('.listing-grid');
  ok((await page.locator('.lc').count()) === 7, 'published listing added to home grid (7 cards)');
  ok((await page.locator('.lc-mine').count()) === 1, 'published card shows "Your listing" badge');

  console.log('\nFLOW 11 — Driver finish routes into the live driver app (parking.html)');
  await page.goto(APP_URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('.hero h1');
  await page.locator('.cta-row .btn-primary').first().click(); // Find a Parking Spot -> driver
  await page.waitForSelector('.wiz');
  await page.locator('.role-card').first().click(); // driver -> advance
  await page.waitForSelector('.oauth');
  await page.locator('.oauth-btn').first().click(); // OAuth shortcut -> profile
  await page.waitForSelector('#p-name');
  await page.fill('#p-name', 'Alex Driver');
  await page.locator('.wiz-actions .btn-primary').click(); // Finish (driver)
  await page.waitForSelector('.success');
  await page.locator('.success .btn-primary').click(); // Find Parking Near Me -> parking.html
  await page.waitForURL(/parking\.html$/);
  ok(page.url().endsWith('parking.html'), 'driver routed to parking.html');
  await page.waitForSelector('.logo');
  ok((await page.locator('.logo').textContent()).includes('HAUS'), 'driver app (Parking Haus) loaded');

  console.log('\nFLOW 12 — Driver taps a listing, reserves it, hands off to the app');
  await page.goto(APP_URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('.listing-grid .lc');
  await page.locator('.listing-grid .lc').first().click(); // open booking
  await page.waitForSelector('.bk-summary');
  ok(await page.locator('.wiz .btn-primary', { hasText: 'Confirm' }).isDisabled(), 'Confirm disabled until a date is picked');
  await page.fill('#bk-date', '2026-06-01');
  await page.locator('.wiz .btn-primary', { hasText: 'Confirm' }).click();
  await page.waitForSelector('.success');
  ok((await page.locator('.success h3').textContent()).toLowerCase().includes('reserved'), 'reservation confirmed');
  const booking = await page.evaluate(() => JSON.parse(localStorage.getItem('mkt_bookings') || '[]'));
  ok(booking.length === 1 && booking[0].date === '2026-06-01', 'booking persisted to localStorage');
  await page.locator('.success .btn-primary').click(); // Go to my parking
  await page.waitForURL(/parking\.html$/);
  ok(page.url().endsWith('parking.html'), 'booking hands off to parking.html');

  console.log('\nFLOW 13 — Host edits then unpublishes a listing');
  await page.goto(APP_URL);
  await page.evaluate(() => localStorage.setItem('mkt_listings', JSON.stringify([
    { id: 'L1', title: 'My driveway', loc: 'Main St 1', price: 10, unit: '/day', rating: null, host: 'Jordan', tags: [['shield', 'Gated']], type: 'Driveway', photoData: '', img: '', mine: true },
  ])));
  await page.reload();
  await page.waitForSelector('.hero h1');
  await page.locator('.nav-links button', { hasText: 'My listings' }).click();
  await page.waitForSelector('.ml-card');
  ok((await page.locator('.ml-card').count()) === 1, 'my listings shows the seeded listing');
  await page.locator('.ml-actions .btn', { hasText: 'Edit' }).click();
  await page.waitForSelector('.ls-form');
  ok((await page.locator('#ls-title').inputValue()) === 'My driveway', 'edit form prefilled from listing');
  await page.fill('#ls-title', 'My driveway (updated)');
  await page.locator('.ls-form .btn-primary', { hasText: 'Save changes' }).click();
  await page.waitForSelector('.ls-success');
  await page.locator('.ls-success .btn-primary', { hasText: 'View on home' }).click();
  await page.waitForSelector('.listing-grid');
  ok((await page.locator('.lc').count()) === 7, 'edit updates in place — no duplicate (still 7 cards)');
  ok((await page.locator('.lc-title', { hasText: 'My driveway (updated)' }).count()) === 1, 'edited title shows on home');
  await page.locator('.nav-links button', { hasText: 'My listings' }).click();
  await page.waitForSelector('.ml-card');
  await page.locator('.ml-actions .btn', { hasText: 'Unpublish' }).click();
  ok((await page.locator('.ml-card').count()) === 0, 'listing removed after unpublish');
  ok((await page.locator('.ml-empty').count()) === 1, 'empty state shown when no listings');

  console.log('\nFLOW 14 — Host uploads a real photo (file -> data URL on the card)');
  const fixturePng = '/tmp/mkt-fixture.png';
  fs.writeFileSync(fixturePng, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64'));
  await page.goto(APP_URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('.hero h1');
  await page.locator('.nav-links button', { hasText: 'My listings' }).click();
  await page.waitForSelector('.ml-empty');
  await page.locator('.ml-empty .btn').click(); // List your first spot
  await page.waitForSelector('.ls-form');
  ok((await page.locator('.ph-drop').count()) === 1, 'photo upload dropzone shown (replaces URL field)');
  await page.setInputFiles('.ph-drop input[type="file"]', fixturePng);
  await page.waitForSelector('.ph-thumb img');
  ok((await page.locator('.ph-thumb img').count()) === 1, 'thumbnail shown after upload');
  const previewSrc = await page.locator('.ls-preview .lc-img').getAttribute('src');
  ok(previewSrc.startsWith('data:image'), 'preview card uses the uploaded photo (data URL)');

  console.log('\nFLOW 15 — Admin backoffice is owner-only (hello@parkinghaus.com)');
  await page.goto(APP_URL);
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('mkt_listings', JSON.stringify([{ id: 'L1', title: 'Owner test spot', loc: 'X', price: 10, unit: '/day', rating: null, host: 'Jordan', tags: [['shield', 'Gated']], type: 'Driveway', photoData: '', img: '', mine: true }]));
    localStorage.setItem('mkt_bookings', JSON.stringify([{ id: 'B1', title: 'Owner test spot', loc: 'X', price: 10, unit: '/day', date: '2026-06-01', time: '' }]));
  });
  await page.reload();
  await page.waitForSelector('.hero h1');
  ok((await page.locator('.nav-links button', { hasText: 'Admin' }).count()) === 0, 'no Admin link for anonymous visitor');

  // Non-owner login: still no admin access
  await page.locator('.nav-cta button', { hasText: 'Log in' }).click();
  await page.waitForSelector('#login-email');
  await page.fill('#login-email', 'someone@else.com');
  await page.fill('#login-pw', 'whatever');
  await page.locator('.wiz .btn-primary', { hasText: 'Log in' }).click();
  await page.waitForSelector('.nav-user');
  ok((await page.locator('.nav-links button', { hasText: 'Admin' }).count()) === 0, 'non-owner sees no Admin link');
  ok((await page.locator('.admin').count()) === 0, 'non-owner is not in the admin view');
  await page.locator('.nav-user button', { hasText: 'Log out' }).click();
  await page.waitForSelector('.nav-cta button');

  // Owner login: admin link + dashboard
  await page.locator('.nav-cta button', { hasText: 'Log in' }).click();
  await page.waitForSelector('#login-email');
  await page.fill('#login-email', 'hello@parkinghaus.com');
  await page.fill('#login-pw', 'ownerpass');
  await page.locator('.wiz .btn-primary', { hasText: 'Log in' }).click();
  await page.waitForSelector('.admin');
  ok((await page.locator('.nav-links button', { hasText: 'Admin' }).count()) === 1, 'owner sees the Admin link');
  ok((await page.locator('.owner-chip').textContent()).includes('hello@parkinghaus.com'), 'admin shows owner email');
  ok((await page.locator('.panel').first().locator('tbody tr').count()) >= 2, 'listings table shows live + demo rows');
  ok((await page.locator('.metric .m-value').first().textContent()) === '1', 'live-listings metric = 1');
  // Moderation: remove the live listing
  await page.locator('.tbl .link-btn', { hasText: 'Remove' }).first().click();
  ok((await page.locator('.badge.live').count()) === 0, 'owner removed the live listing');
  // Cancel the booking
  await page.locator('.tbl .link-btn', { hasText: 'Cancel' }).first().click();
  ok((await page.locator('.admin-empty').count()) === 1, 'owner cancelled the booking (bookings empty)');

  // Owner session persists across reload
  await page.reload();
  await page.waitForSelector('.nav-user');
  ok((await page.locator('.nav-links button', { hasText: 'Admin' }).count()) === 1, 'owner session persists across reload');

  console.log('\nFLOW 16 — Profile photo (1:1) flows onto the host avatar; seed cards fall back');
  const avatarPng = '/tmp/mkt-fixture.png';
  fs.writeFileSync(avatarPng, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64'));
  await page.goto(APP_URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('.listing-grid .lc');
  ok((await page.locator('.listing-grid .lc .lc-host').count()) === 6, 'every seed card has a host avatar');
  ok((await page.locator('.listing-grid .lc .lc-host img').count()) === 0, 'seed host avatars fall back to initial (no photo)');
  // Host onboarding with a profile photo
  await page.locator('.cta-row .btn-secondary').click();
  await page.waitForSelector('.wiz');
  await page.locator('.role-card').nth(1).click(); // host
  await page.waitForSelector('.oauth');
  await page.locator('.oauth-btn').first().click(); // -> profile step
  await page.waitForSelector('.avatar-upload');
  await page.setInputFiles('.avatar-upload input[type="file"]', avatarPng);
  await page.waitForSelector('.avatar-upload .avatar img');
  ok((await page.locator('.avatar-upload .avatar img').count()) === 1, 'uploaded profile photo previews as a 1:1 avatar');
  await page.fill('#p-name', 'María López');
  await page.fill('#p-addr', 'Av. Corrientes 1');
  await page.fill('#p-price', '14');
  await page.locator('.wiz-actions .btn-primary').click(); // Finish -> Done
  await page.waitForSelector('.success');
  await page.locator('.success .btn-primary').click(); // -> list-spot
  await page.waitForSelector('.ls-form');
  ok((await page.locator('.ls-preview .lc-host img').count()) === 1, 'host photo shows on the listing preview avatar');
  await page.fill('#ls-title', 'Gated garage with attendant');
  await page.locator('.ls-form .btn-primary', { hasText: 'Publish' }).click();
  await page.waitForSelector('.ls-success');
  await page.locator('.ls-success .btn-primary', { hasText: 'View on home' }).click();
  await page.waitForSelector('.listing-grid');
  ok((await page.locator('.listing-grid .lc').first().locator('.lc-host img').count()) === 1, 'published card shows the host profile photo');
  const objFit = await page.locator('.lc-host img').first().evaluate((el) => getComputedStyle(el).objectFit);
  ok(objFit === 'cover', 'avatar image uses object-fit: cover');

  await browser.close();
  if (errors.length) {
    console.error('\n❌ JS errors during run:\n  ' + errors.join('\n  '));
    process.exit(2);
  }
  console.log('\nALL MARKETPLACE FLOWS PASSED ✅');
}

main().catch((e) => { console.error('\n❌ ' + e.message); process.exit(1); });
