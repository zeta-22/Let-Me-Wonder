// Decides whether an Instagram page may open. Shared by the in-page filter and
// the Android app (which also checks addresses before loading them).

import { PAGES, ROUTES, REEL_SWIPE } from './rules.js';

const pages = PAGES.map((p) => ({ name: p.name, re: new RegExp(p.path) }));
const routes = ROUTES.map((r) => ({ ...r, re: new RegExp(r.path) }));
const reelRe = new RegExp(REEL_SWIPE.path);

// The kind of page for an address path, e.g. "/" -> "home". See PAGES in rules.js.
export function pageOf(path) {
  for (const p of pages) if (p.re.test(path)) return p.name;
  return 'other';
}

function reelId(path) {
  const m = path && reelRe.exec(path);
  return m ? m[1] : null;
}

// What to do with `path`, given `fromPath` (the last page that was allowed),
// the switches in `settings`, and whether you `tapped` a link to get there.
// Returns one of:
//   { action: 'allow' }
//   { action: 'block', toggle }
//   { action: 'redirect', toggle, to }
export function decide(path, fromPath, settings, { tapped = false } = {}) {
  if (settings[REEL_SWIPE.toggle]) {
    const from = reelId(fromPath);
    const to = reelId(path);
    if (from && to && from !== to) return { action: 'block', toggle: REEL_SWIPE.toggle };
  }
  for (const r of routes) {
    if (!settings[r.toggle]) continue;
    const m = r.re.exec(path);
    if (!m) continue;
    if (r.action === 'redirect' && (tapped || !r.onlyWhenTapped)) {
      return { action: 'redirect', toggle: r.toggle, to: r.to.replace(/\$(\d)/g, (_, i) => m[i] || '') };
    }
    return { action: 'block', toggle: r.toggle };
  }
  return { action: 'allow' };
}
