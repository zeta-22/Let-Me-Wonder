// Automatic checks for the filter, run with: npm test
// Each check opens the fake Instagram with the built userscript and looks at
// what is visible, what is blocked and what the problem report contains.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  launch, open, visible, tap, path, search, blockedShown, blockedMessage, tapGoBack,
  gearShown, panelShown, tapGear, flipSwitch, switchesLocked, lockMessage, enterCode, closePanel, TEST_CODE,
  viewportTag, pinch, INSTAGRAM_VIEWPORT, fingerSwipe, fingerHold, shieldShown, shieldButtonAt, gearAt,
} from './helpers.mjs';

let browser;
before(async () => {
  browser = await launch();
});
after(async () => {
  await browser.close();
});

const ALL_OFF = {
  reelsTab: false, feedReels: false, explore: false, suggested: false, ads: false, reelSwipe: false,
};

async function expectVisible(page, list, shouldBe) {
  for (const fx of list) assert.equal(await visible(page, fx), shouldBe, `${fx} should be ${shouldBe ? 'visible' : 'hidden'}`);
}

const height = (page, fx) => page.evaluate((f) => document.querySelector(`[data-fx="${f}"]`).getBoundingClientRect().height, fx);

test('home feed: ads and suggestions are hidden; friends’ posts and reels stay', async () => {
  const page = await open(browser, '/');
  await expectVisible(page, ['post-normal', 'post-reel', 'post-normal-2', 'post-late', 'caught-up', 'stories'], true);
  await expectVisible(page, ['ad-en', 'ad-it', 'ad-es', 'ad-late', 'ad-textchange'], false);
  await expectVisible(page, ['suggested-accounts', 'suggested-carousel', 'suggested-post', 'suggested-heading'], false);
  await expectVisible(page, ['after-1', 'after-late'], false);
  assert.deepEqual(page.errors, []);
});

test('hidden posts keep their exact size, covered, so the feed’s layout is Instagram’s own', async () => {
  const page = await open(browser, '/');
  const plain = await open(browser, '/', { settings: ALL_OFF });
  for (const fx of ['ad-en', 'suggested-post', 'suggested-carousel']) {
    assert.equal(await height(page, fx), await height(plain, fx), `${fx} keeps its size`);
  }
  await expectVisible(page, ['ad-en', 'suggested-post', 'suggested-carousel', 'suggested-carousel-see-all'], false);
  const cover = await page.evaluate(() => {
    const s = getComputedStyle(document.querySelector('[data-fx="ad-en"]'));
    return { label: decodeURIComponent(s.backgroundImage), taps: s.pointerEvents };
  });
  assert.match(cover.label, /Ad hidden/, 'a small label says what’s there');
  assert.equal(cover.taps, 'none', 'and it can’t be tapped');
});

test('with "Reels in the home feed" on, every reel in the feed is covered and doesn’t play', async () => {
  const page = await open(browser, '/', { settings: { feedReels: true } });
  const plain = await open(browser, '/', { settings: ALL_OFF });
  await expectVisible(page, ['post-reel'], false);
  assert.equal(await height(page, 'post-reel'), await height(plain, 'post-reel'), 'it keeps its size');
  const playing = await page.evaluate(async () => {
    const v = document.querySelector('[data-fx="post-reel"] video');
    v.play().catch(() => {});
    await new Promise((r) => setTimeout(r, 50));
    return !v.paused;
  });
  assert.equal(playing, false, 'its video is paused');
  await expectVisible(page, ['post-normal'], true);
});

for (const hl of ['it', 'es']) {
  test(`home feed in ${hl === 'it' ? 'Italian' : 'Spanish'}: suggestions are hidden too`, async () => {
    const page = await open(browser, `/?hl=${hl}`);
    await expectVisible(page, ['post-normal', 'caught-up'], true);
    await expectVisible(page, ['suggested-accounts', 'suggested-carousel', 'suggested-post', 'after-1', 'after-late'], false);
  });
}

test('Instagram opens on its own home page, with the stories, and Home keeps it there', async () => {
  const page = await open(browser, '/');
  assert.equal(await path(page), '/');
  assert.equal(await search(page), '', 'not switched to the Following feed');
  await expectVisible(page, ['stories', 'post-normal'], true);
  await page.evaluate(() => window.fake.navigate('/direct/inbox/'));
  await tap(page, 'nav-home');
  assert.equal(await path(page), '/');
  assert.equal(await search(page), '');
});

test('pinch to zoom: Instagram’s “no zoom” is relaxed, so two fingers zoom photos and stories', async () => {
  const page = await open(browser, '/');
  assert.equal(await viewportTag(page), 'width=device-width, initial-scale=1, minimum-scale=1, viewport-fit=cover, maximum-scale=5, user-scalable=yes');
  assert.ok((await pinch(page)) > 2, 'two fingers zoom in');

  // If Instagram writes its tag again, zooming is allowed again.
  await page.evaluate((tag) => document.querySelector('meta[name="viewport"]').setAttribute('content', tag), INSTAGRAM_VIEWPORT);
  await page.waitForTimeout(700);
  assert.match(await viewportTag(page), /maximum-scale=5/);

  const off = await open(browser, '/', { settings: { pinchZoom: false } });
  assert.equal(await viewportTag(off), INSTAGRAM_VIEWPORT, 'switched off, Instagram’s tag stays as it is');
  assert.equal(await pinch(off), 1, 'and no zoom, as on Instagram');
});

test('making a post or a story, the filter stays out of the way', async () => {
  for (const where of ['/create/select/', '/stories/create/']) {
    const page = await open(browser, `${where}?hl=it`);
    await expectVisible(page, ['crop', 'create-file', 'create-share'], true);
    await expectVisible(page, ['tag-people'], true); // "Suggeriti per te" here is people to tag
    assert.equal(await gearShown(page), false, `${where}: no settings button over Instagram's buttons`);
    assert.equal(await viewportTag(page), INSTAGRAM_VIEWPORT, `${where}: Instagram's own zoom, for its pinch-to-crop`);
    assert.equal(await pinch(page), 1);
    await page.waitForTimeout(1700);
    const report = await page.evaluate(() => window.__LMW__.buildReport());
    assert.match(report, /the page for making a post or story:\n {2}main role=main/, 'its outline is kept for the next report');
    assert.ok(!report.includes('friend_one'), 'without names');
  }
  // Back on Home, zooming is allowed again.
  const page = await open(browser, '/create/select/');
  await page.evaluate(() => window.fake.navigate('/'));
  await page.waitForTimeout(100);
  assert.match(await viewportTag(page), /maximum-scale=5/);
});

