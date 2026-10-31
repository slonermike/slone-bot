import { blankInput } from '../../core/index.ts';
import type { Bot, InputState } from '../../core/types.ts';
import { live } from './live.ts';
import { PR, type Sim } from './sim.ts';

const DT = 1 / 60;
function inp(sx: number, sy: number, down: boolean, pressed: boolean): InputState {
  const i = blankInput();
  i.left.x = sx; i.left.y = sy; i.buttons.a.down = down; i.buttons.a.pressed = pressed;
  return i;
}
const goalOf = (s: Sim) => s.ws.find((w) => w.type === 'home')!;

/** Try a hop from every angle round the current world, steering toward the goal in the air; return the best angle. */
function plan(s: Sim): number {
  const goal = goalOf(s);
  let best = s.ang, bestScore = -1e12;
  const N = 48;
  for (let k = 0; k < N; k++) {
    const th = (k / N) * Math.PI * 2;
    const c = s.clone();
    c.ang = th; c.vt = 0; c.grounded = true;
    const w = c.ws[c.gi];
    c.x = w.x + Math.cos(th) * (w.r + PR); c.y = w.y + Math.sin(th) * (w.r + PR);
    c.step(DT, inp(0, 0, true, true));
    let score = -1e9, fin = false;
    for (let t = 0; t < 300 && !fin; t++) {
      if (c.deadT > 0) { score = -1e9 + t; fin = true; break; }
      if (c.grounded && t > 3) {
        const lw = c.ws[c.gi];
        score = lw.type === 'home' ? 1e6 : -Math.hypot(goal.x - lw.x, goal.y - lw.y) - (lw.type === 'crumble' ? 40 : 0) - (lw.type === 'fade' || lw.type === 'blink' ? 20 : 0);
        if (c.gi === s.gi) score -= 400;
        fin = true; break;
      }
      const dx = goal.x - c.x, dy = goal.y - c.y, d = Math.hypot(dx, dy) || 1;
      c.step(DT, inp(dx / d, dy / d, true, false));
      if (t === 299) score = -Math.hypot(goal.x - c.x, goal.y - c.y) - 600;
    }
    if (score > bestScore) { bestScore = score; best = th; }
  }
  return best;
}

let target: number | null = null;
let airTick = 0;
export const bots: Bot[] = [
  {
    name: 'greedy',
    reset() { target = null; airTick = 0; },
    act(_o, tick) {
      const s = live.sim;
      if (!s || s.deadT > 0 || s.clearT > 0) { target = null; return {}; }
      const goal = goalOf(s);
      if (s.grounded) {
        airTick = 0;
        if (target === null) target = plan(s);
        let d = target - s.ang; d = Math.atan2(Math.sin(d), Math.cos(d));
        if (Math.abs(d) < 0.05 && Math.abs(s.vt) < 20) { return { hold: tick % 2 === 0 ? ['a'] : [] }; }
        if (Math.abs(d) < 0.05) return { left: { x: 0, y: 0 } };
        const dir = Math.sign(d);
        return { left: { x: -Math.sin(s.ang) * dir, y: Math.cos(s.ang) * dir } };
      }
      target = null; airTick++;
      const dx = goal.x - s.x, dy = goal.y - s.y, dd = Math.hypot(dx, dy) || 1;
      return { left: { x: dx / dd, y: dy / dd }, hold: ['a'] };
    },
  },
  { name: 'degenerate-spin', reset() {}, act: (_o, tick) => ({ left: { x: 1, y: 0 }, hold: tick % 80 === 0 ? ['a'] : [] }) },
];
