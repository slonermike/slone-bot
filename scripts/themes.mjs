#!/usr/bin/env node
// Theme pool access. The ONLY sanctioned way for a nightly run to touch themes/*.json.
// Spec: docs/tech/07-themes-script.md.  Commands: roll | resolve | add | report
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const MIN_POOL = 15;
export const TYPES = ['constraint', 'feeling', 'system', 'world'];
const MAX_ADDS_PER_NIGHT = 3;
const STRIKES_TO_GRAVEYARD = 3;

export class ThemeError extends Error {}

// ---------- storage ----------
function files(dir) {
  return {
    pool: path.join(dir, 'pool.json'),
    graveyard: path.join(dir, 'graveyard.json'),
    state: path.join(dir, 'state.json'),
    fallback: path.join(dir, 'fallback-pool.json'),
  };
}
const read = (f, dflt) => (fs.existsSync(f) && fs.readFileSync(f, 'utf8').trim() ? JSON.parse(fs.readFileSync(f, 'utf8')) : dflt);
const write = (f, v) => fs.writeFileSync(f, JSON.stringify(v, null, 2) + '\n');

function load(dir) {
  const f = files(dir);
  const state = read(f.state, {});
  state.rollHistory ??= [];
  state.used ??= [];
  state.adds ??= {};
  state.events ??= [];
  return { f, pool: read(f.pool, []), graveyard: read(f.graveyard, []), state };
}

export function todayUTC() {
  return process.env.THEMES_TODAY || new Date().toISOString().slice(0, 10);
}

// ---------- seeded shuffle ----------
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
function hash(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}
const sameSet = (a, b) => a.length === b.length && [...a].sort().join() === [...b].sort().join();

// ---------- reasons ----------
const LAZY = /^\s*(it'?s |this is |that'?s )?(just |simply )?(too|very|really|so)?\s*(hard|difficult|complex|complicated|big|large|much work|time[- ]consuming|expensive)(\s+(to|for me to)\s+(build|make|implement|do|code|create))?(\s+(in|for) (one|a|the) night)?\.?\s*$|^\s*(too|would take too) (much|long)( (work|time))?( to (build|make|implement))?\.?\s*$/i;
const COMPARATIVE = /\b(others?|alternatives?|instead|rather|better than|preferred|picked|chose|chosen|more (interesting|fun|promising|feasible|exciting|appealing|focused)( \w+)? than)\b/i;

export function isLazyReason(r) {
  return LAZY.test(r.trim());
}
/** Heuristic: does this reason criticize the theme itself, rather than just prefer an alternative? */
export function citesTheme(r) {
  return !COMPARATIVE.test(r);
}

// ---------- commands ----------
export function roll({ dir = path.join(ROOT, 'themes'), today = todayUTC(), n = 3 } = {}) {
  const { f, pool, state } = load(dir);
  if (state.lastRollDate === today) throw new ThemeError(`already rolled tonight (${today}). One roll per night.`);
  let source = pool;
  const notes = [];
  if (pool.length < n) {
    const fb = read(f.fallback, []);
    if (fb.length < n) throw new ThemeError('theme pool and fallback pool are both too small to roll');
    notes.push(`WARNING: pool has ${pool.length} themes (< ${n}). Falling back to fallback-pool.json.`);
    state.events.push({ date: today, event: 'fallback-pool-used', poolSize: pool.length });
    source = structuredClone(fb);
    write(f.pool, source);
  } else if (pool.length < MIN_POOL) {
    notes.push(`WARNING: theme pool has only ${pool.length} themes (minimum ${MIN_POOL}).`);
    state.events.push({ date: today, event: 'pool-below-minimum', poolSize: pool.length });
  }
  const seen = state.rollHistory.map((h) => h.ids);
  let ids = null;
  for (let salt = 0; salt < 200 && !ids; salt++) {
    const rng = mulberry32(hash(`${today}#${salt}`));
    const order = source.map((t) => t.id).sort();
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    const pick = order.slice(0, n);
    if (!seen.some((s) => sameSet(s, pick))) ids = pick;
  }
  if (!ids) throw new ThemeError('could not find a trio that was not offered before');
  state.lastRollDate = today;
  state.rollHistory.push({ date: today, ids });
  write(f.state, state);
  const lines = ids.map((id) => {
    const t = source.find((x) => x.id === id);
    return `${t.id} | ${t.type} | ${t.text}`;
  });
  return { text: [...notes, ...lines].join('\n'), ids };
}

