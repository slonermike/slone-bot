import { ease as easeLib, lerpColor } from './ease.ts';
import type { EaseFn } from './ease.ts';
import { vfx } from './random.ts';

export interface TweenOptions {
  /** Delay before starting, ms. */
  delay?: number;
  /** Extra random delay in [0, jitter] ms, so groups don't move in lockstep. */
  jitter?: number;
  onComplete?: () => void;
  /** Tween target keys that hold 0xRRGGBB colors (e.g. 'tint') get color interpolation automatically. */
}

interface Track {
  obj: Record<string, unknown>;
  key: string;
  from: number;
  to: number;
  color: boolean;
}

interface Active {
  tracks: Track[];
  elapsed: number;
  delay: number;
  ms: number;
  ease: EaseFn;
  onComplete?: () => void;
  dead: boolean;
  owner: object;
}

function resolve(obj: object, path: string): { holder: Record<string, unknown>; key: string } {
  const parts = path.split('.');
  let holder = obj as Record<string, unknown>;
  for (let i = 0; i < parts.length - 1; i++) holder = holder[parts[i]!] as Record<string, unknown>;
  return { holder, key: parts[parts.length - 1]! };
}

/** Tween manager. Updated by the shell once per rendered frame in REAL time (juice is not sim). */
export class Tweens {
  private list: Active[] = [];

  /**
   * Tween numeric properties. Keys may be paths ('scale.x'); `scale` on a Pixi object
   * is shorthand for both axes; 'tint'/'color' keys interpolate as colors.
   */
  to(obj: object, props: Record<string, number>, ms: number, easing: EaseFn = easeLib.outCubic, opts: TweenOptions = {}): void {
    const tracks: Track[] = [];
    for (const [path, to] of Object.entries(props)) {
      const paths = path === 'scale' && typeof (obj as { scale?: unknown }).scale === 'object' ? ['scale.x', 'scale.y'] : [path];
      for (const p of paths) {
        const { holder, key } = resolve(obj, p);
        tracks.push({ obj: holder, key, from: holder[key] as number, to, color: key === 'tint' || key === 'color' });
      }
    }
    // A new tween on the same keys replaces the old one so effects don't fight.
    for (const a of this.list) {
      a.tracks = a.tracks.filter((t) => !tracks.some((n) => n.obj === t.obj && n.key === t.key));
    }
    this.list.push({
      tracks,
      elapsed: 0,
      delay: (opts.delay ?? 0) + (opts.jitter ? vfx() * opts.jitter : 0),
      ms: Math.max(1, ms),
      ease: easing,
      onComplete: opts.onComplete,
      dead: false,
      owner: obj,
    });
  }

  update(dtMs: number): void {
    for (const a of this.list) {
      if (a.dead) continue;
      a.elapsed += dtMs;
      const local = a.elapsed - a.delay;
      if (local < 0) continue;
      const t = Math.min(1, local / a.ms);
      const k = a.ease(t);
      for (const tr of a.tracks) {
        tr.obj[tr.key] = tr.color ? lerpColor(tr.from, tr.to, Math.min(1, Math.max(0, k))) : tr.from + (tr.to - tr.from) * k;
      }
      if (t >= 1) {
        a.dead = true;
        a.onComplete?.();
      }
    }
    if (this.list.some((a) => a.dead)) this.list = this.list.filter((a) => !a.dead);
  }

  /** Cancel tweens on one object (or all when omitted). */
  clear(obj?: object): void {
    this.list = obj ? this.list.filter((a) => a.owner !== obj) : [];
  }

  get active(): number {
    return this.list.length;
  }
}

/** Shared instance that `tween()` uses. The shell updates it each frame and clears it on restart. */
export const tweens = new Tweens();

/** `tween(sprite, { alpha: 0, 'scale.x': 2 }, 300, ease.outBack, { delay: 50, jitter: 40 })` */
export function tween(obj: object, props: Record<string, number>, ms: number, easing: EaseFn = easeLib.outCubic, opts?: TweenOptions): void {
  tweens.to(obj, props, ms, easing, opts);
}
