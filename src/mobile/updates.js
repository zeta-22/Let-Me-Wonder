// Installs a downloaded update when you open the app, not the time after (see updatePolicy.js).
// Expo checks for an update and downloads it at every launch by itself (app.json,
// checkAutomatically ON_LOAD); this hook also checks when you come back to the app after a
// while, since Android often keeps it in memory instead of launching it again.

import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import * as Updates from 'expo-updates';

import { createUpdatePolicy } from './updatePolicy.js';

const enabled = !__DEV__ && Updates.isEnabled;

function install() {
  Updates.reloadAsync().catch(() => {}); // it didn't take: the next launch installs it anyway
}

// currentPath: a function giving the Instagram page on screen now.
export function useUpdatesAtOpening(currentPath) {
  const { isUpdatePending } = Updates.useUpdates();
  const policy = useRef(null);
  if (!policy.current) policy.current = createUpdatePolicy();

  useEffect(() => {
    if (!enabled) return undefined;
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        policy.current.left();
        return;
      }
      const action = policy.current.returned(currentPath());
      if (action === 'install') install();
      else if (action === 'check') {
        Updates.checkForUpdateAsync()
          .then((result) => (result.isAvailable ? Updates.fetchUpdateAsync() : null))
          .catch(() => {}); // offline: the next opening tries again
      }
    });
    return () => sub.remove();
  }, [currentPath]);

  useEffect(() => {
    if (enabled && isUpdatePending && policy.current.downloaded(currentPath()) === 'install') install();
  }, [isUpdatePending, currentPath]);
}
