// The app's switches, saved on the phone. Nothing else is stored by the app.

import AsyncStorage from '@react-native-async-storage/async-storage';

import { TOGGLES } from '../filter/rules.js';

const KEY = 'lmw-settings-v1';

export function defaultSettings() {
  const s = {};
  for (const t of TOGGLES) s[t.id] = true;
  return s;
}

export async function loadSettings() {
  const s = defaultSettings();
  try {
    const saved = JSON.parse((await AsyncStorage.getItem(KEY)) || 'null');
    if (saved) for (const k of Object.keys(s)) if (typeof saved[k] === 'boolean') s[k] = saved[k];
  } catch (e) {
    // unreadable: start from the defaults (everything on)
  }
  return s;
}

export async function saveSettings(settings) {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(settings));
  } catch (e) {
    // not saved: the switches still apply until the app closes
  }
}
