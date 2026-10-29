const { app, BrowserWindow, globalShortcut, session } = require('electron');
const path = require('node:path');
const { resolveConfig, isAllowedNavigation } = require('./config.cjs');

const cfg = resolveConfig({
  argv: process.argv.slice(1),
  env: process.env,
  dirs: [app.getPath('userData'), path.dirname(app.getPath('exe'))],
});

// Gamepad and audio just work in the page: no autoplay gate, and keep running when the window loses focus
// (Steam's overlay steals focus briefly).
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
// Steam Deck: gamescope runs a Wayland/X session; let Electron pick (ozone auto) and use the GPU.
app.commandLine.appendSwitch('ozone-platform-hint', 'auto');
// The Deck's sandbox needs user namespaces; SteamOS has them, but fall back if a launch reports otherwise.
if (process.argv.includes('--no-sandbox-if-needed') && process.platform === 'linux') app.commandLine.appendSwitch('no-sandbox');

if (!app.requestSingleInstanceLock()) app.quit();

let win;
let retry;

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
    webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false, devTools: cfg.devtools },
  });
  win.removeMenu();
  win.once('ready-to-show', () => win.show());

  // Stay inside the launcher; never open new windows.
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e, target) => {
    const ok = isAllowedNavigation(target, cfg.origin) || target.startsWith('file:') && target.endsWith('offline.html');
    if (!ok) e.preventDefault();
  });

  // Offline or server down: show the local page, keep retrying the real one.
  win.webContents.on('did-fail-load', (_e, code, _desc, failedUrl, isMainFrame) => {
    if (!isMainFrame || code === -3 /* aborted */) return;
    if (failedUrl.startsWith('file:')) return;
    win.loadFile(path.join(__dirname, 'offline.html'), { query: { url: cfg.url } }).catch(() => {});
    retry = setTimeout(load, 5000);
  });

  load();
}

app.whenReady().then(() => {
  // Deny every permission prompt (the launcher needs none; the Gamepad API is not permission-gated).
  session.defaultSession.setPermissionRequestHandler((_wc, _perm, cb) => cb(false));
  createWindow();
  // Escape hatches for desktop testing; on the Deck, quit from Steam's own menu.
  globalShortcut.register('CommandOrControl+Q', () => app.quit());
  globalShortcut.register('F11', () => win.setFullScreen(!win.isFullScreen()));
  app.on('second-instance', () => win && (win.isMinimized() && win.restore(), win.focus()));
});

app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => app.quit());
