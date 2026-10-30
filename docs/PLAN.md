> Approved on 2026-10-30. Progress is tracked in the README (Status table).

# Let Me Wonder: full plan (cloud only)

## Context
You want Instagram without the addictive parts, for personal use, on **Android and iPhone**,
with **nothing installed on your PC** and everything free.

What we decided together:
- **All work happens in the cloud.** I write, test and build; you only use your phones.
- **Android:** our own app. It opens instagram.com inside the app with the filter added.
  Expo's cloud builds it (free account), you install it once from a link, and fixes arrive
  automatically.
- **iPhone:** Safari plus the free **Userscripts** app running **the same filter**. Apple
  doesn't allow a free app of our own; the $99/year option stays available for later.
- **Dropped:** a separate desktop-Chrome prototype (we test the filter in the cloud
  instead), Vercel (not needed) and the "lock the real Instagram app" phase (you'll
  uninstall Instagram).
- **Never:** reading, storing or sending your password. The filter never touches login
  fields and sends nothing anywhere.

## What gets blocked (each one is a switch, all ON by default)
1. **Reels tab and any /reels/ page:** the tab is hidden and the page shows "blocked".
2. **Reels and suggested videos in the home feed:** hidden.
3. **Explore grid:** the search icon goes straight to account search, so search still
   works but the grid never shows. Hashtag and place grids are blocked too.
4. **Suggested posts and "Suggested for you" accounts:** hidden, including everything
   after "You're all caught up".
5. **Ads:** posts marked "Sponsored", in English, Italian, Spanish and more.
6. **Endless video swipe:** a reel a friend sends you in DMs plays, but swiping or tapping
   to another reel shows "blocked".

**Keeps working:** DMs (read, reply, send media), stories, your profile and searched
profiles, the feed of accounts you follow, posting and notifications.

## How it's built: one filter, two wrappers
```
src/filter/rules.js     All the rules as one settings list: blocked addresses, text such as
                        "Sponsored"/"Sponsorizzato"/"Publicidad", page markers. Usually
                        the ONLY file to edit when Instagram changes something.
src/filter/filter.css   Hides things instantly, before they appear (no flash).
src/filter/filter.js    The engine. It watches the page as Instagram changes it
                        (MutationObserver plus address-change checks), hides matching
                        items, shows the "blocked" screen with a Back button, locks the
                        reel swipe, and has a "Report a problem" snapshot.
scripts/build-filter.mjs  Packs the three files above into:
  -> dist/let-me-wonder.user.js   the iPhone Safari script (Userscripts)
  -> src/filter/generated/...     the copy the Android app injects
test/                   Fake Instagram-like pages plus automatic checks, run in a headless
                        Chrome in the cloud
App.js, src/mobile/...     The Android app (Expo + react-native-webview)
```
Key design choices:
- **Detect by stable signals, not Instagram's random class names:** link addresses
  (`/reels/`, `/reel/<id>`, `/explore/`), roles, aria-labels and label text in several
  languages.
- **Hide, don't delete.** Items are hidden, never removed, so Instagram doesn't break.
- **Works in both Safari and the app.** Navigation is blocked by catching taps on blocked
  links and by checking the address on every page change, so it doesn't depend on browser
  internals.
- **"Report a problem"** copies a mostly anonymous outline of the page: structure, button
  labels and link patterns, with usernames masked and no captions, photos or typed text.
  You paste it here when something gets through.

## Stages (I stop at the end of each one and wait for your OK)

### Stage 0: Tidy up (me, 5 minutes)
- Delete the Windows-only files (`scripts/check-env.ps1`, `docs/SETUP-WINDOWS.md`).
- Rewrite the README, and save this plan as `docs/PLAN.md` so any new session can continue
  from it.

### Stage 1: The filter, then the iPhone (me, then you; no accounts needed)
Me:
- Write `rules.js`, `filter.css` and `filter.js`, plus the build script.
- Build test pages that copy Instagram's structure (feed with normal, reel, sponsored and
  suggested posts; Explore; a DM with a reel; reel and profile pages), plus automatic
  checks for every switch, ON and OFF.
- Smoke-test on the real logged-out instagram.com: no errors, and the login page untouched.
- Publish `dist/let-me-wonder.user.js` at a public address, from the `main` branch. I open
  a pull request (PR) and you tap **Merge**.

You, on GitHub (once, about 1 minute):
- ~~Make the repo public~~: not needed, it's already public. Checked on 2026-10-30: GitHub
  says "public" and the filter file downloads without logging in.
