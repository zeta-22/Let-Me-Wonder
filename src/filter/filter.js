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

import { TOGGLES, CSS_RULES, LABELS, LABEL_RULES, LABEL_SKIP_PAGES, STRUCTURE, RULES_VERSION, STORIES, REEL_SWIPE } from './rules.js';
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
const REEL_PAGES = ['reel', 'post']; // a reel's own page (opened from a DM, a profile, the feed)
// Where swiping is never stopped: scrolling there is the point, or they have their own swipes.
const FREE_SWIPE_PAGES = ['home', 'stories', 'create', 'explore', 'search', 'login'];
const reelRe = new RegExp(REEL_SWIPE.path);

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
  let pathSince = Date.now(); // when the address last changed
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
    guardScrolling(); // touches and the wheel: only listened to where a reel can be on screen
    updateShield(); // a reel's page, or the Blocked screen: no shield on it
    // On the right edge on stories and reels, out of the way of Instagram's buttons there.
    ui.setGearPlace(page === 'stories' || shieldOn ? 'side' : null);
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
    pathSince = Date.now();
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
    if (verdict.action === 'allow') {
      reelWatch = null; // you chose what to open: that's the reel to watch now
      return;
    }
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

  // `back`, if given, is how Go back returns (e.g. scrolling back to the reel you opened).
  function showBlocked(toggle, navigated, back) {
    log.add(`Blocked screen: ${toggle}`);
    blocked = { toggle, navigated, back };
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
    if (blocked && blocked.back) {
      const back = blocked.back;
      hideBlocked();
      back();
    } else if (!blocked || !blocked.navigated) {
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

  // The item of a feed a node is in: the node, or its ancestor, sitting next to posts in
  // their list (a post, or a block between posts). Null outside a feed.
  function feedItemOf(node) {
    for (let n = node; n && n.parentElement && !n.matches(STRUCTURE.boundary); n = n.parentElement) {
      if (hasOutside(n.parentElement, n, STRUCTURE.post)) return n;
    }
    return null;
  }

  // Anything hidden in a feed keeps its size, covered: a post, a block between posts, or
  // any part of one, however deep it sits. On Home, everything does. Instagram's feed
  // measures each item once; one that shrank afterwards made the whole feed jump back, and
  // show the posts you'd just seen again. Elsewhere (notifications, a profile) it's removed.
  function mark(node, toggle) {
    if (!node || node === root || node.matches(STRUCTURE.boundary)) return;
    const current = (node.getAttribute(HIDE_ATTR) || '').split(' ').filter(Boolean);
    if (current.includes(toggle)) return; // already hidden: nothing to change, nothing to measure
    if (page === 'home' || node.closest(STRUCTURE.post) || feedItemOf(node)) node.setAttribute(COVER_ATTR, '');
    node.setAttribute(HIDE_ATTR, current.concat(toggle).join(' '));
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
  // it that holds no other content or heading and doesn't cross a page landmark. In a
  // feed it may grow up to the feed's item however deep the label is (Instagram nests its
  // labels in many boxes); elsewhere up to STRUCTURE.maxLevels.
  function blockAround(label) {
    const post = label.closest(STRUCTURE.post);
    if (post) return post;
    const item = feedItemOf(label);
    let node = label;
    for (let i = 0; node !== item && (item || i < STRUCTURE.maxLevels); i++) {
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

  // An element's text, or null as soon as it's longer than `max`: reading only the start of
  // a big element, not all of it, for every short text in every post Instagram adds.
  function shortText(el, max) {
    let text = '';
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let t = walker.nextNode(); t; t = walker.nextNode()) {
      text += t.data;
      if (text.length > max) return null;
    }
    return text;
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
      const text = shortText(el, MAX_LABEL_LENGTH * 2);
      if (text === null) return;
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

  // --- one reel at a time ------------------------------------------------------------
  // While a reel is on screen (one sent in DMs, opened from a profile, ...), a clear shield
  // of the filter's own lies over the whole screen. Every touch lands on it, so Instagram
  // never sees a finger move on a reel: no swipe, nothing that scrolls the reels, nothing
  // that opens the reply box (the keyboard) as a swipe or a long press would.
  // What you do on the shield:
  // - A tap is passed on to whatever of Instagram's is under your finger, as a tap: the
  //   like, comments, share and "more" buttons, the description, the name, the sound,
  //   a text box (with the keyboard, since you tapped it). A double tap too (a like).
  // - A swipe moves a list that scrolls and holds no video: the comments, the people to
  //   send it to, a long description. Never the reels, nor the page around them.
  // - Anything else (a swipe on the reel, a long press, the wheel, keys that aren't typing)
  //   reaches nothing. A long press is what opens the reply box in some viewers.
  // A text box Instagram focuses without your tap (a swipe, or by itself) is closed at once.
  // The filter's settings button and screens stay above the shield.
  // "A reel on screen": a reel's page (/reel/<id>/), or a video at least half the screen
  // tall and as wide as the screen (90%: a video in a chat is narrower), on any page but
  // Home, stories, making a post or story, Explore, search and login. Instagram can show a
  // reel over a chat, open its full viewer over the reel a moment later, or change the
  // address while the reel stays: what's on screen decides. The shield stays while the
  // video is there, and for a moment if Instagram draws it again, as long as the address
  // is the same.
  // As a backstop, if another reel still takes the place of yours (Instagram's own code),
  // it's paused and blocked, and Go back scrolls back to your reel. Instagram drawing your
  // reel again isn't a swipe, and a link you tap yourself starts over with what you opened.
  let reelWatch = null; // { video, scroller, top, id, path }: the reel you opened
  let shieldOn = false;
  let reelSeen = { at: 0, path: null }; // the last time a reel was on screen, and where
  let touch = null; // a finger (or mouse button) down on the shield, see onShield()
  let glideFrame = 0; // a list still gliding after a swipe
  let tappedAt = 0; // the last tap passed on to Instagram
  let typingIn = null; // the text box you tapped, which may keep the keyboard
  let swipeLoggedAt = 0;
  let focusLoggedAt = 0;
  let reelNoted = false;
  const TAP_PX = 10; // a finger moving less than this is a tap...
  const TAP_MS = 500; // ...and lifted this soon; held longer, it's a long press: nothing
  const SHIELD_GRACE_MS = 1500;
  const TAP_FOCUS_MS = 1500; // a text box focused this soon after your tap was yours

  function reelOnScreen() {
    if (!settings.reelSwipe || blocked || FREE_SWIPE_PAGES.includes(page)) return false;
    const now = Date.now();
    if (page === 'reel' || reelVideo()) {
      // Only a reel still there a moment after the address changed is held through a
      // redraw: right after going back to a chat, the reel's still in the page until
      // Instagram draws the chat, and the chat shouldn't wait.
      if (now - pathSince > 500) reelSeen = { at: now, path: location.pathname };
      return true;
    }
    return shieldOn && reelSeen.path === location.pathname && now - reelSeen.at < SHIELD_GRACE_MS;
  }

  // A video at least half the screen tall, as wide as the screen, and mostly on screen.
  function reelVideo() {
    const video = mainVideo();
    return video && video.getBoundingClientRect().width >= window.innerWidth * 0.9 ? video : null;
  }

  function fullScreenVideo() {
    const video = mainVideo();
    if (!video) return null;
    const r = video.getBoundingClientRect();
    return r.height >= window.innerHeight * 0.7 && r.width >= window.innerWidth * 0.8 ? video : null;
  }

  // Puts the shield up or takes it down, as the screen says. Returns whether it's up.
  function updateShield() {
    const on = reelOnScreen();
    if (on !== shieldOn) {
      shieldOn = on;
      touch = null;
      stopGlide();
      ui.setShield(on);
      ui.setGearPlace(page === 'stories' || on ? 'side' : null);
      log.add(on ? `reel on ${pageLabel()}: shield up, Instagram sees no finger move` : 'reel: shield down');
      if (on && closeKeyboard()) log.add('reel: a text box was open, closed it');
    }
    return on;
  }

  function editable(node) {
    return !!node && node.nodeType === 1 && (node.matches('input, textarea, select') || node.isContentEditable);
  }

  // A text box of Instagram's with the keyboard up, which you didn't tap: closed. The
  // filter's own (the code box in settings) never: they're inside its shadow root.
  function closeKeyboard() {
    const focused = document.activeElement;
    if (!editable(focused) || isOurs(focused) || focused === typingIn) return false;
    focused.blur();
    return true;
  }

  // What of Instagram's is under a point of the shield: what a finger there would touch.
  function elementBelow(x, y) {
    for (const el of document.elementsFromPoint(x, y)) if (!isOurs(el)) return el;
    return null;
  }

  // The list a swipe from `start` may move along `axis` ('x' or 'y'): the nearest one that
  // scrolls that way, if it holds no video. One that holds a video is the reels: never.
  // Nor the page itself.
  function freeScroller(start, axis) {
    for (let n = start; n && n !== document.body && n !== root; n = n.parentElement) {
      const style = getComputedStyle(n);
      const over = axis === 'y' ? style.overflowY : style.overflowX;
      const room = axis === 'y' ? n.scrollHeight > n.clientHeight + 4 : n.scrollWidth > n.clientWidth + 4;
      if (/(auto|scroll)/.test(over) && room) return n.querySelector('video') ? null : n;
    }
    return null;
  }

  function stopGlide() {
    if (glideFrame) cancelAnimationFrame(glideFrame);
    glideFrame = 0;
  }

  // After a swipe on a list, it glides on and slows down, like a list does.
  function glide(list, axis, speed) {
    let last = performance.now();
    const step = (now) => {
      const dt = Math.min(now - last, 40);
      last = now;
      if (axis === 'y') list.scrollTop += speed * dt;
      else list.scrollLeft += speed * dt;
      speed *= Math.pow(0.996, dt);
      glideFrame = Math.abs(speed) > 0.02 ? requestAnimationFrame(step) : 0;
    };
    glideFrame = requestAnimationFrame(step);
  }

  function fire(target, Kind, type, init) {
    let event;
    try {
      event = new Kind(type, init);
    } catch (e) {
      return true; // this browser can't make that kind of event: skipped
    }
    return target.dispatchEvent(event);
  }

  // Your tap, passed on to what's under it, as the browser would send a finger's tap:
  // pointer and touch events, then (unless Instagram called them off) the mouse events,
  // the focus of a text box, and the click. Made in your tap's own click, so Instagram
  // may start the sound and the keyboard may open.
  function passTap(x, y, count) {
    const target = elementBelow(x, y);
    if (!target) return;
    tappedAt = Date.now();
    const at = { bubbles: true, cancelable: true, composed: true, view: window, clientX: x, clientY: y, screenX: x, screenY: y };
    const finger = { ...at, pointerId: 1, pointerType: 'touch', isPrimary: true, width: 1, height: 1 };
    let point = null;
    try {
      point = new Touch({ identifier: 1, target, clientX: x, clientY: y, screenX: x, screenY: y, pageX: x + window.scrollX, pageY: y + window.scrollY });
    } catch (e) {
      /* no Touch here (a computer): pointer and mouse events only */
    }
    const down = fire(target, PointerEvent, 'pointerdown', { ...finger, button: 0, buttons: 1, pressure: 0.5 });
    let ok = !point || fire(target, TouchEvent, 'touchstart', { ...at, touches: [point], targetTouches: [point], changedTouches: [point] });
    fire(target, PointerEvent, 'pointerup', { ...finger, button: 0, buttons: 0, pressure: 0 });
    if (point) ok = fire(target, TouchEvent, 'touchend', { ...at, touches: [], targetTouches: [], changedTouches: [point] }) && ok;
    if (!ok) return; // Instagram took the touch itself, as it does on a phone
    const mouse = { ...at, button: 0, detail: count || 1 };
    const pressed = !down || fire(target, MouseEvent, 'mousedown', { ...mouse, buttons: 1 });
    const box = target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])');
    if (pressed && box && !box.disabled) {
      typingIn = box;
      box.focus();
    }
    if (down) fire(target, MouseEvent, 'mouseup', mouse);
    fire(target, MouseEvent, 'click', mouse);
  }

  // A finger on the shield: a tap is passed on, a swipe moves a free list or nothing.
  function onShield(e) {
    const { type } = e;
    if (type === 'pointerdown') {
      stopGlide();
      touch = {
        x: e.clientX, y: e.clientY, lastX: e.clientX, lastY: e.clientY, at: Date.now(), held: 0, moved: 0,
        below: elementBelow(e.clientX, e.clientY), axis: null, list: null, trail: [],
      };
    } else if (type === 'pointermove' && touch) {
      const t = touch;
      t.moved = Math.max(t.moved, Math.abs(e.clientX - t.x), Math.abs(e.clientY - t.y));
      if (!t.axis && t.moved > TAP_PX) {
        t.axis = Math.abs(e.clientY - t.y) >= Math.abs(e.clientX - t.x) ? 'y' : 'x';
        t.list = freeScroller(t.below, t.axis);
        if (!t.list && Date.now() - swipeLoggedAt > 5000) {
          swipeLoggedAt = Date.now();
          log.add('reel: a swipe was stopped, Instagram never saw it');
        }
      }
      if (t.list) {
        if (t.axis === 'y') t.list.scrollTop -= e.clientY - t.lastY;
        else t.list.scrollLeft -= e.clientX - t.lastX;
        t.trail.push([performance.now(), t.axis === 'y' ? e.clientY : e.clientX]);
        if (t.trail.length > 6) t.trail.shift();
      }
      t.lastX = e.clientX;
      t.lastY = e.clientY;
    } else if (type === 'pointerup' && touch) {
      const t = touch;
      t.held = Date.now() - t.at;
      if (t.list && t.trail.length > 1) {
        const [t0, p0] = t.trail[0];
        const [t1, p1] = t.trail[t.trail.length - 1];
        const speed = t1 > t0 && performance.now() - t1 < 100 ? -(p1 - p0) / (t1 - t0) : 0;
        if (Math.abs(speed) > 0.1) glide(t.list, t.axis, Math.max(-4, Math.min(4, speed)));
      }
    } else if (type === 'pointercancel') {
      touch = null;
    } else if (type === 'click') {
      // A click after a swipe or a long press isn't a tap.
      if (!touch || (touch.moved <= TAP_PX && touch.held < TAP_MS)) passTap(e.clientX, e.clientY, e.detail);
      else if (touch.held >= TAP_MS) log.add('reel: a long press was stopped');
      touch = null;
    } else if (type === 'dblclick') {
      const target = elementBelow(e.clientX, e.clientY);
      if (target) fire(target, MouseEvent, 'dblclick', { bubbles: true, cancelable: true, composed: true, view: window, clientX: e.clientX, clientY: e.clientY, button: 0, detail: 2 });
    } else if (type === 'wheel') {
      const list = freeScroller(elementBelow(e.clientX, e.clientY), Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? 'y' : 'x');
      if (list) {
        list.scrollTop += e.deltaY;
        list.scrollLeft += e.deltaX;
      }
    }
  }

  // Every input event, in the capture phase on window, before any of Instagram's code.
  // While the shield is up, your fingers' events (and the wheel, and keys) never reach
  // Instagram as they are, whatever they land on; on the shield, onShield() decides. The
  // filter's own screens (Blocked, settings) and its settings button work as usual, and
  // so does typing in a text box. Events made by code aren't yours: they pass, as
  // everywhere else (the taps passed on to Instagram among them).
  function guard(e) {
    if (!e.isTrusted) return;
    const starts = e.type === 'pointerdown' || e.type === 'touchstart' || e.type === 'mousedown' || e.type === 'wheel' || e.type === 'keydown';
    if (starts ? !updateShield() : !shieldOn) {
      if (e.type === 'pointerdown' && e.pointerType !== 'mouse') noteFreeSwipe();
      return;
    }
    const inner = e.composedPath ? e.composedPath()[0] : e.target;
    const onIt = ui.isShield(inner);
    if (!onIt && isOurs(e.target)) return; // the Blocked screen, settings, the settings button
    if (e.type.startsWith('key') && editable(e.target)) return; // typing
    e.stopImmediatePropagation();
    // On the shield, a tap still makes a click (on the shield, nothing of Instagram's);
    // everything else's default (scrolling, zooming, focusing, a menu) is prevented.
    const tapParts = ['pointerdown', 'pointerup', 'touchstart', 'touchend', 'mousedown', 'mouseup', 'click'];
    if (e.cancelable && !(onIt && tapParts.includes(e.type))) e.preventDefault();
    if (onIt) onShield(e);
  }

  const INPUT_EVENTS = [
    'pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'touchend', 'touchcancel',
    'mousedown', 'mousemove', 'mouseup', 'click', 'dblclick', 'auxclick', 'contextmenu',
    'keydown', 'keypress', 'keyup', 'gesturestart', 'gesturechange', 'gestureend', 'selectstart', 'dragstart',
  ];
  for (const type of INPUT_EVENTS) window.addEventListener(type, guard, { capture: true, passive: false });

  // A finger going down or moving, and the wheel: while anything may stop them, the browser
  // waits for the page's code before it scrolls, and with Instagram busy (adding posts,
  // starting a video) scrolling sticks for a moment. So the filter listens to them only where
  // a reel can be on screen: never on Home and the other pages where swiping is free.
  const SCROLL_EVENTS = ['touchstart', 'touchmove', 'wheel'];
  let guardingScroll = false;

  function guardScrolling() {
    const on = !!settings.reelSwipe && !FREE_SWIPE_PAGES.includes(page);
    if (on === guardingScroll) return;
    guardingScroll = on;
    for (const type of SCROLL_EVENTS) {
      if (on) window.addEventListener(type, guard, { capture: true, passive: false });
      else window.removeEventListener(type, guard, { capture: true });
    }
  }

  // A text box Instagram focuses while a reel is on screen, without your tap just before
  // (a swipe, a long press, or by itself), is closed right away: no keyboard over a reel.
  // The one you tapped keeps it, as long as you're in it.
  window.addEventListener(
    'focusin',
    (e) => {
      if (!shieldOn || !editable(e.target) || isOurs(e.target)) return;
      if (e.target === typingIn || Date.now() - tappedAt < TAP_FOCUS_MS) {
        typingIn = e.target;
        return;
      }
      e.target.blur();
      if (Date.now() - focusLoggedAt > 5000) {
        focusLoggedAt = Date.now();
        log.add('reel: Instagram opened a text box by itself, closed it (no keyboard)');
      }
    },
    true,
  );
  window.addEventListener('focusout', (e) => e.target === typingIn && (typingIn = null), true);

  // For the report: a swipe left free on a page with a video, and why (how much of the
  // screen the biggest video took), in case a reel viewer isn't recognised.
  let freeSwipeLoggedAt = 0;
  function noteFreeSwipe() {
    if (!settings.reelSwipe || FREE_SWIPE_PAGES.includes(page) || Date.now() - freeSwipeLoggedAt < 5000) return;
    let biggest = null;
    for (const video of document.querySelectorAll('video')) {
      const r = video.getBoundingClientRect();
      if (!biggest || r.height * r.width > biggest.height * biggest.width) biggest = r;
    }
    if (!biggest) return;
    freeSwipeLoggedAt = Date.now();
    const share = (a, b) => Math.round((a / b) * 100);
    log.add(
      `swipe left free on ${pageLabel()}: biggest video ${share(biggest.width, window.innerWidth)}% wide, ` +
        `${share(biggest.height, window.innerHeight)}% tall, top at ${share(biggest.top, window.innerHeight)}%`,
    );
  }

  // The video filling most of the screen, if any (at least half the screen tall, mostly in view).
  function mainVideo() {
    let best = null;
    let bestShown = 0;
    for (const video of document.querySelectorAll('video')) {
      const r = video.getBoundingClientRect();
      if (r.height < window.innerHeight * 0.5) continue;
      const shown = Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0);
      if (shown < Math.min(r.height, window.innerHeight) * 0.6) continue;
      if (shown > bestShown) {
        best = video;
        bestShown = shown;
      }
    }
    return best;
  }

  function scrollerOf(el) {
    for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) {
      if (/(auto|scroll)/.test(getComputedStyle(n).overflowY) && n.scrollHeight > n.clientHeight + 10) return n;
    }
    return document.scrollingElement || document.documentElement;
  }

  // The reel a video belongs to: a reel link in the part of the page around it alone.
  function reelIdNear(video) {
    let item = video;
    while (item.parentElement && item.parentElement !== document.body && item.parentElement.querySelectorAll('video').length === 1) {
      item = item.parentElement;
    }
    for (const a of item.querySelectorAll('a[href]')) {
      try {
        const m = reelRe.exec(new URL(a.getAttribute('href'), location.href).pathname);
        if (m) return m[1];
      } catch (e) {
        /* not an address */
      }
    }
    return null;
  }

  function offScreen(el) {
    const r = el.getBoundingClientRect();
    return r.bottom < window.innerHeight * 0.25 || r.top > window.innerHeight * 0.75;
  }

  function watchReel() {
    if (!settings.reelSwipe || FREE_SWIPE_PAGES.includes(page)) {
      reelWatch = null;
      return;
    }
    if (blocked || document.hidden) return;
    // Off a reel's page, only while the shield says a reel is on screen: a video in a chat
    // you came back to is never taken for another reel.
    if (!REEL_PAGES.includes(page) && !shieldOn) {
      reelWatch = null;
      return;
    }
    // On a reel's page, the main video; elsewhere (the address changed, a reel over a
    // chat), one filling the screen. When none has been there for a while, the reel closed.
    const video = REEL_PAGES.includes(page) || reelWatch ? mainVideo() : fullScreenVideo();
    if (!video) {
      if (reelWatch && !REEL_PAGES.includes(page) && Date.now() - reelWatch.seen > 1500) reelWatch = null;
      return;
    }
    if (reelWatch) reelWatch.seen = Date.now();
    if (!reelWatch) {
      const scroller = scrollerOf(video);
      const fromPath = reelRe.exec(location.pathname);
      reelWatch = {
        video, scroller, top: scroller.scrollTop, id: reelIdNear(video) || (fromPath && fromPath[1]), path: location.pathname, seen: Date.now(),
      };
      log.add('reel page: watching the reel you opened');
      if (!reelNoted) {
        reelNoted = true;
        log.note('the reel page', outlineOf(document.querySelector('main') || document.body));
      }
      return;
    }
    const w = reelWatch;
    const otherId = reelIdNear(video);
    if (video === w.video && !(otherId && w.id && otherId !== w.id)) return; // the same player can show another reel
    const moved = w.scroller.isConnected && Math.abs(w.scroller.scrollTop - w.top) > window.innerHeight * 0.4;
    const yoursGone = w.video.isConnected && offScreen(w.video);
    if (moved || yoursGone || (otherId && w.id && otherId !== w.id)) {
      pauseMedia();
      log.add('reel page: another reel came up, blocked');
      showBlocked(REEL_SWIPE.toggle, false, () => {
        if (w.scroller.isConnected) w.scroller.scrollTo({ top: w.top });
        else if (w.video.isConnected) w.video.scrollIntoView({ block: 'center' });
        else location.replace(w.path);
      });
    } else {
      w.video = video; // your reel, drawn again by Instagram
    }
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
  setInterval(watchReel, 300); // another reel taking the place of the one you opened
  setInterval(updateShield, 200); // a reel coming on screen, or leaving it
  window.addEventListener('scroll', () => !FREE_SWIPE_PAGES.includes(page) && watchReel(), { capture: true, passive: true }); // and right away
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
