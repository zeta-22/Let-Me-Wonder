// Instagram's mobile site in a WebView, with the filter injected at page start.
// The filter handles everything inside the page; this screen adds what only the
// app can do: stop full page loads to blocked addresses, open other websites in
// the phone's browser, the Android back button, the app's settings screen, and a
// fresh page when Android stops the old one.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, BackHandler, Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import * as Clipboard from 'expo-clipboard';

import { APP_USER_AGENT } from '../filter/rules.js';
import BlockedScreen from './BlockedScreen.js';
import SettingsScreen from './SettingsScreen.js';
import { REPORT_SCRIPT, settingsScript, startScript } from './injected.js';
import { useTheme } from './theme.js';
import { decideUrl } from './urlPolicy.js';

const START_URL = 'https://www.instagram.com/'; // Instagram's own home, with the stories
const RESTART_AGAIN_MS = 60000; // the page died again this soon after a restart: ask first

// What the cover says when the page can't be shown.
const PROBLEMS = {
  offline: { title: "Can't reach Instagram", text: 'Check your connection and try again.' },
  crashed: { title: 'Instagram stopped working', text: 'The page crashed or the phone ran low on memory.' },
};

// The report comes from the page, which can't know it was restarted: the app adds that.
function withAppNotes(report, deaths) {
  if (!deaths.length) return report;
  const ago = Math.round((Date.now() - deaths[deaths.length - 1]) / 1000);
  const note = `app: the page stopped and was restarted ${deaths.length} time(s), the last ${ago} s ago`;
  const lines = report.split('\n');
  lines.splice(2, 0, note);
  return lines.join('\n');
}

