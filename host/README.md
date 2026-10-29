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

## Safety
Sandboxed renderer, no Node in the page, all permission prompts denied, navigation locked to the launcher's origin, new windows denied.

## Not built yet
Syncing snapshots into a local cache for true offline play, an in-launcher Quit item, an app icon, code signing, Steam overlay and achievements (Steamworks), and a public Steam release (see ROADMAP).
