import { dial } from '../juice/dial.ts';
import { DEFAULT_SOUNDS } from './sounds.ts';
import { renderSfx, SAMPLE_RATE } from './sfxr.ts';
import type { SfxParams } from './sfxr.ts';

export type BusName = 'master' | 'sfx' | 'music' | 'ui';

export interface PlayOptions {
  /** Playback-rate multiplier (1 = authored pitch). */
  pitch?: number;
  /** 0..1 gain multiplier. */
  volume?: number;
  /** -1 (left) .. 1 (right). */
  pan?: number;
  /** Random pitch spread, fraction (default 0.04). Uses the visual RNG, never the sim RNG. */
  variation?: number;
  /** Which bus; names starting with "ui-" default to 'ui'. */
  bus?: BusName;
}

export interface PlayLogEntry {
  name: string;
  at: number;
  pitch: number;
  volume: number;
}

const STORE_KEY = 'mgb.audio.v1';

/**
 * Unified audio facade. Call sites use `play(name, opts)` and never touch WebAudio.
 * Every call is also recorded in `log` (bounded) so bots and the smoke test can
 * verify that audio events fired even when no sound hardware exists.
 */
class AudioEngine {
  private ctx: AudioContext | null = null;
  private buses: Partial<Record<BusName, GainNode>> = {};
  private defs = new Map<string, SfxParams[]>();
  private buffers = new Map<string, AudioBuffer[]>();
  private rr = new Map<string, number>();
  private vfxRand: () => number = Math.random; // visual/audio-only randomness, not sim
  private volumes: Record<BusName, number> = { master: 0.8, sfx: 1, music: 0.8, ui: 1 };
  muted = false;
  readonly log: PlayLogEntry[] = [];
  readonly counts: Record<string, number> = {};
  /** Wall-clock ms of the first play() after the latest input press (latency probe). */
  onPlay: ((name: string, at: number) => void) | null = null;

  constructor() {
    for (const [name, p] of Object.entries(DEFAULT_SOUNDS)) this.defs.set(name, Array.isArray(p) ? p : [p]);
    this.loadSettings();
  }

  /** Define or override a named sound. Pass several params for round-robin variants. */
  define(name: string, params: SfxParams | SfxParams[]): void {
    this.defs.set(name, Array.isArray(params) ? params : [params]);
    this.buffers.delete(name);
  }

  has(name: string): boolean {
    return this.defs.has(name);
  }

  names(): string[] {
    return [...this.defs.keys()];
  }

  /** Raw sample data for a named sound's variants (tests, loudness checks). */
  samples(name: string): Float32Array[] {
    const defs = this.defs.get(name);
    if (!defs) throw new Error(`unknown sound "${name}"`);
    return defs.map((d) => renderSfx(d, SAMPLE_RATE));
  }

  /** Seed the pitch-variation stream (the shell passes ctx.vfxRng). */
  setRandom(fn: () => number): void {
    this.vfxRand = fn;
  }

  /** Create/resume the AudioContext. Needs a user gesture; the shell calls this on the first input. */
  async unlock(): Promise<void> {
    try {
      if (!this.ctx) this.build();
      if (this.ctx && this.ctx.state === 'suspended') await this.ctx.resume();
    } catch {
      /* no audio hardware (headless): play() still logs */
    }
  }

  get running(): boolean {
    return this.ctx?.state === 'running';
  }

  play(name: string, opts: PlayOptions = {}): void {
    const now = typeof performance !== 'undefined' ? performance.now() : 0;
    const pitch = opts.pitch ?? 1;
    const volume = opts.volume ?? 1;
    this.counts[name] = (this.counts[name] ?? 0) + 1;
    this.log.push({ name, at: now, pitch, volume });
    if (this.log.length > 500) this.log.shift();
    this.onPlay?.(name, now);

    if (!dial.enabled('audio') || this.muted) return;
    const defs = this.defs.get(name);
    if (!defs) {
      if (typeof console !== 'undefined') console.warn(`play(): unknown sound "${name}"`);
      return;
    }
    if (!this.ctx || this.ctx.state !== 'running') return;

    const variants = this.buffersFor(name, defs);
    const i = (this.rr.get(name) ?? 0) % variants.length;
    this.rr.set(name, i + 1);
    const src = this.ctx.createBufferSource();
    src.buffer = variants[i]!;
    const spread = opts.variation ?? 0.04;
    src.playbackRate.value = pitch * (1 + (this.vfxRand() * 2 - 1) * spread);
    const gain = this.ctx.createGain();
    gain.gain.value = Math.max(0, Math.min(2, volume)) * dial.intensityForAudio();
    let tail: AudioNode = gain;
    src.connect(gain);
    if (opts.pan && this.ctx.createStereoPanner) {
      const p = this.ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, opts.pan));
      gain.connect(p);
      tail = p;
    }
    const bus = opts.bus ?? (name.startsWith('ui-') ? 'ui' : 'sfx');
    tail.connect(this.buses[bus]!);
    src.start();
  }

  setVolume(bus: BusName, v: number): void {
    this.volumes[bus] = Math.max(0, Math.min(1, v));
    const node = this.buses[bus];
    if (node) node.gain.value = this.volumes[bus];
    this.saveSettings();
  }

  getVolume(bus: BusName): number {
    return this.volumes[bus];
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.buses.master) this.buses.master.gain.value = m ? 0 : this.volumes.master;
    this.saveSettings();
  }

  /** Reset counters between bot runs. */
  resetStats(): void {
    this.log.length = 0;
    for (const k of Object.keys(this.counts)) delete this.counts[k];
  }

  private build(): void {
    const Ctor = typeof window !== 'undefined' ? (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext) : undefined;
    if (!Ctor) return;
    const ctx = new Ctor({ latencyHint: 'interactive' });
    this.ctx = ctx;
    const master = ctx.createGain();
    master.gain.value = this.muted ? 0 : this.volumes.master;
    master.connect(ctx.destination);
    this.buses.master = master;
    for (const b of ['sfx', 'music', 'ui'] as const) {
      const g = ctx.createGain();
      g.gain.value = this.volumes[b];
      g.connect(master);
      this.buses[b] = g;
    }
  }

  private buffersFor(name: string, defs: SfxParams[]): AudioBuffer[] {
    let bufs = this.buffers.get(name);
    if (!bufs) {
      const ctx = this.ctx!;
      bufs = defs.map((d) => {
        const data = renderSfx(d, ctx.sampleRate);
        const buf = ctx.createBuffer(1, data.length, ctx.sampleRate);
        buf.copyToChannel(data as Float32Array<ArrayBuffer>, 0);
        return buf;
      });
      this.buffers.set(name, bufs);
    }
    return bufs;
  }

  private loadSettings(): void {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return;
      const d = JSON.parse(raw) as { volumes?: Partial<Record<BusName, number>>; muted?: boolean };
      for (const k of Object.keys(this.volumes) as BusName[]) {
        if (typeof d.volumes?.[k] === 'number') this.volumes[k] = d.volumes[k]!;
      }
      this.muted = !!d.muted;
    } catch {
      /* ignore */
    }
  }

  private saveSettings(): void {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ volumes: this.volumes, muted: this.muted }));
    } catch {
      /* ignore */
    }
  }
}

export const audio = new AudioEngine();

/** The unified call. `play('hit', { pitch: 1 + combo * 0.05, volume: impact })`. */
export function play(name: string, opts?: PlayOptions): void {
  audio.play(name, opts);
}

/** Define a prototype-specific sound. */
export function defineSound(name: string, params: SfxParams | SfxParams[]): void {
  audio.define(name, params);
}
