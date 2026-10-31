// Let Me Wonder: the filter engine.
//
// Runs inside Instagram's page, as early as possible: in Safari through the
// Userscripts app, or injected by the Android app. It hides unwanted parts,
// blocks unwanted pages and never reads what you type or sends anything anywhere.
//
// How it works (details in README.md):
//   1. CSS from rules.js hides what can be recognised by its address (instant).
//   2. A MutationObserver watches every change Instagram makes to the page and
//      marks items carrying labels such as "Sponsored" (hidden by CSS too).
//   3. Every address change is checked against the rules (Instagram changes
//      pages without reloading), and taps on blocked links are stopped.
//   4. Hidden posts in a feed keep their size and are covered, so the feed's layout
//      stays exactly Instagram's: its list, which keeps only the posts near the
//      screen, and its loading of more posts work as if the filter weren't there.

import { TOGGLES, CSS_RULES, LABELS, LABEL_RULES, LABEL_SKIP_PAGES, STRUCTURE, RULES_VERSION, STORIES } from './rules.js';
import { decide, pageOf } from './routes.js';
import { withSaved } from './settings.js';
import { buildReport, outlineOf } from './report.js';
import { createLog } from './log.js';
import { createLock } from './lock.js';
import { createUi } from './ui.js';
import pageCss from './filter.css';

const VERSION = typeof __LMW_VERSION__ !== 'undefined' ? __LMW_VERSION__ : 'dev';
const SETTINGS_KEY = 'lmw-settings-v1';
const FROM_PATH_KEY = 'lmw-from-path';
const HIDE_ATTR = 'data-lmw-hide';
const COVER_ATTR = 'data-lmw-cover';
const NO_GEAR_PAGES = ['direct', 'login', 'create']; // making a post or story: Instagram's buttons are there
const HIDE_CSS = '{display:none!important}';
const INVISIBLE_CSS = '{visibility:hidden!important;pointer-events:none!important}'; // keeps its size
const SMALL_COVER_PX = 36; // a hidden post's box with the "Small boxes" test switch on
const STORY_RETRY_MS = 1500; // a story ad still showing this long after a skip: try again
const STORY_MAX_TRIES = 3;
const STORY_WAY_MS = 3000; // how long your last tap or swipe in stories says which way you're going
const SWIPE_PX = 50;

// A covered post keeps its size, so the feed keeps Instagram's own layout. Everything in
// it is invisible and can't be tapped, and a small grey label says what was there. With
// the smallCovers test switch on, it shrinks to a small box instead.
// `scope` is the html[...] part of the selector, `target` the rest.
function coverCss(scope, target, label) {
  const sel = `${scope} ${target}`;
  const small = `${scope}[data-lmw-on~="smallCovers"] ${target}`;
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="24"><text x="120" y="16" text-anchor="middle" ' +
    `font-family="system-ui,-apple-system,sans-serif" font-size="13" fill="#8e8e8e">${label}</text></svg>`;
  return (
    `${sel}{pointer-events:none!important;background-image:url("data:image/svg+xml,${encodeURIComponent(svg)}")!important;` +
    'background-position:center!important;background-repeat:no-repeat!important}\n' +
    `${sel} *{visibility:hidden!important}\n` +
    `${small}{height:${SMALL_COVER_PX}px!important;min-height:0!important;max-height:${SMALL_COVER_PX}px!important;overflow:hidden!important}`
  );
}

function coverLabel(toggle) {
  const t = TOGGLES.find((x) => x.id === toggle);
  return (t && t.covered) || 'Hidden';
}

