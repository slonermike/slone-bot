# host: the Steam Deck shell

A thin Electron app that opens the hosted launcher full screen, so SteamOS shows no browser chrome. It holds no game code: the games are the frozen snapshots on the site, so shipping a new game never means shipping a new host.

Why Electron: it bundles Chromium, so the Gamepad API and WebGL behave the same on the Deck as in desktop Chrome. (Tauri uses the system WebKitGTK, whose gamepad support is spotty.)

## Run it (desktop, for now)
```
cd host
npm install            # downloads Electron
MGB_URL=https://<your-site>/ npm start          # full screen; F11 toggles, Ctrl+Q quits
MGB_URL=https://<your-site>/ npm run start:windowed
```
The URL comes from, in order: `--url=...`, the `MGB_URL` env var, a `config.json` (`{"url": "https://..."}`) in the app's user-data folder or next to the executable, then `https://slone-bot.vercel.app/` (for local testing use `MGB_URL=http://127.0.0.1:4173/` with `npm run serve`).

Offline or the site down: it shows a local "can't reach the games" page and retries every 5 seconds. Pages already visited are served from Chromium's cache.

## Releases and self-update
- Releases are built by CI (`.github/workflows/host-release.yml`) for **Windows** (installer), **macOS** (Apple silicon and Intel .dmg), and **Linux** (AppImage, also the Steam Deck build) whenever `host/` changes on main. A release is made only when `host/package.json`'s `version` has no release yet, so **bump the version to ship**. Installers are attached to a GitHub Release (`v<version>`), not stored in the repo or the `site` branch.
- The site has a `/download/` page that lists the latest installers (it reads the GitHub Releases API in the browser). It is linked from the launcher menu only when the launcher runs in a plain browser, never inside the app.
- Inside the app, the launcher's **Start menu** gets an "App update" row (moved to the top when an update is waiting). The app checks 8 seconds after start and every 6 hours. On Windows and Linux AppImage, pressing A downloads the new version and restarts into it (electron-updater). On macOS, builds are unsigned, so the app cannot swap itself: the row opens the download page in the system browser instead.
- Unsigned builds: Windows SmartScreen will warn on first install, macOS needs right-click Open the first time. Code signing is a later decision.
- Dev builds (`npm start`) never check for updates.

## Build for the Deck
Download the Linux AppImage from the releases (or `npm run dist -- --linux` locally), copy it to the Deck (Desktop Mode), `chmod +x`, then in Steam: Add a Non-Steam Game, pick the AppImage. The URL is built in, so there is nothing to configure; if the site moves, set `{"url": "https://..."}` in `~/.config/minigame-bot-host/config.json`. In the game's Controller settings choose the **Gamepad** template (not the default desktop mouse layout), so the page sees a standard pad. Launch from Gaming Mode; quit from Steam's menu (Steam button, Exit Game). Keep the AppImage somewhere writable (your home folder) so it can replace itself.

## Quitting and freshness
- **Quit:** the launcher's Start menu has a "Quit app" row, shown only inside the desktop app (it has no window chrome). `Ctrl+Q` also quits on desktop; on a Steam Deck the Steam menu's Exit Game works too.
- **Fresh pages:** the app asks the server to revalidate every page and data request (`Cache-Control: no-cache`; an unchanged page is a cheap 304), and only keeps hashed build assets cached. So leaving a game always lands on a current launcher and a republished game is never stale. The launcher also reloads itself if the browser restores it from the back-forward cache.

## Steam Deck input
Steam Input sits between the controller and the app. With the wrong layout it turns the pad into a mouse and keyboard: a trigger becomes a click and the buttons stop reaching the games (the Gamepad API only sees a real gamepad). The app handles this in three ways:
- **Mouse off on the Deck** (detected from `SteamDeck=1` or SteamOS): the cursor is hidden and every mouse and wheel event is swallowed before any page script sees it, so a stray click can never act on, or steal focus from, the page. Elsewhere the mouse works; force it with `--no-mouse` or `--allow-mouse`.
- **Focus:** the Gamepad API reports only to a focused page, so the app gives the page focus whenever the window gets it and after every load.
- **A hint instead of a mystery:** if no controller shows up within 8 seconds, the launcher footer says so, and Start opens **Controller help** (also in the Start menu). The fix it describes: in Steam, open this app's Controller Settings, Browse Configs, and pick the official **Gamepad** template (not Desktop or Web Browser), then relaunch. The keyboard works as a fallback everywhere.
- The debug overlay (hold Select, press A) shows `pad yes (<controller name>)`, which says exactly which controller the browser sees.

Shortcuts are window-local (`Ctrl+Q` quits, `F11` toggles full screen); nothing is registered globally, so the OS has nothing to complain about.

## Safety
Sandboxed renderer, no Node in the page, all permission prompts denied, navigation locked to the launcher's origin, new windows denied.

## Not built yet
Syncing snapshots into a local cache for true offline play, an in-launcher Quit item, an app icon, code signing, Steam overlay and achievements (Steamworks), and a public Steam release (see ROADMAP).
