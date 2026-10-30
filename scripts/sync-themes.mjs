#!/usr/bin/env node
// Keeps the theme pool on main in step with the runs. The pool is only useful if a theme used by one run is gone for
// the next, and runs happen on proto branches, so state written there never reaches main by itself.
//   pull  start of a run: take themes/ from the latest main, so this run rolls from the real pool.
//   push  right after `themes.mjs resolve` (and after adding themes): commit just themes/ to main and push it, so the
//         consumption survives even if the run later dies. Retries if main moved.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

export function pull(root = ROOT, remote = 'origin', branch = 'main') {
  git(root, 'fetch', remote, branch);
  git(root, 'checkout', `${remote}/${branch}`, '--', 'themes');
  return `themes/ taken from ${remote}/${branch}`;
}

export function push(root = ROOT, message = 'Themes: pool state after a run', remote = 'origin', branch = 'main') {
  const dir = path.join(root, 'themes');
  let lastErr = '';
  for (let attempt = 1; attempt <= 4; attempt++) {
    git(root, 'fetch', remote, branch);
    const wt = fs.mkdtempSync(path.join(os.tmpdir(), 'themes-sync-'));
    try {
      git(root, 'worktree', 'add', '--detach', wt, `${remote}/${branch}`);
      fs.mkdirSync(path.join(wt, 'themes'), { recursive: true });
      for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.json'))) fs.copyFileSync(path.join(dir, f), path.join(wt, 'themes', f));
      git(wt, 'add', 'themes');
      try { git(wt, 'diff', '--cached', '--quiet'); return 'main already has this theme state'; } catch { /* there are changes */ }
      git(wt, 'commit', '-q', '-m', message);
      try { git(wt, 'push', '-q', remote, `HEAD:${branch}`); return `pushed theme state to ${remote}/${branch}`; } catch (e) { lastErr = String(e.stderr || e); }
    } finally {
      try { git(root, 'worktree', 'remove', '--force', wt); } catch { /* temp dir */ }
    }
  }
  throw new Error(`could not push themes/ to ${remote}/${branch} after 4 tries: ${lastErr.slice(0, 300)}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [cmd, ...rest] = process.argv.slice(2);
  try {
    if (cmd === 'pull') console.log(pull());
    else if (cmd === 'push') console.log(push(ROOT, rest.join(' ') || undefined));
    else { console.error('usage: sync-themes.mjs pull|push ["commit message"]'); process.exitCode = 1; }
  } catch (e) { console.error(`sync-themes: ${e.message}`); process.exitCode = 1; }
}