function normalize(text) {
  return text
    .replace(/[​-‍﻿]/g, '')
    .replace(/[‘’ʼ`´]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.!…]+$/, '')
    .toLowerCase();
}

// Normalized label text -> the label rules it triggers.
const labelIndex = new Map();
for (const rule of LABEL_RULES) {
  for (const text of LABELS[rule.label] || []) {
    const key = normalize(text);
    if (!labelIndex.has(key)) labelIndex.set(key, []);
    labelIndex.get(key).push(rule);
  }
}
const MAX_LABEL_LENGTH = Math.max(...[...labelIndex.keys()].map((k) => k.length)) + 8;
const nextLabels = new Set(STORIES.nextLabels.map(normalize));
const previousLabels = new Set(STORIES.previousLabels.map(normalize));

function sessionTake(key) {
  try {
    const v = sessionStorage.getItem(key);
    sessionStorage.removeItem(key);
    return v;
  } catch (e) {
    return null;
  }
}

function sessionPut(key, value) {
  try {
    if (value) sessionStorage.setItem(key, value);
  } catch (e) {
    /* storage unavailable: only the reel-swipe memory across a redirect is lost */
  }
}

function start() {
  const config = window.__LMW_CONFIG__ || {};
  const host = config.host === 'app' ? 'app' : 'safari';
  const log = createLog();
  const settings = loadSettings(config.settings);
  const root = document.documentElement;

  let page = pageOf(location.pathname);
  let lastPath = null; // last path checked
  const arrivedFrom = sessionTake(FROM_PATH_KEY); // set when the filter itself sent us here
  let allowedPath = arrivedFrom; // last path allowed, to spot reel-to-reel moves
  let navCount = 0; // address changes since the page loaded
  let shownPage = null; // the page as last written in the timeline
  let blocked = null; // { toggle, navigated } while the Blocked screen shows
  let afterMarkers = []; // labels after which every post is hidden ("You're all caught up")
  let sectionMarkers = []; // headings on their own whose list below is hidden
  const labeled = new WeakSet();

  // --- settings -------------------------------------------------------------
  function loadSettings(fromApp) {
    let saved = fromApp;
    if (!saved) {
      try {
        saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null');
      } catch (e) {
        saved = null;
      }
    }
    return withSaved(saved);
  }

  function setSettings(partial) {
    let resized = false;
    for (const k of Object.keys(settings)) {
      if (typeof partial[k] !== 'boolean' || partial[k] === settings[k]) continue;
      settings[k] = partial[k];
      log.add(`switch ${k} ${settings[k] ? 'on' : 'off'}`);
      if (k === 'smallCovers') resized = true;
    }
    if (host !== 'app') {
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      } catch (e) {
        /* private mode: settings last until the tab closes */
      }
    }
    applyRootState();
    fixViewport();
    if (resized) remeasure(true); // hidden posts just changed size, both ways
    lastPath = null; // re-check the current page with the new switches
    checkPath();
  }

  // --- styles ---------------------------------------------------------------
  function buildCss() {
    const parts = [pageCss];
    for (const t of TOGGLES) {
      const scope = `html[data-lmw-on~="${t.id}"]`;
      const marked = `[${HIDE_ATTR}~="${t.id}"]`;
      parts.push(`${scope} ${marked}:not([${COVER_ATTR}])${HIDE_CSS}`, coverCss(scope, `${marked}[${COVER_ATTR}]`, coverLabel(t.id)));
    }
    for (const rule of CSS_RULES) {
      const scope = `html[data-lmw-on~="${rule.toggle}"]` + (rule.page ? `[data-lmw-page="${rule.page}"]` : '');
      // One block per selector, so a selector a browser doesn't support can't disable the others.
      for (const sel of rule.css) {
        if (rule.cover) parts.push(coverCss(scope, sel, coverLabel(rule.toggle)));
        else parts.push(`${scope} ${sel}${rule.invisible ? INVISIBLE_CSS : HIDE_CSS}`);
      }
    }
    return parts.join('\n');
  }

  function applyRootState() {
    root.setAttribute('data-lmw-on', TOGGLES.filter((t) => settings[t.id]).map((t) => t.id).join(' '));
    root.setAttribute('data-lmw-page', page);
    if (blocked) root.setAttribute('data-lmw-blocked', blocked.toggle);
    else root.removeAttribute('data-lmw-blocked');
    // In the app the button is the only way to its settings, so it can't be hidden there.
    ui.setGearVisible((host === 'app' || settings.showGear) && !NO_GEAR_PAGES.includes(page));
    ui.setGearPlace(page === 'stories' ? 'side' : null);
  }

  // --- pages and navigation ---------------------------------------------------
  function pageLabel() {
    const variant = page === 'home' && new URLSearchParams(location.search).get('variant'); // Instagram's feed menu
    return page + (variant ? ` (${variant})` : '');
  }

  function leaveFor(target, toggle, replace) {
    log.add(`leaving the page: ${toggle}`);
    sessionPut(FROM_PATH_KEY, allowedPath);
    root.setAttribute('data-lmw-blocked', toggle); // hide the page while we leave it
    if (replace) location.replace(target);
    else location.assign(target);
  }

  // For the timeline: the kind of page, and which feed on home (Following or the main one).
  function notePage() {
    const label = pageLabel();
    if (label !== shownPage) log.add(`page ${label}`);
    shownPage = label;
  }

  function checkPath() {
    const path = location.pathname;
    if (path === lastPath) {
      notePage();
      return;
    }
    if (lastPath !== null) navCount++;
    lastPath = path;
    const next = pageOf(path);
    if (next !== page) keepCovered(page);
    page = next;
    notePage();
    fixViewport();
    if (page === 'create') noteCreatePage();
    const verdict = decide(path, allowedPath, settings);
    if (verdict.action === 'redirect') {
      leaveFor(verdict.to, verdict.toggle, true);
      return;
    }
    if (verdict.action === 'block') {
      showBlocked(verdict.toggle, true);
    } else {
      allowedPath = path;
      if (blocked) hideBlocked();
    }
    applyRootState();
    notifyHost({ type: 'page', path, allowedPath });
    scanAll();
  }

  function onClick(e) {
    const link = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!link) return;
    let url;
    try {
      url = new URL(link.getAttribute('href'), location.href);
    } catch (err) {
      return;
    }
    if (url.origin !== location.origin) return;
    const verdict = decide(url.pathname, allowedPath, settings, { tapped: true });
    if (verdict.action === 'allow') return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (verdict.action === 'redirect') leaveFor(verdict.to, verdict.toggle, false);
    else showBlocked(verdict.toggle, false);
  }

  function messageFor(toggle) {
    const t = TOGGLES.find((x) => x.id === toggle);
    return t && t.blocked ? t.blocked : 'This part of Instagram is switched off.';
  }

  function pauseMedia() {
    for (const m of document.querySelectorAll('video, audio')) {
      try {
        m.pause();
      } catch (e) {
        /* ignore */
      }
    }
  }

  // A video that starts playing while blocked, or inside a covered post, is paused.
  function onPlay(e) {
    const media = e.target;
    if (!media || !media.pause) return;
    const holder = media.closest && (media.closest(`[${COVER_ATTR}]`) || media.closest(STRUCTURE.post));
    if (blocked || (holder && isCovered(holder))) media.pause();
  }

  function isCovered(node) {
    if (node.hasAttribute(COVER_ATTR) && TOGGLES.some((t) => settings[t.id] && isMarked(node, t.id))) return true;
    return CSS_RULES.some(
      (rule) =>
        rule.cover &&
        settings[rule.toggle] &&
        (!rule.page || rule.page === page) &&
        rule.css.some((sel) => {
          try {
            return node.matches(sel);
          } catch (err) {
            return false; // a selector this browser doesn't support
          }
        }),
    );
  }

  function showBlocked(toggle, navigated) {
    log.add(`Blocked screen: ${toggle}`);
    blocked = { toggle, navigated };
    applyRootState();
    pauseMedia();
    ui.showBlocked(messageFor(toggle), goBack);
    notifyHost({ type: 'blocked', toggle });
  }

  function hideBlocked() {
    blocked = null;
    ui.hideBlocked();
    applyRootState();
  }

  function goBack() {
    if (!blocked || !blocked.navigated) {
      hideBlocked(); // the tap was stopped before leaving the page: just close
    } else if (navCount > 0 || arrivedFrom) {
      history.back(); // the Blocked screen closes once the previous page is back
    } else {
      location.replace('/'); // opened directly on a blocked page: go home
    }
  }

  // --- labels ("Sponsored", "Suggested for you", ...) -------------------------
  function hasOutside(parent, inside, selector) {
    for (const x of parent.querySelectorAll(selector)) if (!inside.contains(x)) return true;
    return false;
  }

  function mark(node, toggle) {
    if (!node || node === root || node.matches(STRUCTURE.boundary)) return;
    const current = (node.getAttribute(HIDE_ATTR) || '').split(' ').filter(Boolean);
    if (!current.includes(toggle)) node.setAttribute(HIDE_ATTR, current.concat(toggle).join(' '));
    // Posts, and blocks sitting between posts in a feed, are covered: they keep their size.
    const inFeed = node.matches(STRUCTURE.post) || (node.parentElement && hasOutside(node.parentElement, node, STRUCTURE.post));
    if (inFeed) node.setAttribute(COVER_ATTR, '');
  }

  function isMarked(node, toggle) {
    return (node.getAttribute(HIDE_ATTR) || '').split(' ').includes(toggle);
  }

  // Leaving a page: the posts its page-only rules covered stay covered, for as long as
  // they're there. Instagram keeps the feed under a story or a post, and its hidden reels
  // shouldn't show or play there meanwhile.
  function keepCovered(fromPage) {
    let kept = 0;
    for (const rule of CSS_RULES) {
      if (!rule.cover || rule.page !== fromPage || !settings[rule.toggle]) continue;
      for (const sel of rule.css) {
        let found;
        try {
          found = document.querySelectorAll(sel);
        } catch (e) {
          continue; // a selector this browser doesn't support
        }
        for (const el of found) {
          // Only posts in a list of posts, never the single post a page like /reel/<id>/ shows.
          if (isMarked(el, rule.toggle) || !el.parentElement || !hasOutside(el.parentElement, el, STRUCTURE.post)) continue;
          mark(el, rule.toggle);
          kept++;
        }
      }
    }
    if (kept) log.add(`kept ${kept} hidden post${kept > 1 ? 's' : ''} hidden after leaving the page`);
  }

  // The block around a label: its post, or the largest group of elements around
  // it that holds no other content or heading and doesn't cross a page landmark.
  function blockAround(label) {
    const post = label.closest(STRUCTURE.post);
    if (post) return post;
    let node = label;
    for (let i = 0; i < STRUCTURE.maxLevels; i++) {
      const parent = node.parentElement;
      if (!parent || parent.matches(STRUCTURE.boundary)) break;
      if (
        hasOutside(parent, node, STRUCTURE.content) ||
        hasOutside(parent, node, STRUCTURE.heading) ||
        hasOutside(parent, node, STRUCTURE.boundary)
      ) {
        break;
      }
      node = parent;
    }
    return node;
  }

  function isJustAHeading(block) {
    return !block.matches(STRUCTURE.interactive) && !block.querySelector(STRUCTURE.interactive);
  }

  // Under a heading on its own (e.g. "Suggested for you" in notifications), hide the
  // blocks that follow it, up to the next heading or real content.
  function hideSections() {
    sectionMarkers = sectionMarkers.filter((m) => m.block.isConnected);
    for (const m of sectionMarkers) {
      for (let sib = m.block.nextElementSibling; sib; sib = sib.nextElementSibling) {
        const stop = [STRUCTURE.heading, STRUCTURE.content].some((s) => sib.matches(s) || sib.querySelector(s));
        if (stop) break;
        mark(sib, m.toggle);
      }
    }
  }

  function feedOf(label) {
    for (let node = label.parentElement; node && node !== root; node = node.parentElement) {
      if (node.querySelector(STRUCTURE.post)) return node;
    }
    return document.querySelector('main') || document.body;
  }

  function hideAfterMarkers() {
    afterMarkers = afterMarkers.filter((m) => m.label.isConnected);
    for (const m of afterMarkers) {
      if (m.page !== page) continue;
      for (const post of m.feed.querySelectorAll(STRUCTURE.post)) {
        if (m.label.compareDocumentPosition(post) & Node.DOCUMENT_POSITION_FOLLOWING && !post.contains(m.label)) {
          mark(post, m.toggle);
        }
      }
    }
  }

  function applyLabel(label, rules) {
    if (labeled.has(label)) return;
    labeled.add(label);
    for (const rule of rules) {
      if (rule.hide.includes('post')) mark(label.closest(STRUCTURE.post), rule.toggle);
      if (rule.hide.includes('block')) {
        const block = blockAround(label);
        mark(block, rule.toggle);
        if (isJustAHeading(block)) {
          sectionMarkers.push({ block, toggle: rule.toggle });
          hideSections();
        }
      }
      if (rule.hide.includes('after')) afterMarkers.push({ label, toggle: rule.toggle, page, feed: feedOf(label) });
    }
  }

  function isOurs(node) {
    return node.id === 'lmw-ui' || node.id === 'lmw-style';
  }

  function checkText(textNode) {
    const raw = textNode.data;
    if (!raw || raw.length > MAX_LABEL_LENGTH * 2) return;
    let el = textNode.parentElement;
    if (!el) return;
    let rules = labelIndex.get(normalize(raw));
    // A label can be split into pieces, e.g. <span>Spon</span><span>sored</span>.
    for (let up = 0; !rules && up < 3 && el; up++) {
      if (up > 0) el = el.parentElement;
      if (!el) return;
      const text = el.textContent;
      if (text.length > MAX_LABEL_LENGTH * 2) return;
      rules = labelIndex.get(normalize(text));
    }
    if (!rules || !el) return;
    // On a story page, a "Sponsored" label outside any post or hidden part is a story ad.
    if (page === 'stories' && rules.some((r) => r.hide.includes('story')) && !el.closest(`${STRUCTURE.post}, [${HIDE_ATTR}]`)) {
      storyLabels.add(el);
      checkStoryAds();
    }
    applyLabel(el, rules);
  }

  function scan(node) {
    if (LABEL_SKIP_PAGES.includes(page)) return;
    if (node.nodeType === 3) {
      checkText(node);
      return;
    }
    if (node.nodeType !== 1 || isOurs(node)) return;
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    for (let t = walker.nextNode(); t; t = walker.nextNode()) checkText(t);
  }

  function afterScan() {
    if (afterMarkers.length) hideAfterMarkers();
    if (sectionMarkers.length) hideSections();
  }

  function scanAll() {
    if (document.body) scan(document.body);
    afterScan();
  }

  // Into a set: a post can come with its parent and on its own in the same batch of changes.
  function collectPosts(node, into) {
    if (node.nodeType !== 1) return;
    if (node.matches(STRUCTURE.post)) into.add(node);
    else for (const post of node.querySelectorAll(STRUCTURE.post)) into.add(post);
  }

  function onMutations(records) {
    checkPath();
    if (root.getAttribute('data-lmw-on') === null) applyRootState(); // in case the page reset our marks
    const added = new Set();
    const removed = new Set();
    for (const r of records) {
      if (r.type === 'characterData') scan(r.target);
      else {
        for (const n of r.addedNodes) {
          scan(n);
          collectPosts(n, added);
        }
        for (const n of r.removedNodes) collectPosts(n, removed);
      }
    }
    afterScan();
    fixViewport(); // as soon as Instagram's tag is in the page
    remeasure();
    if (added.size || removed.size) {
      const change = [added.size && `+${added.size}`, removed.size && `-${removed.size}`].filter(Boolean).join(' ');
      log.add(`posts ${change}, ${document.querySelectorAll(STRUCTURE.post).length} in the page`);
    }
  }

  // --- ads between stories -------------------------------------------------------
  // A story ad has the same "Sponsored" label as a feed ad, but no post around it. The
  // filter pauses it and moves on with Instagram's own controls (STORIES), or else the
  // arrow keys, which the story viewer answers. Never with the ad's own buttons. It moves
  // the way you were going: forward, or back to the story before the ad if you were
  // going back. The first time, the viewer's outline is kept for the problem report, in
  // case Instagram changes how its stories are built.
  const storyLabels = new Set(); // "Sponsored" labels that appeared on a story page
  let storyAd = null; // { label, path, tries, at, back }: the ad being skipped
  let skipping = false;
  let storyOutlineKept = false;
  let storyWay = { back: false, at: 0 }; // your last move in stories
  let pointerStart = null;

  // Your own taps, swipes and arrow keys in stories (not the filter's skips): a tap on the
  // left third of the screen, a swipe to the right or the left-arrow key go back.
  function noteWay(back) {
    if (page === 'stories') storyWay = { back, at: Date.now() };
  }
  window.addEventListener('pointerdown', (e) => (pointerStart = e.isTrusted ? { x: e.clientX, y: e.clientY } : null), true);
  window.addEventListener(
    'pointerup',
    (e) => {
      if (!e.isTrusted || !pointerStart) return;
      const dx = e.clientX - pointerStart.x;
      const swiped = Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(e.clientY - pointerStart.y);
      noteWay(swiped ? dx > 0 : pointerStart.x < window.innerWidth / 3);
      pointerStart = null;
    },
    true,
  );
  window.addEventListener(
    'keydown',
    (e) => {
      if (e.isTrusted && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) noteWay(e.key === 'ArrowLeft');
    },
    true,
  );

  function isShown(el) {
    return el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
  }

  function checkStoryAds() {
    if (page !== 'stories' || !settings.ads || blocked) return;
    for (const label of storyLabels) {
      if (!label.isConnected) storyLabels.delete(label);
      else if (isShown(label)) return skipStoryAd(label);
    }
  }

  function skipStoryAd(label) {
    const now = Date.now();
    // The same label is the same ad until the story had time to change: Instagram moves the
    // address to the next story a moment before the ad leaves the page. A label still there
    // later is the ad that didn't go, or a new ad reusing it (on a new address).
    const same = storyAd && storyAd.label === label;
    if (skipping || (same && now - storyAd.at < STORY_RETRY_MS)) return;
    const retry = same && storyAd.path === location.pathname;
    const tries = retry ? storyAd.tries + 1 : 1;
    if (tries > STORY_MAX_TRIES) return;
    const back = retry ? storyAd.back : storyWay.back && now - storyWay.at < STORY_WAY_MS;
    storyAd = { label, path: location.pathname, tries, at: now, back };
    if (!storyOutlineKept) {
      storyOutlineKept = true;
      log.note('the story viewer when an ad showed', outlineOf(viewerOf(label)));
    }
    pauseMedia();
    // "Previous" is looked for next to "next", and never at the top of the screen, where
    // an "Indietro" would be the arrow that leaves the stories.
    const next = controlNear(nextLabels, label);
    const control = back ? next && controlNear(previousLabels, next, { notOnTop: true }) : next;
    const key = back ? 'ArrowLeft' : 'ArrowRight';
    const how = control ? `the ${back ? 'previous' : 'next'} button` : `the ${back ? 'left' : 'right'}-arrow key`;
    log.add(`story ad: skipped${back ? ' backwards' : ''} with ${how}${tries > 1 ? `, try ${tries}` : ''}`);
    skipping = true;
    try {
      if (control) press(control);
      else label.dispatchEvent(new KeyboardEvent('keydown', { key, code: key, keyCode: back ? 37 : 39, bubbles: true }));
    } finally {
      skipping = false;
    }
  }

  // The part of the page holding the story: the label's ancestor as tall as most of the screen.
  function viewerOf(label) {
    let node = label;
    while (node.parentElement && node.parentElement !== document.body && node.getBoundingClientRect().height < window.innerHeight * 0.6) {
      node = node.parentElement;
    }
    return node;
  }

  // The shown control with one of `labels` closest to `anchor` (sharing its deepest
  // ancestor), outside posts.
  function controlNear(labels, anchor, { notOnTop = false } = {}) {
    const ancestors = [];
    for (let n = anchor; n; n = n.parentElement) ancestors.push(n);
    let best = null;
    let bestAt = Infinity;
    for (const el of document.querySelectorAll('[aria-label]')) {
      if (!labels.has(normalize(el.getAttribute('aria-label'))) || el.closest(STRUCTURE.post) || !isShown(el)) continue;
      const control = el.closest('button, [role="button"], a') || el;
      if (control === anchor || (notOnTop && control.getBoundingClientRect().top < window.innerHeight * 0.15)) continue;
      const at = ancestors.findIndex((a) => a.contains(control));
      if (at >= 0 && at < bestAt) {
        best = control;
        bestAt = at;
      }
    }
    return best;
  }

  function press(el) {
    if (el instanceof HTMLElement) el.click();
    else el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  }

  // --- pinch to zoom ----------------------------------------------------------------
  // Instagram's page tells the browser it can't be zoomed (maximum-scale=1 in its viewport
  // tag). With "Pinch to zoom" on, two fingers zoom photos and stories up to ZOOM_MAX
  // times, like on any web page. The rest of Instagram's tag is kept, it's fixed again if
  // Instagram rewrites it, and it's put back as it was when the switch is off.
  const ZOOM_MAX = 5;
  let viewportOwn = null; // the page's own viewport setting
  let viewportSet = null; // the one the filter last wrote
  let pinchLoggedAt = 0;

  function zoomable(content) {
    const kept = content
      .split(',')
      .map((p) => p.trim())
      .filter((p) => p && !/^(maximum-scale|user-scalable)\s*=/i.test(p));
    return kept.concat(`maximum-scale=${ZOOM_MAX}`, 'user-scalable=yes').join(', ');
  }

  function fixViewport() {
    const meta = document.querySelector('meta[name="viewport"]');
    if (!meta) return;
    const content = meta.getAttribute('content') || '';
    if (content !== viewportSet) viewportOwn = content; // Instagram set it (again)
    // Making a post or a story, two fingers crop the photo: Instagram's own setting then.
    const wanted = settings.pinchZoom && page !== 'create' ? zoomable(viewportOwn) : viewportOwn;
    if (content !== wanted) {
      meta.setAttribute('content', wanted);
      log.add(settings.pinchZoom ? 'pinch to zoom: allowed' : "pinch to zoom: Instagram's setting back");
    }
    viewportSet = wanted;
  }

  // For the report: how far a two-finger touch zoomed, and what on the way up says how
  // touches may be used (in case something else in Instagram blocks pinching).
  window.addEventListener(
    'touchstart',
    (e) => {
      if (!e.isTrusted || e.touches.length !== 2 || Date.now() - pinchLoggedAt < 10000) return;
      pinchLoggedAt = Date.now();
      const ways = [];
      for (let n = e.target; n && n.nodeType === 1; n = n.parentElement) {
        const way = getComputedStyle(n).touchAction;
        if (way !== 'auto') ways.push(`${n.tagName.toLowerCase()} ${way}`);
      }
      setTimeout(() => {
        const zoom = window.visualViewport ? window.visualViewport.scale.toFixed(2) : '?';
        log.add(`two fingers: zoom ${zoom}, touch-action ${ways.join(', ') || 'auto'}`);
      }, 800);
    },
    { capture: true, passive: true },
  );

  // --- making a post or a story ------------------------------------------------------
  // The filter stays out of the way there (see PAGES): no labels, no settings button, and
  // Instagram's own zoom setting. With no button to copy a report, the page's outline
  // (anonymous, without what you type) is kept once for the next report from elsewhere.
  let createNoted = false;

  function noteCreatePage() {
    if (createNoted) return;
    setTimeout(() => {
      if (page !== 'create' || createNoted) return;
      createNoted = true;
      log.note('the page for making a post or story', outlineOf(document.querySelector('main') || document.body));
    }, 1500);
  }

  // --- the feed, for the report's timeline ---------------------------------------
  // Only looks: the page's height and the padding of the list holding the posts.
  function watchFeed() {
    if (page !== 'home' || blocked || document.hidden) return;
    const post = document.querySelector(STRUCTURE.post);
    log.checkFeed(post ? post.parentElement : null);
    remeasure();
  }

  // --- the "Small boxes" test ------------------------------------------------------
  // A small box shrinks a post after Instagram measured it, which is what made the feed
  // jump. A resize event is the usual way to ask a feed like Instagram's to measure its
  // posts again: sent whenever the number of hidden posts changes.
  let coversSeen = -1;

  function coverCount() {
    let n = document.querySelectorAll(`[${COVER_ATTR}]`).length;
    for (const rule of CSS_RULES) {
      if (!rule.cover || !settings[rule.toggle] || (rule.page && rule.page !== page)) continue;
      for (const sel of rule.css) {
        try {
          n += document.querySelectorAll(sel).length;
        } catch (e) {
          /* a selector this browser doesn't support */
        }
      }
    }
    return n;
  }

  function remeasure(force) {
    if (!force && (!settings.smallCovers || page !== 'home')) return;
    const n = coverCount();
    if (n === coversSeen && !force) return;
    coversSeen = n;
    window.dispatchEvent(new Event('resize'));
    log.add(`small boxes: ${n} hidden, asked Instagram to measure again`);
  }

  // --- talking to the Android app (no-op in Safari) ---------------------------
  function notifyHost(message) {
    if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ source: 'lmw', ...message }));
    }
  }

  function report() {
    return buildReport({
      version: VERSION,
      rulesVersion: RULES_VERSION,
      host,
      settings,
      page,
      events: log.lines(),
      eventsBefore: log.before(),
      notes: log.notes(),
    });
  }

  // --- start ----------------------------------------------------------------
  const lock = createLock();
  const ui = createUi({
    toggles: TOGGLES,
    version: VERSION,
    rulesVersion: RULES_VERSION,
    getSettings: () => ({ ...settings }),
    onChange: setSettings,
    getReport: report,
    tryCode: (code) => {
      const result = lock.tryCode(code);
      log.add(result.ok ? 'switches unlocked' : 'wrong code for the switches');
      return result;
    },
    onGear: host === 'app' ? () => notifyHost({ type: 'openSettings' }) : undefined,
  });

  shownPage = pageLabel();
  log.add(`start ${VERSION} ${host}, ${shownPage}`);
  const style = document.createElement('style');
  style.id = 'lmw-style';
  style.textContent = buildCss();
  (document.head || root).appendChild(style);
  ui.mount();
  applyRootState();
  checkPath();

  window.addEventListener('click', onClick, true);
  document.addEventListener('play', onPlay, true);
  window.addEventListener('popstate', checkPath);
  for (const fn of ['pushState', 'replaceState']) {
    // Hear about address changes right away where possible (the app); elsewhere
    // the observer and the timer below notice them.
    const original = history[fn];
    try {
      history[fn] = function () {
        const result = original.apply(this, arguments);
        checkPath();
        return result;
      };
    } catch (e) {
      /* not allowed here: fall back to the observer and timer */
    }
  }
  setInterval(checkPath, 300);
  setInterval(watchFeed, 500);
  setInterval(checkStoryAds, 400); // an ad still showing after a skip, or the next one
  setInterval(fixViewport, 500); // in case Instagram changes its viewport tag without adding nodes
  new MutationObserver(onMutations).observe(root, { childList: true, subtree: true, characterData: true });

  function openFromHash() {
    if (location.hash === '#lmw' && host !== 'app') {
      history.replaceState(history.state, '', location.pathname + location.search);
      ui.openPanel();
    }
  }
  window.addEventListener('hashchange', openFromHash);
  openFromHash();
  document.addEventListener('DOMContentLoaded', () => {
    ui.mount(); // in case the page replaced the document's children
    scanAll();
  });

  window.__LMW__ = {
    version: VERSION,
    rulesVersion: RULES_VERSION,
    getSettings: () => ({ ...settings }),
    setSettings,
    buildReport: report,
    sendReport: () => notifyHost({ type: 'report', text: report() }),
    openSettings: () => ui.openPanel(),
  };
}

// Run once, in the top page only, as soon as the page has its root element.
if (window.top === window && !window.__LMW__) {
  if (document.documentElement) {
    start();
  } else {
    const waiter = new MutationObserver(() => {
      if (document.documentElement) {
        waiter.disconnect();
        start();
      }
    });
    waiter.observe(document, { childList: true });
  }
}
