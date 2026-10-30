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

import { TOGGLES, CSS_RULES, LABELS, LABEL_RULES, LABEL_SKIP_PAGES, STRUCTURE, RULES_VERSION } from './rules.js';
import { decide, pageOf } from './routes.js';
import { buildReport } from './report.js';
import { createUi } from './ui.js';
import pageCss from './filter.css';

const VERSION = typeof __LMW_VERSION__ !== 'undefined' ? __LMW_VERSION__ : 'dev';
const SETTINGS_KEY = 'lmw-settings-v1';
const FROM_PATH_KEY = 'lmw-from-path';
const HIDE_ATTR = 'data-lmw-hide';
const NO_GEAR_PAGES = ['direct', 'stories', 'login'];

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
  const labeled = new WeakSet();

  // --- settings -------------------------------------------------------------
  function loadSettings(fromApp) {
    const s = { showGear: true };
    for (const t of TOGGLES) s[t.id] = true;
    let saved = fromApp;
    if (!saved) {
      try {
        saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null');
      } catch (e) {
        saved = null;
      }
    }
    if (saved && typeof saved === 'object') {
      for (const k of Object.keys(s)) if (typeof saved[k] === 'boolean') s[k] = saved[k];
    }
    return s;
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
    for (const t of TOGGLES) parts.push(`html[data-lmw-on~="${t.id}"] [${HIDE_ATTR}~="${t.id}"]{display:none!important}`);
    for (const rule of CSS_RULES) {
      const scope = `html[data-lmw-on~="${rule.toggle}"]` + (rule.page ? `[data-lmw-page="${rule.page}"]` : '');
      // One block per selector, so a selector a browser doesn't support can't disable the others.
      for (const sel of rule.css) parts.push(`${scope} ${sel}{display:none!important}`);
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
  function checkPath() {
    const path = location.pathname;
    if (path === lastPath) return;
    if (lastPath !== null) navCount++;
    lastPath = path;
    page = pageOf(path);
    const verdict = decide(path, allowedPath, settings);
    if (verdict.action === 'redirect') {
      sessionPut(FROM_PATH_KEY, allowedPath);
      root.setAttribute('data-lmw-blocked', verdict.toggle); // hide the page while we leave it
      location.replace(verdict.to);
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
    if (verdict.action === 'redirect') {
      sessionPut(FROM_PATH_KEY, allowedPath);
      location.assign(verdict.to);
    } else {
      showBlocked(verdict.toggle, false);
    }
  }

  function messageFor(toggle) {
    const t = TOGGLES.find((x) => x.id === toggle);
    return t ? t.blocked : 'This part of Instagram is switched off.';
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
  function mark(node, toggle) {
    if (!node || node === root || node.matches(STRUCTURE.boundary)) return;
    const current = (node.getAttribute(HIDE_ATTR) || '').split(' ').filter(Boolean);
    if (!current.includes(toggle)) node.setAttribute(HIDE_ATTR, current.concat(toggle).join(' '));
  }

  function hasOutside(parent, inside, selector) {
    for (const x of parent.querySelectorAll(selector)) if (!inside.contains(x)) return true;
    return false;
  }

  // The block around a label: its post, or the largest group of elements around
  // it that holds no other content and doesn't cross a page landmark.
  function blockAround(label) {
    const post = label.closest(STRUCTURE.post);
    if (post) return post;
    let node = label;
    for (let i = 0; i < STRUCTURE.maxLevels; i++) {
      const parent = node.parentElement;
      if (!parent || parent.matches(STRUCTURE.boundary)) break;
      if (hasOutside(parent, node, STRUCTURE.content) || hasOutside(parent, node, STRUCTURE.boundary)) break;
      node = parent;
    }
    return node;
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
      if (rule.hide.includes('block')) mark(blockAround(label), rule.toggle);
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

  function scanAll() {
    if (document.body) scan(document.body);
    if (afterMarkers.length) hideAfterMarkers();
  }

  function onMutations(records) {
    checkPath();
    if (root.getAttribute('data-lmw-on') === null) applyRootState(); // in case the page reset our marks
    for (const r of records) {
      if (r.type === 'characterData') scan(r.target);
      else for (const n of r.addedNodes) scan(n);
    }
    if (afterMarkers.length) hideAfterMarkers();
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
  document.addEventListener('play', (e) => blocked && e.target.pause && e.target.pause(), true);
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
