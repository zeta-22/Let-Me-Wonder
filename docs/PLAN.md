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
App.js, src/app/...     The Android app (Expo + react-native-webview)
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
- The repo is already public, so there's nothing to change there (checked on 2026-10-30).
- Merge the pull request (https://github.com/zeta-22/Let-Me-Wonder/pull/1) so the filter
  appears at its permanent address on `main`.

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

### Stage 2: The Android app (me, then you; needs the free Expo account)
You, once (about 5 minutes; you can do it any time before Stage 2): create an account on
expo.dev, create an **access token**,
and add it to this cloud environment as `EXPO_TOKEN` (environment menu in the session
title bar → Edit → Network secrets). Never paste it in chat. Then start a new session on
this repo and say "continue the plan, Stage 2".

Me:
- **The app:** a slim top bar (Back, settings gear), then Instagram filling the screen.
  - The Android back button goes back inside Instagram.
  - Links to other websites open in your normal browser.
- **The filter** is injected as early as possible
  (`injectedJavaScriptBeforeContentLoaded`). The app also blocks /reels/, Explore and
  similar addresses itself (`onShouldStartLoadWithRequest`) and shows a friendly
  **Blocked** screen with a Back button.
- **Settings screen:** the 6 switches, "Report a problem" (copies the outline), "Check for
  updates" and version info.
- **Stay logged in:** Instagram's login cookie is kept between launches, and nothing else
  is stored except your switch settings.
- **Media:** photo and video pickers work for DMs and posting, and reels play.
- **Phone browser label:** the app identifies itself to Instagram as a normal mobile
  browser. This label is kept in `rules.js` so it can be updated.
- **Build and updates:**
  - Expo's cloud builds an installable Android app file (an APK).
  - Fixes reach the app on its next launch, with no reinstalling.
  - Expo keeps the signing key, so updates install over the old version and you stay
    logged in.

You: open the link on your phone, allow "install unknown apps" once, install, log in, and
go through the checklist (`docs/ANDROID.md`).

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
