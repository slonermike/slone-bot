import { num } from '../../bots/builtin.ts';
import type { Bot, BotInput, Observation } from '../../core/types.ts';

interface DemoObs extends Observation {
  x: number;
  y: number;
  vx: number;
  vy: number;
  dashCd: number;
  pickups: { x: number; y: number }[];
  hazards: { x: number; y: number; active: boolean }[];
}

/** Competent policy: chase the nearest pickup, steer around live drifters, dash when the pickup is far. */
export function greedyBot(): Bot {
  let lastDash = false;
  return {
    name: 'greedy',
    reset() { lastDash = false; },
    act(obs): BotInput {
      const o = obs as DemoObs;
      let best: { x: number; y: number } | null = null;
      let bd = Infinity;
      for (const p of o.pickups) {
        const d = Math.hypot(p.x - o.x, p.y - o.y);
        if (d < bd) { bd = d; best = p; }
      }
      let dx = 0;
      let dy = 0;
      if (best) {
        dx = (best.x - o.x) / Math.max(bd, 1);
        dy = (best.y - o.y) / Math.max(bd, 1);
      }
      for (const h of o.hazards) {
        if (!h.active) continue;
        const d = Math.hypot(o.x - h.x, o.y - h.y);
        if (d < 170) {
          const k = ((170 - d) / 170) * 2.2;
          dx += ((o.x - h.x) / Math.max(d, 1)) * k;
          dy += ((o.y - h.y) / Math.max(d, 1)) * k;
        }
      }
      const m = Math.hypot(dx, dy);
      if (m > 1) { dx /= m; dy /= m; }
      const wantDash = !!best && bd > 260 && o.dashCd === 0 && !lastDash && Math.hypot(num(obs, 'vx'), num(obs, 'vy')) < 600;
      lastDash = wantDash;
      return { left: { x: dx, y: dy }, hold: wantDash ? ['a'] : [] };
    },
  };
}

/** Degenerate-strategy probe: park in a corner and spam dash. Should NOT keep up with the greedy bot. */
export function degenerateCornerBot(): Bot {
  let tick = 0;
  return {
    name: 'degenerate-corner',
    reset() { tick = 0; },
    act(): BotInput {
      tick++;
      return { left: { x: -1, y: -1 }, hold: tick % 2 === 0 ? ['a'] : [] };
    },
  };
}