test('an ad between stories is skipped with Instagram’s own next button, never the ad’s link', async () => {
  const page = await open(browser, '/');
  await page.evaluate(() => window.fake.openStoryAd());
  await page.waitForFunction(() => window.fakeStoryMoves === 1, null, { timeout: 3000 });
  assert.equal(await path(page), '/stories/friend_two/222/', 'on to the next story');
  assert.equal(await page.evaluate(() => window.fakeCtaTapped), undefined, 'the ad’s own link is never tapped');
  await page.waitForTimeout(1000);
  assert.equal(await page.evaluate(() => window.fakeStoryMoves), 1, 'the friend’s story that follows isn’t skipped');
  assert.equal(await gearShown(page), true, 'the settings button is there, for a report during an ad');
  const report = await page.evaluate(() => window.__LMW__.buildReport());
  assert.match(report, /story ad: skipped with the next button/);
  assert.match(report, /the story viewer when an ad showed:\n {2}div role=dialog/);
  assert.ok(!/shop_brand|friend_two/.test(report), 'no names in the report');
});

test('without a next button, a story ad is skipped with the right-arrow key; with Ads off it stays', async () => {
  const page = await open(browser, '/?storynext=none');
  await page.evaluate(() => window.fake.openStoryAd());
  await page.waitForFunction(() => window.fakeStoryMoves === 1, null, { timeout: 3000 });
  assert.equal(await path(page), '/stories/friend_two/222/');
  await page.waitForTimeout(1000);
  assert.equal(await page.evaluate(() => window.fakeStoryMoves), 1, 'only the ad is skipped, not the story after it');

  const off = await open(browser, '/', { settings: { ads: false } });
  await off.evaluate(() => window.fake.openStoryAd());
  await off.waitForTimeout(1000);
  assert.equal(await off.evaluate(() => window.fakeStoryMoves), 0);
});

// Taps the screen like a finger: on the right to go on, on the left (first third) to go back.
async function tapStory(page, side) {
  const width = await page.evaluate(() => window.innerWidth);
  await page.mouse.click(side === 'left' ? width * 0.15 : width * 0.8, 400);
}

test('going back through stories, an ad is skipped backwards, to the story before it', async () => {
  const page = await open(browser, '/');
  await page.evaluate(() => window.fake.openStories());
  await tapStory(page, 'right'); // friend_one -> the ad, skipped forward -> friend_two
  await page.waitForFunction(() => window.fakeStory === 'friend_two', null, { timeout: 3000 });
  await tapStory(page, 'left'); // friend_two -> the ad, skipped backwards -> friend_one
  await page.waitForFunction(() => window.fakeStory === 'friend_one', null, { timeout: 3000 });
  await page.waitForTimeout(1600);
  assert.deepEqual(
    await page.evaluate(() => window.fakeStoryTrail),
    ['friend_one', 'shop_brand', 'friend_two', 'shop_brand', 'friend_one'],
    'the ad is passed both ways, and nothing more',
  );
  const report = await page.evaluate(() => window.__LMW__.buildReport());
  assert.match(report, /story ad: skipped with the next button/);
  assert.match(report, /story ad: skipped backwards with the previous button/);
});

test('without controls, going back through an ad uses the left-arrow key', async () => {
  const page = await open(browser, '/?storynext=none');
  await page.evaluate(() => window.fake.openStories());
  await tapStory(page, 'right');
  await page.waitForFunction(() => window.fakeStory === 'friend_two', null, { timeout: 3000 });
  await tapStory(page, 'left');
  await page.waitForFunction(() => window.fakeStory === 'friend_one', null, { timeout: 3000 });
  assert.match(await page.evaluate(() => window.__LMW__.buildReport()), /skipped backwards with the left-arrow key/);
});

test('a friend’s story is never skipped, even with an ad hidden in the feed underneath', async () => {
  const page = await open(browser, '/');
  await page.evaluate(() => window.fake.openStory());
  await page.waitForTimeout(1200);
  assert.equal(await path(page), '/stories/friend_one/111/');
  assert.doesNotMatch(await page.evaluate(() => window.__LMW__.buildReport()), /story ad/);
});

// --- Instagram's story viewer on a phone (see openPhoneStories() in the fake) -----------
// Real finger touches (CDP), like on the phone: a tap at (x, y), held `ms`.
async function fingerTap(page, x, y, ms = 40) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  await page.waitForTimeout(ms);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

// A finger swipe sideways from fromX to toX at height y, taking about `ms`.
async function fingerSwipeX(page, fromX, toX, ms = 150, y = 420) {
  const cdp = await page.context().newCDPSession(page);
  const touch = (type, x) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  const steps = 6;
  await touch('touchStart', fromX);
  for (let i = 1; i <= steps; i++) {
    await page.waitForTimeout(ms / steps);
    await touch('touchMove', fromX + ((toX - fromX) * i) / steps);
  }
  await touch('touchEnd');
}

const phone = (page) => page.evaluate(() => ({ ...window.fakePhone, path: location.pathname }));
const RIGHT = 330; // on the right of the phone's screen (390 px wide)
const LEFT = 40;