export default function InstagramScreen({ settings, onChangeSettings }) {
  const theme = useTheme();
  const web = useRef(null);
  const settingsRef = useRef(settings);
  const page = useRef({ path: '/', allowedPath: '/' }); // where the filter says we are
  const canGoBack = useRef(false);
  const reportAsked = useRef(0); // only accept a report shortly after asking for one
  const [blockedToggle, setBlockedToggle] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [failed, setFailed] = useState(null); // a key of PROBLEMS while the cover shows
  const [webKey, setWebKey] = useState(0); // changed to start a fresh WebView
  const lastRestart = useRef(0);
  const pageDeaths = useRef([]); // when the page's process stopped, for the problem report

  // Used for the next page load; switch changes on the open page are sent right away below.
  const injected = useMemo(() => startScript(settings), [settings]);

  useEffect(() => {
    settingsRef.current = settings;
    web.current?.injectJavaScript(settingsScript(settings));
  }, [settings]);

  // Android back: close what's on top, else go back inside Instagram, else leave the app.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (blockedToggle) {
        setBlockedToggle(null);
        return true;
      }
      if (canGoBack.current || page.current.path !== '/') {
        web.current?.goBack();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [blockedToggle]);

  const onShouldStartLoad = useCallback((request) => {
    if (request.isTopFrame === false) return true;
    const verdict = decideUrl(request.url, { fromPath: page.current.allowedPath, settings: settingsRef.current });
    switch (verdict.action) {
      case 'allow':
        return true;
      case 'block':
        setBlockedToggle(verdict.toggle);
        return false;
      case 'redirect':
        web.current?.injectJavaScript(`location.replace(${JSON.stringify(verdict.to)}); true;`);
        return false;
      case 'external':
        Linking.openURL(verdict.url).catch(() => {});
        return false;
      default:
        return false;
    }
  }, []);

  const onMessage = useCallback((event) => {
    let msg;
    try {
      msg = JSON.parse(event.nativeEvent.data);
    } catch (e) {
      return;
    }
    if (!msg || msg.source !== 'lmw') return;
    if (msg.type === 'page') {
      page.current = { path: msg.path, allowedPath: msg.allowedPath };
    } else if (msg.type === 'openSettings') {
      setSettingsOpen(true);
    } else if (msg.type === 'report' && Date.now() - reportAsked.current < 10000) {
      reportAsked.current = 0;
      Clipboard.setStringAsync(withAppNotes(String(msg.text), pageDeaths.current)).then(() =>
        Alert.alert('Problem report copied', 'Paste it to Claude, with a word on what slipped through.'),
      );
    }
  }, []);

  const requestReport = useCallback(() => {
    setSettingsOpen(false);
    reportAsked.current = Date.now();
    web.current?.injectJavaScript(REPORT_SCRIPT);
  }, []);

  const reload = useCallback(() => {
    setSettingsOpen(false);
    setFailed(null);
    web.current?.reload();
  }, []);

  const restart = useCallback(() => {
    lastRestart.current = Date.now();
    canGoBack.current = false;
    page.current = { path: '/', allowedPath: '/' };
    setFailed(null);
    setWebKey((k) => k + 1);
  }, []);

  // When Android stops the page's process (low on memory, or a crash), this WebView can't
  // be used again and would stay frozen: open a fresh one on the home feed. If it happens
  // again right away, show the cover instead of restarting in a loop.
  const onPageGone = useCallback(() => {
    pageDeaths.current.push(Date.now());
    if (Date.now() - lastRestart.current < RESTART_AGAIN_MS) setFailed('crashed');
    else restart();
  }, [restart]);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.bg }]} edges={['top', 'bottom']}>
      <WebView
        key={webKey}
        ref={web}
        style={[styles.root, { backgroundColor: theme.bg }]}
        source={{ uri: START_URL }}
        userAgent={APP_USER_AGENT}
        injectedJavaScriptBeforeContentLoaded={injected}
        injectedJavaScript={injected}
        onMessage={onMessage}
        onShouldStartLoadWithRequest={onShouldStartLoad}
        onNavigationStateChange={(nav) => {
          canGoBack.current = nav.canGoBack;
        }}
        onLoadEnd={() => web.current?.injectJavaScript(settingsScript(settingsRef.current))}
        onError={() => setFailed('offline')}
        onRenderProcessGone={onPageGone}
        onContentProcessDidTerminate={onPageGone}
        // Stay logged in: keep Instagram's cookies and storage between launches.
        domStorageEnabled
        thirdPartyCookiesEnabled
        sharedCookiesEnabled
        cacheEnabled
        // Videos, photo/video pickers for DMs and posting, camera and microphone when asked.
        allowsInlineMediaPlayback
        allowsFullscreenVideo
        mediaPlaybackRequiresUserAction={false}
        mediaCapturePermissionGrantType="prompt"
        // Links that would open a new window load here instead, so the checks above apply.
        setSupportMultipleWindows={false}
        allowFileAccess={false}
      />

      {blockedToggle ? <BlockedScreen toggle={blockedToggle} onBack={() => setBlockedToggle(null)} /> : null}

      {failed ? (
        <View style={[styles.cover, { backgroundColor: theme.bg }]}>
          <Text style={[styles.errorTitle, { color: theme.fg }]}>{PROBLEMS[failed].title}</Text>
          <Text style={[styles.errorText, { color: theme.muted }]}>{PROBLEMS[failed].text}</Text>
          <Pressable
            onPress={failed === 'crashed' ? restart : reload}
            style={[styles.retry, { backgroundColor: theme.accent }]}
            accessibilityRole="button"
          >
            <Text style={[styles.retryText, { color: theme.accentFg }]}>Retry</Text>
          </Pressable>
        </View>
      ) : null}

      <Modal
        visible={settingsOpen}
        animationType="slide"
        onRequestClose={() => setSettingsOpen(false)}
        statusBarTranslucent
        navigationBarTranslucent
      >
        <SafeAreaProvider>
          <SettingsScreen
            settings={settings}
            onChange={onChangeSettings}
            onClose={() => setSettingsOpen(false)}
            onReport={requestReport}
            onReload={reload}
          />
        </SafeAreaProvider>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  cover: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorTitle: { fontSize: 19, fontWeight: '700', marginBottom: 8 },
  errorText: { fontSize: 15, marginBottom: 20, textAlign: 'center' },
  retry: { borderRadius: 10, paddingVertical: 12, paddingHorizontal: 26 },
  retryText: { fontSize: 15, fontWeight: '600' },
});
