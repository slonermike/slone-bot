#!/usr/bin/env node
// Run-protocol helper: NIGHT_STATE.md checkpoints, elapsed-time gates, seeded atom picks.
// Commands: start [--night <slug>] [--force] | checkin | resume "<input>" | checkpoint <phase> [note...] [--early --reason "why"] | round "<played> | <noticed> | <changed>" [--stepback] | set key=value ... | show | elapsed | check | atoms [--seed N] | look [--seed N] | genre <g1> <g2> <g3> [<g4> <g5>] [--reroll --reason "why"]
// Spec: docs/tech/06-nightly-run-protocol.md
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runKey } from './run-key.mjs';
import { formatLook, parseLedgerLooks, pickLook } from './looks.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const WRAP_MIN = 75;
export const PENCILS_MIN = 90;
// Finishing early is a failure signal: `checkpoint done` needs this much time and this much iteration, or an explicit --early --reason.
export const MIN_DONE_MIN = 60;
export const MIN_ROUNDS = 3;
const STATE_FILE = () => process.env.NIGHT_STATE_FILE || path.join(ROOT, 'NIGHT_STATE.md');
const PHASES = ['start', 'brief', 'core', 'feel', 'test', 'done'];
const KEYS = ['night', 'started', 'phase', 'branch', 'brief', 'lastGoodBuild', 'genre', 'genreOptions', 'pausedMin', 'checkinAt'];

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

