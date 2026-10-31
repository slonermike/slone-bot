#!/usr/bin/env node
// Jump audit for a gravity-hop prototype. For every level, from the spawn, try a single hop from every position on the
// start world (launch angle, 1 degree steps) and every run-up speed (which tilts the launch velocity away from the surface
// normal), and classify where each hop ends. Reports, per level:
//   HOME      hops that land on the goal (and how many distinct launch directions / windows, widest window in degrees)
//   WHIP      hops that land on the goal after their velocity has turned at least --whip degrees (the satisfying ones)
//   NEARER    hops that land on another world closer to the goal (graph distance) than the start world: interesting play
//   DEAD      hops that end in death
// Policy: most levels should not be finishable with one hop, and any that are must need careful precision.
//   npm run jump-audit -- <slug> [--level N] [--step 1] [--max-window 6] [--max-solvable 4] [--whip 150] [--steer]
// Exits 2 when a level's goal window is wider than --max-window degrees or too many levels are one-hop solvable.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const slug = args.find((a) => !a.startsWith('--'));
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? Number(args[i + 1]) : d; };
if (!slug) { console.error('usage: npm run jump-audit -- <slug> [--level N] [--step 1] [--max-window 6] [--max-solvable 4] [--whip 150] [--steer]'); process.exit(1); }
const { Sim, LEVELS, graphDistToHome } = await import(path.join(ROOT, 'src/protos', slug, 'sim.ts'));
const { blankInput, Rng } = await import(path.join(ROOT, 'src/core/index.ts'));

const STEP = opt('step', 1), MAXW = opt('max-window', 6), MAXS = opt('max-solvable', 4), WHIP = opt('whip', 150);
const only = args.includes('--level') ? opt('level', 0) : null;
const STEER = args.includes('--steer');
const DT = 1 / 60;
const RUNUPS = [-330, -220, -110, 0, 110, 220, 330];
const inp = (sx, sy, down) => { const i = blankInput(); i.left.x = sx; i.left.y = sy; i.buttons.a.down = down; return i; };

/** one hop from angle th with run-up vt. Returns { end, turn, world } */
function hop(s0, th, vt, steer) {
  const c = s0.clone();
  const w = c.ws[c.gi];
  c.ang = th; c.vt = vt; c.grounded = true;
  c.x = w.x + Math.cos(th) * (w.r + 12); c.y = w.y + Math.sin(th) * (w.r + 12);
  c.jump(-Math.sin(th), Math.cos(th));
  const home = c.ws.find((q) => q.type === 'home');
  let heading = Math.atan2(c.vy, c.vx), turn = 0;
  for (let t = 0; t < 900; t++) {
    let sx = 0, sy = 0;
    if (steer) { const dx = home.x - c.x, dy = home.y - c.y, d = Math.hypot(dx, dy) || 1; sx = dx / d; sy = dy / d; }
    c.step(DT, inp(sx, sy, true));
    const h = Math.atan2(c.vy, c.vx); let d = h - heading; d = Math.atan2(Math.sin(d), Math.cos(d)); turn += Math.abs(d); heading = h;
    if (c.clearT > 0) return { end: 'home', turn: (turn * 180) / Math.PI, world: c.gi };
    if (c.deadT > 0) return { end: 'dead', turn: (turn * 180) / Math.PI, world: -1 };
    if (c.grounded) return { end: 'landed', turn: (turn * 180) / Math.PI, world: c.gi };
  }
  return { end: 'drift', turn: (turn * 180) / Math.PI, world: -1 };
}

const windows = (arr) => {
  const N = arr.length; const count = arr.filter(Boolean).length;
  if (count === N) return { count, windows: 1, widest: N * STEP };
  const start = arr.indexOf(false); let windows = 0, widest = 0, run = 0;
  for (let i = 1; i <= N; i++) { const v = arr[(start + i) % N]; if (v) run++; else { if (run) { windows++; widest = Math.max(widest, run); } run = 0; } }
  if (run) { windows++; widest = Math.max(widest, run); }
  return { count, windows, widest: widest * STEP };
};

let solvable = 0, tooEasy = 0;
const head = 'lvl name                worlds  dist | HOME dirs (widest window)  | WHIP  | NEARER  | DEAD | best end distance';
console.log(`Single-hop audit (${STEP} degree launch steps x ${RUNUPS.length} run-up speeds${STEER ? ', air steering toward the goal' : ', no air steering'}; whip = velocity turned >= ${WHIP} degrees)\n${head}`);
LEVELS.forEach((spec, n) => {
  if (only !== null && n !== only) return;
  const s = new Sim();
  s.init({ rng: new Rng(1), balance: {}, params: { level: n }, seed: 1, vfxRng: new Rng(2), time: { steps: 0, seconds: 0 }, dt: DT });
  const gd = graphDistToHome(s.ws), here = gd[s.gi];
  const homeW = s.ws.find((q) => q.type === 'home'), startW = s.ws[0];
  const dist = Math.round(Math.hypot(homeW.x - startW.x, homeW.y - startW.y));
  const N = Math.round(360 / STEP);
  const homeDir = new Array(N).fill(false);
  let total = 0, homeHops = 0, whips = 0, nearer = 0, dead = 0, best = 1e9;
  const whipDirs = new Set();
  for (let k = 0; k < N; k++) {
    const th = (k / N) * Math.PI * 2;
    for (const vt of RUNUPS) {
      const r = hop(s, th, vt, STEER);
      total++;
      if (r.end === 'home') { homeHops++; homeDir[k] = true; best = 0; if (r.turn >= WHIP) { whips++; whipDirs.add(k); } }
      else if (r.end === 'dead' || r.end === 'drift') dead++;
      else if (r.end === 'landed') { const g = gd[r.world]; if (g < here - 1) nearer++; best = Math.min(best, g); }
    }
  }
  const w = windows(homeDir);
  const solv = homeHops > 0;
  if (solv) solvable++;
  const easy = w.widest > MAXW;
  if (easy) tooEasy++;
  const pct = (x) => `${((100 * x) / total).toFixed(1)}%`.padStart(6);
  const homeTxt = solv ? `${String(w.count * STEP).padStart(4)} deg in ${String(w.windows).padStart(2)} win (${String(w.widest).padStart(3)})` : '   none';
  console.log(`${String(n + 1).padStart(2)}  ${spec.name.padEnd(18)} ${String(s.ws.length).padStart(5)} ${String(dist).padStart(6)} | ${homeTxt.padEnd(26)} | ${String(whips).padStart(4)} | ${pct(nearer)}  | ${pct(dead)} | ${best === 0 ? 'goal' : Math.round(best)}${easy ? `   <-- TOO EASY: window ${w.widest} > ${MAXW}` : ''}${!solv && nearer / total < 0.02 ? '   <-- dull: almost no hop makes progress' : ''}`);
});
const totalLevels = only !== null ? 1 : LEVELS.length;
console.log(`\n${solvable} of ${totalLevels} levels can be finished in one hop (limit ${MAXS}); ${tooEasy} have a goal window wider than ${MAXW} degrees.`);
if (only === null && (tooEasy > 0 || solvable > MAXS)) { console.log('FAIL: move home farther, add hazards, or widen the sea.'); process.exit(2); }
console.log('OK');
