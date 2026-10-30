// Colours of the app's own screens, matching the filter's Blocked screen (ui.css).

import { useColorScheme } from 'react-native';

const light = {
  bg: '#ffffff',
  fg: '#111111',
  muted: '#6b6b6b',
  line: '#e4e4e4',
  accent: '#2f6f4f',
  accentFg: '#ffffff',
};

const dark = {
  bg: '#121212',
  fg: '#f2f2f2',
  muted: '#a0a0a0',
  line: '#2c2c2c',
  accent: '#6fbf94',
  accentFg: '#0b1f14',
};

export function useTheme() {
  return useColorScheme() === 'dark' ? dark : light;
}
