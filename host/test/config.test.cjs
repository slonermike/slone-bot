const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { resolveConfig, isAllowedNavigation, needsRevalidation, DEFAULT_URL } = require('../config.cjs');

test('defaults', () => {
  const c = resolveConfig();
  assert.equal(c.url, DEFAULT_URL);
  assert.equal(c.windowed, false);
});

test('flag beats env beats file', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mgbhost-'));
  fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify({ url: 'https://file.example/' }));
  assert.equal(resolveConfig({ dirs: [dir] }).url, 'https://file.example/');
  assert.equal(resolveConfig({ dirs: [dir], env: { MGB_URL: 'https://env.example/' } }).url, 'https://env.example/');
  assert.equal(resolveConfig({ dirs: [dir], env: { MGB_URL: 'https://env.example/' }, argv: ['--url=https://flag.example/'] }).url, 'https://flag.example/');
});

test('rejects non-http urls', () => {
  assert.throws(() => resolveConfig({ argv: ['--url=file:///etc/passwd'] }));
});

test('navigation stays on origin', () => {
  assert.ok(isAllowedNavigation('https://a.example/p/x/', 'https://a.example'));
  assert.ok(!isAllowedNavigation('https://evil.example/', 'https://a.example'));
  assert.ok(!isAllowedNavigation('nonsense', 'https://a.example'));
});

test('pages and data revalidate; hashed assets stay cached', () => {
  assert.ok(needsRevalidation('https://a.example/'));
  assert.ok(needsRevalidation('https://a.example/index.json'));
  assert.ok(needsRevalidation('https://a.example/p/some-game/'));
  assert.ok(needsRevalidation('https://a.example/jukebox/songs.json'));
  assert.ok(!needsRevalidation('https://a.example/assets/index-abc123.js'));
  assert.ok(!needsRevalidation('https://a.example/p/some-game/assets/init-xyz.js'));
  assert.ok(!needsRevalidation('not a url'));
});
