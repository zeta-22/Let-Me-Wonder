// The code that unlocks the switches: the same on every phone, for good, so turning the
// filter off takes a deliberate step. Shared by the filter (Safari) and the Android app.
//
// The repository is public, so only the code's fingerprint is here (SHA-256 of SALT +
// the code), not the code. A short code can still be worked out from it by someone
// determined: this is a brake, not a safe. To change the code, put the new fingerprint in
// CODE_HASH (node -e "console.log(require('crypto').createHash('sha256').update(SALT + code).digest('hex'))").

const SALT = 'let-me-wonder:settings-code:v1:';
const CODE_HASH = 'd198ba61a4409fe62c7b0fba5ba568cd99e5203d5b670b307a6b09e1e46ff67b';
const MAX_WRONG = 5; // wrong codes in a row before a wait
const WAIT_MS = 30000;

// SHA-256 of an ASCII text, as hex. Small and synchronous, so it runs the same in the page
// and in the app (which has no crypto library built in).
export function sha256(text) {
  const k = [];
  const h = [];
  for (let n = 2, found = 0; found < 64; n++) {
    let prime = true;
    for (let d = 2; d * d <= n; d++) if (n % d === 0) prime = false;
    if (!prime) continue;
    if (found < 8) h[found] = (Math.sqrt(n) * 2 ** 32) | 0;
    k[found++] = (Math.cbrt(n) * 2 ** 32) | 0;
  }
  const bytes = [];
  for (let i = 0; i < text.length; i++) bytes.push(text.charCodeAt(i) & 0xff);
  const bits = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  for (let i = 7; i >= 0; i--) bytes.push(i >= 4 ? 0 : (bits >>> (i * 8)) & 0xff);
  const rotr = (x, n) => (x >>> n) | (x << (32 - n));
  for (let off = 0; off < bytes.length; off += 64) {
    const w = [];
    for (let i = 0; i < 16; i++) {
      w[i] = (bytes[off + i * 4] << 24) | (bytes[off + i * 4 + 1] << 16) | (bytes[off + i * 4 + 2] << 8) | bytes[off + i * 4 + 3];
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const t1 = (hh + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + k[i] + w[i]) | 0;
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
      hh = g;
      g = f;
      f = e;
      e = (d + t1) | 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) | 0;
    }
    [a, b, c, d, e, f, g, hh].forEach((v, i) => (h[i] = (h[i] + v) | 0));
  }
  return h.map((v) => (v >>> 0).toString(16).padStart(8, '0')).join('');
}

export function fingerprint(code) {
  return sha256(SALT + code);
}

// `hash` is only for the tests, which use a code of their own.
export function isCode(code, hash = CODE_HASH) {
  return /^\d{1,12}$/.test(String(code)) && fingerprint(code) === hash;
}

// Tries codes, with a wait after too many wrong ones in a row. Returns { ok } or
// { ok: false, wait } (seconds to wait before trying again).
export function createLock({ check = isCode, now = () => Date.now() } = {}) {
  let wrong = 0;
  let waitUntil = 0;
  return {
    tryCode(code) {
      const t = now();
      if (t < waitUntil) return { ok: false, wait: Math.ceil((waitUntil - t) / 1000) };
      if (check(code)) {
        wrong = 0;
        return { ok: true };
      }
      wrong++;
      if (wrong < MAX_WRONG) return { ok: false };
      wrong = 0;
      waitUntil = t + WAIT_MS;
      return { ok: false, wait: WAIT_MS / 1000 };
    },
  };
}
