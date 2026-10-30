// Bots for Blot Beat. They read getState() (flat numbers) and press lane buttons like a player would.
import type { Bot, BotInput, ButtonName, Observation } from '../../core/types.ts';
import { Rng } from '../../core/rng.ts';
import { LANE_BUTTON } from './geometry.ts';

const num = (o: Observation, k: string) => Number(o[k] ?? 0);

/** Plays every note with a little human error (timing jitter, the odd miss) and stamps when ink piles up. */
function makeGreedy(opts: { jitter: number; slip: number; stampAt: number; name: string }): Bot {
  let rng = new Rng(1);
  const planned = new Map<number, { at: number }>(); // note id -> time to press
  let releaseAt = [0, 0, 0, 0];
  let prevHold = [false, false, false, false];
  return {
    name: opts.name,
    reset(seed: number) { rng = new Rng(seed ^ 0x9e3779b9); planned.clear(); releaseAt = [0, 0, 0, 0]; prevHold = [false, false, false, false]; },
    act(o: Observation, tick: number): BotInput {
      const hold: ButtonName[] = [];
      const phase = num(o, 'phase');
      if (phase === 1) { // pick
        return { hold: tick % 2 === 0 ? ['a'] : [] };
      }
      if (phase !== 0) return {};
      const t = num(o, 't');
      const want = [false, false, false, false];
      for (let i = 0; i < 6; i++) {
        const id = num(o, `n${i}id`);
        if (!id) continue;
        const lane = num(o, `n${i}l`);
        const nt = num(o, `n${i}t`);
        const len = num(o, `n${i}len`);
        if (!planned.has(id)) {
          const slip = rng.chance(opts.slip);
          planned.set(id, { at: slip ? 99999 : nt + rng.gauss() * opts.jitter });
        }
        const at = planned.get(id)!.at;
        if (t >= at && t < at + 0.05) { want[lane] = true; releaseAt[lane] = Math.max(releaseAt[lane]!, nt + len - 0.02); }
      }
      for (let l = 0; l < 4; l++) {
        const holding = num(o, `held${l}`) > 0;
        const keep = holding && t < releaseAt[l]!;
        // a held lane needs a release tick between presses; presses last two ticks
        if (want[l] && !prevHold[l]) { hold.push(LANE_BUTTON[l]!); prevHold[l] = true; }
        else if (keep || (want[l] && prevHold[l])) { hold.push(LANE_BUTTON[l]!); prevHold[l] = true; }
        else prevHold[l] = false;
      }
      if (num(o, 'ink') >= opts.stampAt && num(o, 'fever') <= 0 && tick % 2 === 0) hold.push('rb');
      return { hold };
    },
  };
}

export const bots: Bot[] = [
  makeGreedy({ name: 'greedy', jitter: 0.045, slip: 0.06, stampAt: 5 }),
  makeGreedy({ name: 'sloppy', jitter: 0.09, slip: 0.22, stampAt: 4 }),
  {
    // mashes every lane every other tick: should hit everything but drown in stray ink
    name: 'degenerate-mash',
    reset() {},
    act(o: Observation, tick: number): BotInput {
      const phase = num(o, 'phase');
      if (phase === 1) return { hold: tick % 2 === 0 ? ['a'] : [] };
      if (phase !== 0) return {};
      const hold: ButtonName[] = tick % 2 === 0 ? ['y', 'b', 'a', 'x'] : [];
      if (num(o, 'ink') >= 3 && num(o, 'fever') <= 0 && tick % 2 === 1) hold.push('rb');
      return { hold };
    },
  },
  {
    // never touches a lane but stamps whenever it can: ink farming should not be a strategy
    name: 'degenerate-stamper',
    reset() {},
    act(o: Observation, tick: number): BotInput {
      const phase = num(o, 'phase');
      if (phase === 1) return { hold: tick % 2 === 0 ? ['a'] : [] };
      if (phase !== 0) return {};
      return { hold: num(o, 'ink') >= 3 && num(o, 'fever') <= 0 && tick % 2 === 0 ? ['rb'] : [] };
    },
  },
];
