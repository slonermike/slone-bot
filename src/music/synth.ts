// WebAudio player for Song data. Small and self-contained: a handful of subtractive voices and a noise drum kit,
// scheduled a little ahead of the clock so the loop never drifts. Not used by the sim (audio is render-side only).
import { beatAt, secondsAt } from './timing.ts';
import type { Inst, Note, Song, Voice } from './types.ts';

interface Ev {
  /** Seconds from the start of a pass, and the note's length in seconds (both honor tempo changes). */
  sec: number;
  dur: number;
  note: Note;
  voice: Voice;
  inst: string;
}

export class SongPlayer {
  private bus: GainNode | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private startTime = 0;
  private loopSeconds = 0;
  private lastEnd = 0;
  private oneShot = false;
  private onEnd: (() => void) | null = null;
  private events: Ev[] = [];
  private i = 0;
  private iter = 0;
  private noise: AudioBuffer | null = null;
  private song: Song | null = null;
  private volume = 0.8;
  private instBus = new Map<string, GainNode>();
  private parts: Set<Inst> | null = null;
  readonly ctx: AudioContext;
  private readonly out: AudioNode;

  /** `out` is where the music goes (a game routes it through the engine's music bus); default is the speakers. */
  constructor(ctx: AudioContext, out?: AudioNode) {
    this.ctx = ctx;
    this.out = out ?? ctx.destination;
  }

  get playing(): boolean {
    return this.bus !== null;
  }

  get current(): Song | null {
    return this.playing ? this.song : null;
  }

