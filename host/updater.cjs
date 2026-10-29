// Update logic. The pure helpers (version compare, asset pick, release parsing) are unit-tested without Electron;
// `createUpdater` wires them to electron-updater (Windows, Linux AppImage) or to a manual "open the download page" path (macOS and other installs,
// because electron-updater cannot swap an unsigned macOS app).
const REPO = 'slonermike/slone-bot';
const DOWNLOAD_PAGE = (origin) => new URL('download/', origin).href;

function compareVersions(a, b) {
  const pa = String(a).replace(/^v/, '').split('-')[0].split('.').map(Number);
  const pb = String(b).replace(/^v/, '').split('-')[0].split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d > 0 ? 1 : -1;
  }
  return 0;
}

/** Pick the right installer for a platform from a GitHub release's asset list. */
function pickAsset(assets, platform, arch) {
  const find = (re) => assets.find((a) => re.test(a.name));
  if (platform === 'win32') return find(/\.exe$/i) ?? null;
  if (platform === 'linux') return find(/\.AppImage$/i) ?? null;
  if (platform === 'darwin') {
    return find(arch === 'arm64' ? /arm64.*\.dmg$/i : /x64.*\.dmg$/i) ?? find(/\.dmg$/i);
  }
  return null;
}

/** Turn GitHub's "latest release" JSON into what the host shows. */
function parseRelease(json, current, platform, arch) {
  const version = String(json.tag_name || '').replace(/^v/, '');
  if (!version) return null;
  const asset = pickAsset(json.assets || [], platform, arch);
  return { version, newer: compareVersions(version, current) > 0, assetUrl: asset?.browser_download_url ?? null, page: json.html_url ?? null };
}

/**
 * @param {object} deps { app, shell, autoUpdater, send(state), origin, platform, arch, fetchJson }
 * State: { status: 'dev'|'idle'|'checking'|'current'|'available'|'downloading'|'ready'|'error', version, percent, manual, error }
 */
function createUpdater(deps) {
  const { app, shell, autoUpdater, send, origin, platform, arch, fetchJson } = deps;
  let state = { status: app.isPackaged ? 'idle' : 'dev', current: app.getVersion(), version: null, percent: 0, manual: false, error: null };
  const set = (patch) => { state = { ...state, ...patch }; send(state); };
  // electron-updater can replace itself on Windows (NSIS) and Linux AppImage only.
  const auto = app.isPackaged && (platform === 'win32' || (platform === 'linux' && !!process.env.APPIMAGE));

  if (auto) {
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = false;
    autoUpdater.on('update-available', (i) => set({ status: 'available', version: i.version, manual: false }));
    autoUpdater.on('update-not-available', () => set({ status: 'current', version: null }));
    autoUpdater.on('download-progress', (p) => set({ status: 'downloading', percent: Math.round(p.percent) }));
    autoUpdater.on('update-downloaded', () => { set({ status: 'ready', percent: 100 }); autoUpdater.quitAndInstall(false, true); });
    autoUpdater.on('error', (e) => set({ status: 'error', error: String(e && e.message || e).slice(0, 200) }));
  }

  async function check() {
    if (state.status === 'dev' || state.status === 'checking' || state.status === 'downloading') return state;
    set({ status: 'checking', error: null });
    try {
      if (auto) {
        await autoUpdater.checkForUpdates();
      } else {
        const rel = parseRelease(await fetchJson(`https://api.github.com/repos/${REPO}/releases/latest`), state.current, platform, arch);
        if (rel && rel.newer) set({ status: 'available', version: rel.version, manual: true, assetUrl: rel.assetUrl });
        else set({ status: 'current', version: null });
      }
    } catch (e) {
      set({ status: 'error', error: String(e && e.message || e).slice(0, 200) });
    }
    return state;
  }

  async function install() {
    if (state.status !== 'available') return state;
    if (state.manual) { await shell.openExternal(DOWNLOAD_PAGE(origin)); return state; }
    set({ status: 'downloading', percent: 0 });
    try { await autoUpdater.downloadUpdate(); } catch (e) { set({ status: 'error', error: String(e && e.message || e).slice(0, 200) }); }
    return state;
  }

  return { check, install, get state() { return state; }, auto };
}

module.exports = { compareVersions, pickAsset, parseRelease, createUpdater, REPO, DOWNLOAD_PAGE };
