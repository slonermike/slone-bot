#!/usr/bin/env node
// Guard for the desktop app's release: the release workflow only builds a version that has no release yet, so a change to
// host/ that keeps the old version never ships. Fails a pull request that changes host/ without raising host/package.json's version.
//   node scripts/check-host-version.mjs <base-ref>     (default origin/main)
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const parse = (v) => String(v).split('.').map((n) => Number(n) || 0);
export function isNewer(a, b) {
  const [x, y] = [parse(a), parse(b)];
  for (let i = 0; i < 3; i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) > (y[i] ?? 0);
  return false;
}

/** Files under host/ that ship in the app (tests and docs do not need a release). */
export function shipsInApp(file) {
  return /^host\/(main|config|updater|preload)\.cjs$|^host\/offline\.html$|^host\/package\.json$/.test(file);
}

export function hostVersionProblem(changedFiles, baseVersion, headVersion) {
  const shipped = changedFiles.filter(shipsInApp).filter((f) => f !== 'host/package.json');
  if (!shipped.length) return null;
  if (isNewer(headVersion, baseVersion)) return null;
  return `host/ changed (${shipped.join(', ')}) but the version is still ${headVersion}. The release workflow only builds new versions, so bump "version" in host/package.json.`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const base = process.argv[2] ?? 'origin/main';
  const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8' });
  const changed = git('diff', '--name-only', `${base}...HEAD`).split('\n').filter(Boolean);
  const baseVersion = JSON.parse(git('show', `${base}:host/package.json`)).version;
  const headVersion = JSON.parse(fs.readFileSync(path.join(ROOT, 'host/package.json'), 'utf8')).version;
  const problem = hostVersionProblem(changed, baseVersion, headVersion);
  if (problem) { console.error(`host version check failed: ${problem}`); process.exit(1); }
  console.log(`host version check ok (${baseVersion} -> ${headVersion})`);
}
