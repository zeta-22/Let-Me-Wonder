// The switches' starting values, and how saved values are read back.
// Shared by the filter (Safari) and the Android app.

import { TOGGLES } from './rules.js';

export function defaultSettings() {
  const s = { showGear: true };
  for (const t of TOGGLES) s[t.id] = t.default !== false;
  return s;
}

// Defaults, overridden by whatever switches were saved before (unknown keys are ignored).
export function withSaved(saved) {
  const s = defaultSettings();
  if (saved && typeof saved === 'object') {
    for (const k of Object.keys(s)) if (typeof saved[k] === 'boolean') s[k] = saved[k];
  }
  return s;
}
