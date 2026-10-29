import { Rng } from '../core/rng.ts';
import { BUTTONS } from '../core/types.ts';
import type { Bot, BotInput, ButtonName, Observation } from '../core/types.ts';

/** No input. Proves pressure actually pushes: a build where nothing happens when idle fails. */
export function idleBot(): Bot {
  return { name: 'idle', reset() {}, act: () => ({}) };
}

/**
 * Random valid inputs: stick direction changes every ~0.25 to 1 s, face buttons mash randomly.
 * Finds crashes, softlocks, NaNs, out-of-bounds. start/select are never pressed (reserved).
 */
export function randomBot(opts: { buttons?: ButtonName[] } = {}): Bot {
  const usable = opts.buttons ?? BUTTONS.filter((b) => b !== 'start' && b !== 'select');
  let rng = new Rng(1);
  let hold = 0;
  let left = { x: 0, y: 0 };
  let right = { x: 0, y: 0 };
  let pressed: ButtonName[] = [];
  return {
    name: 'random',
    reset(seed) {
      rng = new Rng(seed ^ 0x9e3779b9);
      hold = 0;
    },
    act(): BotInput {
      if (hold <= 0) {
        hold = rng.int(15, 60);
        const a = rng.range(0, Math.PI * 2);
        const m = rng.chance(0.2) ? 0 : rng.range(0.4, 1);
        left = { x: Math.cos(a) * m, y: Math.sin(a) * m };
        const a2 = rng.range(0, Math.PI * 2);
        right = { x: Math.cos(a2) * rng.range(0, 1), y: Math.sin(a2) * rng.range(0, 1) };
        pressed = usable.filter(() => rng.chance(0.12));
      }
      hold--;
      // re-roll button holds a bit faster than the stick so presses produce edges
      if (hold % 8 === 0) pressed = usable.filter(() => rng.chance(0.15));
      return { left, right, hold: pressed };
    },
  };
}

/** Helper for authors: steer toward a point; returns a unit-ish left-stick vector. */
export function steerToward(fromX: number, fromY: number, toX: number, toY: number, deadRadius = 4): { x: number; y: number } {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const d = Math.hypot(dx, dy);
  if (d <= deadRadius) return { x: 0, y: 0 };
  return { x: dx / d, y: dy / d };
}

export function num(obs: Observation, key: string, fallback = 0): number {
  const v = obs[key];
  return typeof v === 'number' ? v : fallback;
}
