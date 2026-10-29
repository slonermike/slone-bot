// WebAudio player for Song data. Small and self-contained: a handful of subtractive voices and a noise drum kit,
// scheduled a little ahead of the clock so the loop never drifts. Not used by the sim (audio is render-side only).
import { BEATS_PER_BAR } from './types.ts';
import type { Note, Song, Voice } from './types.ts';

interface Ev {
  t: number;
  note: Note;
  voice: Voice;
  inst: string;
}

export class SongPlayer {
  private bus: GainNode | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private startTime = 0;
  private loopBeats = 0;
  private spb = 0.5;
  private events: Ev[] = [];
  private i = 0;
  private iter = 0;
  private noise: AudioBuffer | null = null;
  private song: Song | null = null;
  private volume = 0.8;
  readonly ctx: AudioContext;

  constructor(ctx: AudioContext) {
    this.ctx = ctx;
  }

  get playing(): boolean {
    return this.bus !== null;
  }

  get current(): Song | null {
    return this.playing ? this.song : null;
  }

  /** Position in the loop, in beats (for the playhead). */
  get beat(): number {
    if (!this.playing) return 0;
    return Math.max(0, ((this.ctx.currentTime - this.startTime) / this.spb) % this.loopBeats);
  }

  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.bus) this.bus.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.03);
  }

  play(song: Song): void {
    this.stop();
    void this.ctx.resume();
    this.song = song;
    this.spb = 60 / song.tempo;
    this.loopBeats = song.bars * BEATS_PER_BAR;
    this.events = song.tracks.flatMap((tr) => tr.notes.map((note) => ({ t: note.t, note, voice: tr.voice, inst: tr.inst }))).sort((a, b) => a.t - b.t);
    this.i = 0;
    this.iter = 0;
    this.startTime = this.ctx.currentTime + 0.12;
    const comp = this.ctx.createDynamicsCompressor();
    const bus = this.ctx.createGain();
    bus.gain.value = this.volume;
    bus.connect(comp).connect(this.ctx.destination);
    this.bus = bus;
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
    for (;;) {
      if (this.i >= this.events.length) {
        this.i = 0;
        this.iter++;
      }
      const e = this.events[this.i]!;
      const at = this.startTime + (this.iter * this.loopBeats + e.t) * this.spb;
      if (at > horizon) break;
      this.i++;
      if (at >= this.ctx.currentTime - 0.05) this.voiceFor(bus, e, Math.max(at, this.ctx.currentTime));
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
    const dur = Math.max(0.05, n.d * this.spb);
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
    } else {
      burst('highpass', 7000, note === 46 ? 0.22 : 0.05, 0.2);
    }
  }
}
