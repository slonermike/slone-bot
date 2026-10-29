import { ColorMatrixFilter } from 'pixi.js';
import type { Container } from 'pixi.js';
import { dial } from './dial.ts';
import { ease } from './ease.ts';
import { tween } from './tween.ts';

interface FlashState {
  filter: ColorMatrixFilter;
  amount: { v: number };
  r: number;
  g: number;
  b: number;
}
const states = new WeakMap<Container, FlashState>();

function apply(s: FlashState): void {
  const t = s.amount.v;
  // blend each channel toward the flash color: c' = c*(1-t) + color*t
  s.filter.matrix = [
    1 - t, 0, 0, 0, s.r * t,
    0, 1 - t, 0, 0, s.g * t,
    0, 0, 1 - t, 0, s.b * t,
    0, 0, 0, 1, 0,
  ];
}

/**
 * Flash a display object toward a color (white by default) and fade back.
 * Uses one small color filter per object; use it on the few things that matter.
 */
export function flash(obj: Container, color = 0xffffff, ms = 110, strength = 1): void {
  const k = Math.min(1, dial.scale('flash', strength));
  if (k <= 0) return;
  let s = states.get(obj);
  if (!s) {
    s = { filter: new ColorMatrixFilter(), amount: { v: 0 }, r: 1, g: 1, b: 1 };
    states.set(obj, s);
  }
  s.r = ((color >> 16) & 255) / 255;
  s.g = ((color >> 8) & 255) / 255;
  s.b = (color & 255) / 255;
  const filters = (obj.filters ? [].concat(obj.filters as never) : []) as unknown[];
  if (!filters.includes(s.filter)) obj.filters = [...filters, s.filter] as never;
  s.amount.v = k;
  apply(s);
  const state = s;
  tween(state.amount, { v: 0 }, ms, ease.outQuad, {
    onComplete: () => {
      const rest = ((obj.filters ? [].concat(obj.filters as never) : []) as unknown[]).filter((f) => f !== state.filter);
      obj.filters = (rest.length ? rest : null) as never;
    },
  });
  // keep the matrix in sync while fading
  const sync = () => {
    if (state.amount.v > 0.001) {
      apply(state);
      requestAnimationFrame(sync);
    }
  };
  requestAnimationFrame(sync);
}
