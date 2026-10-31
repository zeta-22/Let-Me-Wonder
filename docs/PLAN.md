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

**Part B, as it actually runs (2026-10-30):** you couldn't add the token in the
environment settings, so you pasted it in the chat and asked me to use it here, then
merge PR #2. How I handle it:
- **Where the token lives:** saved once to a file in my session scratch folder
  (`…/scratchpad/expo-token`, readable only by me). It never goes in the repo, a commit
  or a pull request, and it's passed to the Expo tool as `EXPO_TOKEN` for each command
  without being printed.
- **Before each commit:** I check `git status` and `git diff` so the token can't slip in.
- **Afterwards:** a pasted token stays in the chat history, so I suggest deleting it on
  expo.dev and making a new one when we're done. Future fixes need a valid token: either
  in the environment settings, or pasted again in a new session.

Steps, in this session:
1. `npx eas-cli whoami`: confirms the token works (prints only your Expo username).
2. `npx eas-cli init --non-interactive --force`: creates the "let-me-wonder" project on
   your Expo account and writes its id and owner into `app.json`.
3. `npx eas-cli update:configure --platform android --non-interactive`: adds the update
   address to `app.json`.
4. Re-run `npm test`, `expo-doctor` and `expo export`, then commit and push the `app.json`
   changes to the branch, after checking no secret is included.
5. `npx eas-cli build -p android --profile preview --non-interactive`, running in the
   background. Expo generates and keeps the signing key. I get notified when it ends,
   which takes about 10–30 minutes on the free plan's queue.
6. **Merge PR #2** into `main` (as you asked), pinned to the commit I just pushed. This also
   updates the iPhone filter to 0.2.0.
7. When the build is done: give you the install page link (expo.dev build page with an
   Install button / QR) and the direct APK link.
8. Publish one update on the "preview" channel (`npx eas-cli update`), to confirm that
   fixes over the internet work. The app downloads it in the background.
9. If something fails (for example, Expo can't create the signing key without
   questions), I stop, show you the exact error and propose the fix. I don't retry with
   different settings on your account without telling you.

**Original Part B (kept for future sessions): new session, with the token in the
environment** (creates a project on your Expo account, which you already approved):
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

### Stage 3, round 1: fixes from your first two Android reports (2026-10-30)
What the reports showed (the real logged-in page, in Italian):
- **Notifications all hidden.** The "Suggeriti per te" heading at the bottom of the
  notifications page made `blockAround()` grow until it hit `main`, because notifications
  contain no post links (`STRUCTURE.content`). The whole list was marked
  `{hidden:suggested}`.
- **Feed stuck.**
  - About 60 posts were loaded: about 35 reels (`article:has(a[href*="/reel/"])`) and 30
    "Suggeriti per te" posts, overlapping.
  - Only about 15 stayed visible, and the "Caricamento..." spinner (`role=progressbar`)
    sat at the bottom.
  - Hidden posts are `display:none`, so they take no space and Instagram's own
    "load more near the end" check likely never fires again.
