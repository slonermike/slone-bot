export type EaseFn = (t: number) => number;

const c1 = 1.70158;
const c3 = c1 + 1;
const c4 = (2 * Math.PI) / 3;

/** Easing curves. All map 0..1 to 0..1 (overshoot curves leave that range in between). */
export const ease = {
  linear: ((t) => t) as EaseFn,
  inQuad: ((t) => t * t) as EaseFn,
  outQuad: ((t) => 1 - (1 - t) * (1 - t)) as EaseFn,
  outCubic: ((t) => 1 - Math.pow(1 - t, 3)) as EaseFn,
  inOut: ((t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)) as EaseFn,
  /** Overshoots then settles. */
  outBack: ((t) => 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)) as EaseFn,
  outElastic: ((t) => (t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1)) as EaseFn,
  outBounce: ((t) => {
    const n1 = 7.5625;
    const d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  }) as EaseFn,
} as const;

/** The cheap version: move fraction `k` of the remaining distance per call. Good for cameras and UI. */
export function chase(current: number, target: number, k: number): number {
  return current + (target - current) * k;
}

/** Frame-rate independent chase: `k` is the fraction closed per 1/60 s. */
export function chaseDt(current: number, target: number, k: number, dtSeconds: number): number {
  const f = 1 - Math.pow(1 - Math.min(0.999, Math.max(0, k)), dtSeconds * 60);
  return current + (target - current) * f;
}

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

export function lerpColor(a: number, b: number, t: number): number {
  const r = Math.round(lerp((a >> 16) & 255, (b >> 16) & 255, t));
  const g = Math.round(lerp((a >> 8) & 255, (b >> 8) & 255, t));
  const bl = Math.round(lerp(a & 255, b & 255, t));
  return (r << 16) | (g << 8) | bl;
}