- Merge the pull request (https://github.com/zeta-22/Let-Me-Wonder/pull/1) so the filter
  appears at its permanent address on `main`.
- Me, small follow-up: remove the "make the repo public" line from that pull request's
  description, and from the copy of this plan in the repo (`docs/PLAN.md`).

You, on iPhone (about 5 minutes, written as a step-by-step guide in `docs/IPHONE.md`):
1. Install **Userscripts** (free) from the App Store, then turn it on in **Settings → Apps
   → Safari → Extensions**, allowed on **instagram.com only**.
2. Open the install link in Safari and tap **Install**.
3. Open instagram.com, log in, and go through the checklist.
4. Quick test: add instagram.com to the Home Screen **with "Open as Web App" ON**, and see
   if the filter still works there (full screen, no address bar). If it doesn't, re-add it
   with the toggle **OFF**: the icon then opens in normal Safari, where it works.
5. Send me a "Report a problem" outline for anything that slips through.

**STOP:** you confirm the iPhone works well enough to move on.

### Stage 2: The Android app (started 2026-10-30, while you test the iPhone)
Checked on 2026-10-30: `EXPO_TOKEN` is **not** in this environment yet, and the latest
versions are Expo SDK 58 and react-native-webview 14. PR #1 is merged, so I restart the
branch `claude/festive-mccarthy-j93xcw` from `main` (`git checkout -B … origin/main`, then
push with `--force-with-lease`; the branch only holds merged work).

**Part A: me, now, no account needed.** I write the whole app and check it compiles in
the cloud.

What the app does:
- **Full screen.** Instagram fills the screen, with no extra top bar.
- **Settings button.** The same small round button as on iPhone. In the app it opens the
  app's own settings screen. (Changed from the "slim top bar" above, to give Instagram
  more room.)
- **Back.** The Android back gesture goes back inside Instagram, closes Settings or the
  Blocked screen, and leaves the app from the first page.
- **Filter.** It's injected at page start (`injectedJavaScriptBeforeContentLoaded`, plus
  `injectedJavaScript` as a backup; the filter ignores a second start). Settings are
  passed in through `window.__LMW_CONFIG__ = { host: 'app', settings }`. A switch you
  change takes effect immediately through `injectJavaScript(... __LMW__.setSettings ...)`.
- **App-level blocking** (`onShouldStartLoadWithRequest`). Before any full page load,
  the address goes through `decide()` from `src/filter/routes.js`. A blocked address
  shows a native Blocked screen with "Go back", in the same style as Safari's.
  - Links through Instagram's redirector (`l.instagram.com/?u=…`) and links to other
    sites open in your phone's browser.
  - `intent:` and "open in the Instagram app" links are ignored.
  - Facebook login pages are allowed inside the app.
- **Settings screen:**
  - the 6 switches, saved on the phone
  - Copy problem report: asks the page for the outline, then copies it to the clipboard
  - Check for updates
  - Reload
  - versions of the app, filter and rules
- **Staying logged in.** The WebView keeps cookies and storage (Android saves them to
  disk), with third-party cookies on. The checklist verifies that you stay logged in.
  - If it fails: in Stage 3 I add a cookie flush when the app goes to the background.
- **Media.** The file picker for DMs and posting (camera and microphone permissions,
  asked only when used), inline video, and full-screen video.
- **Browser label.** `APP_USER_AGENT` in `rules.js` makes the app present itself as
  normal mobile Chrome.
- **Error screen.** "Can't reach Instagram" with a Retry button.

Files:
```
package.json   + expo, react, react-native, react-native-webview, expo-updates,
                 @react-native-async-storage/async-storage, expo-clipboard,
                 react-native-safe-area-context, expo-status-bar
                 (installed with `npx expo install` so the versions match SDK 58)
app.json       name "Let Me Wonder", package com.zeta22.letmewonder, runtimeVersion
               policy appVersion, android permissions CAMERA + RECORD_AUDIO, icon/splash
eas.json       profile "preview": internal distribution, Android APK, channel "preview"
index.js, App.js
src/mobile/InstagramScreen.js   WebView, messages from the page, back handling, Blocked overlay
src/mobile/SettingsScreen.js    switches, report, updates, versions
src/mobile/BlockedScreen.js     native Blocked screen
src/mobile/settings.js          load/save switches (AsyncStorage), defaults from TOGGLES
src/mobile/urlPolicy.js         allow / block / redirect / open outside / ignore, for a URL
src/mobile/injected.js          builds the injected script (config + filter bundle)
src/filter/generated/filterBundle.js  generated by build-filter.mjs (committed for EAS)
assets/icon.png, adaptive-icon.png, splash.png   a simple original leaf icon (drawn as
               SVG, turned into PNG in the cloud browser)
docs/ANDROID.md   install, settings, report, updates
test/url-policy.test.mjs   checks for urlPolicy
.gitignore     + android/, ios/, dist-app/ (generated)
```

Small filter changes (reused by both phones):
- `filter.js`, in app mode: the settings button sends `{type:'openSettings'}` to the app.
  On every address change the filter also tells the app `{type:'page', path,
  allowedPath}`, which the app uses for its reel-swipe check.
- `ui.js`: an optional `onGear` handler. Test 21 is updated to expect the button in app
  mode and the `openSettings` message.
