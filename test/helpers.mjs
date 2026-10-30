// Test helpers: a headless Chrome sized like an iPhone, serving the fake
// Instagram (test/fake-instagram/) at www.instagram.com addresses, with the
// built userscript injected at page start, exactly like Userscripts does.
// Needs Playwright with Chromium (preinstalled in the cloud environment).

import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');
export const userscript = read('../dist/let-me-wonder.user.js');
const fakeApp = read('./fake-instagram/app.js');
const fakePage = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Instagram (fake)</title></head>
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
  // The filter may switch "/" to the Following feed while the page loads: that's a
  // second navigation, so wait for whichever page ends up loaded.
  await page.goto(BASE + path).catch((e) => {
    if (!/interrupted|ERR_ABORTED/i.test(e.message)) throw e;
  });
  await page.waitForLoadState('load');
  await page.waitForTimeout(150); // let the fake add its late items
  page.errors = errors;
  return page;
}

export const search = (page) => page.evaluate(() => location.search);

export const visible = (page, fx) => page.locator(`[data-fx="${fx}"]`).first().isVisible();

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
export const flipSwitch = (page, id) =>
  inUi(page, "const i = root.querySelector('input[data-id=\"' + arg + '\"]'); i.click(); return i.checked", id);

export const path = (page) => page.evaluate(() => location.pathname);
