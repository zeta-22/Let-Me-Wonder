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
//   4. Hidden posts in a feed keep a 1-pixel invisible placeholder, and a stuck
//      "loading" spinner gets a nudge, so Instagram's endless feed keeps loading.

import { TOGGLES, CSS_RULES, LABELS, LABEL_RULES, LABEL_SKIP_PAGES, STRUCTURE, RULES_VERSION } from './rules.js';
import { decide, homeRedirect, pageOf } from './routes.js';
import { withSaved } from './settings.js';
import { buildReport } from './report.js';
import { createUi } from './ui.js';
import pageCss from './filter.css';

const VERSION = typeof __LMW_VERSION__ !== 'undefined' ? __LMW_VERSION__ : 'dev';
const SETTINGS_KEY = 'lmw-settings-v1';
const FROM_PATH_KEY = 'lmw-from-path';
const HIDE_ATTR = 'data-lmw-hide';
const COLLAPSE_ATTR = 'data-lmw-collapse';
const NO_GEAR_PAGES = ['direct', 'stories', 'login'];
const HIDE_CSS = '{display:none!important}';
// Invisible, but still 1px tall: Instagram's endless feed keeps "seeing" it pass by.
const COLLAPSE_CSS =
  '{height:1px!important;min-height:0!important;max-height:1px!important;margin:0!important;padding:0!important;' +
  'border:0!important;overflow:hidden!important;visibility:hidden!important;pointer-events:none!important}';
