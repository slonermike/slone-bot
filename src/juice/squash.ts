import { dial } from './dial.ts';
import { ease } from './ease.ts';
import { tween } from './tween.ts';

interface Scalable {
  scale: { x: number; y: number; set(x: number, y?: number): void };
  position: { x: number; y: number; set(x: number, y?: number): void };
  rotation: number;
}

/**
 * Velocity stretch plus impact squash with a wobble spring.
 * Volume-preserving: stretching one axis thins the other.
 *   const ss = new SquashStretch(body);
 *   ss.update(dtSeconds, vx, vy);   // every render frame
 *   ss.pop(0.4, 'y');               // on impact, 'y' = hit along vertical axis
 */
export class SquashStretch {
  /** Fraction of stretch at `refSpeed`. */
  stretch = 0.25;
  refSpeed = 700;
  stiffness = 260;
  damping = 14;
  private p = 0; // spring displacement
  private v = 0; // spring velocity
  private axis: 'x' | 'y' = 'y';
  private bx: number;
  private by: number;

  readonly target: Scalable;

  constructor(target: Scalable) {
    this.target = target;
    this.bx = target.scale.x;
    this.by = target.scale.y;
  }

  /** Squash on impact. `amount` ~0.1 (tap) to ~0.6 (slam); `axis` is the axis hit (squashed along it). */
  pop(amount: number, axis: 'x' | 'y' = 'y'): void {
    const a = dial.scale('squashStretch', amount);
    if (a <= 0) return;
    this.axis = axis;
    this.p = -Math.min(0.7, a);
    this.v = 0;
  }

  update(dtSeconds: number, vx = 0, vy = 0): void {
    if (!dial.enabled('squashStretch')) {
      this.target.scale.set(this.bx, this.by);
      return;
    }
    const dt = Math.min(dtSeconds, 1 / 30);
    this.v += (-this.stiffness * this.p - this.damping * this.v) * dt;
    this.p += this.v * dt;
    const s = Math.max(-0.5, Math.min(1, ((Math.abs(vx) - Math.abs(vy)) / this.refSpeed) * this.stretch * dial.intensity));
    let sx = 1 + s;
    let sy = 1 - s * 0.8;
    // spring squashes along the hit axis and bulges across it
    if (this.axis === 'y') { sy += this.p; sx -= this.p * 0.8; } else { sx += this.p; sy -= this.p * 0.8; }
    this.target.scale.set(this.bx * Math.max(0.3, sx), this.by * Math.max(0.3, sy));
  }
}

const baseScale = new WeakMap<object, { x: number; y: number }>();

/** Quick uniform scale impulse that springs back: `punch(sprite, 0.3)`. */
export function punch(obj: Scalable, amount = 0.3, ms = 320): void {
  const a = dial.scale('squashStretch', amount);
  if (a <= 0) return;
  let base = baseScale.get(obj);
  if (!base) {
    base = { x: obj.scale.x, y: obj.scale.y };
    baseScale.set(obj, base);
  }
  obj.scale.set(base.x * (1 + a), base.y * (1 + a));
  tween(obj, { 'scale.x': base.x, 'scale.y': base.y }, ms, ease.outElastic);
}

/** Position impulse that springs back: `punchPosition(sprite, 8, 0)`. */
export function punchPosition(obj: Scalable, dx: number, dy: number, ms = 220): void {
  const k = dial.scale('squashStretch', 1);
  if (k <= 0) return;
  const bx = obj.position.x;
  const by = obj.position.y;
  obj.position.set(bx + dx * k, by + dy * k);
  tween(obj, { 'position.x': bx, 'position.y': by }, ms, ease.outElastic);
}
