/**
 * Visual-only random source for juice and audio variation. The shell points it at
 * ctx.vfxRng so effects are reproducible but can never desync the sim RNG.
 */
let source: () => number = Math.random;

export function setVfxRandom(fn: () => number): void {
  source = fn;
}

export function vfx(): number {
  return source();
}

export function vfxRange(min: number, max: number): number {
  return min + (max - min) * source();
}
