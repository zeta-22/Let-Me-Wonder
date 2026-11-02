// When the app installs an update it has downloaded (Instagram reloads, the new version runs).
//
// Expo's usual way waits for the next launch: a fix published now was only used the second
// time you opened the app. Here an update is installed as soon as it's downloaded, if that's
// just after you opened the app, or came back to it after a while. Later than that, or on a
// page where you may be in the middle of something (writing a message, making a post or a
// story, logging in), it waits for the next opening instead of reloading under your fingers.
//
// Plain logic, no React Native, so it's tested in node (test/update-policy.test.mjs).

import { pageOf } from '../filter/routes.js';

export const OPENING_MS = 30000; // an update ready this soon after opening is installed at once
export const AWAY_MS = 60000; // coming back after this long in the background counts as opening
export const BUSY_PAGES = ['direct', 'create', 'login']; // a reload could lose what you're typing

export function createUpdatePolicy(now = Date.now) {
  let openedAt = now();
  let leftAt = null;
  let waiting = false; // an update is downloaded and waits to be installed
  const busy = (path) => BUSY_PAGES.includes(pageOf(path || '/'));

  return {
    // The app went to the background.
    left() {
      if (leftAt === null) leftAt = now();
    },
    // The app is on screen again. Returns 'install' (an update is waiting), 'check' (look for
    // one, and download it), or null (back too soon to count as opening the app).
    returned(path) {
      const away = leftAt === null ? 0 : now() - leftAt;
      leftAt = null;
      if (away < AWAY_MS) return null;
      openedAt = now();
      return waiting && !busy(path) ? 'install' : 'check';
    },
    // An update finished downloading. Returns 'install', or null to wait for the next opening.
    downloaded(path) {
      waiting = true;
      return now() - openedAt < OPENING_MS && !busy(path) ? 'install' : null;
    },
  };
}