- **Missed label.** "Consigli per te" (the suggested-accounts carousel; its "Mostra tutto"
  link was hidden, but the carousel wasn't).
- **Post addresses** are now `/{user}/p/{id}/` and `/{user}/reel/{id}/`. The current
  rules already match these.
- **Report privacy gap.** Names in plain text weren't masked: story usernames (in "Storia
  di …" labels and text), display names, and "Follower: …" lines.
- **Report cosmetic bug.** "body … 33 more like the one above" counted skipped `<script>`
  tags as if they were shown.

Fixes (all in `src/filter/`, shared by both phones):
1. **Notifications.** Add `STRUCTURE.heading`
   (`h1–h6, [role="heading"]`). A block never grows to include another heading. If the
   block is *only* a heading (no links or buttons), it also hides the siblings right after
   it, up to the next heading or content: that's the suggestions list under "Suggeriti
   per te".
2. **Endless feed keeps loading.**
   - Hidden *posts* (and feed-level blocks such as carousels) are collapsed to a 1-pixel,
     invisible placeholder instead of `display:none`. Instagram's loading logic still
     "sees" them pass by. Other hidden things (Reels tab, Explore tiles) stay
     `display:none`.
   - Applies both to marked items (`data-lmw-collapse`) and to `CSS_RULES` entries flagged
     `collapse: true` (feed reels).
   - **Nudge:** if the loading spinner stays in view for about 1.5 s while no new visible
     post has appeared, the filter briefly moves the spinner out of view and back, and
     fires a scroll event. This makes Instagram check again and load the next batch.
   - Videos inside hidden posts are paused if they start.
3. **Labels.** Add "Consigli per te" and "Suggerimenti per te" to `suggestedForYou`.
4. **Report.**
   - Short texts are kept only when they're a known label, appear at least twice on the
     page (interface words like "Segui" or "altro"), sit in a heading, button or time, or
     contain no letters. Anything else becomes `‹N chars›`.
   - Icon labels are kept. Other aria-labels mask words that appear only once, so "Storia
     di silviafici, vista" becomes "Storia di {…}, vista".
   - Handle-like words (with `_`, `.` or digits) are masked everywhere.
   - Skipped tags are no longer counted.
5. **Your answers (2026-10-30):**
   - **Following feed, ON by default.** A new switch, `followingFeed` ("Home: only people
     you follow"). `rules.js` gets
     `HOME_FEED = { toggle: 'followingFeed', query: 'variant=following' }`, and
     `routes.js` gets `homeRedirect(url, settings)`, which is used:
     - **by the filter:** when a page is first opened on `/` with no `variant` (it
       replaces the address with `/?variant=following`), and when you tap a link to `/`
       (the Home button), which reloads into `/?variant=following`. Instagram's own
       in-page moves to `/` are left alone, so choosing "Per te" in Instagram's menu
       still works.
     - **by the app:** it opens on `https://www.instagram.com/?variant=following`, and
       `urlPolicy` turns a full load of `/` into the Following feed.
     - If Instagram ignores `variant=following`, nothing breaks: you just get the normal
       feed, with suggestions hidden as now.
   - **Friends' reels are shown.** `TOGGLES` get a `default` field. "Reels in the home
     feed" becomes **off by default**: friends' reels appear, while suggested reels stay
     hidden by the Suggestions switch. The Reels tab and the reel-swipe block stay on.
     - Defaults come from `TOGGLES[].default` in `filter.js` `loadSettings` and in
       `src/mobile/settings.js`.
     - The settings panel shows the new switch; the app settings screen gets it from
       `TOGGLES` automatically.
     - Saved switches are kept: if you flipped a switch before, your choice stays.
   - **Test changes:**
     - home-feed expectations: friends' reels visible, and opening `/` lands on
       `/?variant=following`
     - tapping Home from another page lands on `/?variant=following`
     - with followingFeed off there's no redirect
     - feedReels on hides reels with a collapsed placeholder
     - urlPolicy: `/` becomes a redirect to the Following feed; `/?variant=following`
       is allowed

Tests (fake Instagram updated with what the reports showed):
- **Feed:**
  - real-style post links (`/{user}/p/`, `/{user}/reel/`) and "Suggeriti per te" inside
    post headers
  - the "Consigli per te" carousel with "Mostra tutto"
  - an **endless loader driven by an IntersectionObserver on the spinner**, which serves
    batches that are mostly hidden. The check: a friend's post from a later batch shows up
    after scrolling to the bottom. This test fails with the old `display:none` approach
    (that's the bug) and passes with the fix.
- **Notifications page:** "Ieri" / "Questa settimana" sections stay visible, while the
  "Suggeriti per te" heading, its list and "Vedi tutti i suggerimenti" are hidden.
- **Report:** story usernames, display names and "Follower: x.y" never appear.
- All existing checks still pass.

Release:
- Restart the branch from `main` (PR #2 is merged), and bump the version to 0.3.0.
- Build, run `npm test`, `expo-doctor` and `expo export`, then commit and open PR #3.
  Merge it, so the iPhone gets 0.3.0.
- **Android update over the internet:** `npx expo export --platform android --output-dir
  dist-app`, then `npx eas-cli update --channel preview --input-dir dist-app
  --skip-bundler --environment preview`. (Last time `eas update` wrote into `dist/` and
  overwrote the iPhone script folder; this avoids that.) No reinstall is needed: close
  and reopen the app twice, or tap Settings → Check for updates.

### Stage 3, round 2: the home feed loops and gets stuck (2026-10-31)
What you said: "sometimes the home crashes and gets in a loop that shows me
multiple times the same images and it kinda gets stuck".

What the report showed (Android app, 0.3.0, Italian, Following feed):
- **Nothing was hidden by labels.** The only hidden things were 4 reels out of 8
  posts, collapsed by "Reels in the home feed" (on; it's off by default, so it was
  either switched on or kept from settings saved under 0.2).
- **The "Caricamento..." spinner** sat at the end of the list, in its own wrapper.
- **The Following page** has a back arrow next to "Seguiti" that links to `/`, as
  does Home.

So on that page the filter did only three things, and each one can loop:
1. **The nudge** fired every 1.5 s while the spinner was on screen, including while a
   batch was still downloading. A loader that isn't guarded against a second trigger
   then asks for the same batch twice, and the same posts appear again. Each copy
   counts as a "new visible post" and resets the 30-nudge limit, so it can go on.
   The fake reproduces this (slow connection, unguarded loader): `sugg-1` showed up
   twice.
2. **Home or the back arrow on the Following feed** did a full reload of the same
   feed (back to the first posts), and each tap added a copy of the feed to the
   history. Android's Back button then went through the copies, one by one.
3. **A hidden reel's video** was still laid out at full size inside its 1-pixel
   placeholder, so it could load, autoplay and be paused again by the filter.

Also seen in the app's code: when Android stops the WebView's page process (low on
memory, or a crash), react-native-webview keeps the app alive but the WebView stays
frozen until you force-close the app.

Fixes (0.3.1):
1. **Nudge once per batch.** The filter checks the feed as soon as posts are added. It
   nudges only when a batch has arrived and the spinner is still on screen 1.5 s later.
   It doesn't nudge while Instagram is loading, nor when the spinner is new (Instagram
   sees a new spinner by itself). If nothing arrives at all, it tries again after 10 s.
   The spinner is now moved up, not down, so the page never gets longer for a moment.
2. **Home on the Following feed** scrolls to the top (like Instagram's own Home button)
   instead of reloading. Coming from another page, Home still opens the Following feed.
3. **Inside a placeholder nothing is drawn** (`> * { display: none }`): no video
   loads or plays in a hidden reel.
4. **App:** if the page's process stops, the app opens a fresh WebView on the home
   feed. If that happens again within a minute, it shows "Instagram stopped working"
   with a Retry button instead of restarting in a loop.

Tests: a slow, unguarded loader in the fake (no post may appear twice, one load per
batch); Home on the Following feed doesn't reload or add history; a hidden reel's video
takes no space. All three failed before the fix.

If it happens again: take the problem report *while* it's looping, and say whether the
page reloads (goes blank) or the same posts appear again further down the feed.

### Stage 3, round 3: still jumping back, stories gone (2026-10-31)
What you said: "I go over one post and it gets back on top of it and it makes me scroll
all over again", and stories open once, then can't be opened again.

First finding: **0.3.1 never reached the phone.** `main` was still on 0.3.0, and no
Android update had been published (this session has no `EXPO_TOKEN`). So this was 0.3.0.

What I found:
1. **0.3.0's nudge makes the page jump back.** It moved the spinner 200000 px *down* for
   two frames, which makes the page that much longer for a moment. A scroll in progress
   at the end of the feed then runs past the real end and snaps back. An experiment with
   scroll gestures in headless Chrome, at the end of a feed with hidden batches: 0.3.0
   overshot by up to 190 px, every time it nudged; 0.3.1 (spinner moved *up*) never did.
2. **Hidden reels came back while you were away from the feed.** "Reels in the home
   feed" is a CSS rule that applies only while the address is home. A story (or a post,
   comments…) changes the address while Instagram keeps the feed underneath, so every
   hidden reel grew back to full size (in the fake: 1 px → 191 px), its video could
   play, and on return it collapsed again, moving the feed.
3. **The Following page has no stories row** (none in your report). Its back arrow
   "← Seguiti" leads to Instagram's main page, which has it. The filter turned that
   arrow into a reload of the Following feed (0.3.0) or a scroll to the top (0.3.1).

Fixes (0.3.2, on top of 0.3.1):
1. **Placeholders stay put.** When you leave a page, posts its page-only rules collapsed
   are marked as hidden (`data-lmw-hide`), so they stay collapsed for as long as they're
   there. Only posts in a list of posts: the single post of a `/reel/<id>/` page is never
   touched.
2. **The back arrow on the Following feed** (found by its icon's label, `HOME_FEED.
   backLabels` in `rules.js`) is left to Instagram: it opens the main page with the
   stories. Home on the Following feed still scrolls to the top.
3. **A timeline in the problem report** (`src/filter/log.js`): the last 80 things that
   happened, with time and scroll position. Scroll jumps of 400 px or more in one step
   (and whether a finger was on the screen), page-height jumps, posts arriving and
   leaving, the feed list's padding, page changes, nudges, Home taps, Blocked screens,
   switch changes, the app going to the background. Numbers and kinds of page only. If
   the feed still jumps, the next report shows what moved it.

Tests: the fake's Following page has the "← Seguiti" header, and stories open over the
feed like the real site. New checks: the back arrow opens the main page without a
reload; a story leaves hidden reels at 1 px and the feed where it was; the report's
timeline has no names. Each failed before the fix. 38 pass.

### Stage 3, round 4: the real cause of the jumping feed (2026-10-31)
What you said (on 0.3.2, really installed this time): the same problems, and the
stories row doesn't appear at all.

What the new timeline in the report showed:
- `feed list padding top 0, bottom 800`, then `posts +2 -2`: **Instagram's feed keeps
  only the posts near the screen** in the page, and holds the room of the others as
  padding on the list, from the heights it measured.
- `page height +512`, then `-512` 0.4 s later: a reel was drawn full size and shrunk
  by the filter right after, i.e. *after* Instagram had measured it.

That's the jump. Instagram measures the reel big, the filter shrinks it to 1 px, and
when you scroll past it Instagram puts back the room it measured. Every post after it
moves down by a whole post, and in Chrome a change of the list's padding stops the
browser from compensating. Reproduced in the fake (a list like Instagram's: only nearby
posts, heights measured once, reel links arriving a moment late): with 0.3.2, the post
after each hidden reel jumped back 477 px; with nothing hidden, no jump. The 0.3.0 nudge
and 0.3.2's fixes were real problems too, but not this one.

Fixes (0.3.3):
1. **Hidden posts keep their exact size: covered, not shrunk.** Everything inside is
   invisible and can't be tapped, with a small grey label from `TOGGLES[].covered`
   ("Reel hidden", "Ad hidden", "Suggestion hidden"). `CSS_RULES` `collapse` became
   `cover`. The feed's layout is Instagram's own, so its list and its loading work
   as if the filter weren't there. A covered post's video is paused.
2. **The nudge is gone**, and so is `STRUCTURE.loader`: with nothing shrunk, Instagram's
   spinner moves as you scroll and Instagram loads by itself.
3. **"See all" suggestions links** (`a[href^="/explore/people/"]`) are now `invisible`
   (same size, can't be tapped) instead of removed, since one inside a suggestions
   block made the block shorter.
4. **Stories:** the Following page has no stories row (Instagram's page). Its back arrow
   opens the main page with the stories. If Instagram doesn't move within 1.5 s (when
   there's nothing to go back to: the app opens straight on Following), the filter
   opens `HOME_FEED.mainPage` (`/?variant=home`), which it doesn't switch to Following.
   The timeline notes which feed is showing.
5. **Report:** the timeline of the page load *before* this one is kept on the phone, so
   a report after a reload still shows what happened. The app adds a line when
   Android restarted the page.

Tests: the fake's virtual feed (scrolling 70 steps past hidden reels, no jump); hidden
posts the same size as without the filter, labelled and untappable; the endless feeds
load by scrolling, no post twice; the back arrow going nowhere opens the main page; the
timeline survives a reload. 40 pass.

Trade-off: with "Reels in the home feed" on, you scroll past an empty, labelled card
where each reel was. With it off (the default) friends' reels just show.

### Stage 3, round 5: ads in stories, smaller boxes (2026-10-31)
What you said (on 0.3.3): the home feed works well now, but there are still ads between
stories, and the "Reel hidden" box could be much smaller, so it scrolls by easily.

**Ads in stories.** The "Sponsored" rule only hid the post around the label, and stories
have no post, so story ads went through. The settings button was also hidden on stories,
so there was no way to send a report from one.
- A "Sponsored" label that appears on a story page, outside posts and hidden parts, is a
  story ad (`LABEL_RULES` hide `story`). The filter pauses it and presses Instagram's own
  "next" control, found by its label (`STORIES.nextLabels`: Avanti, Next, …), or else
  sends the right-arrow key, which the story viewer answers. Never the ad's own buttons.
- The same label counts as the same ad until the story had time to change: the fake
  showed the address moves to the next story a moment before the ad leaves the page,
  and without this the story after the ad was skipped too. If an ad is still there 1.5 s
  later it tries again, 3 times at most.
- The first time, the viewer's outline (anonymous, like the report) is kept in the
  timeline, so the next report shows how Instagram builds it if skipping fails.
- On stories, the settings button now shows on the right edge.

**Smaller boxes.** A box smaller than the post is exactly what made the feed jump: Instagram
measured the post big, and the filter shrank it afterwards. So it's a test switch, off by
default: "Small boxes for hidden posts". It makes the boxes 36 px tall and sends a
`resize` event whenever the number of hidden posts changes (and when the switch changes),
the usual way to make a feed like Instagram's measure its posts again. In the fake, a feed
that measures again on resize doesn't jump; one that never measures again still does. If
the feed jumps with it on, switch it off.

Tests: story ad skipped with the next button (the ad's link never tapped, the following
story not skipped, the outline in the report without names); with the arrow key; not with
Ads off; a friend's story never skipped; small boxes on a feed that measures again. 44 pass.

### Stage 3, round 6: going back past a story ad, locked switches (2026-10-31)
What you said (on 0.3.4): everything works; but when an ad between stories is skipped,
going back lands on the ad, which skips forward again, so the story before it can't be
reached. And: lock the switches with a code, the same on every phone, for good, so only
you can turn the filter off.

**Going back past an ad.** The filter now notes which way you're going through stories:
your own taps (left third of the screen: back), swipes (to the right: back) and arrow
keys, never its own skips. An ad met within 3 s of going back is skipped backwards: with
the "previous" control (`STORIES.previousLabels`), looked for next to the "next" one and
never at the top of the screen (where an "Indietro" would leave the stories), or else
the left-arrow key. A retry keeps the first direction.

**Locked switches.** `src/filter/lock.js`: the code's fingerprint (SHA-256 of a salt +
the code); the code itself is in no file, commit or document of this public repository.
Its own small SHA-256, because the app has no crypto library built in (adding one would
mean a new APK); it matches Node's on the standard test vectors. After 5 wrong codes in a
row, a 30 s wait. Both the Safari panel and the app's settings show the switches greyed
out with a code box; they unlock until the settings close. Copy problem report, Check for
updates and Reload stay free. The tests use a code of their own: `test/helpers.mjs` puts
its fingerprint in their copy of the filter. Limits: four digits can be worked out from
the fingerprint by someone determined, and the app or the Userscripts extension can be
removed. It's a brake, not a safe.

Tests: going back through an ad lands on the story before it (with the controls, and
with the arrow keys only); the panel's lock (wrong code, right code, locked again after
closing, no codes in the report); the lock itself (SHA-256, digits only, the wait). 50 pass.

### Stage 3, round 7: back to the classic home; settings in three parts (2026-10-31)
What you said (on 0.3.5): open the app on the classic home (the one with the stories),
not on the Following feed, which you don't use. And keep what everyone may need (the
problem report, updates, reload, …) out of the locked filters, so only the filters that
remove reels and the other addictive parts are locked.

**Following feed removed.** The "Home: only people you follow" switch, the switch of
`/` to `/?variant=following` (`HOME_FEED`, `homeRedirect`), the Home-tap and back-arrow
handling on that page, and the app's start address are gone. The app opens on
`https://www.instagram.com/`, and Home is Instagram's own. A saved `followingFeed` is
ignored (unknown switches are). If you open Instagram's own Following feed from its menu,
it's left as it is.

**Settings in three parts**, in the app and in the Safari panel:
- **App:** Copy problem report, Check for updates, Reload Instagram. Free for anyone.
- **Display:** switches that turn nothing back on (`TOGGLES[].free`): Small boxes, and
  in Safari "Show the settings button". Free too.
- **Filters:** the rest, locked with the code as before.

Tests: the home page opens as it is, with the stories, and Home keeps it there; the
panel's display switches move without the code while the filters stay locked. The
Following-feed checks are removed. 46 pass.

On the classic home, Instagram mixes in suggested posts: they're covered at their size
("Suggestion hidden"), so there can be more empty cards than on the Following feed. If
that's too much, the Small boxes test switch is the thing to try.

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
