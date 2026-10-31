// The app's settings: one switch per rule, the problem report, updates, versions.
// The switches are locked with a code (src/filter/lock.js) and lock again on closing.

import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';

import { RULES_VERSION, TOGGLES } from '../filter/rules.js';
import { FILTER_VERSION } from '../filter/generated/filterBundle.js';
import { createLock } from '../filter/lock.js';
import { useTheme } from './theme.js';

// One lock while the app is open, so the wait after too many wrong codes holds.
const lock = createLock();

function Button({ label, onPress, theme }) {
  return (
    <Pressable onPress={onPress} style={[styles.button, { borderColor: theme.line }]} accessibilityRole="button">
      <Text style={[styles.buttonText, { color: theme.fg }]}>{label}</Text>
    </Pressable>
  );
}

export default function SettingsScreen({ settings, onChange, onClose, onReport, onReload }) {
  const theme = useTheme();
  const [status, setStatus] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [code, setCode] = useState('');
  const [lockMessage, setLockMessage] = useState('');

  function tryUnlock() {
    const result = lock.tryCode(code);
    setCode('');
    if (result.ok) {
      setUnlocked(true);
      setLockMessage('');
    } else {
      setLockMessage(result.wait ? `Too many tries: wait ${result.wait} s.` : 'Wrong code.');
    }
  }

  function close() {
    setUnlocked(false);
    onClose();
  }

  async function checkForUpdates() {
    if (__DEV__ || !Updates.isEnabled) {
      setStatus('Updates are not set up in this version of the app.');
      return;
    }
    try {
      setStatus('Checking…');
      const result = await Updates.checkForUpdateAsync();
      if (!result.isAvailable) {
        setStatus('You have the latest version.');
        return;
      }
      setStatus('Downloading the update…');
      await Updates.fetchUpdateAsync();
      await Updates.reloadAsync();
    } catch (e) {
      setStatus(`Couldn't check for updates: ${e.message}`);
    }
  }

  const appVersion = Constants.expoConfig?.version ?? '?';
  const updateId = Updates.updateId ? Updates.updateId.slice(0, 8) : 'built-in';

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.bg }]} edges={['top', 'bottom']}>
      <View style={[styles.header, { borderColor: theme.line }]}>
        <Text style={[styles.title, { color: theme.fg }]} accessibilityRole="header">
          Let Me Wonder
        </Text>
        <Pressable onPress={close} hitSlop={12} accessibilityRole="button">
          <Text style={[styles.done, { color: theme.accent }]}>Done</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.section, { color: theme.muted }]}>Hide and block</Text>
        {unlocked ? (
          <Text style={[styles.hint, { color: theme.muted }]}>Unlocked until you close the settings.</Text>
        ) : (
          <View>
            <Text style={[styles.hint, { color: theme.muted }]}>Locked: enter the code to change the switches.</Text>
            <View style={styles.lockEntry}>
              <TextInput
                value={code}
                onChangeText={setCode}
                onSubmitEditing={tryUnlock}
                secureTextEntry
                keyboardType="number-pad"
                maxLength={12}
                placeholder="Code"
                placeholderTextColor={theme.muted}
                accessibilityLabel="Code"
                style={[styles.code, { color: theme.fg, borderColor: theme.line }]}
              />
              <Pressable onPress={tryUnlock} style={[styles.unlock, { borderColor: theme.line }]} accessibilityRole="button">
                <Text style={[styles.buttonText, { color: theme.fg }]}>Unlock</Text>
              </Pressable>
            </View>
            {lockMessage ? <Text style={[styles.status, { color: theme.accent }]}>{lockMessage}</Text> : null}
          </View>
        )}
        {TOGGLES.map((t) => (
          <View key={t.id} style={[styles.row, { borderColor: theme.line }]}>
            <Text style={[styles.rowLabel, { color: unlocked ? theme.fg : theme.muted }]}>{t.label}</Text>
            <Switch
              value={!!settings[t.id]}
              onValueChange={(value) => onChange({ [t.id]: value })}
              disabled={!unlocked}
              trackColor={{ true: theme.accent }}
              accessibilityLabel={t.label}
            />
          </View>
        ))}

        <Button label="Copy problem report" onPress={onReport} theme={theme} />
        <Text style={[styles.hint, { color: theme.muted }]}>
          Open the page where something slipped through, then tap this and paste the report to Claude. It shows the
          page's structure only: usernames are masked, captions and messages are left out.
        </Text>
        <Button label="Check for updates" onPress={checkForUpdates} theme={theme} />
        <Button label="Reload Instagram" onPress={onReload} theme={theme} />
        {status ? <Text style={[styles.status, { color: theme.accent }]}>{status}</Text> : null}

        <Text style={[styles.foot, { color: theme.muted }]}>
          App {appVersion} · filter {FILTER_VERSION} · rules {RULES_VERSION} · update {updateId}
        </Text>
        <Text style={[styles.foot, { color: theme.muted }]}>
          You log in on Instagram's own page. This app never reads your password and sends nothing anywhere; it only
          keeps these switches on your phone.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 18, fontWeight: '700' },
  done: { fontSize: 16, fontWeight: '600' },
  content: { padding: 18, paddingBottom: 40 },
  section: { fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLabel: { fontSize: 15, flex: 1, paddingRight: 12 },
  button: { borderWidth: 1, borderRadius: 10, paddingVertical: 11, alignItems: 'center', marginTop: 14 },
  buttonText: { fontSize: 15 },
  hint: { fontSize: 13, lineHeight: 18, marginTop: 6 },
  lockEntry: { flexDirection: 'row', marginTop: 8, marginBottom: 6 },
  code: { flex: 1, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 16, marginRight: 8 },
  unlock: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 16, justifyContent: 'center' },
  status: { fontSize: 14, marginTop: 12 },
  foot: { fontSize: 12, lineHeight: 17, marginTop: 16 },
});
