import { Text } from 'pixi.js';
import type { Container } from 'pixi.js';
import { ease } from './ease.ts';
import { tween } from './tween.ts';

export interface NumberPopOptions {
  color?: number;
  /** Font size px. Default 36. */
  size?: number;
  /** Rise distance px. Default 70. */
  rise?: number;
  ms?: number;
}

/** Floating score/damage text with ease and fade: `numberPop(view.world, '+1', x, y)`. */
export function numberPop(parent: Container, text: string | number, x: number, y: number, opts: NumberPopOptions = {}): Text {
  const t = new Text({
    text: String(text),
    style: {
      fontFamily: 'system-ui, sans-serif',
      fontWeight: '800',
      fontSize: opts.size ?? 36,
      fill: opts.color ?? 0xffffff,
      stroke: { color: 0x101020, width: 5 },
    },
  });
  t.anchor.set(0.5);
  t.position.set(x, y);
  t.scale.set(0.4);
  parent.addChild(t);
  const ms = opts.ms ?? 750;
  tween(t, { 'scale.x': 1, 'scale.y': 1 }, ms * 0.3, ease.outBack);
  tween(t, { y: y - (opts.rise ?? 70) }, ms, ease.outCubic);
  tween(t, { alpha: 0 }, ms * 0.4, ease.linear, { delay: ms * 0.6, onComplete: () => t.destroy() });
  return t;
}