test('on a phone, a story ad is skipped with Instagram’s own tap zone, all its parts, and nothing is paused', async () => {
  // 0.4.7 looked for a "Next" button and then pressed the arrow key: a phone's viewer has
  // neither, so the ad stayed, and the filter paused it (and every video) three times.
  const page = await open(browser, '/');
  await page.evaluate(() => window.fake.openPhoneStories(0));
  await fingerTap(page, RIGHT, 420); // friend_one, part 2
  await page.waitForTimeout(300);
  await fingerTap(page, RIGHT, 420); // on to the ad
  await page.waitForFunction(() => window.fakeStory === 'friend_two', null, { timeout: 4000 });
  await page.waitForTimeout(1500);
  const fx = await phone(page);
  assert.deepEqual(fx.trail, ['friend_one/111', 'friend_one/112', 'shop_brand/901', 'shop_brand/902', 'friend_two/222'], 'both parts of the ad, then the story after it, and no more');
  assert.equal(fx.path, '/stories/friend_two/222/');
  assert.equal(fx.pausedByOthers, 0, 'the filter paused no video');
  assert.equal(fx.ctaOpened, 0);
  assert.equal(await page.evaluate(() => window.fakeCtaTapped), undefined, 'the ad’s own link is never tapped');
  assert.equal(await shieldShown(page), false, 'no shield over stories');
  const report = await page.evaluate(() => window.__LMW__.buildReport());
  assert.match(report, /story ad: skipped with Instagram's tap zone on the right\n.*story ad: skipped with Instagram's tap zone on the right, its next part/);
  assert.doesNotMatch(report, /arrow key|couldn't skip/);
  assert.ok(!/shop_brand|friend_two|friend_one/.test(report), 'no names in the report');
});

test('on a phone, going back through an ad lands on the story before it', async () => {
  const page = await open(browser, '/');
  await page.evaluate(() => window.fake.openPhoneStories(2)); // friend_two
  await page.waitForTimeout(400);
  await fingerTap(page, LEFT, 420); // back: the ad's last part, skipped backwards
  await page.waitForFunction(() => window.fakeStory === 'friend_one', null, { timeout: 4000 });
  await page.waitForTimeout(1500);
  const fx = await phone(page);
  assert.deepEqual(fx.trail, ['friend_two/222', 'shop_brand/902', 'shop_brand/901', 'friend_one/112'], 'through the ad, to friend_one’s last story');
  assert.equal(fx.pausedByOthers, 0);
  assert.match(await page.evaluate(() => window.__LMW__.buildReport()), /story ad: skipped backwards with Instagram's tap zone on the left/);
});

test('on a phone, an ad drawn just off the screen next to a friend’s story is left alone', async () => {
  // 0.4.7 took any label with a box for an ad on screen: it "skipped" and paused the
  // friend's story you were watching.
  const page = await open(browser, '/?prerender=1');
  await page.evaluate(() => window.fake.openPhoneStories(0));
  await fingerTap(page, RIGHT, 420); // friend_one, part 2; the ad is drawn off the right edge
  await page.waitForTimeout(1800);
  const fx = await phone(page);
  assert.deepEqual(fx.trail, ['friend_one/111', 'friend_one/112']);
  assert.equal(fx.pausedByOthers, 0);
  assert.doesNotMatch(await page.evaluate(() => window.__LMW__.buildReport()), /story ad/);
});

test('on a phone, your taps and swipes move the stories as Instagram means them, and the report says why one didn’t', async () => {
  const page = await open(browser, '/');
  await page.evaluate(() => window.fake.openPhoneStories(0));
  await page.waitForTimeout(300);
  await fingerTap(page, RIGHT, 420); // friend_one/112
  await page.waitForTimeout(120);
  await fingerSwipeX(page, 320, 60, 150); // a quick swipe to the left: the next reel (the ad, skipped)
  await page.waitForFunction(() => window.fakeStory === 'friend_two', null, { timeout: 4000 });
  await page.waitForTimeout(900);
  await fingerSwipeX(page, 60, 320, 150); // to the right: back, through the ad
  await page.waitForFunction(() => window.fakeStory === 'friend_one', null, { timeout: 4000 });
  await page.waitForTimeout(1200);
  let fx = await phone(page);
  assert.equal(fx.path, '/stories/friend_one/112/');
  assert.equal(fx.pausedByOthers, 0);
  // Instagram's own rules: a swipe over 500 ms, or a tap held 200 ms, moves nothing.
  await fingerSwipeX(page, 320, 60, 800);
  await page.waitForTimeout(1000);
  await fingerTap(page, RIGHT, 420, 350);
  await page.waitForTimeout(1000);
  fx = await phone(page);
  assert.equal(fx.path, '/stories/friend_one/112/', 'Instagram took neither');
  assert.equal(fx.ignoredTaps, 1);
  const report = await page.evaluate(() => window.__LMW__.buildReport());
  assert.match(report, /stories: your swipe to the left didn't move the story \(\d+ ms: Instagram only takes swipes of up to 500 ms\)/);
  assert.match(report, /stories: your tap on the right didn't move the story \(held \d+ ms: Instagram takes that for a pause, not a tap\)/);
});

test('with pinch to zoom, no double-tap zoom (taps through stories stay taps), and a zoom is undone on the next story', async () => {
  const page = await open(browser, '/');
  const touchAction = () => page.evaluate(() => getComputedStyle(document.documentElement).touchAction);
  assert.equal(await touchAction(), 'manipulation', 'panning and pinching, no double-tap zoom');
  await page.evaluate(() => window.fake.openPhoneStories(0));
  await page.waitForTimeout(300);
  assert.ok((await pinch(page)) > 2, 'two fingers zoom the story');
  await page.evaluate(() => document.querySelector('section [data-fx="zone-next"]').click()); // the next story
  await page.waitForTimeout(700);
  assert.ok((await page.evaluate(() => window.visualViewport.scale)) < 1.05, 'back to its size');
  assert.match(await viewportTag(page), /maximum-scale=5/, 'and two fingers zoom again');
  assert.match(await page.evaluate(() => window.__LMW__.buildReport()), /zoom 2\.\d undone \(the address changed\), now 1\.0/);

  const off = await open(browser, '/', { settings: { pinchZoom: false } });
  assert.equal(await off.evaluate(() => getComputedStyle(document.documentElement).touchAction), 'auto', 'Instagram’s own, with the switch off');
});

test('"Small boxes" test switch: hidden reels shrink, and a feed that measures again on a resize doesn’t jump', async () => {
  const settings = { feedReels: true, smallCovers: true };
  const page = await open(browser, '/?fake=virtual&remeasure=resize', { settings });
  await page.waitForTimeout(800); // the first reel's link arrives, then the filter asks for a new measure
  assert.ok((await height(page, 'v1')) <= 40, 'a small box');
  await expectVisible(page, ['v1'], false);
  assert.deepEqual(await scrollAndFindJumps(page, 70), [], 'no jump');
  // Why it's only a test: a feed that never measures again still jumps with small boxes.
  const stubborn = await open(browser, '/?fake=virtual', { settings });
  assert.notDeepEqual(await scrollAndFindJumps(stubborn, 70), []);
});

test('a story opened from the feed leaves hidden reels hidden, so the feed doesn’t move underneath', async () => {
  const page = await open(browser, '/', { settings: { feedReels: true } });
  const where = () => page.evaluate(() => ({ y: scrollY, h: document.documentElement.scrollHeight }));
  await page.evaluate(() => {
    document.body.style.paddingBottom = '3000px';
    window.scrollTo(0, 300);
  });
  const before = await where();
  const reelHeight = await height(page, 'post-reel');
  await page.evaluate(() => window.fake.openStory());
  await page.waitForTimeout(100);
  await expectVisible(page, ['post-reel'], false); // still covered under the story, so its video can't play
  assert.equal(await height(page, 'post-reel'), reelHeight);
  assert.deepEqual(await where(), before, 'the feed underneath didn’t change');
  await page.evaluate(() => history.back());
  await page.waitForTimeout(100);
  assert.equal(await path(page), '/');
  await expectVisible(page, ['post-reel'], false);
  assert.deepEqual(await where(), before, 'back where you were');
});

// Keeps scrolling to the end of the page, like a finger, until `done` is true in the page.
async function scrollUntil(page, done, ms = 15000) {
  const until = Date.now() + ms;
  while (!(await page.evaluate(done)) && Date.now() < until) {
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(200);
  }
  return page.evaluate(done);
}

test('endless feed: hidden posts keep their size, so Instagram loads more as you scroll', async () => {
  const page = await open(browser, '/?fake=endless&hl=it');
  assert.equal(await scrollUntil(page, () => window.fakeBatchesLoaded === 3), true, 'every batch loaded');
  await expectVisible(page, ['first-friend', 'late-friend'], true);
  await expectVisible(page, ['sugg-1', 'sugg-5', 'sugg-9'], false);
});

// Scrolls down like a finger, step by step, and lists every time the post (or `item`) at the
// top of the screen didn't move by exactly the step: the feed jumped.
async function scrollAndFindJumps(page, steps, step = 120, item = 'article') {
  return page.evaluate(
    async ([steps, step, item]) => {
      const jumps = [];
      const topPost = () => {
        for (const a of document.querySelectorAll(item)) {
          const r = a.getBoundingClientRect();
          if (r.bottom > 0 && r.height > 1) return [a, r.top];
        }
        return [null, 0];
      };
      for (let k = 0; k < steps; k++) {
        const [post, before] = topPost();
        const y = window.scrollY;
        window.scrollBy(0, step);
        await new Promise((r) => setTimeout(r, 80));
        const moved = window.scrollY - y;
        if (post && post.isConnected) {
          const after = post.getBoundingClientRect().top;
          if (Math.abs(after - (before - moved)) > 4) jumps.push(`${post.dataset.fx}: ${Math.round(after - (before - moved))}px`);
        }
      }
      return jumps;
    },
    [steps, step, item],
  );
}

test('in a feed that keeps only nearby posts (like Instagram’s), scrolling past hidden reels never jumps', async () => {
  const page = await open(browser, '/?fake=virtual', { settings: { feedReels: true } });
  await page.waitForTimeout(300); // the first reel's link arrives
  await expectVisible(page, ['v0'], true);
  await expectVisible(page, ['v1'], false);
  assert.deepEqual(await scrollAndFindJumps(page, 70), [], 'the feed stays under your finger');
  const reelsSeen = await page.evaluate(() =>
    [...document.querySelectorAll('article')].filter((a) => a.querySelector('a[href*="/reel/"]') && a.checkVisibility()).length,
  );
  assert.ok(reelsSeen > 0, 'reels further down are in the page too');
  await expectVisible(page, [await page.evaluate(() => document.querySelector('article:has(a[href*="/reel/"])').dataset.fx)], false);
});

// Scrolls the classic home's list until its item `fx` is in the page, then waits for the
// labels Instagram fills in a moment later.
async function scrollToItem(page, fx) {
  await page.evaluate(async (f) => {
    for (let k = 0; k < 400 && !document.querySelector(`[data-fx="${f}"]`); k++) {
      window.scrollBy(0, 200);
      await new Promise((r) => setTimeout(r, 20));
    }
    document.querySelector(`[data-fx="${f}"]`).scrollIntoView({ block: 'center' });
  }, fx);
  await page.waitForTimeout(400);
}

test('Instagram’s classic home: what’s hidden keeps its size however deep it sits, so the feed never jumps back', async () => {
  // 0.4.6 hid part of a "Consigli per te" block (its heading, deep inside many boxes) and a
  // "/reels/" link in it, after Instagram had measured the block: the feed jumped back after
  // every such block, and the posts you'd just seen came back.
  const page = await open(browser, '/?fake=main&hl=it');
  await page.waitForTimeout(400);
  assert.deepEqual(await scrollAndFindJumps(page, 170, 120, '.item'), [], 'the feed stays under your finger');

  const fresh = await open(browser, '/?fake=main&hl=it');
  const plain = await open(browser, '/?fake=main&hl=it', { settings: ALL_OFF });
  await scrollToItem(fresh, 'm3');
  await scrollToItem(plain, 'm3');
  await expectVisible(fresh, ['m1-post', 'm4-post'], true); // a friend's reel and post
  await expectVisible(fresh, ['m2-post', 'm3'], false); // an ad, the whole "Consigli per te" block
  for (const fx of ['m2', 'm3']) assert.equal(await height(fresh, fx), await height(plain, fx), `${fx} keeps its size`);
  await scrollToItem(fresh, 'm25');
  await scrollToItem(plain, 'm25');
  await expectVisible(fresh, ['m24'], true); // "Sei in pari"
  await expectVisible(fresh, ['m23', 'm25-post', 'm26-post'], false); // a "Consigli per te" block, suggested posts
  for (const fx of ['m23', 'm25']) assert.equal(await height(fresh, fx), await height(plain, fx), `${fx} keeps its size`);
  assert.deepEqual(fresh.errors, []);
});

// The filter's listeners that a browser waits for before it scrolls (touches, the wheel).
async function scrollBlockers(page) {
  const cdp = await page.context().newCDPSession(page);
  const found = [];
  for (const expression of ['window', 'document']) {
    const { result } = await cdp.send('Runtime.evaluate', { expression });
    const { listeners } = await cdp.send('DOMDebugger.getEventListeners', { objectId: result.objectId });
    for (const l of listeners) if (['touchstart', 'touchmove', 'wheel', 'mousewheel'].includes(l.type) && !l.passive) found.push(l.type);
  }
  return found.sort();
}

test('Home scrolls without waiting on the filter: it listens to touches and the wheel only where a reel can be', async () => {
  const page = await open(browser, '/');
  assert.deepEqual(await scrollBlockers(page), [], 'nothing holds up scrolling on Home');
  await page.evaluate(() => window.fake.navigate('/reel/DM1/'));
  await page.waitForTimeout(100);
  assert.deepEqual(await scrollBlockers(page), ['touchmove', 'touchstart', 'wheel'], 'on a reel, swiping is stopped');
  await page.evaluate(() => history.back());
  await page.waitForTimeout(400);
  assert.equal(await path(page), '/');
  assert.deepEqual(await scrollBlockers(page), [], 'back on Home, nothing again');
  await page.evaluate(() => (document.body.style.paddingBottom = '3000px'));
  await fingerSwipe(page, 600, 150);
  assert.ok((await page.evaluate(() => window.scrollY)) > 100, 'Home scrolls');

  const off = await open(browser, '/reel/DM1/?fake=reelfeed', { settings: { reelSwipe: false } });
  assert.deepEqual(await scrollBlockers(off), [], 'with the switch off, nowhere');
});

test('endless feed on a slow connection: the filter never makes Instagram load twice, so no post shows up twice', async () => {
  const page = await open(browser, '/?fake=endless&slow=1&hl=it');
  assert.equal(await scrollUntil(page, () => !!document.querySelector('[data-fx="late-friend"]'), 20000), true);
  const copies = await page.evaluate(() => {
    const n = {};
    for (const a of document.querySelectorAll('article')) n[a.dataset.fx] = (n[a.dataset.fx] || 0) + 1;
    return n;
  });
  for (const [fx, n] of Object.entries(copies)) assert.equal(n, 1, `${fx} shows up once`);
  assert.equal(await page.evaluate(() => window.fakeLoadsStarted), 2, 'one load per batch');
  await expectVisible(page, ['first-friend', 'late-friend'], true);
});

test('notifications stay; only the "Suggeriti per te" section under them is hidden', async () => {
  const page = await open(browser, '/notifications/?hl=it');
  await expectVisible(page, ['notif-list', 'notif-yesterday', 'notif-week'], true);
  await expectVisible(page, ['notif-sugg-heading', 'notif-sugg-list', 'notif-see-all'], false);
});

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

test('on a reel you opened, swiping on to other reels is blocked even when the address doesn’t change', async () => {
  const page = await open(browser, '/reel/DM1/?fake=reelfeed');
  const list = () => page.evaluate(() => document.querySelector('[data-fx="reel-list"]').scrollTop);
  await page.waitForTimeout(3000); // watching it for a few seconds
  await page.evaluate(() => document.querySelector('[data-fx="reel-list"]').scrollBy(0, window.innerHeight)); // a swipe
  await page.waitForTimeout(800);
  assert.equal(await path(page), '/reel/DM1/', 'Instagram didn’t change the address');
  assert.equal(await blockedShown(page), true, 'the next reel is blocked');
  assert.match(await blockedMessage(page), /Moving on to other reels is switched off/);
  await tapGoBack(page);
  await page.waitForTimeout(500);
  assert.equal(await blockedShown(page), false);
  assert.equal(await list(), 0, 'Go back: on your reel again');
  await page.waitForTimeout(800);
  assert.equal(await blockedShown(page), false, 'and you can keep watching it');
  assert.match(await page.evaluate(() => window.__LMW__.buildReport()), /reel page: another reel came up, blocked/);
});

test('on a reel you opened, a finger swipe never moves on: not the page, not Instagram’s own code', async () => {
  const page = await open(browser, '/reel/DM1/?fake=reelfeed');
  const state = () =>
    page.evaluate(() => ({ top: document.querySelector('[data-fx="reel-list"]').scrollTop, code: window.fakeCodeSwipes }));
  assert.equal(await shieldShown(page), true, 'the shield is over the reel');
  await page.waitForTimeout(3000); // watching it for a few seconds first
  await fingerSwipe(page, 600, 120);
  assert.deepEqual(await state(), { top: 0, code: 0 }, 'still on the reel you opened');
  await page.waitForTimeout(2000);
  await fingerSwipe(page, 640, 80); // and again, later, a longer one
  await fingerSwipe(page, 120, 640); // and down
  assert.deepEqual(await state(), { top: 0, code: 0 });
  await page.mouse.wheel(0, 800); // the wheel and the keys too
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('j');
  await page.waitForTimeout(500);
  assert.deepEqual(await state(), { top: 0, code: 0 });
  assert.equal(await blockedShown(page), false, 'nothing moved, so nothing to block');
  assert.match(await page.evaluate(() => window.__LMW__.buildReport()), /reel: a swipe was stopped, Instagram never saw it/);
  assert.match(await page.evaluate(() => window.__LMW__.buildReport()), /the reel page:\n {2}main role=main/);
});

test('on a reel, your taps reach Instagram’s own buttons: sound, like, description, share, comments; the reel never moves', async () => {
  const page = await open(browser, '/direct/t/123/?fake=reelfeed'); // reels open in the swipeable viewer
  await tap(page, 'dm-reel-link');
  assert.equal(await path(page), '/reel/DM1/');
  await page.waitForTimeout(400);
  assert.equal(await shieldShown(page), true);
  const centre = (fx) =>
    page.evaluate((f) => {
      const r = document.querySelector(`[data-fx="${f}"]`).getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }, fx);
  const fingerTap = async (fx) => {
    const c = await centre(fx);
    await page.touchscreen.tap(c.x, c.y);
    await page.waitForTimeout(200);
  };
  const reel = () =>
    page.evaluate(() => ({
      top: document.querySelector('[data-fx="reel-list"]').scrollTop,
      code: window.fakeCodeSwipes,
      reply: !!window.fakeReplyOpened,
    }));
  const fake = (name) => page.evaluate((n) => window[n], name);

  await page.touchscreen.tap(180, 200); // the reel itself (Instagram: sound on/off)
  assert.equal(await fake('fakeTaps'), 1);
  await fingerTap('reel-like-0');
  assert.equal(await fake('fakeLikes'), 1, 'like');
  await page.mouse.dblclick(180, 200); // a double tap on the reel (Instagram: like)
  assert.equal(await fake('fakeDoubleTaps'), 1, 'double tap');
  await fingerTap('reel-more-0');
  assert.equal(await fake('fakeCaptionOpen'), true, 'the whole description');

  // Share: the people to send it to, in a list that scrolls; Invia sends it.
  await fingerTap('reel-share-0');
  const shareList = () => page.evaluate(() => document.querySelector('[data-fx="share-sheet"]').scrollTop);
  await fingerSwipe(page, 640, 420);
  assert.ok((await shareList()) > 100, 'the list of people scrolls');
  await fingerTap('share-send-9');
  assert.equal(await fake('fakeSent'), 'share-send-9', 'sent');

  // Comments: they scroll, and you can write one (the keyboard opens because you tapped the box).
  await fingerTap('reel-comments-0');
  const comments = () => page.evaluate(() => document.querySelector('[data-fx="comments-sheet"]').scrollTop);
  await fingerSwipe(page, 620, 400);
  const scrolled = await comments();
  assert.ok(scrolled > 100, 'the comments scroll');
  await page.waitForTimeout(1500);
  assert.ok((await comments()) >= scrolled, 'and glide on a little');
  await page.evaluate(() => (document.querySelector('[data-fx="comments-sheet"]').scrollTop = 0));
  await fingerTap('comment-box');
  assert.equal(await page.evaluate(() => document.activeElement.dataset.fx), 'comment-box');
  await page.keyboard.type('bello j k');
  await page.waitForTimeout(1600);
  assert.equal(await page.evaluate(() => document.activeElement.dataset.fx), 'comment-box', 'the box you tapped stays open');
  assert.equal(await page.evaluate(() => document.querySelector('[data-fx="comment-box"]').value), 'bello j k', 'typing works, spaces and j/k too');

  assert.deepEqual(await reel(), { top: 0, code: 0, reply: false }, 'through all of it, still on the reel you opened');

  // A swipe on the reel itself (above the sheet) still moves nothing.
  await fingerSwipe(page, 300, 60);
  assert.deepEqual(await reel(), { top: 0, code: 0, reply: false });

  // Back (Android's back button, or Instagram's own): the chat, where everything works as usual.
  await page.evaluate(() => document.querySelector('[data-fx="comments-sheet"]').remove()); // Instagram closes it on leaving
  await page.goBack();
  await page.waitForTimeout(400);
  assert.equal(await path(page), '/direct/t/123/');
  assert.equal(await shieldShown(page), false);
  await page.evaluate(() => (document.body.style.paddingBottom = '3000px'));
  await fingerSwipe(page, 600, 150);
  assert.ok((await page.evaluate(() => window.scrollY)) > 100, 'the chat scrolls');
});

test('on a reel, a link you tap reaches Instagram: a name opens, another reel stays blocked', async () => {
  const page = await open(browser, '/reel/DM1/?fake=reelfeed');
  await page.waitForTimeout(400);
  const link = await page.evaluate(() => {
    const r = document.querySelector('[data-fx="topbar"] a[href="/"]').getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  await page.touchscreen.tap(link.x, link.y);
  await page.waitForTimeout(300);
  assert.equal(await path(page), '/', 'the link under your finger opened');
  assert.equal(await shieldShown(page), false);

  const other = await open(browser, '/reel/DM1/?fake=reelfeed');
  await other.waitForTimeout(400);
  const next = await other.evaluate(() => {
    const a = document.querySelector('[data-fx="reel-item-0"] a');
    a.setAttribute('href', '/reel/NEXT1/'); // a link to another reel, on screen
    a.style.cssText = 'position:absolute;left:8px;top:30vh;padding:10px;background:#fff';
    const r = a.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  await other.touchscreen.tap(next.x, next.y);
  await other.waitForTimeout(300);
  assert.equal(await path(other), '/reel/DM1/');
  assert.equal(await blockedShown(other), true, 'another reel: blocked, as before');
});

test('the settings button stays above the shield, and its panel works', async () => {
  const page = await open(browser, '/reel/DM1/?fake=reelfeed');
  assert.equal(await shieldShown(page), true);
  assert.equal(await gearShown(page), true);
  const gear = await gearAt(page);
  await page.touchscreen.tap(gear.x, gear.y);
  assert.equal(await panelShown(page), true);
  await enterCode(page, TEST_CODE);
  assert.match(await lockMessage(page), /Unlocked/);
});

for (const [after, address] of [['direct', '/direct/t/123/'], ['post', '/p/DM1/']]) {
  test(`on a reel you opened, swiping stays stopped when Instagram changes the address after a moment (${after})`, async () => {
    const page = await open(browser, `/reel/DM1/?fake=reelfeed&after=${after}`);
    const state = () =>
      page.evaluate(() => ({ top: document.querySelector('[data-fx="reel-list"]').scrollTop, code: window.fakeCodeSwipes }));
    await page.waitForTimeout(2600);
    assert.equal(await path(page), address, 'the address changed, the reel is still on screen');
    await fingerSwipe(page, 600, 120);
    assert.deepEqual(await state(), { top: 0, code: 0 }, 'still on the reel you opened');
    await page.evaluate(() => document.querySelector('[data-fx="reel-list"]').scrollBy(0, window.innerHeight)); // if it moved anyway
    await page.waitForTimeout(800);
    assert.equal(await blockedShown(page), true, 'the backstop still knows your reel');
  });
}

test('a DM chat without a reel on screen scrolls as usual, and typing works with the keyboard up', async () => {
  const page = await open(browser, '/direct/t/123/');
  await page.evaluate(() => (document.body.style.paddingBottom = '3000px'));
  await fingerSwipe(page, 600, 150);
  assert.ok((await page.evaluate(() => window.scrollY)) > 100);
  // A video sent in the chat, the keyboard up (a shorter screen): no shield, the text box stays.
  await page.evaluate(() => document.querySelector('[data-fx="dm-video"]').scrollIntoView({ block: 'start' }));
  await page.focus('[data-fx="composer"]');
  await page.setViewportSize({ width: 390, height: 380 });
  await page.waitForTimeout(500);
  await page.focus('[data-fx="composer"]');
  await page.keyboard.type('see you');
  await page.waitForTimeout(300);
  assert.equal(await shieldShown(page), false);
  assert.equal(await page.evaluate(() => document.activeElement.dataset.fx), 'composer');
  assert.equal(await page.evaluate(() => document.querySelector('[data-fx="composer"]').value), 'see you');
});

test('on a reel, no swipe or long press opens the reply box (no keyboard); a text box Instagram opens itself is closed', async () => {
  const page = await open(browser, '/reel/DM1/?fake=reelfeed');
  const state = () =>
    page.evaluate(() => ({
      top: document.querySelector('[data-fx="reel-list"]').scrollTop,
      code: window.fakeCodeSwipes,
      reply: !!window.fakeReplyOpened,
    }));
  await page.waitForTimeout(2000);
  await fingerSwipe(page, 600, 120);
  await fingerSwipe(page, 600, 560); // a little way up
  await fingerHold(page, 400, 900); // a finger held still
  assert.deepEqual(await state(), { top: 0, code: 0, reply: false }, 'no next reel, no reply box');

  // Instagram opening a text box by itself (the keyboard would come up): closed at once.
  await page.evaluate(() => {
    document.body.insertAdjacentHTML('beforeend', '<div style="position:fixed;left:0;right:0;bottom:0"><textarea data-fx="typing"></textarea></div>');
    document.querySelector('[data-fx="typing"]').focus();
  });
  assert.equal(await page.evaluate(() => document.activeElement.tagName), 'BODY', 'no text box open over the reel');
  assert.match(await page.evaluate(() => window.__LMW__.buildReport()), /reel: Instagram opened a text box by itself, closed it \(no keyboard\)/);

  // A shorter screen (as with the keyboard up): swiping still doesn't move on.
  await page.setViewportSize({ width: 390, height: 380 });
  await page.waitForTimeout(400);
  await fingerSwipe(page, 300, 60);
  const after = await state();
  assert.deepEqual([after.top, after.code], [0, 0], 'still on the reel you opened');
});

test('Instagram’s full viewer opening over the reel a moment later: swiping still doesn’t exist, no keyboard', async () => {
  // As 0.4.4 let through: the reel's page first, then Instagram's viewer over it, in a dialog.
  const page = await open(browser, '/reel/DM1/?fake=reelpost');
  const state = () =>
    page.evaluate(() => {
      const list = document.querySelector('[data-fx="reel-viewer"] [data-fx="reel-list"]');
      return { viewer: !!list, top: list ? list.scrollTop : 0, code: window.fakeCodeSwipes || 0, reply: !!window.fakeReplyOpened };
    });
  await fingerSwipe(page, 600, 120);
  await page.waitForTimeout(2500); // the viewer opens over the reel
  assert.equal((await state()).viewer, true);
  await fingerSwipe(page, 600, 120);
  await page.waitForTimeout(5000);
  await fingerSwipe(page, 640, 80);
  await fingerHold(page, 400, 900);
  assert.deepEqual(await state(), { viewer: true, top: 0, code: 0, reply: false }, 'no next reel, no reply box');
  assert.equal(await page.evaluate(() => document.activeElement.tagName), 'BODY');
  assert.equal(await blockedShown(page), false);
  assert.equal(await shieldShown(page), true);
});

test('swipes elsewhere are left alone: Home scrolls, and with the switch off a reel page does too', async () => {
  const home = await open(browser, '/');
  await home.evaluate(() => (document.body.style.paddingBottom = '3000px'));
  await fingerSwipe(home, 600, 150);
  assert.ok((await home.evaluate(() => window.scrollY)) > 100, 'Home scrolls');

  const off = await open(browser, '/reel/DM1/?fake=reelfeed', { settings: { reelSwipe: false } });
  assert.equal(await shieldShown(off), false, 'no shield with the switch off');
  await fingerSwipe(off, 600, 120);
  assert.ok((await off.evaluate(() => document.querySelector('[data-fx="reel-list"]').scrollTop)) > 100);
});

test('on a reel you opened: Instagram drawing it again isn’t a swipe; with the switch off, swiping works', async () => {
  const page = await open(browser, '/reel/DM1/?fake=reelfeed');
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    const v = document.querySelector('[data-fx="reel-video-0"]');
    v.replaceWith(v.cloneNode());
  });
  await page.waitForTimeout(800);
  assert.equal(await blockedShown(page), false);

  const off = await open(browser, '/reel/DM1/?fake=reelfeed', { settings: { reelSwipe: false } });
  await off.waitForTimeout(800);
  await off.evaluate(() => document.querySelector('[data-fx="reel-list"]').scrollBy(0, window.innerHeight));
  await off.waitForTimeout(800);
  assert.equal(await blockedShown(off), false);
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

test('settings panel (Safari): the switches are locked with the code, and lock again when it closes', async () => {
  const page = await open(browser, '/');
  await tapGear(page);
  assert.equal(await switchesLocked(page), true, 'locked when it opens');
  assert.equal(await flipSwitch(page, 'ads'), true, 'a locked switch doesn’t move');
  assert.equal(await flipSwitch(page, 'smallCovers'), true, 'display switches stay free: they turn nothing back on');
  assert.equal(await flipSwitch(page, 'smallCovers'), false);
  assert.equal(await flipSwitch(page, 'feedReels'), true, 'so does the one for friends’ reels');
  assert.equal(await visible(page, 'post-reel'), false, 'and it applies at once');
  assert.equal(await flipSwitch(page, 'feedReels'), false);
  await expectVisible(page, ['post-reel'], true);
  await expectVisible(page, ['suggested-post'], false); // suggestions stay hidden: that switch is locked
  assert.equal(await visible(page, 'ad-en'), false);
  await enterCode(page, '1357');
  assert.equal(await switchesLocked(page), true);
  assert.match(await lockMessage(page), /Wrong code/);
  await enterCode(page, TEST_CODE);
  assert.equal(await switchesLocked(page), false, 'the right code unlocks them');
  await closePanel(page);
  await tapGear(page);
  assert.equal(await switchesLocked(page), true, 'locked again after closing');
  const report = await page.evaluate(() => window.__LMW__.buildReport());
  assert.match(report, /switches unlocked/);
  assert.ok(!report.includes(TEST_CODE) && !report.includes('1357'), 'codes never go in the report');
});

test('settings panel (Safari): the button opens it, switches apply at once and are remembered', async () => {
  const page = await open(browser, '/');
  assert.equal(await gearShown(page), true);
  await tapGear(page);
  assert.equal(await panelShown(page), true);
  await enterCode(page, TEST_CODE);
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

  const home = await open(browser, '/?hl=it');
  const homeReport = await home.evaluate(() => window.__LMW__.buildReport());
  assert.match(homeReport, /page: home {3}path: \/\n/);
  assert.match(homeReport, /hidden by labels: .*ads×/);
  assert.match(homeReport, /href=\/\{user\}\//);
  assert.match(homeReport, /href=\/\{user\}\/p\/\{id\}\//);
  assert.ok(!/friend_one|stranger|shop_brand/.test(homeReport), 'usernames in links are masked');
  assert.ok(!homeReport.includes('lovely day at the beach'), 'captions are left out');
  // Names that only appear as plain text (story tray, suggested accounts) are masked too.
  for (const name of ['story_anna', 'storybob', 'story_carla', 'Mario Rossi', 'Luisa Bianchi', 'claudia.mangia', 'mario_r']) {
    assert.ok(!homeReport.includes(name), `${name} is masked`);
  }
  assert.match(homeReport, /aria="Storia di \{…\}, vista"/, 'the label structure stays readable');
  assert.match(homeReport, /"Consigli per te"/, 'known labels are kept');
  assert.match(homeReport, /"Segui"/, 'repeated interface words are kept');
  assert.match(homeReport, /‹\d+ chars›/, 'one-off texts become a length');
  assert.ok(!/^body\n\s*… \d+ more/m.test(homeReport), 'skipped tags are not counted');

  const dm = await open(browser, '/direct/t/123/');
  const dmReport = await dm.evaluate(() => window.__LMW__.buildReport());
  assert.ok(!dmReport.includes('see you at 8'), 'DM messages are left out');
});

test('problem report: a timeline of what happened, in numbers and kinds of page only', async () => {
  const page = await open(browser, '/', { settings: { feedReels: true } });
  await page.evaluate(() => (document.body.style.paddingBottom = '4000px'));
  await page.evaluate(() => window.scrollTo(0, 2500)); // as if the page jumped by itself
  await page.waitForTimeout(100);
  await page.evaluate(() => window.fake.openStory());
  await page.evaluate(() => history.back());
  await page.waitForTimeout(100);
  const report = await page.evaluate(() => window.__LMW__.buildReport());
  const timeline = report.slice(report.indexOf('what happened'), report.indexOf('\n---\n'));
  assert.match(timeline, /start 0\.\d+\.\d+ safari, home\n/);
  assert.match(timeline, /posts \+\d+/);
  assert.match(timeline, /scroll jumped \+2500/);
  assert.match(timeline, /page stories/);
  assert.match(timeline, /kept 1 hidden post hidden/);
  assert.ok(!/friend|stranger|brand/.test(timeline), 'no names, only numbers');

  // After a reload, the report still shows what happened before it.
  await page.reload();
  await page.waitForTimeout(100);
  const after = await page.evaluate(() => window.__LMW__.buildReport());
  const before = after.slice(after.indexOf('the page load before this one'), after.indexOf('\n---\n'));
  assert.match(before, /scroll jumped \+2500/);
  assert.match(before, /page stories/);
});

test('inside the Android app: settings, reports and page changes go through the app', async () => {
  const page = await open(browser, '/', { app: { ...ALL_OFF, ads: true, showGear: false } });
  await expectVisible(page, ['ad-en'], false);
  await expectVisible(page, ['post-reel'], true);

  // The settings button can't be hidden in the app (it's the way to the app's settings),
  // and it asks the app to open its own settings screen instead of the in-page panel.
  assert.equal(await gearShown(page), true);
  await tapGear(page);
  assert.equal(await panelShown(page), false);

  await page.evaluate(() => window.__LMW__.sendReport());
  await page.evaluate(() => window.fake.navigate('/direct/inbox/'));
  const messages = await page.evaluate(() => window.__appMessages);
  assert.ok(messages.some((m) => m.source === 'lmw' && m.type === 'openSettings'));
  const report = messages.find((m) => m.type === 'report');
  assert.ok(report && report.text.includes('Let Me Wonder problem report'));
  const pages = messages.filter((m) => m.type === 'page').map((m) => m.allowedPath);
  assert.deepEqual(pages.slice(-2), ['/', '/direct/inbox/'], 'the app hears about each page');
  assert.equal(await page.evaluate(() => localStorage.getItem('lmw-settings-v1')), null, 'the app keeps settings itself');
});
