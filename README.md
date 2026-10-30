# Let Me Wonder

Instagram without the addictive parts: no Reels, no Explore grid, no suggested
posts, no ads, no endless video swiping. DMs, stories, posting, search, your
profile and the feed of people you follow keep working.

- **iPhone:** Instagram in Safari, filtered by the free Userscripts add-on.
  See [docs/IPHONE.md](docs/IPHONE.md).
- **Android:** our own app, coming in Stage 2.

Personal project. The full plan is in [docs/PLAN.md](docs/PLAN.md).

## Status

| Stage | What | Status |
|---|---|---|
| 0 | Tidy up, plan | done |
| 1 | The filter, plus the iPhone setup (Safari + Userscripts) | built and tested in the cloud; waiting for the test on your iPhone |
| 2 | Android app (Expo + WebView, free Expo account) | not started |
| 3 | Tuning on both phones with "Report a problem" | not started |

## How it works

Instagram's website is a *single-page app*: it changes pages without reloading
and keeps adding posts as you scroll. The filter runs inside that page, from
the moment it starts loading, and works in three layers:

1. **CSS, instantly.** Things recognisable by their link address are hidden
   before they're ever drawn, e.g. any link ending in `/reels/` (the Reels tab),
   feed posts that link to a `/reel/`, and the Explore grid tiles.
2. **Labels, as the page changes.** A `MutationObserver` sees every change
   Instagram makes. When a label like *Sponsored*, *Sponsorizzato* or
   *Suggested for you* appears, the post or block around it is marked and
   hidden. Everything after *"You're all caught up"* is hidden too.
3. **Pages.** Every address change is checked against the rules. Taps on
   blocked links are stopped. If Instagram moves to a blocked page anyway, a
   **Blocked** screen covers it, pauses any video, and offers **Go back**. On a
   single reel (e.g. one sent in DMs), moving to a *different* reel is
   blocked: that's what stops the endless swipe.

It detects things by **stable signals** (link addresses such as `/reels/`,
`/explore/` and `/reel/<id>`, `<article>` posts, roles, aria-labels, and label
text in several languages), never by Instagram's random CSS class names.
Hidden items are only hidden, never removed, so Instagram keeps working.

**Privacy:** the filter never reads input boxes, never sends anything over the
network and stores only your switch settings. You log in on Instagram's own
page.

## Project layout

```
src/filter/rules.js     ALL the rules: addresses, selectors, labels. Edit this one.
src/filter/routes.js    Decides if a page may open (shared with the Android app)
src/filter/filter.js    The engine: observer, page checks, tap blocking
src/filter/report.js    "Report a problem" outline (anonymised)
src/filter/ui.js, *.css Blocked screen, settings button and panel
scripts/build-filter.mjs  Builds dist/let-me-wonder.user.js
dist/let-me-wonder.user.js  The built script that Userscripts installs (don't edit)
test/fake-instagram/    A tiny fake Instagram that copies the signals the filter uses
test/filter.test.mjs    Automatic checks (npm test)
test/smoke-live.mjs     Quick check on the real, logged-out instagram.com (npm run smoke)
docs/                   Plan, iPhone setup, phone checklist
```

## Updating the filter when Instagram changes something

Instagram changes its site often. Most fixes are a small edit to
`src/filter/rules.js`:

1. **Get a problem report.** On the phone: filter settings → *Copy problem
   report*, on the screen where something slipped through. The report shows
   which switches are on, what was hidden, how many items each CSS rule
   matched, and an outline of the page (tags, roles, aria-labels, link
   patterns like `/{user}/` and `/p/{id}/`, short texts).
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
   - Run `npm run build:filter` and commit, including `dist/`.
   - Merge to `main`. The iPhone gets the update automatically after a while.

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