  /** Position in the song, in beats (for the playhead; wraps for a loop). */
  get beat(): number {
    if (!this.playing || !this.song) return 0;
    const el = Math.max(0, this.ctx.currentTime - this.startTime);
    return beatAt(this.song.tempoMap, this.oneShot ? Math.min(el, this.loopSeconds) : el % this.loopSeconds);
  }

  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.bus) this.bus.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.03);
  }

  /**
   * Bring parts of a playing song in or out with a short fade, so a game can layer the music with its pressure.
   * Parts keep playing in time while muted, so they come in on the beat. `null` means every part.
   */
  setParts(parts: Inst[] | null, fadeSeconds = 0.4): void {
    this.parts = parts ? new Set(parts) : null;
    for (const [inst, g] of this.instBus) g.gain.setTargetAtTime(this.partOn(inst as Inst) ? 1 : 0, this.ctx.currentTime, fadeSeconds / 3);
  }

  private partOn(inst: Inst): boolean {
    return !this.parts || this.parts.has(inst);
  }

  /** Overall level multiplier (ducking under a stinger, quieter while paused). */
  setLevel(v: number, seconds = 0.2): void {
    if (this.bus) this.bus.gain.setTargetAtTime(this.volume * Math.max(0, v), this.ctx.currentTime, Math.max(0.005, seconds / 3));
  }

  /** Play from the start. A one-shot stops by itself after its last note rings out and then calls `onEnd`. `parts` limits which parts start audible. */
  play(song: Song, onEnd?: () => void, parts?: Inst[]): void {
    this.stop();
    void this.ctx.resume();
    this.song = song;
    this.oneShot = song.form === 'oneshot';
    this.onEnd = onEnd ?? null;
    const last = song.bars[song.bars.length - 1]!;
    this.loopSeconds = secondsAt(song.tempoMap, last.start + last.beats);
    this.events = song.tracks
      .flatMap((tr) => tr.notes.map((note) => {
        const sec = secondsAt(song.tempoMap, note.t);
        return { sec, dur: secondsAt(song.tempoMap, note.t + note.d) - sec, note, voice: tr.voice, inst: tr.inst };
      }))
      .sort((a, b) => a.sec - b.sec);
    this.lastEnd = Math.max(this.loopSeconds, ...this.events.map((e) => e.sec + e.dur));
    this.i = 0;
    this.iter = 0;
    this.startTime = this.ctx.currentTime + 0.12;
    const comp = this.ctx.createDynamicsCompressor();
    const bus = this.ctx.createGain();
    bus.gain.value = this.volume;
    bus.connect(comp).connect(this.out);
    this.bus = bus;
    this.parts = parts ? new Set(parts) : null;
    this.instBus.clear();
    for (const tr of song.tracks) {
      if (this.instBus.has(tr.inst)) continue;
      const g = this.ctx.createGain();
      g.gain.value = this.partOn(tr.inst) ? 1 : 0;
      g.connect(bus);
      this.instBus.set(tr.inst, g);
    }
    this.tick();
    this.timer = setInterval(() => this.tick(), 40);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    const bus = this.bus;
    this.bus = null;
    if (bus) {
      bus.gain.cancelScheduledValues(this.ctx.currentTime);
      bus.gain.setTargetAtTime(0, this.ctx.currentTime, 0.02);
      setTimeout(() => bus.disconnect(), 400);
    }
  }

  private tick(): void {
    const bus = this.bus;
    if (!bus) return;
    const horizon = this.ctx.currentTime + 0.25;
    if (this.oneShot && this.ctx.currentTime > this.startTime + this.lastEnd + 0.6) {
      const done = this.onEnd;
      this.stop();
      done?.();
      return;
    }
    for (;;) {
      if (this.i >= this.events.length) {
        if (this.oneShot) break;
        this.i = 0;
        this.iter++;
      }
      const e = this.events[this.i]!;
      const at = this.startTime + this.iter * this.loopSeconds + e.sec;
      if (at > horizon) break;
      this.i++;
      if (at >= this.ctx.currentTime - 0.05) this.voiceFor(this.instBus.get(e.inst) ?? bus, e, Math.max(at, this.ctx.currentTime));
    }
  }

  private noiseBuf(): AudioBuffer {
    if (!this.noise) {
      const len = this.ctx.sampleRate;
      const b = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = b.getChannelData(0);
      let s = 12345;
      for (let k = 0; k < len; k++) {
        s = (s * 1664525 + 1013904223) >>> 0;
        d[k] = (s / 4294967296) * 2 - 1;
      }
      this.noise = b;
    }
    return this.noise;
  }

  private voiceFor(out: AudioNode, e: Ev, at: number): void {
    const { ctx } = this;
    const n = e.note;
    const dur = Math.max(0.05, e.dur);
    const vel = (n.v / 127) ** 1.2;
    if (e.inst === 'drums') return this.drum(out, n.n, at, vel);
    const freq = 440 * 2 ** ((n.n - 69) / 12);
    const g = ctx.createGain();
    g.connect(out);
    const osc = (type: OscillatorType, f: number, detune = 0) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = f;
      o.detune.value = detune;
      return o;
    };
    const filt = (type: BiquadFilterType, f: number, q = 0.7) => {
      const b = ctx.createBiquadFilter();
      b.type = type;
      b.frequency.value = f;
      b.Q.value = q;
      return b;
    };
    const run = (oscs: OscillatorNode[], attack: number, release: number, peak: number, decayTo = 1) => {
      const end = at + dur + release;
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(peak * vel, at + attack);
      g.gain.setTargetAtTime(peak * vel * decayTo, at + attack, Math.max(0.05, dur * 0.4));
      g.gain.setTargetAtTime(0, at + dur, release / 3);
      for (const o of oscs) { o.start(at); o.stop(end + 0.1); }
    };
    switch (e.voice) {
      case 'square': {
        const o = osc('square', freq);
        const f = filt('lowpass', 2600);
        o.connect(f).connect(g);
        run([o], 0.005, 0.08, 0.16, 0.7);
        break;
      }
      case 'saw': {
        const a = osc('sawtooth', freq, -6);
        const b = osc('sawtooth', freq, 6);
        const f = filt('lowpass', Math.min(5000, freq * 5), 1.2);
        a.connect(f); b.connect(f); f.connect(g);
        run([a, b], 0.01, 0.1, 0.11, 0.75);
        break;
      }
      case 'pluck': {
        const o = osc('triangle', freq);
        const f = filt('lowpass', freq * 6, 2);
        f.frequency.setValueAtTime(freq * 8, at);
        f.frequency.setTargetAtTime(freq * 1.5, at, 0.06);
        o.connect(f).connect(g);
        run([o], 0.003, 0.05, 0.3, 0.02);
        break;
      }
      case 'bell': {
        const a = osc('sine', freq);
        const b = osc('sine', freq * 2.76);
        const gb = ctx.createGain();
        gb.gain.value = 0.35;
        a.connect(g); b.connect(gb).connect(g);
        run([a, b], 0.003, 0.5, 0.2, 0.05);
        break;
      }
      case 'flute': {
        const a = osc('sine', freq);
        const b = osc('triangle', freq);
        const lfo = osc('sine', 5.2);
        const lg = ctx.createGain();
        lg.gain.value = 7;
        lfo.connect(lg); lg.connect(a.detune); lg.connect(b.detune);
        const f = filt('lowpass', 2200);
        a.connect(f); b.connect(f); f.connect(g);
        run([a, b, lfo], 0.07, 0.12, 0.17, 0.85);
        break;
      }
      case 'sub': {
        const a = osc('sine', freq);
        const b = osc('triangle', freq * 2);
        const gb = ctx.createGain();
        gb.gain.value = 0.25;
        a.connect(g); b.connect(gb).connect(g);
        run([a, b], 0.01, 0.1, 0.34, 0.8);
        break;
      }
      case 'warm': {
        const a = osc('sawtooth', freq, -9);
        const b = osc('sawtooth', freq, 9);
        const f = filt('lowpass', 1100);
        a.connect(f); b.connect(f); f.connect(g);
        run([a, b], 0.35, 0.5, 0.045, 1);
        break;
      }
    }
  }

  private drum(out: AudioNode, note: number, at: number, vel: number): void {
    const { ctx } = this;
    const g = ctx.createGain();
    g.connect(out);
    const burst = (type: BiquadFilterType, f: number, len: number, level: number) => {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuf();
      const bf = ctx.createBiquadFilter();
      bf.type = type;
      bf.frequency.value = f;
      src.connect(bf).connect(g);
      g.gain.setValueAtTime(level * vel, at);
      g.gain.exponentialRampToValueAtTime(0.001, at + len);
      src.start(at);
      src.stop(at + len + 0.05);
    };
    if (note === 36) {
      const o = ctx.createOscillator();
      o.frequency.setValueAtTime(160, at);
      o.frequency.exponentialRampToValueAtTime(45, at + 0.14);
      o.connect(g);
      g.gain.setValueAtTime(0.85 * vel, at);
      g.gain.exponentialRampToValueAtTime(0.001, at + 0.28);
      o.start(at);
      o.stop(at + 0.3);
    } else if (note === 38) {
      burst('bandpass', 1900, 0.17, 0.38);
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = 190;
      const og = ctx.createGain();
      og.gain.setValueAtTime(0.25 * vel, at);
      og.gain.exponentialRampToValueAtTime(0.001, at + 0.1);
      o.connect(og).connect(out);
      o.start(at);
      o.stop(at + 0.12);
    } else if (note === 37) {
      burst('bandpass', 2600, 0.04, 0.3);
    } else if (note === 49) {
      burst('highpass', 4500, 1.1, 0.3);
    } else {
      burst('highpass', 7000, note === 46 ? 0.22 : 0.05, 0.2);
    }
  }
}
