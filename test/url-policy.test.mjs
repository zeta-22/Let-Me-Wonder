// Checks for what the Android app does when the page wants to load a new address
// (src/mobile/urlPolicy.js). Run with: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { decideUrl } from '../src/mobile/urlPolicy.js';

const ON = {
  reelsTab: true, feedReels: true, explore: true, suggested: true, ads: true, reelSwipe: true,
};
const OFF = Object.fromEntries(Object.keys(ON).map((k) => [k, false]));
const at = (url, fromPath = '/', settings = ON) => decideUrl(url, { fromPath, settings });

test('normal Instagram pages load in the app, the home page as it is', () => {
  for (const url of [
    'https://www.instagram.com/',
    'https://www.instagram.com/?variant=following',
    'https://www.instagram.com/direct/inbox/',
    'https://www.instagram.com/friend_one/',
    'https://www.instagram.com/p/AAA/',
    'https://www.instagram.com/explore/search/',
    'https://instagram.com/accounts/login/',
    'https://accountscenter.instagram.com/',
  ]) {
    assert.deepEqual(at(url), { action: 'allow' }, url);
  }
});

test('blocked pages are stopped, each by its own switch', () => {
  assert.deepEqual(at('https://www.instagram.com/reels/'), { action: 'block', toggle: 'reelsTab' });
  assert.deepEqual(at('https://www.instagram.com/reels/ABC/'), { action: 'block', toggle: 'reelsTab' });
  assert.deepEqual(at('https://www.instagram.com/friend_one/reels/'), { action: 'block', toggle: 'reelsTab' });
  assert.deepEqual(at('https://www.instagram.com/explore/tags/cats/'), { action: 'block', toggle: 'explore' });
  assert.deepEqual(at('https://www.instagram.com/explore/people/'), { action: 'block', toggle: 'suggested' });
});

test('with the switches off, those pages load', () => {
  assert.deepEqual(at('https://www.instagram.com/reels/', '/', OFF), { action: 'allow' });
  assert.deepEqual(at('https://www.instagram.com/explore/tags/cats/', '/', OFF), { action: 'allow' });
});

test('a reel opens from DMs, but not straight after another reel', () => {
  assert.deepEqual(at('https://www.instagram.com/reel/B/', '/direct/t/1/'), { action: 'allow' });
  assert.deepEqual(at('https://www.instagram.com/reel/B/', '/reel/A/'), { action: 'block', toggle: 'reelSwipe' });
  assert.deepEqual(at('https://www.instagram.com/reel/A/', '/reel/A/'), { action: 'allow' });
  assert.deepEqual(at('https://www.instagram.com/reel/B/', '/reel/A/', { ...ON, reelSwipe: false }), { action: 'allow' });
});

test('links to other websites open in the phone browser', () => {
  assert.deepEqual(at('https://example.com/page'), { action: 'external', url: 'https://example.com/page' });
  assert.deepEqual(at('https://l.instagram.com/?u=https%3A%2F%2Fexample.com%2Fshop&e=x'), {
    action: 'external',
    url: 'https://example.com/shop',
  });
  assert.deepEqual(at('mailto:hello@example.com'), { action: 'external', url: 'mailto:hello@example.com' });
});

test('"open in the Instagram app" links are ignored; Facebook login stays inside', () => {
  assert.deepEqual(at('intent://instagram.com/_n/mainfeed/#Intent;package=com.instagram.android;scheme=https;end'), {
    action: 'ignore',
  });
  assert.deepEqual(at('instagram://user?username=someone'), { action: 'ignore' });
  assert.deepEqual(at('https://www.facebook.com/login.php?next=x'), { action: 'allow' });
  assert.deepEqual(at('about:blank'), { action: 'allow' });
  assert.deepEqual(at('not a url'), { action: 'ignore' });
});
