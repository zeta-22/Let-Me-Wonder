# Let Me Wonder

A personal app (Android + iPhone) that shows Instagram **without the addictive
parts**: no Reels, no Explore grid, no suggested posts, no ads, no endless
video swiping. DMs, stories, posting, search, your profile and the feed of
people you follow keep working.

## How it works (short version)

The app does **not** touch the official Instagram app. It opens
`https://www.instagram.com` inside its own built-in browser (a *WebView*),
then adds a small filter:

- **CSS** that hides the unwanted parts of the page before they appear,
- **JavaScript** that keeps watching the page (Instagram changes it constantly
  without reloading) and hides new unwanted items as they show up,
- **navigation blocking**: if the app is asked to open a blocked address
  (e.g. `/reels/` or `/explore/`), it shows a friendly "blocked" screen with a
  back button instead.

Each filter rule is a switch in the app's settings, all on by default.

**Privacy:** you log in on Instagram's own page inside the WebView, exactly as
in a browser. The app never reads, stores or sends your password; it only keeps
Instagram's normal login cookie so you stay logged in.

## Status

| Phase | What | Status |
|---|---|---|
| 0 | Check the tools on your Windows PC | **in progress** |
| 1 | Filter prototype as a Chrome extension, tested on instagram.com | not started |
| 2 | Expo app: WebView + filter + settings + blocked screen + persistent login | not started |
| 3 | Android APK you install permanently (free, no Play Store) | not started |
| 4 | iPhone options (needs a decision about Apple's paid account) | not started |
| 5 | Optional: locking the real Instagram app | not started |

## Project layout

```
scripts/check-env.ps1   Phase 0: read-only check of your PC's tools
docs/SETUP-WINDOWS.md   Phase 0: what to install, why, and how
```

More folders arrive with each phase (the filter itself will live in
`src/filter/` so it can be tested on its own, outside the app).

## Getting started

See [docs/SETUP-WINDOWS.md](docs/SETUP-WINDOWS.md).
