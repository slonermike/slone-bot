import { Graphics } from 'pixi.js';
import type { Container } from 'pixi.js';
import { dial } from './dial.ts';

export interface TrailOptions {
  /** Remembered positions. Default 14. */
  length?: number;
  color?: number;
  /** Width at the head, px. Default 18. */
  width?: number;
  alpha?: number;
}

/** Ribbon trail from remembered positions. Call `push()` each sim-or-render tick you want a sample, `draw()` each render. */
export class Trail {
  readonly gfx = new Graphics();
  private pts: { x: number; y: number }[] = [];
  private readonly length: number;
  color: number;
  width: number;
  alpha: number;

  constructor(parent: Container, opts: TrailOptions = {}) {
    this.length = opts.length ?? 14;
    this.color = opts.color ?? 0xffffff;
    this.width = opts.width ?? 18;
    this.alpha = opts.alpha ?? 0.5;
    parent.addChild(this.gfx);
  }

  push(x: number, y: number): void {
    this.pts.push({ x, y });
    if (this.pts.length > this.length) this.pts.shift();
  }

  clear(): void {
    this.pts.length = 0;
    this.gfx.clear();
  }

  draw(): void {
    const g = this.gfx;
    g.clear();
    if (!dial.enabled('trails') || this.pts.length < 2) return;
    const n = this.pts.length;
    for (let i = 1; i < n; i++) {
      const t = i / (n - 1);
      const a = this.pts[i - 1]!;
      const b = this.pts[i]!;
      g.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({
        width: Math.max(1, this.width * t * Math.min(1.5, dial.intensity)),
        color: this.color,
        alpha: this.alpha * t,
        cap: 'round',
      });
    }
  }
}
