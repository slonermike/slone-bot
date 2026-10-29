// Resolves where the host loads the launcher from. Pure, so it is unit-testable without Electron.
// Priority: --url=<url> flag, MGB_URL env var, config.json next to the app or in userData, built-in default.
const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_URL = 'https://slone-bot.vercel.app/';

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return {};
  }
}

function resolveConfig({ argv = [], env = {}, dirs = [] } = {}) {
  const flag = (name) => argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
  const has = (name) => argv.includes(`--${name}`);
  const files = dirs.map((d) => readJson(path.join(d, 'config.json')));
  const fromFile = files.find((f) => typeof f.url === 'string')?.url;
  const raw = flag('url') || env.MGB_URL || fromFile || DEFAULT_URL;
  const url = new URL(raw);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error(`unsupported url: ${raw}`);
  return {
    url: url.href,
    origin: url.origin,
    windowed: has('windowed'),
    noMouse: has('no-mouse'),
    allowMouse: has('allow-mouse'),
    devtools: has('devtools'),
  };
}

/** Navigation stays on the launcher's own origin; everything else is refused. */
function isAllowedNavigation(target, origin) {
  try {
    return new URL(target).origin === origin;
  } catch {
    return false;
  }
}

/**
 * Pages and data (the launcher, game pages, index.json) must be revalidated on every load so leaving a game always
 * lands on a fresh launcher and a republished game is never stale. Hashed build assets never change, so they can
 * stay cached.
 */
function needsRevalidation(target) {
  try {
    return !/\/assets\//.test(new URL(target).pathname);
  } catch {
    return false;
  }
}

/** True on a Steam Deck / SteamOS (the Deck sets SteamDeck=1 for games; SteamOS also identifies itself in os-release). */
function isSteamDeck(env = {}, osRelease = '') {
  return env.SteamDeck === '1' || env.SteamOS === '1' || /^ID=["']?steamos["']?$/m.test(osRelease);
}

/** Injected into every page on the Deck: the controller is the only input, so a stray click must do nothing. */
const NO_MOUSE_CSS = 'html,body,*{cursor:none !important;pointer-events:none !important;user-select:none !important}';

module.exports = { resolveConfig, isAllowedNavigation, needsRevalidation, isSteamDeck, NO_MOUSE_CSS, DEFAULT_URL };
