// Shown when the app stops a page from loading (same look as the filter's own
// Blocked screen, which covers pages Instagram opens without reloading).

import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { TOGGLES } from '../filter/rules.js';
import { useTheme } from './theme.js';

const leaf = require('../../assets/leaf.png');

export default function BlockedScreen({ toggle, onBack }) {
  const theme = useTheme();
  const message = TOGGLES.find((t) => t.id === toggle)?.blocked || 'This part of Instagram is switched off.';
  return (
    <View style={[styles.cover, { backgroundColor: theme.bg }]} accessibilityViewIsModal>
      <Image source={leaf} style={[styles.leaf, { tintColor: theme.accent }]} accessibilityIgnoresInvertColors />
      <Text style={[styles.title, { color: theme.fg }]} accessibilityRole="header">
        This part is switched off
      </Text>
      <Text style={[styles.message, { color: theme.muted }]}>{message}</Text>
      <Pressable onPress={onBack} style={[styles.button, { backgroundColor: theme.accent }]} accessibilityRole="button">
        <Text style={[styles.buttonText, { color: theme.accentFg }]}>Go back</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  cover: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', padding: 24 },
  leaf: { width: 44, height: 44 },
  title: { fontSize: 21, fontWeight: '700', marginTop: 12, marginBottom: 8, textAlign: 'center' },
  message: { fontSize: 15, lineHeight: 21, marginBottom: 22, textAlign: 'center', maxWidth: 340 },
  button: { borderRadius: 10, paddingVertical: 12, paddingHorizontal: 26 },
  buttonText: { fontSize: 15, fontWeight: '600' },
});
