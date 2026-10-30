// The app's switches, saved on the phone. Nothing else is stored by the app.

import AsyncStorage from '@react-native-async-storage/async-storage';

import { withSaved } from '../filter/settings.js';

const KEY = 'lmw-settings-v1';

export async function loadSettings() {
  try {
    return withSaved(JSON.parse((await AsyncStorage.getItem(KEY)) || 'null'));
  } catch (e) {
    return withSaved(null); // unreadable: start from the defaults
  }
}

export async function saveSettings(settings) {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(settings));
  } catch (e) {
    // not saved: the switches still apply until the app closes
  }
}
