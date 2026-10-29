#!/usr/bin/env node
// Nightly preflight: verify tools and report what is available. Short output; never fails the night by itself
// (exit 1 only if node is too old or the repo is not installed).
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { findChromium } from '../tests/lib/browser.mjs';

const run = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lines = [];
const log = (k, v) => { lines.push(`${k.padEnd(18)} ${v}`); console.log(`${k.padEnd(18)} ${v}`); };
let fatal = false;

const major = Number(process.versions.node.split('.')[0]);
log('node', `${process.versions.node} ${major >= 22 ? 'ok' : 'TOO OLD (need >= 22.18)'}`);
if (major < 22) fatal = true;

log('PAUSE file', fs.existsSync(path.join(ROOT, 'PAUSE')) ? 'PRESENT: log one line and exit (protocol step 0.1)' : 'absent');
log('NIGHT_RUN env', process.env.NIGHT_RUN === '1' ? 'set (themes report disabled)' : 'not set (scheduled task should set NIGHT_RUN=1)');
log('node_modules', fs.existsSync(path.join(ROOT, 'node_modules/pixi.js')) ? 'ok' : 'MISSING: run npm ci');
if (!fs.existsSync(path.join(ROOT, 'node_modules/pixi.js'))) fatal = true;

// headless Chromium
try {
  const { chromium } = await import('playwright');
  const exe = findChromium();
  let browser;
  try { browser = await chromium.launch({ args: ['--no-sandbox'] }); }
  catch (e) { if (!exe) throw e; browser = await chromium.launch({ args: ['--no-sandbox'], executablePath: exe }); }
  const page = await browser.newPage();
  await page.setContent('<canvas id=c></canvas>');
  const gl = await page.evaluate(() => !!document.getElementById('c').getContext('webgl2') || !!document.getElementById('c').getContext('webgl'));
  const ver = browser.version();
  await browser.close();
  log('chromium', `ok (${ver}), webgl ${gl ? 'yes' : 'NO (use sim-only bots)'}`);
} catch (e) {
  log('chromium', `UNAVAILABLE (${String(e.message).split('\n')[0]}). Continue with sim-only bots and note it.`);
}

// network allowlist probe (curl honors the sandbox proxy env)
const hosts = [
  ['npm', 'https://registry.npmjs.org/'], ['github', 'https://github.com/'], ['pypi', 'https://pypi.org/'],
  ['kenney', 'https://kenney.nl/'], ['opengameart', 'https://opengameart.org/'], ['freesound', 'https://freesound.org/'],
  ['google-fonts', 'https://fonts.google.com/'],
];
const results = await Promise.all(hosts.map(async ([name, url]) => {
  try {
    const { stdout } = await run('curl', ['-sS', '-o', '/dev/null', '-w', '%{http_code}', '-m', '5', '-I', url], { timeout: 8000 });
    const code = Number(stdout);
    return `${name}:${code >= 200 && code < 400 ? 'ok' : code === 0 ? 'blocked' : code}`;
  } catch { return `${name}:blocked`; }
}));
log('network', results.join(' '));

// skills visible on disk (best effort; the tool list in the session is the real source)
const skillDirs = [path.join(os.homedir(), '.claude/skills'), path.join(ROOT, '.claude/skills'), path.join(os.homedir(), '.claude/plugins')];
const found = new Set();
const walk = (d, depth = 0) => {
  if (!fs.existsSync(d) || depth > 4) return;
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (/design|frontend/i.test(e.name)) found.add(e.name);
      walk(path.join(d, e.name), depth + 1);
    }
  }
};
skillDirs.forEach((d) => walk(d));
log('design skills', found.size ? [...found].slice(0, 8).join(', ') : 'none found on disk (check the session skill list for frontend-design)');
log('artifact types', 'not detectable from a script: check the session tool list');
log('summary', fatal ? 'FATAL problems above' : 'ready');
process.exit(fatal ? 1 : 0);
