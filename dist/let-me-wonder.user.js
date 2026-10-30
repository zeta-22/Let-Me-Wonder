// ==UserScript==
// @name         Let Me Wonder
// @namespace    https://github.com/zeta-22/Let-Me-Wonder
// @version      0.2.0
// @description  Instagram without Reels, Explore, suggestions and ads.
// @match        https://www.instagram.com/*
// @match        https://instagram.com/*
// @run-at       document-start
// @inject-into  content
// @noframes
// @grant        none
// @homepageURL  https://github.com/zeta-22/Let-Me-Wonder
// @updateURL    https://raw.githubusercontent.com/zeta-22/Let-Me-Wonder/main/dist/let-me-wonder.user.js
// @downloadURL  https://raw.githubusercontent.com/zeta-22/Let-Me-Wonder/main/dist/let-me-wonder.user.js
// ==/UserScript==

// Built from src/filter/ by scripts/build-filter.mjs. Edit those files, not this one.
(() => {
  // src/filter/rules.js
  var RULES_VERSION = "2026.10.30";
  var TOGGLES = [
    { id: "reelsTab", label: "Reels tab and Reels pages", blocked: "Reels are switched off." },
    { id: "feedReels", label: "Reels in the home feed", blocked: "Reels are switched off." },
    { id: "explore", label: "Explore grid", blocked: "Explore is switched off. Searching for accounts still works." },
    { id: "suggested", label: "Suggested posts and accounts", blocked: "Suggestions are switched off." },
    { id: "ads", label: "Ads and sponsored posts", blocked: "Ads are switched off." },
    { id: "reelSwipe", label: "Swiping to the next reel", blocked: "You watched the reel you opened. Moving on to other reels is switched off." }
  ];
  var PAGES = [
    { name: "home", path: "^/$" },
    { name: "explore", path: "^/explore/?$" },
    { name: "search", path: "^/explore/search(/|$)" },
    { name: "reel", path: "^/(?:[^/]+/)?reels?/[^/]+/?$" },
    { name: "post", path: "^/(?:[^/]+/)?p/[^/]+" },
    { name: "direct", path: "^/direct(/|$)" },
    { name: "stories", path: "^/stories(/|$)" },
    { name: "login", path: "^/(accounts/(login|emailsignup|password|onetap)|challenge)(/|$)" }
  ];
  var ROUTES = [
    { path: "^/reels/?$", toggle: "reelsTab", action: "block" },
    // the Reels tab
    { path: "^/reels/audio/", toggle: "reelsTab", action: "block" },
    // "more reels with this sound"
    // A link into the swipeable reels feed (e.g. in a DM) opens just that one reel.
    { path: "^/reels/([^/]+)/?$", toggle: "reelsTab", action: "redirect", to: "/reel/$1/", onlyWhenTapped: true },
    { path: "^/[^/]+/reels/?$", toggle: "reelsTab", action: "block" },
    // the Reels tab on a profile
    { path: "^/explore/(tags|locations)/", toggle: "explore", action: "block" },
    // hashtag and place grids
    { path: "^/explore/people/", toggle: "suggested", action: "block" }
    // "Discover people"
  ];
  var REEL_SWIPE = { toggle: "reelSwipe", path: "^/(?:[^/]+/)?reels?/([^/]+)/?$" };
  var CSS_RULES = [
    { toggle: "reelsTab", css: ['a[href$="/reels/"]'] },
    // Reels tab, also on profiles
    {
      toggle: "feedReels",
      page: "home",
      css: ['article:has(a[href*="/reel/"])', 'article:has(a[href^="/reels/audio/"])']
      // reel posts in the feed
    },
    { toggle: "explore", page: "explore", css: ['a[href*="/p/"]', 'a[href*="/reel/"]'] },
    // Explore grid tiles; the search box stays
    { toggle: "suggested", css: ['a[href^="/explore/people/"]'] }
    // "See all" suggested people
  ];
  var LABELS = {
    sponsored: ["Sponsored", "Sponsorizzato", "Sponsorizzata", "Publicidad", "Patrocinado", "Sponsoris\xE9", "Gesponsert", "Gesponsord"],
    suggestedForYou: [
      "Suggested for you",
      "Suggeriti per te",
      "Suggerimenti per te",
      "Sugerencias para ti",
      "Sugeridos para ti",
      "Sugest\xF5es para voc\xEA",
      "Suggestions pour vous",
      "Vorschl\xE4ge f\xFCr dich"
    ],
    suggestedPosts: [
      "Suggested posts",
      "Post suggeriti",
      "Publicaciones sugeridas",
      "Publica\xE7\xF5es sugeridas",
      "Publications sugg\xE9r\xE9es",
      "Vorgeschlagene Beitr\xE4ge"
    ],
    suggestedReels: ["Suggested reels", "Reel suggeriti", "Reels suggeriti", "Reels sugeridos"],
    caughtUp: ["You're all caught up", "Sei in pari", "Hai visualizzato tutto", "Ya est\xE1s al d\xEDa", "Voc\xEA est\xE1 em dia", "Vous \xEAtes \xE0 jour"]
  };
  var LABEL_RULES = [
    { label: "sponsored", toggle: "ads", hide: ["post"] },
    { label: "suggestedForYou", toggle: "suggested", hide: ["block"] },
    { label: "suggestedPosts", toggle: "suggested", hide: ["block", "after"] },
    { label: "suggestedReels", toggle: "suggested", hide: ["block"] },
    { label: "caughtUp", toggle: "suggested", hide: ["after"] }
  ];
  var LABEL_SKIP_PAGES = ["direct", "login"];
  var STRUCTURE = {
    post: "article",
    // one post in a feed
    content: 'article, a[href*="/p/"], a[href*="/reel/"]',
    // other content: a block never grows to include it
    boundary: 'main, [role="main"], nav, header, [role="dialog"], body',
    // a block never grows past or around these
    maxLevels: 8
    // how many levels up a block can grow from its label
  };

  // src/filter/routes.js
  var pages = PAGES.map((p) => ({ name: p.name, re: new RegExp(p.path) }));
  var routes = ROUTES.map((r) => ({ ...r, re: new RegExp(r.path) }));
  var reelRe = new RegExp(REEL_SWIPE.path);
  function pageOf(path) {
    for (const p of pages) if (p.re.test(path)) return p.name;
    return "other";
  }
  function reelId(path) {
    const m = path && reelRe.exec(path);
    return m ? m[1] : null;
  }
  function decide(path, fromPath, settings, { tapped = false } = {}) {
    if (settings[REEL_SWIPE.toggle]) {
      const from = reelId(fromPath);
      const to = reelId(path);
      if (from && to && from !== to) return { action: "block", toggle: REEL_SWIPE.toggle };
    }
    for (const r of routes) {
      if (!settings[r.toggle]) continue;
      const m = r.re.exec(path);
      if (!m) continue;
      if (r.action === "redirect" && (tapped || !r.onlyWhenTapped)) {
        return { action: "redirect", toggle: r.toggle, to: r.to.replace(/\$(\d)/g, (_, i) => m[i] || "") };
      }
      return { action: "block", toggle: r.toggle };
    }
    return { action: "allow" };
  }

  // src/filter/report.js
  var HIDE_ATTR = "data-lmw-hide";
  var MAX_LINES = 2500;
  var MAX_DEPTH = 45;
  var MAX_TEXT = 40;
  var REPEAT_SHOWN = 4;
  var SKIP_TAGS = /* @__PURE__ */ new Set(["SCRIPT", "STYLE", "NOSCRIPT", "LINK", "META", "TEMPLATE", "HEAD"]);
  var PATH_WORDS = /* @__PURE__ */ new Set([
    "p",
    "reel",
    "reels",
    "tv",
    "explore",
    "search",
    "tags",
    "locations",
    "people",
    "direct",
    "inbox",
    "t",
    "new",
    "stories",
    "highlights",
    "accounts",
    "activity",
    "edit",
    "login",
    "emailsignup",
    "password",
    "reset",
    "onetap",
    "create",
    "select",
    "style",
    "details",
    "audio",
    "tagged",
    "saved",
    "comments",
    "liked_by",
    "followers",
    "following",
    "about",
    "challenge",
    "web",
    "your_activity",
    "settings",
    "notifications"
  ]);
  var ID_AFTER = /* @__PURE__ */ new Set(["p", "reel", "reels", "tv", "t", "audio", "highlights", "locations", "tags"]);
  function redactPath(path) {
    const segs = path.split("/").filter(Boolean);
    const out = segs.map((s, i) => {
      if (PATH_WORDS.has(s)) return s;
      const prev = segs[i - 1];
      if (prev === "stories") return "{user}";
      if (prev && ID_AFTER.has(prev)) return "{id}";
      return i === 0 ? "{user}" : "{x}";
    });
    return "/" + out.join("/") + (segs.length && path.endsWith("/") ? "/" : "");
  }
  function redactHref(href) {
    let url;
    try {
      url = new URL(href, location.href);
    } catch (e) {
      return "{bad-link}";
    }
    if (url.origin !== location.origin) return "ext:" + url.hostname;
    return redactPath(url.pathname);
  }
  function collectUsernames() {
    const names = /* @__PURE__ */ new Set();
    for (const a of document.querySelectorAll("a[href]")) {
      let url;
      try {
        url = new URL(a.getAttribute("href"), location.href);
      } catch (e) {
        continue;
      }
      if (url.origin !== location.origin) continue;
      const segs = url.pathname.split("/").filter(Boolean);
      const candidate = segs[0] === "stories" ? segs[1] : segs[0];
      if (candidate && !PATH_WORDS.has(candidate) && candidate.length > 1) names.add(candidate.toLowerCase());
    }
    return names;
  }
  function escapeRe(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  function makeMasker(usernames) {
    const list = [...usernames].sort((a, b) => b.length - a.length).map(escapeRe);
    const re = list.length ? new RegExp("(^|[^\\w.])(" + list.join("|") + ")(?![\\w])", "gi") : null;
    return (text) => {
      let t = text.replace(/@[\w.]+/g, "@{user}");
      if (re) t = t.replace(re, "$1{user}");
      return t;
    };
  }
  function ownText(el2) {
    let t = "";
    for (const n of el2.childNodes) if (n.nodeType === 3) t += n.data;
    return t.replace(/\s+/g, " ").trim();
  }
  function describe(el2, ctx) {
    const tag = el2.tagName.toLowerCase();
    const parts = [tag];
    const role = el2.getAttribute("role");
    if (role) parts.push("role=" + role);
    const aria = el2.getAttribute("aria-label");
    if (aria) parts.push('aria="' + ctx.mask(aria).slice(0, 60) + '"');
    if (tag === "a" && el2.hasAttribute("href")) parts.push("href=" + redactHref(el2.getAttribute("href")));
    if (tag === "input" || tag === "button") {
      const type = el2.getAttribute("type");
      if (type) parts.push("type=" + type);
    }
    if (tag === "input" || tag === "textarea") {
      const ph = el2.getAttribute("placeholder");
      if (ph) parts.push('placeholder="' + ctx.mask(ph).slice(0, 40) + '"');
    }
    if (tag === "img" && el2.getAttribute("alt")) parts.push("alt=\u2026");
    const hidden = el2.getAttribute(HIDE_ATTR);
    if (hidden) parts.push("{hidden:" + hidden + "}");
    if (ctx.allowText && tag !== "textarea") {
      const text = ownText(el2);
      if (text && text.length <= MAX_TEXT) parts.push('"' + ctx.mask(text) + '"');
      else if (text) parts.push('"\u2026' + text.length + ' chars"');
    }
    return parts.join(" ");
  }
  function signature(el2) {
    return el2.tagName + "|" + (el2.getAttribute("role") || "") + "|" + el2.childElementCount;
  }
  function walk(el2, depth, ctx) {
    if (ctx.lines.length >= MAX_LINES) return;
    if (SKIP_TAGS.has(el2.tagName) || el2.id && el2.id.startsWith("lmw-")) return;
    const indent = "  ".repeat(depth);
    ctx.lines.push(indent + describe(el2, ctx));
    if (el2.tagName === "svg" || el2.tagName === "SVG" || depth >= MAX_DEPTH) return;
    const kids = [...el2.children];
    for (let i = 0; i < kids.length; i++) {
      const sig = signature(kids[i]);
      let run = 1;
      while (i + run < kids.length && signature(kids[i + run]) === sig) run++;
      if (run > REPEAT_SHOWN + 2) {
        for (let j = 0; j < REPEAT_SHOWN; j++) walk(kids[i + j], depth + 1, ctx);
        ctx.lines.push(indent + "  \u2026 " + (run - REPEAT_SHOWN) + " more like the one above");
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
          n = "unsupported";
        }
        out.push(`  ${rule.toggle}${rule.page ? " @" + rule.page : ""}  ${sel}  -> ${n}`);
      }
    }
    return out;
  }
  function buildReport({ version, rulesVersion, host, settings, page }) {
    const mask = makeMasker(collectUsernames());
    const hiddenCounts = {};
    for (const el2 of document.querySelectorAll("[" + HIDE_ATTR + "]")) {
      for (const t of el2.getAttribute(HIDE_ATTR).split(/\s+/)) hiddenCounts[t] = (hiddenCounts[t] || 0) + 1;
    }
    const head = [
      "Let Me Wonder problem report",
      `version ${version} \xB7 rules ${rulesVersion} \xB7 ${host}`,
      `page: ${page}   path: ${redactPath(location.pathname)}`,
      `screen: ${window.innerWidth}x${window.innerHeight}   ${navigator.userAgent}`,
      "switches: " + TOGGLES.map((t) => `${t.id}=${settings[t.id] ? "on" : "off"}`).join(" "),
      "hidden by labels: " + (Object.entries(hiddenCounts).map(([k, v]) => `${k}\xD7${v}`).join(" ") || "none"),
      "css rule matches:",
      ...cssMatches(),
      "---"
    ];
    const ctx = { lines: [], mask, allowText: page !== "direct" };
    if (document.body) walk(document.body, 0, ctx);
    if (ctx.lines.length >= MAX_LINES) ctx.lines.push("\u2026 (cut here, page is very long)");
    return head.concat(ctx.lines).join("\n");
  }

  // src/filter/ui.css
  var ui_default = "/* Let Me Wonder: look of the Blocked screen, settings button and settings panel.\n   Lives in its own shadow root, so Instagram's styles can't touch it. */\n\n:host {\n  --bg: #ffffff;\n  --fg: #111111;\n  --muted: #6b6b6b;\n  --line: #e4e4e4;\n  --accent: #2f6f4f;\n  --accent-fg: #ffffff;\n  --shade: rgba(0, 0, 0, 0.35);\n}\n@media (prefers-color-scheme: dark) {\n  :host {\n    --bg: #121212;\n    --fg: #f2f2f2;\n    --muted: #a0a0a0;\n    --line: #2c2c2c;\n    --accent: #6fbf94;\n    --accent-fg: #0b1f14;\n    --shade: rgba(0, 0, 0, 0.6);\n  }\n}\n\n/* Set on each top-level piece: the host element itself is reset to keep Instagram's styles out. */\n.blocked, .gear, .backdrop {\n  font: 15px/1.4 -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;\n  color: var(--fg);\n}\n\n[hidden] { display: none !important; }\nbutton { font: inherit; color: inherit; cursor: pointer; -webkit-tap-highlight-color: transparent; }\n\n/* Blocked screen */\n.blocked {\n  position: fixed;\n  inset: 0;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  padding: 24px;\n  background: var(--bg);\n  pointer-events: auto;\n}\n.blocked .card { max-width: 340px; text-align: center; }\n.blocked .leaf { width: 44px; height: 44px; color: var(--accent); }\n.blocked h1 { font-size: 21px; margin: 12px 0 8px; }\n.blocked p { color: var(--muted); margin: 0 0 22px; }\n.primary {\n  border: 0;\n  border-radius: 10px;\n  padding: 12px 26px;\n  background: var(--accent);\n  color: var(--accent-fg);\n  font-weight: 600;\n}\n\n/* Small settings button (Safari only) */\n.gear {\n  position: fixed;\n  right: 10px;\n  bottom: calc(env(safe-area-inset-bottom, 0px) + 64px);\n  width: 34px;\n  height: 34px;\n  border-radius: 50%;\n  border: 1px solid var(--line);\n  background: var(--bg);\n  color: var(--muted);\n  opacity: 0.55;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  padding: 0;\n  pointer-events: auto;\n}\n.gear svg { width: 18px; height: 18px; }\n\n/* Settings panel */\n.backdrop {\n  position: fixed;\n  inset: 0;\n  background: var(--shade);\n  display: flex;\n  align-items: flex-end;\n  justify-content: center;\n  pointer-events: auto;\n}\n.sheet {\n  width: 100%;\n  max-width: 480px;\n  max-height: 88vh;\n  overflow-y: auto;\n  background: var(--bg);\n  border-radius: 16px 16px 0 0;\n  padding: 16px 18px calc(env(safe-area-inset-bottom, 0px) + 18px);\n}\n.sheet-head { display: flex; align-items: center; justify-content: space-between; }\n.sheet h2 { font-size: 18px; margin: 0; }\n.close { border: 0; background: none; font-size: 22px; padding: 4px 8px; color: var(--muted); }\n.toggles { list-style: none; margin: 10px 0; padding: 0; }\n.toggles li { border-bottom: 1px solid var(--line); }\n.toggles label { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 0; }\n.toggles input { width: 22px; height: 22px; accent-color: var(--accent); flex: none; }\n.secondary {\n  width: 100%;\n  margin-top: 14px;\n  border: 1px solid var(--line);\n  border-radius: 10px;\n  padding: 11px;\n  background: none;\n}\n.status { min-height: 1.4em; margin: 10px 0 0; color: var(--accent); font-size: 14px; }\n.manual { width: 100%; height: 120px; margin-top: 8px; font: 12px/1.3 ui-monospace, Menlo, monospace; }\n.foot { color: var(--muted); font-size: 12px; margin: 12px 0 0; }\n";

  // src/filter/ui.js
  var LEAF_ICON = '<svg class="leaf" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14z"/><path d="M5 19l7-7"/></svg>';
  var SLIDERS_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/></svg>';
  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k === "text") node.textContent = v;
      else if (k === "html") node.innerHTML = v;
      else node.setAttribute(k, v);
    }
    for (const c of children || []) node.appendChild(c);
    return node;
  }
  function createUi(options) {
    const host = el("div", { id: "lmw-ui" });
    host.style.cssText = "all: initial; position: fixed; inset: 0; z-index: 2147483647; pointer-events: none;";
    const shadow = host.attachShadow({ mode: "open" });
    shadow.appendChild(el("style", { text: ui_default }));
    const blockedMsg = el("p");
    const backButton = el("button", { class: "primary", type: "button", text: "Go back" });
    const blocked = el("div", { class: "blocked", role: "dialog", "aria-modal": "true", "aria-labelledby": "lmw-blocked-title", hidden: "" }, [
      el("div", { class: "card" }, [
        el("div", { html: LEAF_ICON }),
        el("h1", { id: "lmw-blocked-title", text: "This part is switched off" }),
        blockedMsg,
        backButton
      ])
    ]);
    let onBack = null;
    backButton.addEventListener("click", () => onBack && onBack());
    const gear = el("button", { class: "gear", type: "button", "aria-label": "Let Me Wonder settings", html: SLIDERS_ICON, hidden: "" });
    gear.addEventListener("click", () => options.onGear ? options.onGear() : openPanel());
    const switches = options.toggles.map((t) => ({ id: t.id, label: t.label }));
    switches.push({ id: "showGear", label: "Show the settings button" });
    const inputs = {};
    const list = el(
      "ul",
      { class: "toggles" },
      switches.map((s) => {
        const input = el("input", { type: "checkbox", role: "switch", "data-id": s.id });
        inputs[s.id] = input;
        input.addEventListener("change", () => options.onChange({ [s.id]: input.checked }));
        return el("li", {}, [el("label", {}, [el("span", { text: s.label }), input])]);
      })
    );
    const status = el("p", { class: "status", "aria-live": "polite" });
    const reportButton = el("button", { class: "secondary", type: "button", text: "Copy problem report" });
    const closeButton = el("button", { class: "close", type: "button", "aria-label": "Close", text: "\u2715" });
    const sheet = el("div", { class: "sheet", role: "dialog", "aria-modal": "true", "aria-label": "Let Me Wonder settings" }, [
      el("div", { class: "sheet-head" }, [el("h2", { text: "Let Me Wonder" }), closeButton]),
      list,
      reportButton,
      status,
      el("p", {
        class: "foot",
        text: `Version ${options.version} \xB7 rules ${options.rulesVersion}. If you hide the settings button, open instagram.com/#lmw to get here.`
      })
    ]);
    const backdrop = el("div", { class: "backdrop", hidden: "" }, [sheet]);
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) closePanel();
    });
    closeButton.addEventListener("click", () => closePanel());
    reportButton.addEventListener("click", () => copyReport());
    shadow.append(blocked, gear, backdrop);
    let gearWanted = false;
    function refreshGear() {
      gear.hidden = !gearWanted || !blocked.hidden || !backdrop.hidden;
    }
    function openPanel() {
      const s = options.getSettings();
      for (const [id, input] of Object.entries(inputs)) input.checked = !!s[id];
      status.textContent = "";
      const old = sheet.querySelector(".manual");
      if (old) old.remove();
      backdrop.hidden = false;
      refreshGear();
    }
    function closePanel() {
      backdrop.hidden = true;
      refreshGear();
    }
    async function copyReport() {
      const text = options.getReport();
      try {
        await navigator.clipboard.writeText(text);
        status.textContent = "Copied. Paste it to Claude.";
      } catch (e) {
        status.textContent = "Couldn't copy by itself: select all the text below and copy it.";
        const box = el("textarea", { class: "manual", readonly: "" });
        box.value = text;
        status.after(box);
        box.select();
      }
    }
    return {
      mount() {
        if (!host.isConnected) document.documentElement.appendChild(host);
      },
      showBlocked(message, handleBack) {
        blockedMsg.textContent = message;
        onBack = handleBack;
        blocked.hidden = false;
        backdrop.hidden = true;
        refreshGear();
      },
      hideBlocked() {
        blocked.hidden = true;
        onBack = null;
        refreshGear();
      },
      setGearVisible(visible) {
        gearWanted = visible;
        refreshGear();
      },
      openPanel
    };
  }

  // src/filter/filter.css
  var filter_default = "/* Let Me Wonder: page styles that don't depend on Instagram's layout.\n   Rules that do (selectors, labels) live in rules.js and are added next to this. */\n\n/* While the Blocked screen is up, the page under it is hidden. */\nhtml[data-lmw-blocked] body {\n  visibility: hidden !important;\n}\n";

  // src/filter/filter.js
  var VERSION = true ? "0.2.0" : "dev";
  var SETTINGS_KEY = "lmw-settings-v1";
  var FROM_PATH_KEY = "lmw-from-path";
  var HIDE_ATTR2 = "data-lmw-hide";
  var NO_GEAR_PAGES = ["direct", "stories", "login"];
  function normalize(text) {
    return text.replace(/[​-‍﻿]/g, "").replace(/[‘’ʼ`´]/g, "'").replace(/\s+/g, " ").trim().replace(/[.!…]+$/, "").toLowerCase();
  }
  var labelIndex = /* @__PURE__ */ new Map();
  for (const rule of LABEL_RULES) {
    for (const text of LABELS[rule.label] || []) {
      const key = normalize(text);
      if (!labelIndex.has(key)) labelIndex.set(key, []);
      labelIndex.get(key).push(rule);
    }
  }
  var MAX_LABEL_LENGTH = Math.max(...[...labelIndex.keys()].map((k) => k.length)) + 8;
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
    }
  }
  function start() {
    const config = window.__LMW_CONFIG__ || {};
    const host = config.host === "app" ? "app" : "safari";
    const settings = loadSettings(config.settings);
    const root = document.documentElement;
    let page = pageOf(location.pathname);
    let lastPath = null;
    const arrivedFrom = sessionTake(FROM_PATH_KEY);
    let allowedPath = arrivedFrom;
    let navCount = 0;
    let blocked = null;
    let afterMarkers = [];
    const labeled = /* @__PURE__ */ new WeakSet();
    function loadSettings(fromApp) {
      const s = { showGear: true };
      for (const t of TOGGLES) s[t.id] = true;
      let saved = fromApp;
      if (!saved) {
        try {
          saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "null");
        } catch (e) {
          saved = null;
        }
      }
      if (saved && typeof saved === "object") {
        for (const k of Object.keys(s)) if (typeof saved[k] === "boolean") s[k] = saved[k];
      }
      return s;
    }
    function setSettings(partial) {
      for (const k of Object.keys(settings)) if (typeof partial[k] === "boolean") settings[k] = partial[k];
      if (host !== "app") {
        try {
          localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
        } catch (e) {
        }
      }
      applyRootState();
      lastPath = null;
      checkPath();
    }
    function buildCss() {
      const parts = [filter_default];
      for (const t of TOGGLES) parts.push(`html[data-lmw-on~="${t.id}"] [${HIDE_ATTR2}~="${t.id}"]{display:none!important}`);
      for (const rule of CSS_RULES) {
        const scope = `html[data-lmw-on~="${rule.toggle}"]` + (rule.page ? `[data-lmw-page="${rule.page}"]` : "");
        for (const sel of rule.css) parts.push(`${scope} ${sel}{display:none!important}`);
      }
      return parts.join("\n");
    }
    function applyRootState() {
      root.setAttribute("data-lmw-on", TOGGLES.filter((t) => settings[t.id]).map((t) => t.id).join(" "));
      root.setAttribute("data-lmw-page", page);
      if (blocked) root.setAttribute("data-lmw-blocked", blocked.toggle);
      else root.removeAttribute("data-lmw-blocked");
      ui.setGearVisible((host === "app" || settings.showGear) && !NO_GEAR_PAGES.includes(page));
    }
    function checkPath() {
      const path = location.pathname;
      if (path === lastPath) return;
      if (lastPath !== null) navCount++;
      lastPath = path;
      page = pageOf(path);
      const verdict = decide(path, allowedPath, settings);
      if (verdict.action === "redirect") {
        sessionPut(FROM_PATH_KEY, allowedPath);
        root.setAttribute("data-lmw-blocked", verdict.toggle);
        location.replace(verdict.to);
        return;
      }
      if (verdict.action === "block") {
        showBlocked(verdict.toggle, true);
      } else {
        allowedPath = path;
        if (blocked) hideBlocked();
      }
      applyRootState();
      notifyHost({ type: "page", path, allowedPath });
      scanAll();
    }
    function onClick(e) {
      const link = e.target && e.target.closest ? e.target.closest("a[href]") : null;
      if (!link) return;
      let url;
      try {
        url = new URL(link.getAttribute("href"), location.href);
      } catch (err) {
        return;
      }
      if (url.origin !== location.origin) return;
      const verdict = decide(url.pathname, allowedPath, settings, { tapped: true });
      if (verdict.action === "allow") return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (verdict.action === "redirect") {
        sessionPut(FROM_PATH_KEY, allowedPath);
        location.assign(verdict.to);
      } else {
        showBlocked(verdict.toggle, false);
      }
    }
    function messageFor(toggle) {
      const t = TOGGLES.find((x) => x.id === toggle);
      return t ? t.blocked : "This part of Instagram is switched off.";
    }
    function pauseMedia() {
      for (const m of document.querySelectorAll("video, audio")) {
        try {
          m.pause();
        } catch (e) {
        }
      }
    }
    function showBlocked(toggle, navigated) {
      blocked = { toggle, navigated };
      applyRootState();
      pauseMedia();
      ui.showBlocked(messageFor(toggle), goBack);
      notifyHost({ type: "blocked", toggle });
    }
    function hideBlocked() {
      blocked = null;
      ui.hideBlocked();
      applyRootState();
    }
    function goBack() {
      if (!blocked || !blocked.navigated) {
        hideBlocked();
      } else if (navCount > 0 || arrivedFrom) {
        history.back();
      } else {
        location.replace("/");
      }
    }
    function mark(node, toggle) {
      if (!node || node === root || node.matches(STRUCTURE.boundary)) return;
      const current = (node.getAttribute(HIDE_ATTR2) || "").split(" ").filter(Boolean);
      if (!current.includes(toggle)) node.setAttribute(HIDE_ATTR2, current.concat(toggle).join(" "));
    }
    function hasOutside(parent, inside, selector) {
      for (const x of parent.querySelectorAll(selector)) if (!inside.contains(x)) return true;
      return false;
    }
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
      return document.querySelector("main") || document.body;
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
        if (rule.hide.includes("post")) mark(label.closest(STRUCTURE.post), rule.toggle);
        if (rule.hide.includes("block")) mark(blockAround(label), rule.toggle);
        if (rule.hide.includes("after")) afterMarkers.push({ label, toggle: rule.toggle, page, feed: feedOf(label) });
      }
    }
    function isOurs(node) {
      return node.id === "lmw-ui" || node.id === "lmw-style";
    }
    function checkText(textNode) {
      const raw = textNode.data;
      if (!raw || raw.length > MAX_LABEL_LENGTH * 2) return;
      let el2 = textNode.parentElement;
      if (!el2) return;
      let rules = labelIndex.get(normalize(raw));
      for (let up = 0; !rules && up < 3 && el2; up++) {
        if (up > 0) el2 = el2.parentElement;
        if (!el2) return;
        const text = el2.textContent;
        if (text.length > MAX_LABEL_LENGTH * 2) return;
        rules = labelIndex.get(normalize(text));
      }
      if (rules && el2) applyLabel(el2, rules);
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
      if (root.getAttribute("data-lmw-on") === null) applyRootState();
      for (const r of records) {
        if (r.type === "characterData") scan(r.target);
        else for (const n of r.addedNodes) scan(n);
      }
      if (afterMarkers.length) hideAfterMarkers();
    }
    function notifyHost(message) {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ source: "lmw", ...message }));
      }
    }
    function report() {
      return buildReport({ version: VERSION, rulesVersion: RULES_VERSION, host, settings, page });
    }
    const ui = createUi({
      toggles: TOGGLES,
      version: VERSION,
      rulesVersion: RULES_VERSION,
      getSettings: () => ({ ...settings }),
      onChange: setSettings,
      getReport: report,
      onGear: host === "app" ? () => notifyHost({ type: "openSettings" }) : void 0
    });
    const style = document.createElement("style");
    style.id = "lmw-style";
    style.textContent = buildCss();
    (document.head || root).appendChild(style);
    ui.mount();
    applyRootState();
    checkPath();
    window.addEventListener("click", onClick, true);
    document.addEventListener("play", (e) => blocked && e.target.pause && e.target.pause(), true);
    window.addEventListener("popstate", checkPath);
    for (const fn of ["pushState", "replaceState"]) {
      const original = history[fn];
      try {
        history[fn] = function() {
          const result = original.apply(this, arguments);
          checkPath();
          return result;
        };
      } catch (e) {
      }
    }
    setInterval(checkPath, 300);
    new MutationObserver(onMutations).observe(root, { childList: true, subtree: true, characterData: true });
    function openFromHash() {
      if (location.hash === "#lmw" && host !== "app") {
        history.replaceState(history.state, "", location.pathname + location.search);
        ui.openPanel();
      }
    }
    window.addEventListener("hashchange", openFromHash);
    openFromHash();
    document.addEventListener("DOMContentLoaded", () => {
      ui.mount();
      scanAll();
    });
    window.__LMW__ = {
      version: VERSION,
      rulesVersion: RULES_VERSION,
      getSettings: () => ({ ...settings }),
      setSettings,
      buildReport: report,
      sendReport: () => notifyHost({ type: "report", text: report() }),
      openSettings: () => ui.openPanel()
    };
  }
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
})();
