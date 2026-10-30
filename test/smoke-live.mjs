// Smoke test on the real instagram.com, logged out. Run with: npm run smoke
// Checks that the filter starts without errors on Instagram's real page,
// leaves the login form alone and blocks /reels/. Pages that need a login
// (feed, DMs) can only be checked on your phone.

import { createRequire } from 'node:module';
import { userscript } from './helpers.mjs';

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

await browser.close();
console.log(failed ? '\nSome checks failed.' : '\nAll live checks passed.');
process.exit(failed ? 1 : 0);
