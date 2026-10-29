/**
 * Trauma-model screen shake: trauma decays linearly; the visible shake is trauma squared
 * times smooth noise, with capped amplitude. Pure, so it is unit-testable.
 */
export class Trauma {
  value = 0;
  /** Max offset in px at full trauma. */
  maxOffset = 22;
  /** Max rotation in radians at full trauma. */
  maxRotation = 0.035;
  /** Decay per second. */
  decay = 1.6;

  add(amount: number): void {
    this.value = Math.min(1, this.value + Math.max(0, amount));
  }

  update(dtSeconds: number): void {
    this.value = Math.max(0, this.value - this.decay * dtSeconds);
  }

  reset(): void {
    this.value = 0;
  }

  /** Offset for the given time (seconds). Deterministic smooth noise from summed sines. */
  sample(timeSeconds: number): { x: number; y: number; rot: number } {
    const s = this.value * this.value;
    if (s <= 0) return { x: 0, y: 0, rot: 0 };
    const t = timeSeconds * 28;
    const n1 = Math.sin(t * 1.0 + 0.3) * 0.6 + Math.sin(t * 2.3 + 1.7) * 0.4;
    const n2 = Math.sin(t * 1.1 + 4.1) * 0.6 + Math.sin(t * 2.7 + 0.2) * 0.4;
    const n3 = Math.sin(t * 0.9 + 2.2) * 0.6 + Math.sin(t * 2.1 + 5.0) * 0.4;
    return { x: n1 * s * this.maxOffset, y: n2 * s * this.maxOffset, rot: n3 * s * this.maxRotation };
  }
}
