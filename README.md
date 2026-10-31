# Let Me Wonder

Instagram without the addictive parts: no Reels, no Explore grid, no suggested
posts, no ads, no endless video swiping. DMs, stories, posting, search, your
profile and the feed of people you follow keep working.

- **iPhone:** Instagram in Safari, filtered by the free Userscripts add-on.
  See [docs/IPHONE.md](docs/IPHONE.md).
- **Android:** our own app (Expo + WebView) with the same filter built in.
  See [docs/ANDROID.md](docs/ANDROID.md).

Personal project. The full plan is in [docs/PLAN.md](docs/PLAN.md).

## Status

| Stage | What | Status |
|---|---|---|
| 0 | Tidy up, plan | done |
| 1 | The filter, plus the iPhone setup (Safari + Userscripts) | built and tested in the cloud; waiting for the test on your iPhone |
| 2 | Android app (Expo + WebView, free Expo account) | Part A done: the app is written and compiles in the cloud. Part B (build the APK) needs the `EXPO_TOKEN` |
| 3 | Tuning on both phones with "Report a problem" | not started |

## How it works

Instagram's website is a *single-page app*: it changes pages without reloading
and keeps adding posts as you scroll. The filter runs inside that page, from
the moment it starts loading, and works in five layers:

1. **CSS, instantly.** Things recognisable by their link address are hidden
   before they're ever drawn, e.g. any link ending in `/reels/` (the Reels tab)
   and the Explore grid tiles.
2. **Labels, as the page changes.** A `MutationObserver` sees every change
   Instagram makes. When a label like *Sponsored*, *Sponsorizzato*,
   *Suggeriti per te* or *Consigli per te* appears, the post or block around it
   is marked and hidden. A block never grows past another heading, so
   a "Suggeriti per te" heading at the bottom of your notifications hides only
   the list under it. Everything after *"You're all caught up"* is hidden too.
3. **Pages.** Every address change is checked against the rules. Taps on
   blocked links are stopped. If Instagram moves to a blocked page anyway, a
   **Blocked** screen covers it, pauses any video, and offers **Go back**. On a
   single reel (e.g. one sent in DMs), moving to a *different* reel is
   blocked: that's what stops the endless swipe. Home opens Instagram's
   **Following** feed (`/?variant=following`): only people you follow, newest
   first. That page has no stories row: its back arrow (**← Seguiti**) is left
   to Instagram and opens the main home page, which has the stories.
4. **The feed keeps its own layout.** Instagram's feed keeps only the posts
   near the screen in the page, and holds the room of the others from their
   measured heights. So a hidden post keeps its exact size: it is *covered*
   (everything in it invisible and untappable, a small grey label such as
   "Reel hidden" on it) instead of shrunk. Shrinking it made the whole feed jump
   back by a post as you scrolled past. With the layout unchanged, Instagram's
   scrolling and its loading of more posts work as if the filter weren't there.
   A covered post's video is paused, and posts stay covered when you open a
   story or a post from the feed. On the Following feed, Home scrolls back to
   the top instead of reloading it. A test switch, **Small boxes for hidden
   posts** (off by default), shrinks them to a small box and asks Instagram to
   measure the feed again; if Instagram doesn't, the feed jumps, so switch it off.
5. **Ads between stories.** A story with the *Sponsored* label is paused and
   skipped with the story viewer's own "next" control (or the right-arrow key),
   never with the ad's buttons. On stories, the settings button sits on the right
   edge, so you can copy a problem report while an ad is on screen.

It detects things by **stable signals** (link addresses such as `/reels/`,
`/explore/` and `/reel/<id>`, `<article>` posts, roles, aria-labels, and label
text in several languages), never by Instagram's random CSS class names.
Hidden items are only hidden, never removed, so Instagram keeps working.

**Privacy:** the filter never reads input boxes, never sends anything over the
network and stores only your switch settings and, for the problem report, a short
timeline of the last page load in numbers (scroll positions, post counts). You log in on Instagram's own
page.

