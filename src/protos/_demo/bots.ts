import { num, steerToward } from '../../bots/builtin.ts';
import type { Bot, BotInput, Observation } from '../../core/types.ts';

interface DemoObs extends Observation {
  x: number;
  y: number;
  vx: number;
  vy: number;
  dashCd: number;
  pickups: { x: number; y: number }[];
}

/** Competent policy: chase the nearest pickup, dash when it is far and the dash is ready. */
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
      if (!best) return {};
      const left = steerToward(o.x, o.y, best.x, best.y);
      const wantDash = bd > 260 && o.dashCd === 0 && !lastDash && Math.hypot(num(obs, 'vx'), num(obs, 'vy')) < 600;
      lastDash = wantDash;
      return { left, hold: wantDash ? ['a'] : [] };
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
