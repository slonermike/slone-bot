import { Container, Graphics } from 'pixi.js';
import { dial } from './dial.ts';
import { vfxRange } from './random.ts';

export type Mood = 'neutral' | 'happy' | 'worried' | 'frown';

export interface EyesOptions {
  /** Eye radius, px. Default 9. */
  size?: number;
  /** Distance between eye centers. Default 2.6 * size. */
  gap?: number;
  color?: number;
  pupil?: number;
  /** Draw a small mouth under the eyes (smile/frown). Default true. */
  mouth?: boolean;
}

/**
 * Googly eyes for any entity: blink on a timer, look toward a target, smile on success,
 * frown on a near miss. Add `eyes.container` to your entity container and call `update()` per render frame.
 */
export class Eyes {
  readonly container = new Container();
  private readonly size: number;
  private readonly gap: number;
  private readonly gfx = new Graphics();
  private look = { x: 0, y: 0 };
  private blinkT = 0;
  private nextBlink = vfxRange(1.5, 4);
  private mood: Mood = 'neutral';
  private moodT = 0;
  private dirty = true;
  private readonly opts: Required<EyesOptions>;

  constructor(opts: EyesOptions = {}) {
    this.size = opts.size ?? 9;
    this.gap = opts.gap ?? this.size * 2.6;
    this.opts = { size: this.size, gap: this.gap, color: opts.color ?? 0xffffff, pupil: opts.pupil ?? 0x1b1b2f, mouth: opts.mouth ?? true };
    this.container.addChild(this.gfx);
  }

  /** Look in a direction (any vector; normalized internally, max pupil offset is automatic). */
  lookAt(dx: number, dy: number): void {
    const m = Math.hypot(dx, dy);
    const nx = m > 1e-6 ? dx / m : 0;
    const ny = m > 1e-6 ? dy / m : 0;
    const k = Math.min(1, m / 120);
    if (Math.abs(nx * k - this.look.x) > 0.02 || Math.abs(ny * k - this.look.y) > 0.02) this.dirty = true;
    this.look.x = nx * k;
    this.look.y = ny * k;
  }

  blink(): void {
    this.blinkT = 0.12;
    this.dirty = true;
  }

  /** Hold a mood for `seconds`, then return to neutral. */
  setMood(mood: Mood, seconds = 1): void {
    this.mood = mood;
    this.moodT = seconds;
    this.dirty = true;
  }

  update(dtSeconds: number): void {
    if (!dial.enabled('eyes')) {
      this.container.visible = false;
      return;
    }
    this.container.visible = true;
    this.nextBlink -= dtSeconds;
    if (this.nextBlink <= 0) {
      this.blink();
      this.nextBlink = vfxRange(1.5, 4.5);
    }
    if (this.blinkT > 0) {
      this.blinkT -= dtSeconds;
      if (this.blinkT <= 0) this.dirty = true;
    }
    if (this.moodT > 0) {
      this.moodT -= dtSeconds;
      if (this.moodT <= 0) {
        this.mood = 'neutral';
        this.dirty = true;
      }
    }
    if (this.dirty) {
      this.redraw();
      this.dirty = false;
    }
  }

  private redraw(): void {
    const g = this.gfx;
    const { size, gap } = this;
    g.clear();
    const lid = this.blinkT > 0 ? 0.15 : this.mood === 'happy' ? 0.7 : 1;
    for (const sx of [-1, 1]) {
      const cx = (sx * gap) / 2;
      g.ellipse(cx, 0, size, size * lid).fill(this.opts.color);
      if (lid > 0.4) {
        g.circle(cx + this.look.x * size * 0.4, this.look.y * size * 0.4, size * 0.45).fill(this.opts.pupil);
      }
      if (this.mood === 'worried' || this.mood === 'frown') {
        const dir = this.mood === 'worried' ? -sx : sx;
        g.moveTo(cx - size, -size * 1.4 + dir * size * 0.3).lineTo(cx + size, -size * 1.4 - dir * size * 0.3).stroke({ width: 2.5, color: this.opts.pupil, cap: 'round' });
      }
    }
    if (this.opts.mouth) {
      const my = size * 2;
      const w = size * 1.1;
      if (this.mood === 'happy') {
        g.moveTo(-w, my - 2).quadraticCurveTo(0, my + size * 0.9, w, my - 2).stroke({ width: 2.5, color: this.opts.pupil, cap: 'round' });
      } else if (this.mood === 'frown' || this.mood === 'worried') {
        g.moveTo(-w, my + 2).quadraticCurveTo(0, my - size * 0.6, w, my + 2).stroke({ width: 2.5, color: this.opts.pupil, cap: 'round' });
      } else {
        g.moveTo(-w * 0.6, my).lineTo(w * 0.6, my).stroke({ width: 2.5, color: this.opts.pupil, cap: 'round' });
      }
    }
  }
}
