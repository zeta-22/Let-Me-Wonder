// Automatic checks for the filter, run with: npm test
// Each check opens the fake Instagram with the built userscript and looks at
// what is visible, what is blocked and what the problem report contains.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  launch, open, visible, tap, path, blockedShown, blockedMessage, tapGoBack,
  gearShown, panelShown, tapGear, flipSwitch,
} from './helpers.mjs';

let browser;
before(async () => {
  browser = await launch();
});
after(async () => {
  await browser.close();
});

const ALL_OFF = { reelsTab: false, feedReels: false, explore: false, suggested: false, ads: false, reelSwipe: false };

async function expectVisible(page, list, shouldBe) {
  for (const fx of list) assert.equal(await visible(page, fx), shouldBe, `${fx} should be ${shouldBe ? 'visible' : 'hidden'}`);
}

test('home feed: reels, ads and suggestions are hidden; friends’ posts stay', async () => {
  const page = await open(browser, '/');
  await expectVisible(page, ['post-normal', 'post-normal-2', 'post-late', 'caught-up', 'stories'], true);
  await expectVisible(page, ['post-reel', 'ad-en', 'ad-it', 'ad-es', 'ad-late', 'ad-textchange'], false);
  await expectVisible(page, ['suggested-accounts', 'suggested-post', 'suggested-heading', 'after-1', 'after-late'], false);
  assert.deepEqual(page.errors, []);
});

for (const hl of ['it', 'es']) {
  test(`home feed in ${hl === 'it' ? 'Italian' : 'Spanish'}: suggestions are hidden too`, async () => {
    const page = await open(browser, `/?hl=${hl}`);
    await expectVisible(page, ['post-normal', 'caught-up'], true);
    await expectVisible(page, ['suggested-accounts', 'suggested-post', 'after-1', 'after-late'], false);
  });
}

test('bottom bar: Reels tab is gone, the other buttons stay', async () => {
  const page = await open(browser, '/');
  await expectVisible(page, ['nav-home', 'nav-explore', 'nav-create', 'nav-profile'], true);
  await expectVisible(page, ['nav-reels'], false);
});

test('tapping a Reels link shows the Blocked screen without leaving the page', async () => {
  const page = await open(browser, '/');
  await tap(page, 'nav-reels');
  assert.equal(await path(page), '/');
  assert.equal(await blockedShown(page), true);
  assert.match(await blockedMessage(page), /Reels are switched off/);
  await tapGoBack(page);
  assert.equal(await blockedShown(page), false);
  assert.equal(await visible(page, 'post-normal'), true);
});

test('if Instagram itself moves to /reels/, it is blocked, videos are paused, and Back works', async () => {
  const page = await open(browser, '/');
  await page.evaluate(() => window.fake.navigate('/reels/'));
  assert.equal(await blockedShown(page), true);
  assert.equal(await visible(page, 'reels-video'), false, 'the page under the Blocked screen is hidden');
  const paused = await page.evaluate(async () => {
    const v = document.querySelector('video');
    v.play().catch(() => {});
    await new Promise((r) => setTimeout(r, 50));
    return v.paused;
  });
  assert.equal(paused, true, 'videos are paused while blocked');
  await tapGoBack(page);
  await page.waitForTimeout(100);
  assert.equal(await path(page), '/');
  assert.equal(await blockedShown(page), false);
});

test('opening /reels/ directly is blocked; Go back leads home', async () => {
  const page = await open(browser, '/reels/');
  assert.equal(await blockedShown(page), true);
  await tapGoBack(page);
  await page.waitForURL('https://www.instagram.com/');
  await page.waitForTimeout(100);
  assert.equal(await blockedShown(page), false);
  assert.equal(await visible(page, 'post-normal'), true);
});

test('tapping a DM link into the swipeable reels feed opens just that one reel', async () => {
  const page = await open(browser, '/direct/t/123/');
  await tap(page, 'dm-reels-feed-link');
  await page.waitForURL('https://www.instagram.com/reel/DM3/');
  await page.waitForTimeout(100);
  assert.equal(await blockedShown(page), false);
  assert.equal(await visible(page, 'reel-video'), true);
});

test('opening the swipeable reels feed any other way is blocked', async () => {
  const page = await open(browser, '/reels/ABC/');
  assert.equal(await path(page), '/reels/ABC/');
  assert.equal(await blockedShown(page), true);
});

test('if Instagram moves from /reels/ to a reel in the feed by itself, it stays blocked', async () => {
  const page = await open(browser, '/');
  await page.evaluate(() => window.fake.navigate('/reels/'));
  await page.evaluate(() => history.replaceState({}, '', '/reels/XYZ/'));
  await page.waitForTimeout(400);
  assert.equal(await path(page), '/reels/XYZ/');
  assert.equal(await blockedShown(page), true);
});

test('Explore: the grid is hidden but the search box stays', async () => {
  const page = await open(browser, '/explore/');
  await expectVisible(page, ['search-box', 'search-link'], true);
  await expectVisible(page, ['tile-1', 'tile-2'], false);
});

test('search finds accounts; hashtag grids are blocked', async () => {
  const page = await open(browser, '/explore/search/');
  await expectVisible(page, ['search-box', 'result-user', 'result-tag'], true);
  await tap(page, 'result-user');
  assert.equal(await path(page), '/someone/');
  assert.equal(await blockedShown(page), false);
  await page.goBack();
  await tap(page, 'result-tag');
  assert.equal(await blockedShown(page), true);
  assert.match(await blockedMessage(page), /Explore is switched off/);
});

test('"See all" suggested people is hidden and its page is blocked', async () => {
  const page = await open(browser, '/explore/people/');
  assert.equal(await blockedShown(page), true);
});

