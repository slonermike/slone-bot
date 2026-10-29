export const DT = 1 / 60;

export interface StepperOptions {
  dt?: number;
  /** Accumulator clamp, in steps. A long hitch drops time instead of spiraling. Default 5. */
  maxCatchUp?: number;
}

export interface AdvanceResult {
  /** Sim steps to run this frame (hit-stop frames already removed). */
  steps: number;
  /** Interpolation factor 0..1 for render. */
  alpha: number;
  /** Steps skipped by hit-stop this frame. */
  frozen: number;
}

/**
 * Fixed-timestep accumulator with hit-stop. Pure and DOM-free so it can be
 * unit-tested and reused by bots. Timescale runs MORE fixed steps per frame,
 * never larger steps.
 */
export class FixedStepper {
  readonly dt: number;
  private readonly maxCatchUp: number;
  private acc = 0;
  private freeze = 0;
  /** Multiplier on real time; 1 for real play. Only bots/tests change this. */
  timescale = 1;
  /** Total hit-stop sim-steps skipped, for telemetry. */
  totalFrozen = 0;

  constructor(opts: StepperOptions = {}) {
    this.dt = opts.dt ?? DT;
    this.maxCatchUp = opts.maxCatchUp ?? 5;
  }

  /** Freeze the sim for `frames` sim steps (the longest request wins). */
  hitStop(frames: number): void {
    if (frames > this.freeze) this.freeze = Math.floor(frames);
  }

  get frozen(): boolean {
    return this.freeze > 0;
  }

  /** Feed real elapsed seconds; get the number of sim steps to run. */
  advance(realSeconds: number): AdvanceResult {
    this.acc += realSeconds * this.timescale;
    const cap = this.maxCatchUp * this.dt * Math.max(1, this.timescale);
    if (this.acc > cap) this.acc = cap;
    let steps = 0;
    let frozen = 0;
    while (this.acc >= this.dt) {
      this.acc -= this.dt;
      if (this.freeze > 0) {
        this.freeze--;
        frozen++;
        this.totalFrozen++;
      } else {
        steps++;
      }
    }
    return { steps, frozen, alpha: this.acc / this.dt };
  }

  reset(): void {
    this.acc = 0;
    this.freeze = 0;
  }
}
