// Let Me Wonder: Instagram without the addictive parts.

import { useCallback, useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import InstagramScreen from './src/mobile/InstagramScreen.js';
import { loadSettings, saveSettings } from './src/mobile/settings.js';

export default function App() {
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    loadSettings().then(setSettings);
  }, []);

  const changeSettings = useCallback((partial) => {
    setSettings((current) => {
      const next = { ...current, ...partial };
      saveSettings(next);
      return next;
    });
  }, []);

  if (!settings) return null; // a moment while the saved switches load

  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <InstagramScreen settings={settings} onChangeSettings={changeSettings} />
    </SafeAreaProvider>
  );
}
