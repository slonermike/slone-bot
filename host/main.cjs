const { app, BrowserWindow, session, ipcMain, shell, net } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { resolveConfig, isAllowedNavigation, needsRevalidation, isSteamDeck, launchedBySteam, sandboxUnavailable, NO_MOUSE_CSS } = require('./config.cjs');
const { createUpdater } = require('./updater.cjs');

const cfg = resolveConfig({
  argv: process.argv.slice(1),
  env: process.env,
  dirs: [app.getPath('userData'), path.dirname(app.getPath('exe'))],
});

// A plain-text log next to the settings (~/.config/minigame-bot-host/host.log), so a launch that hangs or dies
// under Steam, where there is no terminal, can still be diagnosed. The previous run is kept as host.log.1.
const logFile = path.join(app.getPath('userData'), 'host.log');
try {
  fs.mkdirSync(path.dirname(logFile), { recursive: true });
  if (fs.existsSync(logFile)) fs.renameSync(logFile, `${logFile}.1`);
} catch { /* logging must never stop the app */ }
const t0 = Date.now();
let logged = 0;
function log(...parts) {
  const line = `${new Date().toISOString()} +${((Date.now() - t0) / 1000).toFixed(2)}s ${parts.map((p) => (typeof p === 'string' ? p : JSON.stringify(p))).join(' ')}\n`;
  if ((logged += line.length) > 256 * 1024) return; // a retry loop must not fill the disk
  try { fs.appendFileSync(logFile, line); } catch { /* ignore */ }
}
process.on('uncaughtException', (err) => { log('uncaughtException', String(err && err.stack || err)); });
process.on('unhandledRejection', (err) => { log('unhandledRejection', String(err && err.stack || err)); });

// Gamepad and audio just work in the page: no autoplay gate, and keep running when the window loses focus
// (Steam's overlay steals focus briefly).
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
// Steam Deck: gamescope runs a Wayland/X session; let Electron pick (ozone auto) and use the GPU.
app.commandLine.appendSwitch('ozone-platform-hint', 'auto');
// The Chromium sandbox needs unprivileged user namespaces. SteamOS has them; Ubuntu 23.10+ restricts them, and the
// app would die at launch. Drop the OS sandbox there (the page is still sandboxed, isolated, and locked to our origin)
// or when asked with --no-sandbox-if-needed.
if (process.platform === 'linux') {
  const readText = (p) => { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } };
  if (process.argv.includes('--no-sandbox-if-needed') || sandboxUnavailable(readText)) app.commandLine.appendSwitch('no-sandbox');
}

if (!app.requestSingleInstanceLock()) { log('another instance holds the lock; quitting'); app.quit(); }

let osRelease = '';
try { osRelease = fs.readFileSync('/etc/os-release', 'utf8'); } catch { /* not Linux */ }
const deck = isSteamDeck(process.env, osRelease);
const viaSteam = launchedBySteam(process.env);
const env = process.env;
log('start', { version: app.getVersion(), electron: process.versions.electron, platform: process.platform, arch: process.arch, argv: process.argv.slice(1), url: cfg.url, windowed: cfg.windowed });
log('env', { deck, viaSteam, XDG_SESSION_TYPE: env.XDG_SESSION_TYPE, WAYLAND_DISPLAY: env.WAYLAND_DISPLAY, DISPLAY: env.DISPLAY, GAMESCOPE_WAYLAND_DISPLAY: env.GAMESCOPE_WAYLAND_DISPLAY, SteamGameId: env.SteamGameId, STEAM_COMPAT_APP_ID: env.STEAM_COMPAT_APP_ID, STEAM_COMPAT_DATA_PATH: env.STEAM_COMPAT_DATA_PATH, APPIMAGE: env.APPIMAGE, noSandbox: app.commandLine.hasSwitch('no-sandbox') });
let win;
let retry;
let updater;