export function resolve({ dir = path.join(ROOT, 'themes'), today = todayUTC(), pick, rejects = [] } = {}) {
  const { f, pool, graveyard, state } = load(dir);
  if (state.lastResolveDate === today) throw new ThemeError(`already resolved tonight (${today}). One resolve per night.`);
  const last = state.rollHistory[state.rollHistory.length - 1];
  if (!last || last.date !== today || state.lastRollDate !== today) throw new ThemeError('roll first: no roll recorded for tonight.');
  if (!last.ids.includes(pick)) throw new ThemeError(`pick "${pick}" is not one of tonight's rolled ids.`);
  const rej = new Map();
  for (const r of rejects) {
    if (!last.ids.includes(r.id)) throw new ThemeError(`reject "${r.id}" is not one of tonight's rolled ids.`);
    if (r.id === pick) throw new ThemeError(`"${pick}" cannot be both picked and rejected.`);
    if (!r.reason || !r.reason.trim()) throw new ThemeError(`reject "${r.id}" needs a non-empty reason.`);
    if (isLazyReason(r.reason)) throw new ThemeError(`reject "${r.id}": reinterpret it smaller instead. "Too hard to build" is not a reason; shrink the idea.`);
    rej.set(r.id, r.reason.trim());
  }
  for (const id of last.ids) if (id !== pick && !rej.has(id)) throw new ThemeError(`rolled option "${id}" must be rejected with a reason.`);

  const summary = [];
  const picked = pool.find((t) => t.id === pick);
  if (!picked) throw new ThemeError(`picked theme "${pick}" is no longer in the pool.`);
  picked.used = today;
  state.used.push({ id: picked.id, text: picked.text, type: picked.type, date: today });
  let newPool = pool.filter((t) => t.id !== pick);
  summary.push(`picked ${pick}: ${picked.text}`);

  for (const [id, reason] of rej) {
    const t = newPool.find((x) => x.id === id);
    if (!t) continue;
    t.strikes += 1;
    t.reasons.push({ date: today, text: reason });
    if (t.strikes >= STRIKES_TO_GRAVEYARD && t.reasons.some((x) => citesTheme(x.text))) {
      graveyard.push({ ...t, retired: today });
      newPool = newPool.filter((x) => x.id !== id);
      summary.push(`rejected ${id}: retired to graveyard`);
    } else {
      summary.push(`rejected ${id}`);
    }
  }
  state.lastResolveDate = today;
  write(f.pool, newPool);
  write(f.graveyard, graveyard);
  write(f.state, state);
  return { text: summary.join('\n') };
}

