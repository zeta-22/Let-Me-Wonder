# iPhone setup (Safari + Userscripts, free)

About 5 minutes, once. You need nothing but your iPhone.

**What you're installing:** *Userscripts* is a free, open-source Safari add-on
whose only job is to run small scripts on the websites they're made for. Our
script is the Let Me Wonder filter: it only runs on instagram.com, never reads
what you type, and sends nothing anywhere.

## 1. Install Userscripts
1. Install **Userscripts** from the App Store:
   <https://apps.apple.com/app/id1463298887> (free, no in-app purchases).
2. Open it once. It sets itself up; you can close it again.

## 2. Turn it on in Safari
1. Open **Settings → Apps → Safari → Extensions → Userscripts** and turn it
   **on**. (On older iOS versions, look under **Settings → Safari →
   Extensions**.)
2. When Safari asks whether Userscripts may run on a website, allow it for
   **instagram.com** (and for raw.githubusercontent.com during step 3, where
   the filter is downloaded from). It doesn't need any other website.

## 3. Install the filter
1. In **Safari**, open this link:
   <https://raw.githubusercontent.com/zeta-22/Let-Me-Wonder/main/dist/let-me-wonder.user.js>
   You'll see a page of code. That's the filter.
2. Tap the **extensions button** in Safari's address bar (the puzzle piece, or
   the **aA** menu), then **Userscripts**. It shows an install prompt. Tap
   **Install**.
3. If you don't see an install prompt, tell Claude. There's a manual way too.

## 4. Use it
1. Open **instagram.com** in Safari and log in, as usual. Your password goes
   only to Instagram.
2. **Is the Reels button gone from the bottom bar?** Then the filter is running.
3. Tap the small round button at the bottom right: the filter's settings open.
   At the bottom they show the version, e.g. **Version 0.3.7 · rules
   2026.10.31f**.
4. Go through the [checklist](CHECKLIST.md).

**What you'll notice:** no Reels, Explore grid, suggestions or ads. A hidden
post keeps its place as an empty card with a small grey label ("Reel hidden",
"Suggestion hidden"), so the feed doesn't jump. Ads between stories are skipped
by themselves, also when you go back through the stories. Two fingers zoom
photos and stories.

## 5. A Home Screen icon, and a quick test
Since iOS 26, a site added to the Home Screen can open **full screen as a web
app** (no address bar, its own icon), which feels almost like a real app.
Safari add-ons may not run in that mode, so test it:

1. On instagram.com, tap **Share → Add to Home Screen**. Leave
   **Open as Web App** turned **on** and tap **Add**.
2. Open Instagram from the new icon. **Is the Reels button gone from the bottom
   bar?**
   - **Yes:** the filter works full screen. Keep this icon, you're done.
   - **No:** the filter doesn't run in web-app mode. Delete the icon, add it
     again with **Open as Web App** turned **off**. That icon opens normal
     Safari, where the filter works.
3. Tell Claude which one it was.

## Settings and "Report a problem"
- The small round button at the bottom right opens the settings. In stories
  it sits on the right edge, halfway up; in DMs and while you make a post or a
  story it hides. You can also open
  **instagram.com/#lmw**.
- The settings have three parts:
  - **Copy problem report**, for anyone: when something slipped through or
    doesn't work, tap it on that screen and paste the report to Claude. It holds
    the page's *structure* and a short timeline in numbers: usernames are
    replaced with `{user}`, captions and DM messages are left out, and anything
    you've typed is never included. Skim it before sending if you like.
  - **Display**, for anyone: "Reels in the home feed, also from people you
    follow" (off: friends' reels show; on: every reel is hidden; reels from
    accounts you don't follow stay hidden either way), "Small boxes for hidden
    posts" (a test, off: if the feed starts jumping with it, turn it off),
    "Pinch to zoom photos and stories" (on) and "Show the settings button".
  - **Filters**: what hides reels, Explore, suggestions and ads. You can see
    them, but changing them takes the **code** (the owner has it). They stay
    unlocked until you close the settings. After 5 wrong codes, wait 30 seconds.

## Updates
When Claude fixes something, Userscripts picks up the new version by itself
after a while (it checks now and then). To get it right away, open the install
link from step 3 again and tap **Install**.
