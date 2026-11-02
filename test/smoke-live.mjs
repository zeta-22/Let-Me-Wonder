// Smoke test on the real instagram.com, logged out. Run with: npm run smoke
// Checks that the filter starts without errors on Instagram's real page,
// leaves the login form alone, blocks /reels/ and holds a reel in the real reel viewer. Pages that need a login
// (feed, DMs) can only be checked on your phone.

import { createRequire } from 'node:module';
import { userscript } from './helpers.mjs';
import { APP_USER_AGENT } from '../src/filter/rules.js';

const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');

const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
const browser = await chromium.launch(proxy ? { proxy: { server: proxy } } : {});

async function visit(path, withFilter) {
  const context = await browser.newContext(devices['iPhone 13']);
  if (withFilter) await context.addInitScript({ content: userscript });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('https://www.instagram.com' + path, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(6000);
  const info = await page.evaluate(() => {
    const ui = document.getElementById('lmw-ui');
    const passwords = [...document.querySelectorAll('input[type=password]')];
    return {
      landedOn: location.pathname,
      filterRunning: !!document.getElementById('lmw-style') && document.documentElement.hasAttribute('data-lmw-on'),
      blocked: !!ui && !ui.shadowRoot.querySelector('.blocked').hidden,
      passwordBoxes: passwords.filter((i) => i.getBoundingClientRect().height > 0).length,
    };
  });
  const report = withFilter ? await page.evaluate(() => window.__LMW__ && window.__LMW__.buildReport()) : null;
  await context.close();
  return { ...info, errors, report };
}

let failed = false;
const check = (ok, text) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${text}`);
  if (!ok) failed = true;
};

for (const path of ['/accounts/login/', '/']) {
  const without = await visit(path, false);
  const withF = await visit(path, true);
  console.log(`\n${path} -> landed on ${withF.landedOn}`);
  check(withF.filterRunning, 'filter is running');
  check(!withF.blocked, 'no Blocked screen');
  check(withF.passwordBoxes === without.passwordBoxes, `login form untouched (${withF.passwordBoxes} password box(es) with filter, ${without.passwordBoxes} without)`);
  const extra = withF.errors.filter((e) => !without.errors.includes(e));
  check(extra.length === 0, `no new page errors with the filter${extra.length ? ': ' + extra.join(' | ') : ''}`);
  if (path === '/accounts/login/' && withF.report) {
    console.log('  outline of the real page (first 40 lines):');
    console.log(withF.report.split('\n').slice(0, 40).map((l) => '    ' + l).join('\n'));
  }
}

const reels = await visit('/reels/', true);
console.log(`\n/reels/ -> landed on ${reels.landedOn}`);
if (reels.landedOn.startsWith('/reels')) check(reels.blocked, 'Reels page is blocked');
else console.log('note  logged out, Instagram sent us elsewhere first; blocking is covered by npm test');

// Instagram's real reel viewer, as the Android app sees it (its user agent). Logged out, it
// shows a reel under an "open the app" sheet; closed, real finger swipes move to other reels
// (only past about half the screen: shorter ones spring back).
// Without the filter a swipe must move on (else this check proves nothing); with it (the
// Reels tab switch off, so the page opens), no swipe may, early or after a while.
async function swipeReels(reelPath, withFilter) {
  const context = await browser.newContext({ ...devices['Pixel 7'], userAgent: APP_USER_AGENT, locale: 'it-IT' });
  if (withFilter) {
    await context.addInitScript((s) => (window.__LMW_CONFIG__ = { host: 'app', settings: s }), { reelsTab: false, reelSwipe: true });
    await context.addInitScript({ content: userscript });
  }
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('https://www.instagram.com' + reelPath, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(3000);
  await page.evaluate(() => {
    const x = [...document.querySelectorAll('[aria-label]')].find((n) => /^(chiudi|close)$/i.test(n.getAttribute('aria-label')));
    if (x) (x.closest('[role=button], button') || x).dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await page.waitForTimeout(800);
  const cdp = await context.newCDPSession(page);
  const touch = (type, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: 200, y }] });
  const where = () =>
    page.evaluate(() => {
      const vids = [...document.querySelectorAll('video')];
      const main = vids.find((v) => v.getBoundingClientRect().top > -200 && v.getBoundingClientRect().top < 200);
      return { path: location.pathname, videos: vids.length, onScreen: main ? vids.indexOf(main) : -1 };
    });
  const start = await where();
  const moves = [];
  for (const [wait, from, to] of [[0, 650, 200], [8000, 650, 200], [0, 250, 700]]) {
    await page.waitForTimeout(wait);
    await touch('touchStart', from);
    const step = from > to ? -30 : 30;
    for (let y = from + step; step < 0 ? y >= to : y <= to; y += step) {
      await touch('touchMove', y);
      await page.waitForTimeout(8); // a finger's pace
    }
    await touch('touchEnd');
    await page.waitForTimeout(1500);
    moves.push(await where());
  }
  await context.close();
  return { start, moves, errors };
}

const firstReel = reels.landedOn.match(/^\/reels\/[^/]+\/$/) ? reels.landedOn : null;
const plain = firstReel ? await swipeReels(firstReel, false) : null;
if (!plain || plain.start.videos === 0) {
  console.log("\nnote  Instagram didn't show its reel viewer logged out; the reel swipe is covered by npm test");
} else {
  const moved = (r) => r.moves.filter((m) => m.path !== r.start.path || m.onScreen !== r.start.onScreen).length;
  console.log(`\n${firstReel} (real reel viewer, finger swipes up, up after 8 s, down)`);
  console.log(`  without the filter: ${plain.moves.map((m) => m.path).join(' -> ')}`);
  if (moved(plain) === 0) console.log("note  swipes didn't move the viewer even without the filter: Instagram changed it, check by hand");
  else {
    const held = await swipeReels(firstReel, true);
    console.log(`  with the filter:    ${held.moves.map((m) => m.path).join(' -> ')}`);
    check(moved(held) === 0, 'no swipe moves on to another reel, also 8 seconds later');
    check(held.errors.filter((e) => !plain.errors.includes(e)).length === 0, 'no new page errors with the filter');
  }
}

await browser.close();
console.log(failed ? '\nSome checks failed.' : '\nAll live checks passed.');
process.exit(failed ? 1 : 0);