/** Minutes of work so far. Time spent waiting for the human (the check-in) is not counted against the night. */
export function elapsedMinutes(s, now = Date.now()) {
  const t = Date.parse(s.started);
  if (!Number.isFinite(t)) return NaN;
  const waiting = s.checkinAt && Number.isFinite(Date.parse(s.checkinAt)) ? Math.max(0, now - Date.parse(s.checkinAt)) / 60000 : 0;
  return Math.max(0, (now - t) / 60000 - (Number(s.pausedMin) || 0) - waiting);
}
export function gate(min) {
  return min >= PENCILS_MIN ? 'PENCILS-DOWN' : min >= WRAP_MIN ? 'WRAP-UP' : 'OK';
}
export function countRounds(notes = []) {
  return {
    rounds: notes.filter((n) => /^\S+ round \d+:/.test(n)).length,
    stepbacks: notes.filter((n) => /^\S+ stepback \d+:/.test(n)).length,
  };
}
/** Why `checkpoint done` is refused right now ([] means it may proceed). */
export function doneBlockers(min, notes) {
  const { rounds, stepbacks } = countRounds(notes);
  const out = [];
  if (min < MIN_DONE_MIN) out.push(`only ${fmt(min)} elapsed (need ${fmt(MIN_DONE_MIN)})`);
  if (rounds < MIN_ROUNDS) out.push(`${rounds} of ${MIN_ROUNDS} rounds logged`);
  if (stepbacks < 1) out.push('no step-back logged');
  return out;
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
// ---------- genre ----------
export const normalizeGenre = (s) => String(s).trim().toLowerCase().replace(/\s+/g, ' ');
/** `genre: x` tags from the ledger, oldest first. */
export function parseLedgerGenres(md) {
  const out = [];
  for (const line of md.split(/\r?\n/)) {
    const m = /genre:\s*([^|]+?)\s*(?:\||$)/.exec(line);
    if (m) out.push(normalizeGenre(m[1]));
  }
  return out;
}
function textSeed(t) {
  let h = 0x811c9dc5;
  for (const c of t) { h ^= c.charCodeAt(0); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}
/**
 * The agent lists 3 to 5 genres that fit tonight's theme; this picks one at random so the agent cannot steer toward a
 * favorite. Genres used in the last three ledger lines are skipped when there is any other option.
 */
export function pickGenre(options, recent, seed) {
  const opts = [...new Set(options.map(normalizeGenre).filter(Boolean))];
  if (opts.length < 3 || opts.length > 5) throw new Error('give 3 to 5 distinct genres that fit the theme');
  const last = recent.slice(-3);
  const fresh = opts.filter((o) => !last.includes(o));
  const pool = fresh.length ? fresh : opts;
  const rng = mulberry32((seed ^ textSeed(opts.join('|'))) >>> 0);
  return { genre: pool[Math.floor(rng() * pool.length)], options: opts, repeated: fresh.length === 0 };
}

function dateSeed(d = runKey()) {
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
    console.log(`started ${s.started}. Soft wrap-up at 1:15, pencils-down at 1:30 (target about 90 minutes).`);
  } else if (cmd === 'checkpoint') {
    const s = readState();
    if (!s) throw new Error('no NIGHT_STATE.md; run `start` first');
    const phase = rest[0];
    if (!PHASES.includes(phase)) throw new Error(`phase must be one of ${PHASES.join('|')}`);
    const m = elapsedMinutes(s, now.getTime());
    const words = rest.slice(1).filter((a, i, arr) => !['--early', '--reason'].includes(a) && arr[i - 1] !== '--reason');
    let note = words.join(' ');
    if (phase === 'done') {
      const blockers = doneBlockers(m, s.notes);
      if (blockers.length && m < PENCILS_MIN) {
        if (!flag('early')) {
          console.error(`NOT DONE: ${blockers.join('; ')}.\nBuilds are made by looping: play it, note what works and what does not, change it, repeat (docs/tech/06, "Iterate"). Log a round with \`round "<played> | <noticed> | <changed>"\`, and a step-back with \`round --stepback "..."\`. If the game truly is finished, \`checkpoint done --early --reason "why"\`.`);
          process.exitCode = 2;
          return;
        }
        if (!opt('reason')) throw new Error('--early needs --reason "why stopping now is right"');
        note = `finished early (${blockers.join('; ')}) because ${opt('reason')} ${note}`.trim();
      }
    }
    s.phase = phase;
    s.notes.push(`${fmt(m)} phase=${phase}${note ? ' ' + note : ''}`);
    writeState(s);
    console.log(`checkpoint ${phase} at ${fmt(m)} [${gate(m)}]`);
  } else if (cmd === 'round') {
    const s = readState();
    if (!s) throw new Error('no NIGHT_STATE.md; run `start` first');
    const text = rest.filter((a) => !a.startsWith('--')).join(' ').trim();
    if (!text) throw new Error('usage: round "<what I played> | <what I noticed> | <what I changed>" [--stepback]');
    const m = elapsedMinutes(s, now.getTime());
    const c = countRounds(s.notes);
    const kind = flag('stepback') ? 'stepback' : 'round';
    const n = (kind === 'round' ? c.rounds : c.stepbacks) + 1;
    s.notes.push(`${fmt(m)} ${kind} ${n}: ${text}`);
    writeState(s);
    const left = WRAP_MIN - m;
    console.log(`logged ${kind} ${n} at ${fmt(m)}. ${left > 0 ? `${fmt(left)} until wrap-up: ` : 'Past wrap-up: '}${kind === 'stepback' ? 'now act on the biggest weakness you named, then loop again.' : 'now play it again.'}`);
  } else if (cmd === 'checkin') {
    const s = readState();
    if (!s) throw new Error('no NIGHT_STATE.md; run `start` first');
    if (s.checkinAt) { console.log(`already waiting on the human since ${s.checkinAt}; run \`resume\` when they answer or you give up.`); return; }
    s.checkinAt = now.toISOString();
    s.notes.push(`${fmt(elapsedMinutes(s, now.getTime()))} check-in: asked the human for input (clock paused)`);
    writeState(s);
    console.log('clock paused. Ask the question now (see doc 06, "Check in"), then run `resume "<their input, or no input>"`.');
  } else if (cmd === 'resume') {
    const s = readState();
    if (!s) throw new Error('no NIGHT_STATE.md; run `start` first');
    if (!s.checkinAt) throw new Error('no check-in is open; run `checkin` first');
    const waited = Math.max(0, now.getTime() - Date.parse(s.checkinAt)) / 60000;
    s.pausedMin = String(Math.floor(((Number(s.pausedMin) || 0) + waited) * 1000) / 1000);
    s.checkinAt = '';
    const text = rest.join(' ').trim() || 'no input';
    s.notes.push(`${fmt(elapsedMinutes(s, now.getTime()))} check-in answered after ${waited.toFixed(1)} min: ${text}`);
    writeState(s);
    console.log(`resumed; ${waited.toFixed(1)} min of waiting is not counted. Put the human's input in the brief ("Human input:") and follow it.`);
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
    const c = countRounds(s.notes);
    console.log(`elapsed ${fmt(m)}  ${g}${g === 'WRAP-UP' ? ': freeze scope' : g === 'PENCILS-DOWN' ? ': stop editing, ship the last passing build' : ''}`);
    if (g === 'OK') console.log(`rounds ${c.rounds}, step-backs ${c.stepbacks}. ${fmt(WRAP_MIN - m)} until wrap-up. Time left means another loop: play it, note what is weak, change it. Do not wrap up early.`);
    if (cmd === 'check' && g === 'PENCILS-DOWN') process.exitCode = 2;
  } else if (cmd === 'atoms') {
    const lib = fs.readFileSync(path.join(ROOT, 'docs/design/03-concept-library.md'), 'utf8');
    const ledger = fs.readFileSync(path.join(ROOT, 'docs/design/ledger.md'), 'utf8');
    const seed = opt('seed') ? Number(opt('seed')) : dateSeed();
    const [a, b] = pickAtoms(parseAtoms(lib), parseLedgerPairs(ledger), seed);
    console.log(`${a}, ${b}`);
  } else if (cmd === 'genre') {
    const s = readState();
    if (!s) throw new Error('no NIGHT_STATE.md; run `start` first');
    const options = rest.filter((a, i) => !a.startsWith('--') && rest[i - 1] !== '--reason');
    if (s.genre && s.genre !== 'none' && !flag('reroll')) {
      console.log(`genre already rolled: ${s.genre} (from: ${s.genreOptions}). A drastic change later is allowed: --reroll --reason "why".`);
      return;
    }
    if (flag('reroll') && !opt('reason')) throw new Error('--reroll needs --reason "why the current genre is not working"');
    const ledger = fs.readFileSync(path.join(ROOT, 'docs/design/ledger.md'), 'utf8');
    const rerolls = (s.notes ?? []).filter((n) => /genre rerolled/.test(n)).length;
    const r = pickGenre(options, parseLedgerGenres(ledger), dateSeed() + rerolls);
    s.genre = r.genre;
    s.genreOptions = r.options.join(' / ');
    const m = elapsedMinutes(s, now.getTime());
    s.notes.push(`${fmt(m)} genre ${flag('reroll') ? 'rerolled' : 'rolled'}: ${r.genre} (from ${r.options.join(', ')})${flag('reroll') ? ' because ' + opt('reason') : ''}`);
    writeState(s);
    console.log(`GENRE: ${r.genre}\nfrom: ${r.options.join(', ')}${r.repeated ? '\nnote: every option was used in the last three nights, so repeats were allowed' : ''}\nBuild a game recognizably of this genre. Reinterpret it freely for the theme; put "Genre: ${r.genre}" in the brief and add "genre: ${r.genre}" to your ledger line.`);
  } else if (cmd === 'look') {
    const ledger = fs.readFileSync(path.join(ROOT, 'docs/design/ledger.md'), 'utf8');
    const seed = opt('seed') ? Number(opt('seed')) : dateSeed();
    console.log(formatLook(pickLook(parseLedgerLooks(ledger), seed)));
  } else {
    console.error('usage: night-state.mjs start|checkpoint <phase> [note]|set k=v|round \"<played | noticed | changed>\" [--stepback]|show|elapsed|check|atoms [--seed N]|look [--seed N]|genre <3-5 genres>');
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(process.argv.slice(2)); } catch (e) { console.error(`night-state: ${e.message}`); process.exit(1); }
}
