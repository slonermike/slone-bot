#!/usr/bin/env node
// Level-curve heuristic for the gravity-hop prototype: is each level interesting, and does the run escalate overall with reprieves?
//   npm run level-curve -- <slug> [--step 3] [--verbose]
// Per level it measures (by simulating single hops from every world on the shortest hop path):
//   hops     number of hops on the shortest path (length)
//   progress share of hops that land on a world nearer the goal (too low = dull or unfair, too high = a coin flip)
//   deadly   share of hops that end in death
//   types    distinct special world types on the level, new = types not seen in any earlier level
//   timed    crumble / fade / blink worlds, plus the boss
// and combines them into DIFFICULTY (0..1). Checks on the whole sequence:
//   E1 escalation: the trend (least-squares slope) is up and the last level is clearly harder than the first
//   E2 reprieve:   at least 3 levels are easier than the level before (a breather), and no more than 3 climbs in a row
//   E3 no cliffs:  no level is more than 0.22 harder than the one before it
//   I1 interest:   each level's progress share is between 12% and 75%, deadly share under 40%
//   I2 novelty:    a level introduces a new world type (the boss counts), or is a breather; the finale may mix everything
// Exits 2 when a check fails.
import { load, levelSim, hopFrom, hopPath } from './lib/hops.mjs';
const args = process.argv.slice(2);
const slug = args.find((a) => !a.startsWith('--'));
if (!slug) { console.error('usage: npm run level-curve -- <slug> [--step 3] [--verbose]'); process.exit(1); }
const stepArg = args.indexOf('--step'); const STEP = stepArg >= 0 ? Number(args[stepArg + 1]) : 3;
const L = await load(slug);
const RUNUPS = [-330, -165, 0, 165, 330];
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));

const rows = [];
const seen = new Set();
L.LEVELS.forEach((spec, n) => {
  const s = levelSim(L, n);
  const gd = L.graphDistToHome(s.ws);
  const path = hopPath(L, s, spec.reach) ?? [0];
  let total = 0, prog = 0, dead = 0;
  for (const gi of path) {
    if (s.ws[gi].type === 'home') continue;
    for (let k = 0; k < 360; k += STEP) for (const vt of RUNUPS) {
      const r = hopFrom(L, s, gi, (k * Math.PI) / 180, vt); total++;
      if (r.end === 'dead' || r.end === 'drift') dead++;
      else if (r.end === 'home' || (r.end === 'landed' && gd[r.world] < gd[gi] - 1)) prog++;
    }
  }
  const types = new Set(s.ws.map((w) => w.type).filter((t) => t !== 'rock' && t !== 'home'));
  if (spec.boss) types.add('boss');
  const fresh = [...types].filter((t) => !seen.has(t)); types.forEach((t) => seen.add(t));
  const timed = s.ws.filter((w) => ['crumble', 'fade', 'blink'].includes(w.type)).length + (spec.boss ? 3 : 0);
  const suns = s.ws.filter((w) => w.type === 'sun').length;
  const hops = Math.max(1, path.length - 1);
  const progress = total ? prog / total : 0, deadly = total ? dead / total : 0;
  const D = 0.25 * clamp(hops / 12) + 0.2 * clamp(deadly * 3) + 0.2 * clamp(1 - progress * 1.4) + 0.15 * clamp(types.size / 6) + 0.1 * clamp(timed / 6) + 0.1 * clamp(suns / 6);
  rows.push({ n, name: spec.name, hops, progress, deadly, types: types.size, fresh, timed, suns, D, sig: [...types].sort().join(',') });
});

const fmt = (x) => x.toFixed(2);
console.log('lvl name                hops progress deadly types new      timed suns  DIFFICULTY');
rows.forEach((r, i) => {
  const delta = i ? r.D - rows[i - 1].D : 0;
  const bar = '#'.repeat(Math.round(r.D * 40));
  console.log(`${String(r.n + 1).padStart(2)}  ${r.name.padEnd(18)} ${String(r.hops).padStart(4)} ${(100 * r.progress).toFixed(0).padStart(6)}% ${(100 * r.deadly).toFixed(0).padStart(5)}% ${String(r.types).padStart(5)} ${(r.fresh.join('+') || '-').padEnd(8)} ${String(r.timed).padStart(4)} ${String(r.suns).padStart(4)}   ${fmt(r.D)} ${i ? (delta < -0.02 ? 'v' : delta > 0.02 ? '^' : '=') : ' '} ${bar}`);
});

// checks
const fails = [];
const D = rows.map((r) => r.D), m = D.length;
const xs = D.map((_, i) => i), mx = (m - 1) / 2, my = D.reduce((a, b) => a + b, 0) / m;
const slope = xs.reduce((a, x, i) => a + (x - mx) * (D[i] - my), 0) / xs.reduce((a, x) => a + (x - mx) ** 2, 0);
if (slope < 0.015) fails.push(`E1 escalation: trend slope ${slope.toFixed(3)} per level (need >= 0.015)`);
if (D[m - 1] - D[0] < 0.25) fails.push(`E1 escalation: last level only ${(D[m - 1] - D[0]).toFixed(2)} harder than the first (need >= 0.25)`);
const dips = D.filter((d, i) => i > 0 && d < D[i - 1] - 0.02).length;
if (dips < 3) fails.push(`E2 reprieve: only ${dips} breather levels (need >= 3)`);
let run = 0, maxRun = 0; D.forEach((d, i) => { if (i > 0 && d > D[i - 1] + 0.02) { run++; maxRun = Math.max(maxRun, run); } else run = 0; });
if (maxRun > 3) fails.push(`E2 reprieve: ${maxRun} climbs in a row (limit 3)`);
D.forEach((d, i) => { if (i > 0 && d - D[i - 1] > 0.22) fails.push(`E3 cliff: level ${i + 1} is ${(d - D[i - 1]).toFixed(2)} harder than level ${i}`); });
rows.forEach((r, i) => {
  if (r.progress < 0.12) fails.push(`I1 level ${r.n + 1} ${r.name}: only ${(100 * r.progress).toFixed(0)}% of hops make progress (dull or unfair)`);
  if (r.progress > 0.75 && i > 0) fails.push(`I1 level ${r.n + 1} ${r.name}: ${(100 * r.progress).toFixed(0)}% of hops make progress (a coin flip)`);
  if (r.deadly > 0.4) fails.push(`I1 level ${r.n + 1} ${r.name}: ${(100 * r.deadly).toFixed(0)}% of hops are deadly`);
  if (i > 0 && i < m - 1 && r.sig === rows[i - 1].sig && r.D >= D[i - 1] - 0.02 && !r.fresh.length) fails.push(`I2 novelty: level ${r.n + 1} repeats the previous level's ingredients without easing`);
});
console.log(`\nslope ${slope.toFixed(3)}/level, first ${fmt(D[0])} -> last ${fmt(D[m - 1])}, breathers ${dips}, longest climb ${maxRun}`);
if (fails.length) { console.log('\nFAIL'); fails.forEach((f) => console.log(' - ' + f)); process.exit(2); }
console.log('OK: escalates overall, with reprieves, no cliffs, every level interesting.');