function load() {
  clearTimeout(retry);
  win.loadURL(cfg.url).catch(() => {});
}

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    fullscreen: !cfg.windowed,
    autoHideMenuBar: true,
    backgroundColor: '#0b0b14',
    show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false, devTools: cfg.devtools },
  });
  win.removeMenu();
  win.once('ready-to-show', () => { log('ready-to-show'); win.show(); });
  // If the first paint never comes (a GPU or display-backend problem), show the window anyway rather than hang invisibly.
  setTimeout(() => { if (win && !win.isDestroyed() && !win.isVisible()) { log('no ready-to-show after 5s; showing anyway'); win.show(); } }, 5000);
  win.webContents.on('did-finish-load', () => log('did-finish-load', win.webContents.getURL()));
  win.webContents.on('render-process-gone', (_e, d) => log('render-process-gone', d));
  win.webContents.on('unresponsive', () => log('page unresponsive'));
  win.webContents.on('console-message', (_e, level, message, line, source) => { if (level >= 2) log('page error', message, `${source}:${line}`); });

  // Window-local shortcuts (global ones need OS permission on some systems and fight other apps).
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return;
    if ((input.control || input.meta) && input.key.toLowerCase() === 'q') { e.preventDefault(); app.quit(); }
    else if (input.key === 'F11') { e.preventDefault(); win.setFullScreen(!win.isFullScreen()); }
  });

  // The gamepad is the only input. Steam Input can turn triggers and trackpads into mouse clicks; ignore the mouse
  // completely on the Deck (or with --no-mouse) so a stray click can never act on, or take focus from, the page.
  const mouseOff = !cfg.allowMouse && (cfg.noMouse || deck);
  if (mouseOff) {
    const hideMouse = () => win.webContents.insertCSS(NO_MOUSE_CSS).catch(() => {});
    win.webContents.on('did-finish-load', hideMouse);
    win.webContents.on('did-navigate-in-page', hideMouse);
  }
  // The Gamepad API only reports to a focused page, so hand focus back whenever the window gets it.
  win.on('focus', () => win.webContents.focus());
  win.webContents.on('did-finish-load', () => win.webContents.focus());

  // Stay inside the launcher; never open new windows.
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e, target) => {
    const ok = isAllowedNavigation(target, cfg.origin) || target.startsWith('file:') && target.endsWith('offline.html');
    if (!ok) e.preventDefault();
  });

  // Offline or server down: show the local page, keep retrying the real one.
  win.webContents.on('did-fail-load', (_e, code, _desc, failedUrl, isMainFrame) => {
    log('did-fail-load', { code, desc: _desc, url: failedUrl, isMainFrame });
    if (!isMainFrame || code === -3 /* aborted */) return;
    if (failedUrl.startsWith('file:')) return;
    win.loadFile(path.join(__dirname, 'offline.html'), { query: { url: cfg.url } }).catch(() => {});
    retry = setTimeout(load, 5000);
  });

  load();
}

const fromLauncher = (e) => {
  try { return new URL(e.senderFrame.url).origin === cfg.origin; } catch { return false; }
};

async function fetchJson(url) {
  const res = await net.fetch(url, { headers: { accept: 'application/vnd.github+json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function setupUpdates() {
  const { autoUpdater } = require('electron-updater');
  updater = createUpdater({
    app, shell, autoUpdater, fetchJson, origin: cfg.origin, platform: process.platform, arch: process.arch,
    send: (s) => win && !win.isDestroyed() && win.webContents.send('mgb:update', s),
  });
  ipcMain.on('mgb:info', (e) => { e.returnValue = { version: app.getVersion(), platform: process.platform, mouseOff: !cfg.allowMouse && (cfg.noMouse || deck), deck, steam: viaSteam }; });
  ipcMain.handle('mgb:update-state', (e) => (fromLauncher(e) ? updater.state : null));
  ipcMain.handle('mgb:update-check', (e) => (fromLauncher(e) ? updater.check() : null));
  ipcMain.handle('mgb:update-install', (e) => (fromLauncher(e) ? updater.install() : null));
  ipcMain.handle('mgb:quit', (e) => { if (fromLauncher(e)) app.quit(); });
  // look once shortly after start, then every few hours while it stays open
  setTimeout(() => updater.check(), 8000);
  setInterval(() => updater.check(), 6 * 60 * 60 * 1000);
}

app.on('child-process-gone', (_e, d) => log('child-process-gone', d));
app.whenReady().then(() => {
  log('ready; gpu', app.getGPUFeatureStatus());
  setupUpdates();
  // Deny every permission prompt (the launcher needs none; the Gamepad API is not permission-gated).
  session.defaultSession.setPermissionRequestHandler((_wc, _perm, cb) => cb(false));
  // ask the server to revalidate pages and data on every load (a 304 is cheap), so exiting a game loads a fresh launcher
  session.defaultSession.webRequest.onBeforeSendHeaders({ urls: [`${cfg.origin}/*`] }, (details, cb) => {
    const headers = { ...details.requestHeaders };
    if (needsRevalidation(details.url)) headers['Cache-Control'] = 'no-cache';
    cb({ requestHeaders: headers });
  });
  createWindow();
  log('window created');
  // Escape hatches for desktop testing; on the Deck, quit from Steam's own menu.
  app.on('second-instance', () => win && (win.isMinimized() && win.restore(), win.focus()));
});

app.on('window-all-closed', () => { log('window-all-closed'); app.quit(); });
