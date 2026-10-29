import type { Bot, BotInput, Observation } from '../../core/types.ts';

interface Obs extends Observation {
  x: number;
  y: number;
  charge: number;
  stuck: { x: number; y: number; grip: number }[];
  gates: { x: number; cy: number; gap: number; active: boolean }[];
  ready: boolean;
  surging: boolean;
  choosing: boolean;
  sel: number;
  offerGaps: number[];
}

const clamp = (v: number) => Math.max(-1, Math.min(1, v));

/** Competent policy: fly to the nearest wedged blob, hover within reach and hold A until the cork pops; spend a full flush; pick the wider layout. */
export function greedyBot(): Bot {
  let tog = false;
  return {
    name: 'greedy',
    reset() { tog = false; },
    act(obs): BotInput {
      const o = obs as Obs;
      tog = !tog;
      if (o.choosing) {
        const want = o.offerGaps[0]! >= o.offerGaps[1]! ? 0 : 1;
        return { left: { x: want === 0 ? -1 : 1, y: 0 }, hold: o.sel === want && tog ? ['a'] : [] };
      }
      if (o.surging) return { left: { x: 1, y: (400 - o.y) / 200 } };
      if (o.ready && tog) return { hold: ['y'] };
      let target: { x: number; y: number } | null = null;
      let td = Infinity;
      for (const s of o.stuck) {
        const d = Math.hypot(s.x - o.x, s.y - o.y);
        if (d < td) { td = d; target = s; }
      }
      if (!target) {
        // idle patrol between the active gates
        const gs = o.gates.filter((g) => g.active);
        const mx = gs.reduce((a, g) => a + g.x, 0) / Math.max(1, gs.length);
        return { left: { x: clamp((mx - 120 - o.x) / 100), y: clamp((400 - o.y) / 100) } };
      }
      // close in until well inside lock range, then hold A (the sim locks on and fills the ring)
      const near = td < 150;
      return { left: near ? { x: 0, y: 0 } : { x: clamp((target.x - o.x) / 60), y: clamp((target.y - o.y) / 60) }, hold: td < 200 ? ['a'] : [] };
    },
  };
}

/** Degenerate probe: park left of the first gate and hold A forever. Should NOT keep up with the greedy bot once a second gate appears. */
export function degenerateHolderBot(): Bot {
  return {
    name: 'degenerate-holder',
    reset() {},
    act(obs): BotInput {
      const o = obs as Obs;
      if (o.choosing) return { hold: o.sel === 0 ? ['a'] : [] };
      const g = o.gates[0]!;
      return { left: { x: clamp((g.x - 110 - o.x) / 60), y: clamp((g.cy - o.y) / 60) }, hold: ['a'] };
    },
  };
}
