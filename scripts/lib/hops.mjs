// Shared helpers for level audits of the gravity-hop prototype: build a level's sim, run a single hop, find the shortest hop path.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export async function load(slug) {
  const sim = await import(path.join(ROOT, 'src/protos', slug, 'sim.ts'));
  const core = await import(path.join(ROOT, 'src/core/index.ts'));
  return { ...sim, blankInput: core.blankInput, Rng: core.Rng };
}
export const DT = 1 / 60;
export function levelSim(L, n) {
  const s = new L.Sim();
  s.init({ rng: new L.Rng(1), balance: {}, params: { level: n }, seed: 1, vfxRng: new L.Rng(2), time: { steps: 0, seconds: 0 }, dt: DT });
  return s;
}
/** One hop from world `gi` at angle th with run-up vt. Returns { end: 'home'|'dead'|'landed'|'drift', turn (degrees), world }. */
export function hopFrom(L, s0, gi, th, vt, steer = false) {
  const c = s0.clone();
  const w = c.ws[gi];
  c.gi = gi; c.ang = th; c.vt = vt; c.grounded = true;
  c.x = w.x + Math.cos(th) * (w.r + 12); c.y = w.y + Math.sin(th) * (w.r + 12);
  c.jump(-Math.sin(th), Math.cos(th));
  const home = c.ws.find((q) => q.type === 'home');
  let heading = Math.atan2(c.vy, c.vx), turn = 0;
  const inp = L.blankInput();
  inp.buttons.a.down = true;
  for (let t = 0; t < 900; t++) {
    if (steer) { const dx = home.x - c.x, dy = home.y - c.y, d = Math.hypot(dx, dy) || 1; inp.left.x = dx / d; inp.left.y = dy / d; }
    c.step(DT, inp);
    const h = Math.atan2(c.vy, c.vx); let d = h - heading; d = Math.atan2(Math.sin(d), Math.cos(d)); turn += Math.abs(d); heading = h;
    if (c.clearT > 0) return { end: 'home', turn: (turn * 180) / Math.PI, world: c.gi };
    if (c.deadT > 0) return { end: 'dead', turn: (turn * 180) / Math.PI, world: -1 };
    if (c.grounded) return { end: 'landed', turn: (turn * 180) / Math.PI, world: c.gi };
  }
  return { end: 'drift', turn: (turn * 180) / Math.PI, world: -1 };
}
/** Shortest path (fewest hops) from the start to home over safe worlds a hop can reach; returns world indices or null. */
export function hopPath(L, s, k = 1) {
  const ws = s.ws, prev = new Array(ws.length).fill(-2); prev[0] = -1; const q = [0];
  const safe = (t) => t !== 'sun' && t !== 'repel';
  while (q.length) {
    const i = q.shift();
    if (ws[i].type === 'home') { const p = []; for (let k = i; k >= 0; k = prev[k]) p.unshift(k); return p; }
    ws.forEach((w, j) => { if (prev[j] === -2 && safe(w.type) && L.canHop(ws[i], w, k)) { prev[j] = i; q.push(j); } });
  }
  return null;
}
