// "Report a problem": a text outline of the current page, to paste to Claude when
// something slips through. It keeps the page's structure (tags, roles, button
// labels, link patterns) and leaves out personal content:
//   - usernames are replaced with {user}, post and chat ids with {id}
//   - long texts (captions, comments) are dropped; in DMs all message text is dropped
//   - what you type (input boxes) is never read
//   - images are listed without their descriptions

import { CSS_RULES, TOGGLES } from './rules.js';

const HIDE_ATTR = 'data-lmw-hide';
const MAX_LINES = 2500;
const MAX_DEPTH = 45;
const MAX_TEXT = 40;
const REPEAT_SHOWN = 4; // of a long run of similar siblings (a feed), how many are written out

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'LINK', 'META', 'TEMPLATE', 'HEAD']);
const PATH_WORDS = new Set([
  'p', 'reel', 'reels', 'tv', 'explore', 'search', 'tags', 'locations', 'people', 'direct', 'inbox', 't', 'new',
  'stories', 'highlights', 'accounts', 'activity', 'edit', 'login', 'emailsignup', 'password', 'reset', 'onetap',
  'create', 'select', 'style', 'details', 'audio', 'tagged', 'saved', 'comments', 'liked_by', 'followers',
  'following', 'about', 'challenge', 'web', 'your_activity', 'settings', 'notifications',
]);
const ID_AFTER = new Set(['p', 'reel', 'reels', 'tv', 't', 'audio', 'highlights', 'locations', 'tags']);

// "/someone/p/Cx12ab/" -> "/{user}/p/{id}/"
export function redactPath(path) {
  const segs = path.split('/').filter(Boolean);
  const out = segs.map((s, i) => {
    if (PATH_WORDS.has(s)) return s;
    const prev = segs[i - 1];
    if (prev === 'stories') return '{user}';
    if (prev && ID_AFTER.has(prev)) return '{id}';
    return i === 0 ? '{user}' : '{x}';
  });
  return '/' + out.join('/') + (segs.length && path.endsWith('/') ? '/' : '');
}

function redactHref(href) {
  let url;
  try {
    url = new URL(href, location.href);
  } catch (e) {
    return '{bad-link}';
  }
  if (url.origin !== location.origin) return 'ext:' + url.hostname;
  return redactPath(url.pathname);
}