const NUDGE_AFTER_MS = 1500; // spinner on screen this long with nothing new to show
const MAX_NUDGES = 30; // per stretch without a new visible post, so it can't load forever

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
  const settings = loadSettings(config.settings);
  const root = document.documentElement;

  let page = pageOf(location.pathname);
  let lastPath = null; // last path checked
  const arrivedFrom = sessionTake(FROM_PATH_KEY); // set when the filter itself sent us here
  let allowedPath = arrivedFrom; // last path allowed, to spot reel-to-reel moves
  let navCount = 0; // address changes since the page loaded
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
    for (const k of Object.keys(settings)) if (typeof partial[k] === 'boolean') settings[k] = partial[k];
    if (host !== 'app') {
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      } catch (e) {
        /* private mode: settings last until the tab closes */
      }
    }
    applyRootState();
    lastPath = null; // re-check the current page with the new switches
    checkPath();
  }

  // --- styles ---------------------------------------------------------------
  function buildCss() {
    const parts = [pageCss];
    for (const t of TOGGLES) {
      const marked = `html[data-lmw-on~="${t.id}"] [${HIDE_ATTR}~="${t.id}"]`;
      parts.push(`${marked}:not([${COLLAPSE_ATTR}])${HIDE_CSS}`, `${marked}[${COLLAPSE_ATTR}]${COLLAPSE_CSS}`);
    }
    for (const rule of CSS_RULES) {
      const scope = `html[data-lmw-on~="${rule.toggle}"]` + (rule.page ? `[data-lmw-page="${rule.page}"]` : '');
      // One block per selector, so a selector a browser doesn't support can't disable the others.
      for (const sel of rule.css) parts.push(`${scope} ${sel}${rule.collapse ? COLLAPSE_CSS : HIDE_CSS}`);
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
  }

  // --- pages and navigation ---------------------------------------------------
  function leaveFor(target, toggle, replace) {
    sessionPut(FROM_PATH_KEY, allowedPath);
    root.setAttribute('data-lmw-blocked', toggle); // hide the page while we leave it
    if (replace) location.replace(target);
    else location.assign(target);
  }

  function checkPath() {
    const path = location.pathname;
    if (path === lastPath) return;
    const firstCheck = lastPath === null && navCount === 0 && !allowedPath;
    if (lastPath !== null) navCount++;
    lastPath = path;
    page = pageOf(path);
    // Opened on the home feed: show the Following feed instead (only when the page loads,
    // so choosing "For you" in Instagram's own menu still works).
    const home = firstCheck && homeRedirect(path, location.search, settings);
    if (home) {
      leaveFor(home, 'followingFeed', true);
      return;
    }
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
    const home = homeRedirect(url.pathname, url.search, settings);
    const verdict = home ? null : decide(url.pathname, allowedPath, settings, { tapped: true });
    if (verdict && verdict.action === 'allow') return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (home) leaveFor(home, 'followingFeed', false); // the Home button: Following feed
    else if (verdict.action === 'redirect') leaveFor(verdict.to, verdict.toggle, false);
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

  // A video that starts playing while blocked, or inside a hidden post, is paused.
  function onPlay(e) {
    const media = e.target;
    if (!media || !media.pause) return;
    const post = media.closest && media.closest(STRUCTURE.post);
    if (blocked || (post && post.getBoundingClientRect().height <= 1)) media.pause();
  }

  function showBlocked(toggle, navigated) {
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
    // Posts, and blocks sitting between posts in a feed, keep a 1px placeholder.
    const inFeed = node.matches(STRUCTURE.post) || (node.parentElement && hasOutside(node.parentElement, node, STRUCTURE.post));
    if (inFeed) node.setAttribute(COLLAPSE_ATTR, '');
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
    if (rules && el) applyLabel(el, rules);
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

  function onMutations(records) {
    checkPath();
    if (root.getAttribute('data-lmw-on') === null) applyRootState(); // in case the page reset our marks
    for (const r of records) {
      if (r.type === 'characterData') scan(r.target);
      else for (const n of r.addedNodes) scan(n);
    }
    afterScan();
  }

  // --- keeping the endless feed loading ---------------------------------------
  // When most new posts are hidden, Instagram's "load more" spinner can stay on
  // screen without Instagram noticing it should load again. Moving the spinner out
  // of view and back for a moment, plus a scroll event, makes it check again.
  let spinnerSince = 0;
  let lastVisibleCount = -1;
  let nudges = 0;

  function visiblePosts() {
    let n = 0;
    for (const post of document.querySelectorAll(STRUCTURE.post)) if (post.getBoundingClientRect().height > 1) n++;
    return n;
  }

  function nudge(spinner) {
    const box = spinner.parentElement || spinner;
    const before = box.style.transform;
    box.style.transform = 'translateY(200000px)';
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        box.style.transform = before;
        window.dispatchEvent(new Event('scroll'));
      }),
    );
  }

  function watchFeed() {
    if (page !== 'home' || blocked || document.hidden) return;
    const count = visiblePosts();
    if (count !== lastVisibleCount) {
      lastVisibleCount = count;
      spinnerSince = 0;
      nudges = 0;
    }
    const spinner = document.querySelector(STRUCTURE.loader);
    const box = spinner && spinner.getBoundingClientRect();
    const onScreen = box && box.height > 0 && box.top < window.innerHeight && box.bottom > 0;
    if (!onScreen) {
      spinnerSince = 0;
      return;
    }
    const now = Date.now();
    if (!spinnerSince) spinnerSince = now;
    if (now - spinnerSince >= NUDGE_AFTER_MS && nudges < MAX_NUDGES) {
      nudges++;
      spinnerSince = now;
      nudge(spinner);
    }
  }

  // --- talking to the Android app (no-op in Safari) ---------------------------
  function notifyHost(message) {
    if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ source: 'lmw', ...message }));
    }
  }

  function report() {
    return buildReport({ version: VERSION, rulesVersion: RULES_VERSION, host, settings, page });
  }

  // --- start ----------------------------------------------------------------
  const ui = createUi({
    toggles: TOGGLES,
    version: VERSION,
    rulesVersion: RULES_VERSION,
    getSettings: () => ({ ...settings }),
    onChange: setSettings,
    getReport: report,
    onGear: host === 'app' ? () => notifyHost({ type: 'openSettings' }) : undefined,
  });

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
