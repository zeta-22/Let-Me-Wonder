// The filter's own screens: the Blocked screen, the small settings button, the settings
// panel (the panel is for Safari; the Android app has its own) and the clear shield over
// a reel, with its own buttons.
// Everything lives in one shadow root, so Instagram's styles can't change it.

import uiCss from './ui.css';

const LEAF_ICON =
  '<svg class="leaf" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14z"/><path d="M5 19l7-7"/></svg>';
const SLIDERS_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">' +
  '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/></svg>';

const icon = (paths) =>
  `<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
const PLAY_ICON = icon('<path d="M8 5v14l11-7z"/>');
const PAUSE_ICON = icon('<path d="M7 5h3v14H7zM14 5h3v14h-3z" stroke="none"/>');
const SOUND_ON_ICON = icon('<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" fill="none"/>');
const SOUND_OFF_ICON = icon('<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 9l6 6M22 9l-6 6" fill="none"/>');
const CLOSE_ICON = icon('<path d="M6 6l12 12M18 6L6 18" fill="none"/>');

function el(tag, attrs, children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === 'text') node.textContent = v;
    else if (k === 'html') node.innerHTML = v; // only used with the fixed icons above
    else node.setAttribute(k, v);
  }
  for (const c of children || []) node.appendChild(c);
  return node;
}

// options: { toggles, version, rulesVersion, getSettings, onChange(partial), getReport(),
//            tryCode(code) -> { ok, wait } (the lock on the switches, see lock.js),
//            onGear() (optional: what the settings button does instead of opening the panel),
//            onShield(part) (a tap on the reel's shield: 'play', 'sound', 'close' or 'shield') }
export function createUi(options) {
  const host = el('div', { id: 'lmw-ui' });
  host.style.cssText = 'all: initial; position: fixed; inset: 0; z-index: 2147483647; pointer-events: none;';
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.appendChild(el('style', { text: uiCss }));

  // Blocked screen
  const blockedMsg = el('p');
  const backButton = el('button', { class: 'primary', type: 'button', text: 'Go back' });
  const blocked = el('div', { class: 'blocked', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'lmw-blocked-title', hidden: '' }, [
    el('div', { class: 'card' }, [
      el('div', { html: LEAF_ICON }),
      el('h1', { id: 'lmw-blocked-title', text: 'This part is switched off' }),
      blockedMsg,
      backButton,
    ]),
  ]);
  let onBack = null;
  backButton.addEventListener('click', () => onBack && onBack());

  // The shield over a reel: clear, over the whole screen, so every touch lands on it and
  // none on Instagram. Its buttons: play/pause, sound, close. A tap anywhere else is
  // play/pause. The filter handles your taps on it before anything else sees them (see
  // guard() in filter.js); this listener is for clicks made by code.
  const playButton = el('button', { class: 'reel-button', type: 'button', 'data-part': 'play', 'aria-label': 'Pause', html: PAUSE_ICON });
  const soundButton = el('button', { class: 'reel-button', type: 'button', 'data-part': 'sound', 'aria-label': 'Sound on', html: SOUND_OFF_ICON });
  const closeReelButton = el('button', { class: 'reel-button', type: 'button', 'data-part': 'close', 'aria-label': 'Close the reel', html: CLOSE_ICON });
  const shield = el('div', { class: 'shield', 'data-part': 'shield', hidden: '' }, [
    el('div', { class: 'reel-bar', role: 'toolbar', 'aria-label': 'This reel only: no swiping' }, [playButton, soundButton, closeReelButton]),
  ]);
  function shieldPart(node) {
    const start = node && node.nodeType !== 1 ? node.parentElement : node;
    const part = start && start.closest ? start.closest('[data-part]') : null;
    return part && shield.contains(part) ? part.dataset.part : null;
  }
  shield.addEventListener('click', (e) => {
    const part = shieldPart(e.target);
    if (part && options.onShield) options.onShield(part);
  });
  let shieldState = {};

  // Settings button
  const gear = el('button', { class: 'gear', type: 'button', 'aria-label': 'Let Me Wonder settings', html: SLIDERS_ICON, hidden: '' });
  gear.addEventListener('click', () => (options.onGear ? options.onGear() : openPanel()));

  // Settings panel: the problem report and the switches that turn nothing back on are
  // free; the filters are locked with the code.
  const inputs = {};
  const lockedInputs = [];
  function switchList(switches) {
    return el(
      'ul',
      { class: 'toggles' },
      switches.map((s) => {
        const input = el('input', { type: 'checkbox', role: 'switch', 'data-id': s.id });
        inputs[s.id] = input;
        if (!s.free) lockedInputs.push(input);
        input.addEventListener('change', () => options.onChange({ [s.id]: input.checked }));
        return el('li', {}, [el('label', {}, [el('span', { text: s.label }), input])]);
      }),
    );
  }
  const freeList = switchList([
    ...options.toggles.filter((t) => t.free),
    { id: 'showGear', label: 'Show the settings button', free: true },
  ]);
  const list = switchList(options.toggles.filter((t) => !t.free));
  // The switches are locked until the code is entered, and lock again when the panel closes.
  const codeBox = el('input', {
    class: 'code', type: 'password', inputmode: 'numeric', autocomplete: 'off', maxlength: '12', 'aria-label': 'Code',
  });
  const unlockButton = el('button', { class: 'secondary unlock', type: 'button', text: 'Unlock' });
  const lockMsg = el('p', { class: 'lock-msg', 'aria-live': 'polite' });
  const lockRow = el('div', { class: 'lock' }, [lockMsg, el('div', { class: 'lock-entry' }, [codeBox, unlockButton])]);
  let unlocked = false;

  function setLocked(locked, message) {
    unlocked = !locked;
    for (const input of lockedInputs) input.disabled = locked;
    lockMsg.textContent = message || (locked ? 'Locked: enter the code to change the switches.' : 'Unlocked until you close this.');
    lockRow.querySelector('.lock-entry').hidden = !locked;
    codeBox.value = '';
  }

  function tryUnlock() {
    const result = options.tryCode(codeBox.value);
    if (result.ok) setLocked(false);
    else setLocked(true, result.wait ? `Too many tries: wait ${result.wait} s.` : 'Wrong code.');
  }
  unlockButton.addEventListener('click', tryUnlock);
  codeBox.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') tryUnlock();
  });

  const status = el('p', { class: 'status', 'aria-live': 'polite' });
  const reportButton = el('button', { class: 'secondary', type: 'button', text: 'Copy problem report' });
  const closeButton = el('button', { class: 'close', type: 'button', 'aria-label': 'Close', text: '✕' });
  const sheet = el('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Let Me Wonder settings' }, [
    el('div', { class: 'sheet-head' }, [el('h2', { text: 'Let Me Wonder' }), closeButton]),
    reportButton,
    status,
    freeList,
    el('h3', { class: 'section', text: 'Filters' }),
    lockRow,
    list,
    el('p', {
      class: 'foot',
      text: `Version ${options.version} · rules ${options.rulesVersion}. If you hide the settings button, open instagram.com/#lmw to get here.`,
    }),
  ]);
  const backdrop = el('div', { class: 'backdrop', hidden: '' }, [sheet]);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closePanel();
  });
  closeButton.addEventListener('click', () => closePanel());
  reportButton.addEventListener('click', () => copyReport());

  shadow.append(shield, blocked, gear, backdrop); // later ones on top: the shield is the lowest

  let gearWanted = false;
  function refreshGear() {
    gear.hidden = !gearWanted || !blocked.hidden || !backdrop.hidden;
  }

  function openPanel() {
    const s = options.getSettings();
    for (const [id, input] of Object.entries(inputs)) input.checked = !!s[id];
    setLocked(true);
    status.textContent = '';
    const old = sheet.querySelector('.manual');
    if (old) old.remove();
    backdrop.hidden = false;
    refreshGear();
  }

  function closePanel() {
    setLocked(true);
    backdrop.hidden = true;
    refreshGear();
  }

  async function copyReport() {
    const text = options.getReport();
    try {
      await navigator.clipboard.writeText(text);
      status.textContent = 'Copied. Paste it to Claude.';
    } catch (e) {
      status.textContent = "Couldn't copy by itself: select all the text below and copy it.";
      const box = el('textarea', { class: 'manual', readonly: '' });
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
    // 'side' moves it to the right edge, out of the way of the story viewer's buttons.
    setGearPlace(place) {
      if (place) gear.dataset.place = place;
      else delete gear.dataset.place;
    },
    setShield(on) {
      shield.hidden = !on;
    },
    // { playing, sound }: what the shield's buttons show.
    setShieldState(state) {
      if (state.playing === shieldState.playing && state.sound === shieldState.sound) return;
      shieldState = state;
      playButton.innerHTML = state.playing ? PAUSE_ICON : PLAY_ICON;
      playButton.setAttribute('aria-label', state.playing ? 'Pause' : 'Play');
      soundButton.innerHTML = state.sound ? SOUND_ON_ICON : SOUND_OFF_ICON;
      soundButton.setAttribute('aria-label', state.sound ? 'Sound off' : 'Sound on');
    },
    // Which part of the shield a node is: 'play', 'sound', 'close', 'shield', or null.
    shieldPart,
    openPanel,
  };
}