const STOP = new Set('a an the of to and or in on for with you your it is are be as at by that this from but not'.split(' '));
const tokens = (s) => new Set(s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter((w) => w && !STOP.has(w)));
export function similarity(a, b) {
  const A = tokens(a), B = tokens(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  return inter / Math.min(A.size, B.size);
}

export function add({ dir = path.join(ROOT, 'themes'), today = todayUTC(), text, type, source = 'postmortem', env = process.env } = {}) {
  const { f, pool, graveyard, state } = load(dir);
  if (!text || !text.trim()) throw new ThemeError('theme text is required.');
  if (!TYPES.includes(type)) throw new ThemeError(`--type must be one of ${TYPES.join('|')}.`);
  if (!['postmortem', 'human', 'seed'].includes(source)) throw new ThemeError('--source must be postmortem|human|seed.');
  if (env.NIGHT_RUN === '1' && source !== 'postmortem') throw new ThemeError('nightly runs must use --source postmortem.');
  if ((state.adds[today] ?? 0) >= MAX_ADDS_PER_NIGHT && source === 'postmortem') throw new ThemeError(`at most ${MAX_ADDS_PER_NIGHT} themes may be added per night.`);
  const existing = [...pool, ...graveyard, ...state.used];
  if (existing.some((t) => similarity(t.text, text) >= 0.7)) throw new ThemeError('too similar to an existing or retired theme. Write a different design prompt.');
  const nums = [...existing, ...read(f.fallback, [])].map((t) => Number(/\d+/.exec(t.id)?.[0] ?? 0));
  const id = `t${String(Math.max(0, ...nums) + 1).padStart(3, '0')}`;
  pool.push({ id, text: text.trim(), type, source, strikes: 0, reasons: [], used: null });
  state.adds[today] = (state.adds[today] ?? 0) + 1;
  write(f.pool, pool);
  write(f.state, state);
  return { text: `added ${id}: ${text.trim()}` };
}

export function report({ dir = path.join(ROOT, 'themes'), env = process.env } = {}) {
  if (env.NIGHT_RUN === '1') throw new ThemeError('report is for the human only; refused under NIGHT_RUN=1.');
  const { pool, graveyard, state } = load(dir);
  const out = [`pool size: ${pool.length} (min ${MIN_POOL})`, `used so far: ${state.used.length}`, `graveyard: ${graveyard.length}`, 'strikes:'];
  for (const t of pool.filter((x) => x.strikes > 0)) out.push(`  ${t.id} x${t.strikes} ${t.text}`);
  for (const t of graveyard) out.push(`  [graveyard] ${t.id} ${t.text}: ${t.reasons.map((r) => r.text).join(' / ')}`);
  const words = {};
  for (const t of [...pool, ...graveyard]) for (const r of t.reasons) for (const w of tokens(r.text)) words[w] = (words[w] ?? 0) + 1;
  const top = Object.entries(words).sort((a, b) => b[1] - a[1]).slice(0, 10);
  out.push('common words in rejection reasons: ' + (top.map(([w, c]) => `${w}(${c})`).join(' ') || 'none'));
  if (state.events.length) out.push('events: ' + state.events.map((e) => `${e.date} ${e.event}`).join('; '));
  return { text: out.join('\n') };
}

// ---------- CLI ----------
function parseArgs(argv) {
  const o = { _: [], reject: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      const v = argv[++i];
      if (k === 'reject') {
        const m = /^(t\d+):([\s\S]*)$/.exec(v ?? '');
        if (!m) throw new ThemeError('use --reject <id>:"reason"');
        o.reject.push({ id: m[1], reason: m[2].replace(/^["']|["']$/g, '') });
      } else o[k] = v;
    } else o._.push(a);
  }
  return o;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dir = process.env.THEMES_DIR ? path.resolve(process.env.THEMES_DIR) : path.join(ROOT, 'themes');
  try {
    const [cmd, ...rest] = process.argv.slice(2);
    const a = parseArgs(rest);
    let r;
    if (cmd === 'roll') r = roll({ dir, n: a.n ? Number(a.n) : 3 });
    else if (cmd === 'resolve') r = resolve({ dir, pick: a.pick, rejects: a.reject });
    else if (cmd === 'add') r = add({ dir, text: a._[0], type: a.type, source: a.source ?? 'postmortem' });
    else if (cmd === 'report') r = report({ dir });
    else throw new ThemeError('usage: themes.mjs roll [--n 3] | resolve --pick <id> --reject <id>:"reason" ... | add "<text>" --type <type> --source postmortem | report');
    console.log(r.text);
  } catch (e) {
    if (e instanceof ThemeError) { console.error(`themes: ${e.message}`); process.exit(1); }
    throw e;
  }
}
