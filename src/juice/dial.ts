/** Juice dial: runtime layer switches plus a global intensity. Persisted per device (try/catch). */
export const LAYERS = ['shake', 'particles', 'hitStop', 'squashStretch', 'flash', 'trails', 'eyes', 'audio'] as const;
export type Layer = (typeof LAYERS)[number];

const KEY = 'mgb.juice.v1';

export class JuiceDial {
  private on: Record<Layer, boolean>;
  /** Global intensity multiplier, 0..2 (1 = as authored). */
  intensity = 1;
  private listeners = new Set<() => void>();

  constructor() {
    this.on = Object.fromEntries(LAYERS.map((l) => [l, true])) as Record<Layer, boolean>;
  }

  enabled(layer: Layer): boolean {
    return this.on[layer];
  }

  /** Scale an authored amount by intensity; returns 0 when the layer is off. */
  scale(layer: Layer, amount: number): number {
    return this.on[layer] ? amount * this.intensity : 0;
  }

  set(layer: Layer, value: boolean): void {
    this.on[layer] = value;
    this.changed();
  }

  toggle(layer: Layer): void {
    this.set(layer, !this.on[layer]);
  }

  setIntensity(v: number): void {
    this.intensity = Math.max(0, Math.min(2, Math.round(v * 20) / 20));
    this.changed();
  }

  /** Global intensity applied to audio volume (audio layer scale, clamped so loud never clips the bus). */
  intensityForAudio(): number {
    return Math.min(1.5, this.intensity);
  }

  /** Turn every layer on or off (bots compare effects on vs off). */
  setAll(value: boolean): void {
    for (const l of LAYERS) this.on[l] = value;
    this.changed();
  }

  /** Layers currently on. Handy for telemetry. */
  activeLayers(): Layer[] {
    return LAYERS.filter((l) => this.on[l]);
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Apply `?juice=off` or `?juice=shake,audio` style URL overrides, then stored settings are ignored. */
  applyParams(params: Record<string, string>): void {
    const j = params.juice;
    if (j === 'off') this.setAll(false);
    else if (j && j !== 'on') {
      const want = new Set(j.split(','));
      for (const l of LAYERS) this.on[l] = want.has(l);
      this.changed();
    }
    if (params.intensity) this.setIntensity(Number(params.intensity) || 1);
  }

  load(): void {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return;
      const d = JSON.parse(raw) as { on?: Partial<Record<Layer, boolean>>; intensity?: number };
      for (const l of LAYERS) if (typeof d.on?.[l] === 'boolean') this.on[l] = d.on[l]!;
      if (typeof d.intensity === 'number') this.intensity = d.intensity;
    } catch {
      /* ignore */
    }
  }

  private changed(): void {
    try {
      localStorage.setItem(KEY, JSON.stringify({ on: this.on, intensity: this.intensity }));
    } catch {
      /* ignore */
    }
    this.listeners.forEach((f) => f());
  }
}

/** Shared dial used by every helper. */
export const dial = new JuiceDial();
