// Test helpers: a headless Chrome sized like an iPhone, serving the fake
// Instagram (test/fake-instagram/) at www.instagram.com addresses, with the
// built userscript injected at page start, exactly like Userscripts does.
// Needs Playwright with Chromium (preinstalled in the cloud environment).

import { createRequire } from 'node:module';
import { fingerprint } from '../src/filter/lock.js';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');

// The tests unlock the switches with a code of their own: the real code isn't in the
// repository, so their copy of the filter gets this code's fingerprint instead.
export const TEST_CODE = '2468';
const built = read('../dist/let-me-wonder.user.js');
export const userscript = built.replace(/(CODE_HASH = ")[0-9a-f]{64}"/, `$1${fingerprint(TEST_CODE)}"`);
if (userscript === built) throw new Error('the lock fingerprint was not found in the built filter');
const fakeApp = read('./fake-instagram/app.js');
// Instagram's real viewport tag (read from instagram.com, Oct 2026): it forbids zooming.
export const INSTAGRAM_VIEWPORT = 'width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, viewport-fit=cover';
const fakePage = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="${INSTAGRAM_VIEWPORT}"><title>Instagram (fake)</title></head>
<body><div id="root"></div><script src="/__fake__/app.js"></script></body></html>`;

export const BASE = 'https://www.instagram.com';

export async function launch() {
  return chromium.launch();
}

// Opens `path` on the fake Instagram. Options:
//   settings: saved switches, as the Safari settings panel would store them
//   app:      run as inside the Android app (with these settings)
export async function open(browser, path, { settings, app } = {}) {
  const context = await browser.newContext(devices['iPhone 13']);
  await context.route('**/*', (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (url.hostname !== 'www.instagram.com') return route.abort();
    if (url.pathname === '/__fake__/app.js') return route.fulfill({ contentType: 'text/javascript', body: fakeApp });
    if (req.resourceType() === 'document') return route.fulfill({ contentType: 'text/html', body: fakePage });
    return route.fulfill({ status: 204, body: '' });
  });
  if (settings) {
    await context.addInitScript((s) => localStorage.setItem('lmw-settings-v1', JSON.stringify(s)), settings);
  }
  if (app) {
    await context.addInitScript((s) => {
      window.__appMessages = [];
      window.ReactNativeWebView = { postMessage: (m) => window.__appMessages.push(JSON.parse(m)) };
      window.__LMW_CONFIG__ = { host: 'app', settings: s };
    }, app);
  }
  await context.addInitScript({ content: userscript });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  // The filter may send a page elsewhere while it loads (e.g. the swipeable reels feed to
  // one reel): that's a second navigation, so wait for whichever page ends up loaded.
  await page.goto(BASE + path).catch((e) => {
    if (!/interrupted|ERR_ABORTED/i.test(e.message)) throw e;
  });
  await page.waitForLoadState('load');
  await page.waitForTimeout(150); // let the fake add its late items
  page.errors = errors;
  return page;
}

export const search = (page) => page.evaluate(() => location.search);

// Can you see it? A post the filter covers keeps its box, but nothing in it shows.
export const visible = (page, fx) =>
  page.evaluate((f) => {
    const el = document.querySelector(`[data-fx="${f}"]`);
    const seen = (n) => n.checkVisibility({ visibilityProperty: true }) && n.getClientRects().length > 0;
    if (!el || !seen(el)) return false;
    const inside = el.querySelectorAll('*');
    return inside.length === 0 || [...inside].some(seen);
  }, fx);

// Clicks like a finger would, even on things the filter has hidden.
export const tap = (page, fx) => page.evaluate((f) => document.querySelector(`[data-fx="${f}"]`).click(), fx);

const inUi = (page, fn, arg) =>
  page.evaluate(
    ([source, a]) => {
      const root = document.getElementById('lmw-ui').shadowRoot;
      return new Function('root', 'arg', source)(root, a);
    },
    [fn, arg],
  );

export const blockedShown = (page) => inUi(page, "return !root.querySelector('.blocked').hidden");
export const blockedMessage = (page) => inUi(page, "return root.querySelector('.blocked p').textContent");
export const tapGoBack = (page) => inUi(page, "root.querySelector('.blocked .primary').click()");
export const gearShown = (page) => inUi(page, "return !root.querySelector('.gear').hidden");
export const panelShown = (page) => inUi(page, "return !root.querySelector('.backdrop').hidden");
export const tapGear = (page) => inUi(page, "root.querySelector('.gear').click()");
// The filters are locked; the free switches (friends' reels, Small boxes, Pinch to zoom, Show the
// settings button) never are.
export const switchesLocked = (page) =>
  inUi(page, "const all = [...root.querySelectorAll('.toggles input')]; const free = ['feedReels', 'smallCovers', 'pinchZoom', 'showGear']; " +
    "return all.filter((i) => !free.includes(i.dataset.id)).every((i) => i.disabled) && all.filter((i) => free.includes(i.dataset.id)).every((i) => !i.disabled)");
export const lockMessage = (page) => inUi(page, "return root.querySelector('.lock-msg').textContent");
export const enterCode = (page, code) =>
  inUi(page, "root.querySelector('.code').value = arg; root.querySelector('.unlock').click()", code);
export const closePanel = (page) => inUi(page, "root.querySelector('.close').click()");
export const flipSwitch = (page, id) =>
  inUi(page, "const i = root.querySelector('input[data-id=\"' + arg + '\"]'); i.click(); return i.checked", id);

export const path = (page) => page.evaluate(() => location.pathname);

export const viewportTag = (page) => page.evaluate(() => document.querySelector('meta[name="viewport"]').getAttribute('content'));

// Pinches with two fingers (as the browser's own pinch gesture) and returns the zoom after it.
export async function pinch(page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.synthesizePinchGesture', { x: 180, y: 300, scaleFactor: 2.5, relativeSpeed: 600 });
  await page.waitForTimeout(300);
  return page.evaluate(() => window.visualViewport.scale);
}
