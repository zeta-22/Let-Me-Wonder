// What happened on the page lately, for "Report a problem": scroll and page-height
// jumps, posts arriving and leaving, page changes, and what the filter itself did
// (nudges, Home taps, Blocked screens). Only numbers and kinds of page, never content
// or names. Kept in memory for this page only, never stored or sent anywhere.

const MAX_LINES = 80;
const JUMP_PX = 400; // a scroll or page-height change this big in one step is noted
const LIST_PX = 100; // so is a change this big in the feed list's padding

const signed = (n) => (n > 0 ? '+' : '') + n;

export function createLog() {
  const lines = [];
  const start = Date.now();
  let lastY = 0;
  let lastHeight = 0;
  let lastPadding = null;
  let fingers = 0;

  function add(text) {
    const s = ((Date.now() - start) / 1000).toFixed(1);
    lines.push(`${s}s y=${Math.round(window.scrollY)} ${text}`);
    if (lines.length > MAX_LINES) lines.shift();
  }

  // The page's own scrolling. A finger moves it a little per frame; a big step at once
  // is the page jumping.
  function onScroll(e) {
    if (e.target !== document) return; // carousels and other boxes scroll on their own
    const y = Math.round(window.scrollY);
    if (Math.abs(y - lastY) >= JUMP_PX) add(`scroll jumped ${signed(y - lastY)}${fingers ? ', finger on screen' : ''}`);
    lastY = y;
  }

  // Called by the filter's timer on the feed: the page getting much taller or shorter at
  // once, and the padding of the list holding the posts (where an app that keeps only
  // the posts near the screen puts the space of the others).
  function checkFeed(list) {
    const h = document.documentElement.scrollHeight;
    if (lastHeight && Math.abs(h - lastHeight) >= JUMP_PX) add(`page height ${signed(h - lastHeight)}, now ${h}`);
    lastHeight = h;
    if (!list) return;
    const style = getComputedStyle(list);
    const padding = [parseFloat(style.paddingTop) || 0, parseFloat(style.paddingBottom) || 0].map(Math.round);
    if (!lastPadding || padding.some((p, i) => Math.abs(p - lastPadding[i]) >= LIST_PX)) {
      if (lastPadding || padding.some(Boolean)) add(`feed list padding top ${padding[0]}, bottom ${padding[1]}`);
      lastPadding = padding;
    }
  }

  const passive = { capture: true, passive: true };
  window.addEventListener('scroll', onScroll, passive);
  window.addEventListener('touchstart', (e) => (fingers = e.touches.length), passive);
  window.addEventListener('touchend', (e) => (fingers = e.touches.length), passive);
  window.addEventListener('touchcancel', () => (fingers = 0), passive);
  document.addEventListener('visibilitychange', () => add(document.hidden ? 'app in the background' : 'app back on screen'));

  return { add, checkFeed, lines: () => lines.slice() };
}
