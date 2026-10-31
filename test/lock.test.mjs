// Automatic checks for the settings lock (src/filter/lock.js), run with: npm test
// The real code isn't in the repository; these checks use a code of their own.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { sha256, fingerprint, isCode, createLock } from '../src/filter/lock.js';

test('its SHA-256 matches the standard one', () => {
  for (const text of ['', 'abc', 'let-me-wonder', 'x'.repeat(55), 'x'.repeat(56), 'x'.repeat(200)]) {
    assert.equal(sha256(text), createHash('sha256').update(text).digest('hex'), `${text.length} characters`);
  }
});

test('only the right code opens it, and only digits count', () => {
  const hash = fingerprint('2468');
  assert.equal(isCode('2468', hash), true);
  for (const wrong of ['2469', '246', '24680', '', 'abcd', '24 68', '２４６８']) assert.equal(isCode(wrong, hash), false, wrong);
  assert.equal(isCode('2468'), false, 'the test code is not the real one');
});

test('after five wrong codes in a row it waits 30 seconds, even for the right one', () => {
  let now = 0;
  const lock = createLock({ check: (c) => isCode(c, fingerprint('2468')), now: () => now });
  for (let i = 0; i < 4; i++) assert.deepEqual(lock.tryCode('1111'), { ok: false });
  assert.deepEqual(lock.tryCode('1111'), { ok: false, wait: 30 });
  now += 10000;
  assert.deepEqual(lock.tryCode('2468'), { ok: false, wait: 20 });
  now += 20000;
  assert.deepEqual(lock.tryCode('2468'), { ok: true });
});