test('DMs: messages stay (even one saying "Sponsored"), a shared reel plays, the next reel is blocked', async () => {
  const page = await open(browser, '/direct/t/123/');
  await expectVisible(page, ['dm-sponsored-text', 'dm-msg', 'dm-reel', 'composer'], true);
  await tap(page, 'dm-reel-link');
  assert.equal(await path(page), '/reel/DM1/');
  assert.equal(await blockedShown(page), false);
  assert.equal(await visible(page, 'reel-video'), true);

  // Tapping a link to another reel: stopped before leaving.
  await tap(page, 'next-reel-link');
  assert.equal(await path(page), '/reel/DM1/');
  assert.equal(await blockedShown(page), true);
  assert.match(await blockedMessage(page), /Moving on to other reels is switched off/);
  await tapGoBack(page);
  assert.equal(await blockedShown(page), false);

  // Swiping (Instagram moves the address to the next reel): blocked, Back returns.
  await page.evaluate(() => window.fake.navigate('/reel/NEXT1/'));
  assert.equal(await blockedShown(page), true);
  await tapGoBack(page);
  await page.waitForTimeout(100);
  assert.equal(await path(page), '/reel/DM1/');
  assert.equal(await blockedShown(page), false);

  // Back in DMs, a different shared reel can still be opened.
  await page.evaluate(() => window.fake.navigate('/direct/t/123/'));
  await page.evaluate(() => window.fake.navigate('/reel/DM2/'));
  assert.equal(await blockedShown(page), false);
});

test('profiles: header, posts grid and tabs stay; Reels tab and suggestions go', async () => {
  const page = await open(browser, '/friend_one/');
  await expectVisible(page, ['profile-header', 'profile-grid', 'tab-posts', 'tab-tagged'], true);
  await expectVisible(page, ['tab-reels', 'profile-suggested'], false);
  await tap(page, 'tab-reels');
  assert.equal(await blockedShown(page), true);
});

test('with every switch off, nothing is hidden or blocked', async () => {
  const page = await open(browser, '/', { settings: ALL_OFF });
  await expectVisible(page, ['post-reel', 'ad-en', 'ad-it', 'suggested-accounts', 'after-1', 'nav-reels'], true);
  await tap(page, 'nav-reels');
  assert.equal(await path(page), '/reels/');
  assert.equal(await blockedShown(page), false);
});

test('each switch only affects its own part', async () => {
  const page = await open(browser, '/', { settings: { ...ALL_OFF, ads: true } });
  await expectVisible(page, ['ad-en', 'ad-it', 'ad-es', 'ad-late'], false);
  await expectVisible(page, ['post-reel', 'suggested-accounts', 'after-1', 'nav-reels'], true);
});

test('settings panel (Safari): the button opens it, switches apply at once and are remembered', async () => {
  const page = await open(browser, '/');
  assert.equal(await gearShown(page), true);
  await tapGear(page);
  assert.equal(await panelShown(page), true);
  assert.equal(await flipSwitch(page, 'ads'), false);
  assert.equal(await visible(page, 'ad-en'), true);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('lmw-settings-v1')));
  assert.equal(saved.ads, false);
  assert.equal(saved.reelsTab, true);
});

test('the settings button stays out of the way in DMs, and #lmw opens the panel', async () => {
  const page = await open(browser, '/direct/t/123/');
  assert.equal(await gearShown(page), false);
  await page.evaluate(() => (location.hash = '#lmw'));
  await page.waitForTimeout(50);
  assert.equal(await panelShown(page), true);
});

test('problem report: structure only, no usernames, no messages, never what you type', async () => {
  const login = await open(browser, '/accounts/login/');
  await login.fill('[data-fx="username"]', 'my.real.name');
  await login.fill('[data-fx="password"]', 'hunter2-very-secret');
  const loginReport = await login.evaluate(() => window.__LMW__.buildReport());
  assert.ok(!loginReport.includes('hunter2-very-secret'), 'password never appears');
  assert.ok(!loginReport.includes('my.real.name'), 'typed username never appears');
  assert.match(loginReport, /input .*type=password/);

  const home = await open(browser, '/');
  const homeReport = await home.evaluate(() => window.__LMW__.buildReport());
  assert.match(homeReport, /page: home/);
  assert.match(homeReport, /hidden by labels: .*ads×/);
  assert.match(homeReport, /href=\/\{user\}\//);
  assert.match(homeReport, /href=\/p\/\{id\}\//);
  assert.ok(!/friend_one|stranger|shop_brand/.test(homeReport), 'usernames are masked');
  assert.ok(!homeReport.includes('lovely day at the beach'), 'captions are left out');

  const dm = await open(browser, '/direct/t/123/');
  const dmReport = await dm.evaluate(() => window.__LMW__.buildReport());
  assert.ok(!dmReport.includes('see you at 8'), 'DM messages are left out');
});

test('inside the Android app: no settings button, settings and reports go through the app', async () => {
  const page = await open(browser, '/', { app: { ...ALL_OFF, ads: true } });
  assert.equal(await gearShown(page), false);
  await expectVisible(page, ['ad-en'], false);
  await expectVisible(page, ['post-reel'], true);
  await page.evaluate(() => window.__LMW__.sendReport());
  const messages = await page.evaluate(() => window.__appMessages);
  const report = messages.find((m) => m.type === 'report');
  assert.ok(report && report.text.includes('Let Me Wonder problem report'));
  assert.equal(await page.evaluate(() => localStorage.getItem('lmw-settings-v1')), null, 'the app keeps settings itself');
});
