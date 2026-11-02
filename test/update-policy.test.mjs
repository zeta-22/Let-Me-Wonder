// Checks for when the Android app installs a downloaded update (src/mobile/updatePolicy.js).
// Run with: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { AWAY_MS, OPENING_MS, createUpdatePolicy } from '../src/mobile/updatePolicy.js';

function clock() {
  let t = 1000;
  const now = () => t;
  now.pass = (ms) => (t += ms);
  return now;
}

test('an update downloaded just after opening the app is installed right away', () => {
  const now = clock();
  const policy = createUpdatePolicy(now);
  now.pass(4000); // Expo's own check at launch takes a few seconds
  assert.equal(policy.downloaded('/'), 'install');
});

test('one downloaded later waits for the next opening, then is installed', () => {
  const now = clock();
  const policy = createUpdatePolicy(now);
  now.pass(OPENING_MS + 1000);
  assert.equal(policy.downloaded('/friend_one/'), null, "not while you're using the app");
  policy.left();
  now.pass(AWAY_MS + 1000);
  assert.equal(policy.returned('/friend_one/'), 'install');
});

test('coming back after a while looks for an update, and one ready soon after is installed', () => {
  const now = clock();
  const policy = createUpdatePolicy(now);
  now.pass(10 * 60000);
  policy.left();
  now.pass(5 * 60000);
  assert.equal(policy.returned('/'), 'check');
  now.pass(3000);
  assert.equal(policy.downloaded('/'), 'install');
});

test('a quick trip to another app is not an opening', () => {
  const now = clock();
  const policy = createUpdatePolicy(now);
  now.pass(OPENING_MS + 1000);
  assert.equal(policy.downloaded('/'), null);
  policy.left();
  now.pass(AWAY_MS - 5000); // e.g. picking a photo, or a look at another app
  assert.equal(policy.returned('/'), null);
  now.pass(2000);
  assert.equal(policy.downloaded('/'), null, 'the opening was long ago');
});

test('never while writing a message, making a post or a story, or logging in', () => {
  for (const path of ['/direct/t/123/', '/direct/inbox/', '/create/style/', '/stories/create/', '/accounts/login/']) {
    const now = clock();
    const policy = createUpdatePolicy(now);
    now.pass(3000);
    assert.equal(policy.downloaded(path), null, `${path}: just opened`);
    policy.left();
    now.pass(AWAY_MS + 1000);
    assert.equal(policy.returned(path), 'check', `${path}: back after a while`);
    policy.left();
    now.pass(AWAY_MS + 1000);
    assert.equal(policy.returned('/'), 'install', `${path}: then back on the home page`);
  }
});

test('stories, posts, profiles and a reel are fine to reload when you just opened the app', () => {
  for (const path of ['/', '/stories/friend_one/111/', '/p/AAA/', '/friend_one/', '/reel/AAA/', '/explore/search/']) {
    const now = clock();
    assert.equal(createUpdatePolicy(now).downloaded(path), 'install', path);
  }
});