## Project layout

```
src/filter/rules.js     ALL the rules: addresses, selectors, labels. Edit this one.
src/filter/routes.js    Decides if a page may open (shared with the Android app)
src/filter/filter.js    The engine: observer, page checks, tap blocking
src/filter/report.js    "Report a problem" outline (anonymised)
src/filter/log.js       The report's timeline: scroll jumps, posts arriving, what the filter did
src/filter/ui.js, *.css Blocked screen, settings button and panel
src/filter/generated/   The built filter as the Android app injects it (don't edit)
scripts/build-filter.mjs  Builds dist/let-me-wonder.user.js and src/filter/generated/
dist/let-me-wonder.user.js  The built script that Userscripts installs (don't edit)

App.js, index.js        The Android app's entry point
src/mobile/InstagramScreen.js  WebView + filter, app-level page blocking, back button, restart after a page crash
src/mobile/urlPolicy.js What to do with a full page load (allow/block/browser/ignore)
src/mobile/SettingsScreen.js, BlockedScreen.js, settings.js, injected.js, theme.js
app.json, eas.json      App name, Android package, permissions; Expo cloud build profile
assets/                 Icons (made by scripts/make-icons.mjs)

test/fake-instagram/    A tiny fake Instagram that copies the signals the filter uses
test/filter.test.mjs    Automatic checks for the filter (npm test)
test/url-policy.test.mjs  Automatic checks for the app's page rules (npm test)
test/smoke-live.mjs     Quick check on the real, logged-out instagram.com (npm run smoke)
docs/                   Plan, iPhone and Android guides, phone checklist
```

## Updating the filter when Instagram changes something

Instagram changes its site often. Most fixes are a small edit to
`src/filter/rules.js`:

1. **Get a problem report.** On the phone: filter settings → *Copy problem
   report*, on the screen where something slipped through. The report shows
   which switches are on, what was hidden, how many items each CSS rule
   matched, a timeline of the last things that happened (scroll jumps, posts
   arriving and leaving, page changes, also from the page load before), and an outline of the page
   (tags, roles, aria-labels, link patterns like `/{user}/` and `/p/{id}/`,
   short texts).
2. **Find the change** in the outline. Typical cases and where to fix them:

   | What happened | Edit in `rules.js` |
   |---|---|
   | An ad shows with a new wording or language | add it to `LABELS.sponsored` |
   | "Suggested for you" in a new wording | add it to `LABELS.suggestedForYou` |
   | Reels tab or Explore grid back on screen | `CSS_RULES`: the link pattern changed |
   | A page that should be blocked opens | `ROUTES`: add or adjust its address pattern |
   | Feed posts are no longer `<article>` | `STRUCTURE.post` |
   | A whole block gets hidden that shouldn't | `STRUCTURE.content` / `boundary` |

3. **Reproduce it** in the fake Instagram (`test/fake-instagram/app.js`) and
   add a check in `test/filter.test.mjs`, so the fix stays fixed.
4. **Check and publish:**
   - Run `npm test`.
   - Raise `version` in `package.json`. Userscripts only updates when the
     version number goes up.
   - Run `npm run build:filter` and commit, including `dist/` and
     `src/filter/generated/`.
   - Merge to `main`. The iPhone gets the update automatically after a while.
   - Android: publish it with `npx eas-cli update --channel preview --message "…"`.
     The app picks it up the next time it opens.

## Development

```bash
npm install
```

```bash
npm test
```

`npm test` builds the filter and runs the automatic checks in a headless
Chrome (needs Playwright with Chromium, preinstalled in the cloud environment).
`npm run smoke` loads the real instagram.com logged out. Instagram limits
traffic from cloud servers, so that check can only confirm that the filter
starts without errors.

The Android app is checked in the cloud with `npx expo-doctor` and
`npx expo export --platform android` (does the app's code compile). The installable
APK is built in Expo's cloud with `npx eas-cli build -p android --profile preview`,
which needs an `EXPO_TOKEN` in the environment.