// Usernames seen in profile links on this page, to mask them in texts too.
function collectUsernames() {
  const names = new Set();
  for (const a of document.querySelectorAll('a[href]')) {
    let url;
    try {
      url = new URL(a.getAttribute('href'), location.href);
    } catch (e) {
      continue;
    }
    if (url.origin !== location.origin) continue;
    const segs = url.pathname.split('/').filter(Boolean);
    const candidate = segs[0] === 'stories' ? segs[1] : segs[0];
    if (candidate && !PATH_WORDS.has(candidate) && candidate.length > 1) names.add(candidate.toLowerCase());
  }
  return names;
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function makeMasker(usernames) {
  const list = [...usernames].sort((a, b) => b.length - a.length).map(escapeRe);
  const re = list.length ? new RegExp('(^|[^\\w.])(' + list.join('|') + ')(?![\\w])', 'gi') : null;
  return (text) => {
    let t = text.replace(/@[\w.]+/g, '@{user}');
    if (re) t = t.replace(re, '$1{user}');
    return t;
  };
}

function ownText(el) {
  let t = '';
  for (const n of el.childNodes) if (n.nodeType === 3) t += n.data;
  return t.replace(/\s+/g, ' ').trim();
}

function describe(el, ctx) {
  const tag = el.tagName.toLowerCase();
  const parts = [tag];
  const role = el.getAttribute('role');
  if (role) parts.push('role=' + role);
  const aria = el.getAttribute('aria-label');
  if (aria) parts.push('aria="' + ctx.mask(aria).slice(0, 60) + '"');
  if (tag === 'a' && el.hasAttribute('href')) parts.push('href=' + redactHref(el.getAttribute('href')));
  if (tag === 'input' || tag === 'button') {
    const type = el.getAttribute('type');
    if (type) parts.push('type=' + type);
  }
  if (tag === 'input' || tag === 'textarea') {
    const ph = el.getAttribute('placeholder');
    if (ph) parts.push('placeholder="' + ctx.mask(ph).slice(0, 40) + '"');
  }
  if (tag === 'img' && el.getAttribute('alt')) parts.push('alt=…');
  const hidden = el.getAttribute(HIDE_ATTR);
  if (hidden) parts.push('{hidden:' + hidden + '}');
  if (ctx.allowText && tag !== 'textarea') {
    const text = ownText(el);
    if (text && text.length <= MAX_TEXT) parts.push('"' + ctx.mask(text) + '"');
    else if (text) parts.push('"…' + text.length + ' chars"');
  }
  return parts.join(' ');
}

function signature(el) {
  return el.tagName + '|' + (el.getAttribute('role') || '') + '|' + el.childElementCount;
}

function walk(el, depth, ctx) {
  if (ctx.lines.length >= MAX_LINES) return;
  if (SKIP_TAGS.has(el.tagName) || (el.id && el.id.startsWith('lmw-'))) return;
  const indent = '  '.repeat(depth);
  ctx.lines.push(indent + describe(el, ctx));
  // Don't go inside icons, or deeper than MAX_DEPTH.
  if (el.tagName === 'svg' || el.tagName === 'SVG' || depth >= MAX_DEPTH) return;
  const kids = [...el.children];
  for (let i = 0; i < kids.length; i++) {
    const sig = signature(kids[i]);
    let run = 1;
    while (i + run < kids.length && signature(kids[i + run]) === sig) run++;
    if (run > REPEAT_SHOWN + 2) {
      for (let j = 0; j < REPEAT_SHOWN; j++) walk(kids[i + j], depth + 1, ctx);
      ctx.lines.push(indent + '  … ' + (run - REPEAT_SHOWN) + ' more like the one above');
      i += run - 1;
    } else {
      walk(kids[i], depth + 1, ctx);
    }
  }
}

function cssMatches() {
  const out = [];
  for (const rule of CSS_RULES) {
    for (const sel of rule.css) {
      let n;
      try {
        n = document.querySelectorAll(sel).length;
      } catch (e) {
        n = 'unsupported';
      }
      out.push(`  ${rule.toggle}${rule.page ? ' @' + rule.page : ''}  ${sel}  -> ${n}`);
    }
  }
  return out;
}

export function buildReport({ version, rulesVersion, host, settings, page }) {
  const mask = makeMasker(collectUsernames());
  const hiddenCounts = {};
  for (const el of document.querySelectorAll('[' + HIDE_ATTR + ']')) {
    for (const t of el.getAttribute(HIDE_ATTR).split(/\s+/)) hiddenCounts[t] = (hiddenCounts[t] || 0) + 1;
  }
  const head = [
    'Let Me Wonder problem report',
    `version ${version} · rules ${rulesVersion} · ${host}`,
    `page: ${page}   path: ${redactPath(location.pathname)}`,
    `screen: ${window.innerWidth}x${window.innerHeight}   ${navigator.userAgent}`,
    'switches: ' + TOGGLES.map((t) => `${t.id}=${settings[t.id] ? 'on' : 'off'}`).join(' '),
    'hidden by labels: ' + (Object.entries(hiddenCounts).map(([k, v]) => `${k}×${v}`).join(' ') || 'none'),
    'css rule matches:',
    ...cssMatches(),
    '---',
  ];
  const ctx = { lines: [], mask, allowText: page !== 'direct' };
  if (document.body) walk(document.body, 0, ctx);
  if (ctx.lines.length >= MAX_LINES) ctx.lines.push('… (cut here, page is very long)');
  return head.concat(ctx.lines).join('\n');
}
