#!/usr/bin/env node
// Run-protocol helper: NIGHT_STATE.md checkpoints, elapsed-time gates, seeded atom picks.
// Commands: start [--night <slug>] [--force] | checkpoint <phase> [note...] | set key=value ... | show | elapsed | check | atoms [--seed N]
// Spec: docs/tech/06-nightly-run-protocol.md
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const WRAP_MIN = 180;
export const PENCILS_MIN = 210;
const STATE_FILE = () => process.env.NIGHT_STATE_FILE || path.join(ROOT, 'NIGHT_STATE.md');
const PHASES = ['start', 'brief', 'core', 'feel', 'test', 'done'];
const KEYS = ['night', 'started', 'phase', 'branch', 'brief', 'lastGoodBuild'];

export function parseState(text) {
  const s = { notes: [] };
  for (const line of text.split(/\r?\n/)) {
    const m = /^(\w+):\s*(.*)$/.exec(line);
    if (!m) continue;
    if (m[1] === 'notes') { if (m[2]) s.notes.push(m[2]); }
    else s[m[1]] = m[2];
  }
  const noteBlock = text.split(/^notes:.*$/m)[1];
  if (noteBlock) s.notes = noteBlock.split(/\r?\n/).map((l) => l.replace(/^[-*]\s*/, '').trim()).filter(Boolean);
  return s;
}

export function formatState(s) {
  const lines = ['```'];
  for (const k of KEYS) lines.push(`${k}: ${s[k] ?? ''}`);
  lines.push('notes: one line per checkpoint');
  for (const n of s.notes ?? []) lines.push(`- ${n}`);
  lines.push('```');
  return lines.join('\n') + '\n';
}

function readState() {
  const f = STATE_FILE();
  if (!fs.existsSync(f)) return null;
  return parseState(fs.readFileSync(f, 'utf8').replace(/```/g, ''));
}
function writeState(s) {
  fs.writeFileSync(STATE_FILE(), formatState(s));
}

export function elapsedMinutes(s, now = Date.now()) {
  const t = Date.parse(s.started);
  return Number.isFinite(t) ? (now - t) / 60000 : NaN;
}
export function gate(min) {
  return min >= PENCILS_MIN ? 'PENCILS-DOWN' : min >= WRAP_MIN ? 'WRAP-UP' : 'OK';
}
const fmt = (min) => `${Math.floor(min / 60)}:${String(Math.floor(min % 60)).padStart(2, '0')}`;

// ---------- atoms ----------
function mulberry32(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function parseAtoms(md) {
  return [...md.matchAll(/^- `([a-z]-[a-z0-9-]+)`:/gm)].map((m) => m[1]);
}
export function parseLedgerPairs(md) {
  const pairs = [];
  for (const line of md.split(/\r?\n/)) {
    const m = /atoms:\s*([a-z]-[a-z0-9-]+)\s*,\s*([a-z]-[a-z0-9-]+)/.exec(line);
    if (m) pairs.push([m[1], m[2]]);
  }
  return pairs;
}
/** Two atoms from different categories (by id prefix), avoiding pairings already in the ledger. */
export function pickAtoms(atoms, ledgerPairs, seed) {
  const rng = mulberry32(seed);
  const used = new Set(ledgerPairs.map((p) => [...p].sort().join('+')));
  for (let tries = 0; tries < 500; tries++) {
    const a = atoms[Math.floor(rng() * atoms.length)];
    const b = atoms[Math.floor(rng() * atoms.length)];
    if (a === b) continue;
    if (a[0] === b[0] && tries < 400) continue;
    if (used.has([a, b].sort().join('+'))) continue;
    return [a, b];
  }
  throw new Error('no unused atom pairing found');
}
function dateSeed(d = new Date().toISOString().slice(0, 10)) {
  let h = 0x811c9dc5;
  for (const c of d) { h ^= c.charCodeAt(0); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

// ---------- CLI ----------
function main(argv) {
  const [cmd, ...rest] = argv;
  const flag = (n) => rest.includes(`--${n}`);
  const opt = (n) => { const i = rest.indexOf(`--${n}`); return i >= 0 ? rest[i + 1] : undefined; };
  const now = new Date();

  if (cmd === 'start') {
    const prev = readState();
    if (prev && prev.phase && prev.phase !== 'done' && elapsedMinutes(prev) < 360 && !flag('force')) {
      const m = elapsedMinutes(prev);
      console.log(`RESUMING night ${prev.night || '(unnamed)'} phase=${prev.phase} elapsed ${fmt(m)} [${gate(m)}]. Use --force to start over.`);
      return;
    }
    const s = { night: opt('night') ?? 'tbd', started: now.toISOString(), phase: 'start', branch: 'none', brief: 'none', lastGoodBuild: 'none', notes: [`${now.toISOString()} started`] };
    writeState(s);
    console.log(`started ${s.started}. Soft wrap-up at 3:00, pencils-down at 3:30.`);
  } else if (cmd === 'checkpoint') {
    const s = readState();
    if (!s) throw new Error('no NIGHT_STATE.md; run `start` first');
    const phase = rest[0];
    if (!PHASES.includes(phase)) throw new Error(`phase must be one of ${PHASES.join('|')}`);
    s.phase = phase;
    const m = elapsedMinutes(s, now.getTime());
    s.notes.push(`${fmt(m)} phase=${phase}${rest[1] ? ' ' + rest.slice(1).join(' ') : ''}`);
    writeState(s);
    console.log(`checkpoint ${phase} at ${fmt(m)} [${gate(m)}]`);
  } else if (cmd === 'set') {
    const s = readState();
    if (!s) throw new Error('no NIGHT_STATE.md; run `start` first');
    for (const kv of rest) {
      const [k, ...v] = kv.split('=');
      if (!KEYS.includes(k) || k === 'started') throw new Error(`cannot set "${k}"`);
      s[k] = v.join('=');
    }
    writeState(s);
    console.log('ok');
  } else if (cmd === 'show') {
    const s = readState();
    console.log(s ? fs.readFileSync(STATE_FILE(), 'utf8') : 'no NIGHT_STATE.md');
  } else if (cmd === 'elapsed' || cmd === 'check') {
    const s = readState();
    if (!s) throw new Error('no NIGHT_STATE.md; run `start` first');
    const m = elapsedMinutes(s, now.getTime());
    const g = gate(m);
    console.log(`elapsed ${fmt(m)}  ${g}${g === 'WRAP-UP' ? ': freeze scope' : g === 'PENCILS-DOWN' ? ': stop editing, ship the last passing build' : ''}`);
    if (cmd === 'check' && g === 'PENCILS-DOWN') process.exitCode = 2;
  } else if (cmd === 'atoms') {
    const lib = fs.readFileSync(path.join(ROOT, 'docs/design/03-concept-library.md'), 'utf8');
    const ledger = fs.readFileSync(path.join(ROOT, 'docs/design/ledger.md'), 'utf8');
    const seed = opt('seed') ? Number(opt('seed')) : dateSeed();
    const [a, b] = pickAtoms(parseAtoms(lib), parseLedgerPairs(ledger), seed);
    console.log(`${a}, ${b}`);
  } else {
    console.error('usage: night-state.mjs start|checkpoint <phase> [note]|set k=v|show|elapsed|check|atoms [--seed N]');
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(process.argv.slice(2)); } catch (e) { console.error(`night-state: ${e.message}`); process.exit(1); }
}
