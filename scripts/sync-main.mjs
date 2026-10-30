#!/usr/bin/env node
// Keeps the shared state on main in step with the runs. Runs happen on proto branches, so what a run records there
// (the theme pool, the ledger, pending lessons) never reaches main by itself, and the next run starts blind.
//   pull   start of a run: take themes/ from the latest main, so this run rolls from the real pool.
//   push   right after `themes.mjs resolve` (and after adding themes): commit just themes/ to main and push it, so the
//          consumption survives even if the run later dies. Retries if main moved.
//   notes  at wrap-up: append what this run added to docs/design/ledger.md and pending-lessons.md onto main's copies
//          (appended lines only, so other runs' entries are kept) and push. Safe to run twice.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const NOTE_FILES = ['docs/design/ledger.md', 'docs/design/pending-lessons.md'];
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

/**
 * What `ours` added to `base` (non-blank lines, in order), appended to `theirs`. A heading ("## ") gets a blank line
 * before it. Returns `theirs` unchanged when those lines are already there, so repeating it is harmless.
 */
export function appendAdded(base, ours, theirs) {
  const seen = new Map();
  for (const l of base.split('\n')) seen.set(l, (seen.get(l) ?? 0) + 1);
  const added = [];
  for (const l of ours.split('\n')) {
    if (!l.trim()) continue;
    if (seen.get(l) > 0) seen.set(l, seen.get(l) - 1); else added.push(l);
  }
  if (!added.length || theirs.includes(added.join('\n'))) return theirs;
  const out = [theirs.replace(/\s*$/, '')];
  for (const l of added) { if (l.startsWith('## ')) out.push(''); out.push(l); }
  return out.join('\n') + '\n';
}

/** Append this run's ledger line and lessons to main (`from` is a ref to read them from instead of the working tree). */
export function pushNotes(root = ROOT, message = 'Ledger and pending lessons from a run', remote = 'origin', branch = 'main', from = null) {
  let lastErr = '';
  for (let attempt = 1; attempt <= 4; attempt++) {
    git(root, 'fetch', remote, branch);
    const base = git(root, 'merge-base', from ?? 'HEAD', `${remote}/${branch}`);
    const wt = fs.mkdtempSync(path.join(os.tmpdir(), 'notes-sync-'));
    try {
      git(root, 'worktree', 'add', '--detach', wt, `${remote}/${branch}`);
      for (const f of NOTE_FILES) {
        let b = '';
        try { b = git(root, 'show', `${base}:${f}`); } catch { /* new file */ }
        const ours = from ? git(root, 'show', `${from}:${f}`) : fs.readFileSync(path.join(root, f), 'utf8');
        const theirs = fs.readFileSync(path.join(wt, f), 'utf8');
        fs.writeFileSync(path.join(wt, f), appendAdded(b, ours, theirs));
      }
      git(wt, 'add', ...NOTE_FILES);
      try { git(wt, 'diff', '--cached', '--quiet'); return 'main already has these notes'; } catch { /* changes */ }
      git(wt, 'commit', '-q', '-m', message);
      try { git(wt, 'push', '-q', remote, `HEAD:${branch}`); return `pushed ledger and lessons to ${remote}/${branch}`; } catch (e) { lastErr = String(e.stderr || e); }
    } finally {
      try { git(root, 'worktree', 'remove', '--force', wt); } catch { /* temp dir */ }
    }
  }
  throw new Error(`could not push notes to ${remote}/${branch} after 4 tries: ${lastErr.slice(0, 300)}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [cmd, ...rest] = process.argv.slice(2);
  try {
    if (cmd === 'pull') console.log(pull());
    else if (cmd === 'push') console.log(push(ROOT, rest.join(' ') || undefined));
    else if (cmd === 'notes') console.log(pushNotes(ROOT, rest.join(' ') || undefined));
    else { console.error('usage: sync-main.mjs pull|push|notes ["commit message"]'); process.exitCode = 1; }
  } catch (e) { console.error(`sync-main: ${e.message}`); process.exitCode = 1; }
}
