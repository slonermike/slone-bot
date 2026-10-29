import { dial } from './dial.ts';
import { Trauma } from './shake.ts';

/** Stats the shell reads into telemetry. */
export const fxStats = { shakePeak: 0, hitStopFrames: 0, particleMax: 0 };

/** Screen shake state. The shell applies it to `view.world` each frame. */
export const trauma = new Trauma();

let hitStopImpl: ((frames: number) => void) | null = null;

/** Shell registers its stepper here. */
export function registerHitStop(fn: ((frames: number) => void) | null): void {
  hitStopImpl = fn;
}

/**
 * Add screen shake. `amount` 0..1 (trauma; the felt shake is trauma squared, so small hits stay subtle).
 * Respects the juice dial.
 */
export function shake(amount: number): void {
  const a = dial.scale('shake', amount);
  if (a <= 0) return;
  trauma.add(a);
  fxStats.shakePeak = Math.max(fxStats.shakePeak, trauma.value);
}

/** Freeze the sim for `frames` steps on a big impact (3 to 8 reads well). Respects the juice dial. */
export function hitStop(frames: number): void {
  if (!dial.enabled('hitStop')) return;
  const n = Math.round(frames * Math.min(1.5, dial.intensity));
  if (n <= 0) return;
  fxStats.hitStopFrames += n;
  hitStopImpl?.(n);
}

export function resetFxStats(): void {
  fxStats.shakePeak = 0;
  fxStats.hitStopFrames = 0;
  fxStats.particleMax = 0;
  trauma.reset();
}