- `build-filter.mjs` also writes `src/filter/generated/filterBundle.js`.
- Bump `package.json` to 0.2.0, so Userscripts sees the change.

Verified in the cloud before Part B:
- `npm test`: the 21 filter checks, plus the new urlPolicy checks. The urlPolicy checks
  cover:
  - blocked pages
  - a reel → a different reel
  - external links and Instagram's link redirector
  - `intent:` links
  - Facebook login
  - switches turned off
- `npx expo install --check` / `npx expo-doctor`: dependencies match SDK 58.
- `npx expo export --platform android`: the app's code compiles.
- `npx expo prebuild --platform android --no-install` (temporary, not committed): the
  Android settings in `app.json` are valid.
- **Not possible in the cloud:** running the app on an Android emulator. The page filter
  is the same code already tested; the rest is checked on your phone.
- Commit and push, then open PR #2 into `main` (merged when you say so).

**You, meanwhile (about 5 minutes, free):**
1. Sign up at https://expo.dev/signup and confirm your email.
2. On expo.dev, open your avatar → **Account settings → Access tokens → Create token**.
   Name it "let-me-wonder-cloud" and copy it. You can delete it there any time.
3. In this session's title bar, open the environment menu → **Edit** → **Network
   secrets**, and add `EXPO_TOKEN` = the token. If that section isn't there, add it as an
   environment variable with the same name. Never paste the token in the chat.
4. Start a **new session** on this repo (the token only reaches new sessions) and say
   "continue the plan, Stage 2 Part B".

**Part B: new session, with the token** (creates a project on your Expo account, which you
already approved):
1. `npx eas-cli whoami`: confirms the token works. Nothing is printed except your Expo
   username.
2. `npx eas-cli init --non-interactive --force`: creates the "let-me-wonder" project and
   writes its id into `app.json`.
3. `npx eas-cli update:configure --non-interactive`: sets up updates over the internet.
4. `npx eas-cli build -p android --profile preview --non-interactive`: Expo's cloud builds
   the APK and keeps the signing key. It takes about 10–30 minutes on the free plan. I
   follow it until it finishes, then give you the install link.
5. Later fixes: `npx eas-cli update --channel preview --message "…"`. The app picks them
   up the next time it opens, or right away with "Check for updates".

**You:** open the link on your Android phone, allow "install unknown apps" once, install,
log in, and go through `docs/CHECKLIST.md`.

**STOP:** you confirm the Android app works.

### Stage 3: Tuning (together, a few days)
- You use both phones normally and send "Report a problem" outlines.
- I fix `rules.js` (or the engine) and re-run all the automatic checks.
  - **Android:** the fix arrives on its own.
  - **iPhone:** one tap on "Check for updates" in Userscripts.
- Ends when every item in **Done means** works on both phones.

### Later, only if you want
- **Rules auto-update:** both wrappers download just the rules list (text settings, never
  code) from the repo in the background, so small fixes reach the iPhone without a tap
  either.
- **iPhone app ($99/year Apple account):** the same app as Android, reusing all the code.

## Done means
- Instagram on Android (app) and iPhone (Safari) shows no Reels tab, no reels in the feed,
  no Explore grid, no suggested posts and no ads.
- DMs, stories, posting and account search work.
- A reel sent in DMs plays, but you can't swipe to another.
- You stay logged in after closing the app or Safari.
- The README explains how the filter works and how to update `rules.js` when Instagram
  changes.

## Accounts and money
| What | Cost | When |
|---|---|---|
| Public GitHub repo (already public, nothing to do) | free | Stage 1 |
| Userscripts app (App Store) | free | Stage 1 |
| Expo account plus token (decided: yes) | free (the free plan includes enough builds for this) | Stage 2 |
| Apple Developer account | $99/year | only if you later want the iPhone app |

## How I verify each stage
- **Every change:** the automatic checks run in the cloud's headless Chrome on the fake
  Instagram pages. Each switch is checked ON and OFF; blocked links show the blocked
  screen; Explore redirects to search; reel-to-reel is blocked; the snapshot masks
  usernames and never contains typed text.
- **Every change:** a smoke test on the real logged-out instagram.com (no errors, login
  form untouched).
- **Before each Android build:** the app is compiled in the cloud first (`npx expo
  export`, `expo-doctor`).
- **What I can't check myself:** logged-in Instagram and Safari itself. Those are checked
  by you with the checklists, and your "Report a problem" outlines become new fake test
  pages, so a fixed problem stays fixed.

## Honest limits
- **Expect some tuning.** I can't see logged-in Instagram, so version 1 is built from what
  I know of its mobile site. Addresses (/reels/, /explore/) are reliable; feed ads and
  suggestions are the likeliest to need fixes in Stage 3.
- **Instagram changes its site often.** When something breaks, it's usually a quick edit
  to `rules.js`.
- **On iPhone it's Safari, not an app.** You see the address bar unless the full-screen
  test in Stage 1 works.
