const test = require('node:test');
const assert = require('node:assert');
const { compareVersions, pickAsset, parseRelease } = require('../updater.cjs');

test('compareVersions', () => {
  assert.equal(compareVersions('0.2.0', '0.1.9'), 1);
  assert.equal(compareVersions('v1.0.0', '1.0.0'), 0);
  assert.equal(compareVersions('0.1.0', '0.1.1'), -1);
  assert.equal(compareVersions('1.10.0', '1.9.0'), 1);
});

const assets = [
  'Minigame-Bot-0.2.0-x64.AppImage', 'Minigame-Bot-Setup-0.2.0-x64.exe', 'Minigame-Bot-0.2.0-x64.dmg', 'Minigame-Bot-0.2.0-arm64.dmg', 'latest.yml',
].map((name) => ({ name, browser_download_url: `https://x/${name}` }));

test('pickAsset per platform', () => {
  assert.match(pickAsset(assets, 'win32', 'x64').name, /\.exe$/);
  assert.match(pickAsset(assets, 'linux', 'x64').name, /\.AppImage$/);
  assert.equal(pickAsset(assets, 'darwin', 'arm64').name, 'Minigame-Bot-0.2.0-arm64.dmg');
  assert.equal(pickAsset(assets, 'darwin', 'x64').name, 'Minigame-Bot-0.2.0-x64.dmg');
  assert.equal(pickAsset(assets, 'freebsd', 'x64'), null);
});

test('parseRelease flags only newer versions', () => {
  const json = { tag_name: 'v0.2.0', html_url: 'https://x/r', assets };
  assert.equal(parseRelease(json, '0.1.0', 'linux', 'x64').newer, true);
  assert.equal(parseRelease(json, '0.2.0', 'linux', 'x64').newer, false);
  assert.equal(parseRelease({}, '0.1.0', 'linux', 'x64'), null);
});

const { createUpdater } = require('../updater.cjs');
const { EventEmitter } = require('node:events');

function make({ packaged = true, platform = 'darwin', release } = {}) {
  const states = [];
  const opened = [];
  const au = Object.assign(new EventEmitter(), { checkUpdates: 0, downloads: 0, installs: 0 });
  au.checkForUpdates = async () => { au.checkUpdates++; au.emit('update-available', { version: '0.3.0' }); };
  au.downloadUpdate = async () => { au.downloads++; au.emit('download-progress', { percent: 50 }); au.emit('update-downloaded'); };
  au.quitAndInstall = () => { au.installs++; };
  const u = createUpdater({
    app: { isPackaged: packaged, getVersion: () => '0.2.0' }, shell: { openExternal: async (x) => opened.push(x) }, autoUpdater: au,
    send: (s) => states.push(s.status), origin: 'https://site.example/', platform, arch: 'arm64', fetchJson: async () => release,
  });
  return { u, states, opened, au };
}

test('dev builds never check', async () => {
  const { u, states } = make({ packaged: false });
  await u.check();
  assert.equal(u.state.status, 'dev');
  assert.deepEqual(states, []);
});

test('macOS: newer release is manual and opens the download page', async () => {
  const { u, opened } = make({ platform: 'darwin', release: { tag_name: 'v0.3.0', assets } });
  await u.check();
  assert.equal(u.state.status, 'available');
  assert.equal(u.state.manual, true);
  await u.install();
  assert.deepEqual(opened, ['https://site.example/download/']);
});

test('macOS: same version is current', async () => {
  const { u } = make({ platform: 'darwin', release: { tag_name: 'v0.2.0', assets } });
  await u.check();
  assert.equal(u.state.status, 'current');
});

test('Windows: downloads, then installs and restarts', async () => {
  const { u, au, states } = make({ platform: 'win32' });
  await u.check();
  assert.equal(u.state.status, 'available');
  await u.install();
  assert.equal(au.downloads, 1);
  assert.equal(au.installs, 1);
  assert.ok(states.includes('downloading') && states.includes('ready'));
});
