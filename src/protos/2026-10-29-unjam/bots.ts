import type { Bot, BotInput, Observation } from '../../core/types.ts';

interface Obs extends Observation {
  x: number;
  y: number;
  charge: number;
  popCd: number;
  stuck: { x: number; y: number; grip: number }[];
  gates: { x: number; cy: number; gap: number; active: boolean }[];
  ready: boolean;
  surging: boolean;
  choosing: boolean;
  sel: number;
  offerGaps: number[];
}

/** Competent policy: stand left of the stuck blobs, hold the pop long enough to beat their grip, release; spend a full flush; pick the wider layout. */
export function greedyBot(): Bot {
  let phase = 0;
  let hold = 0;
  let tog = false;
  return {
    name: 'greedy',
    reset() { phase = 0; hold = 0; tog = false; },
    act(obs): BotInput {
      const o = obs as Obs;
      tog = !tog;
      if (o.choosing) {
        const want = o.offerGaps[0]! >= o.offerGaps[1]! ? 0 : 1;
        return { left: { x: want === 0 ? -1 : 1, y: 0 }, hold: o.sel === want && tog ? ['a'] : [] };
      }
      if (o.surging) {
        // plow back and forth along the pipe
        return { left: { x: 1, y: (400 - o.y) / 200 } };
      }
      if (o.ready && tog) return { hold: ['y'] };
      let target: { x: number; y: number; grip: number } | null = null;
      for (const s of o.stuck) if (!target || s.x < target.x) target = s;
      if (!target) {
        phase = 0;
        const g = o.gates.find((q) => q.active) ?? o.gates[0]!;
        return { left: { x: Math.max(-1, Math.min(1, (g.x - 150 - o.x) / 80)), y: Math.max(-1, Math.min(1, (g.cy - o.y) / 80)) } };
      }
      const px = target.x - 130;
      const dx = px - o.x;
      const dy = target.y - o.y;
      if (phase === 0) {
        if (Math.abs(dx) < 50 && Math.abs(dy) < 50) { phase = 1; hold = 0; }
        return { left: { x: Math.max(-1, Math.min(1, dx / 60)), y: Math.max(-1, Math.min(1, dy / 60)) } };
      }
      // charge long enough for the grip: 0.4 * grip needs (0.3 + 0.7c) >= grip*0.4/(1-0.5*d/R) ; hold a safe amount
      hold++;
      const need = target.grip >= 1.7 ? 36 : target.grip >= 1.2 ? 28 : 20;
      if (hold < need) return { left: { x: Math.max(-1, Math.min(1, dx / 60)), y: Math.max(-1, Math.min(1, dy / 60)) }, hold: ['a'] };
      phase = 0;
      return {};
    },
  };
}

/** Degenerate probe: park left of the first gate and hold A forever (auto-fires full pops). Should NOT keep up with the greedy bot. */
export function degenerateHolderBot(): Bot {
  return {
    name: 'degenerate-holder',
    reset() {},
    act(obs): BotInput {
      const o = obs as Obs;
      if (o.choosing) return { hold: o.sel === 0 ? ['a'] : [] };
      const g = o.gates[0]!;
      return { left: { x: Math.max(-1, Math.min(1, (g.x - 140 - o.x) / 60)), y: Math.max(-1, Math.min(1, (g.cy - o.y) / 60)) }, hold: ['a'] };
    },
  };
}
