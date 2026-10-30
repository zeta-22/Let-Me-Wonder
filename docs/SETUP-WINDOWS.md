# Setting up your Windows PC (Phase 0)

This page lists every tool the project uses, **what it is, why we need it, and
when** (some are only needed in later phases, so you can wait). Nothing here
costs money or needs an account.

> **Tip:** most tools can be installed with `winget`, the installer built into
> Windows 10/11. You type one command in PowerShell and it downloads and
> installs the official version. If you prefer, every item also has a normal
> website download.

## 1. Check what you already have

1. Press **Start**, type `PowerShell`, open **Windows PowerShell** (a normal
   window, no need for "Run as administrator").
2. Open [`scripts/check-env.ps1`](../scripts/check-env.ps1), copy all of it,
   paste it into the PowerShell window and press **Enter**. If Windows asks
   "paste multiple lines?", say yes.
3. Copy everything it prints and paste it back to Claude.

The script only **looks**: it installs, changes and sends nothing.

Meaning of the labels: **OK** = ready, **MISSING** = needed, **CHECK** = needs a
small fix, **OPTIONAL** = only for some choices later, **INFO** = just facts.

## 2. What you need, by phase

| Tool | Needed for | Why |
|---|---|---|
| Google Chrome | Phase 1 | We test the filter on instagram.com in Chrome first, pretending to be an iPhone screen. |
| Git | Phase 2 | Downloads this project's code from GitHub to your PC, and gets my updates later with one command. |
| Node.js (LTS) | Phase 2 | Runs the Expo tools that turn the code into the app and send it to your phone while we develop. |
| Expo Go (phone app) | Phase 2 | Free app from the Play Store that runs our app on your phone without building anything. |
| USB debugging on the phone | Phase 2-3 (recommended) | Lets desktop Chrome inspect the page *inside* the app on your phone, which makes fixing the filter much easier. |
| adb (Android platform-tools) | Phase 2-3 (recommended, small) | Small Google tool (~10 MB) that talks to your phone over USB: installs APKs, shows logs. |
| Android Studio | Phase 3, **only if** we build the APK on your PC | Big (several GB). We decide in Phase 3; don't install it now. |
| VS Code | optional | A free editor, handy if you want to read or tweak the code. |

## 3. How to install each one

Type each command in PowerShell and press Enter. Each one opens the official
installer; accept the default options unless noted.

### Google Chrome
```powershell
winget install --id Google.Chrome -e
```
Or download from <https://www.google.com/chrome/>.

### Git
```powershell
winget install --id Git.Git -e
```
Or download from <https://git-scm.com/download/win>. The installer asks many
questions; the defaults are all fine.

### Node.js (LTS version)
```powershell
winget install --id OpenJS.NodeJS.LTS -e
```
Or download the **LTS** installer from <https://nodejs.org>. If the installer
offers *"Automatically install the necessary tools"* (Chocolatey / build
tools), leave it **unchecked**; we don't need it.

**Close and reopen PowerShell** after installing Git or Node, otherwise the
window won't find the new commands.

### adb (Android platform-tools)
```powershell
winget install --id Google.PlatformTools -e
```
Or download "SDK Platform-Tools for Windows" from
<https://developer.android.com/tools/releases/platform-tools>, unzip it to
`C:\platform-tools`, and tell Claude it's there.

### USB debugging on your Android phone
1. **Settings → About phone** → tap **Build number** 7 times (on some phones
   it's under *Software information*). You'll see "You are now a developer".
2. **Settings → System → Developer options** (the location varies by brand;
   search the settings for "Developer options") → turn on **USB debugging**.
3. Plug the phone into the PC with a USB cable that carries data (not a
   charge-only cable). On the phone, tap **Allow** when it asks
   "Allow USB debugging?".

You can turn USB debugging off again whenever you like.

### Expo Go (phone)
Install **Expo Go** from the Play Store. Only needed from Phase 2.

### VS Code (optional)
```powershell
winget install --id Microsoft.VisualStudioCode -e
```

## 4. A Windows quirk you may hit: "running scripts is disabled"

If the check shows **PowerShell script policy: Restricted**, commands such as
`npx expo start` (Phase 2) may fail in PowerShell with *"running scripts is
disabled on this system"*. Two fixes, pick one:

- **Use Command Prompt** (`cmd`) instead of PowerShell for those commands, or
- allow scripts for your user only (a common, low-risk setting: scripts you
  write yourself run; scripts downloaded from the internet must be signed):
  ```bash
  Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
  ```

## 5. Where to put the project

Later we'll download the code into a short folder path without spaces, such as
`C:\dev\let-me-wonder`. Android build tools on Windows break on very long
paths, so avoid putting it deep inside Documents or OneDrive.
