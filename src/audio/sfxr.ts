/**
 * Tiny sfxr-style sample generator. Pure: params in, Float32Array out, so sounds are
 * deterministic and unit-testable (silence, clipping, loudness) without WebAudio.
 */
export type Wave = 'square' | 'saw' | 'triangle' | 'sine' | 'noise';

export interface SfxParams {
  wave: Wave;
  /** Start frequency, Hz. */
  freq: number;
  /** Frequency slide, octaves per second (negative falls). */
  slide?: number;
  /** Change in slide, octaves per second per second. */
  deltaSlide?: number;
  /** Square duty 0.05..0.95. */
  duty?: number;
  /** Seconds. */
  attack?: number;
  sustain?: number;
  decay?: number;
  /** Extra volume boost at the start of the sustain (0..1). */
  punch?: number;
  vibratoDepth?: number;
  vibratoSpeed?: number;
  /** One-pole low-pass cutoff Hz (0 = off). */
  lowpass?: number;
  /** One-pole high-pass cutoff Hz (0 = off). */
  highpass?: number;
  /** Bit-crush: reduce to this many bits (0 = off). */
  crush?: number;
  /** Short noise click mixed over the first ~8 ms (layered transient). */
  transient?: number;
  /** Peak amplitude, 0..1. Default 0.5 leaves headroom. */
  volume?: number;
}

export const SAMPLE_RATE = 44100;

export function sfxDuration(p: SfxParams): number {
  return (p.attack ?? 0.003) + (p.sustain ?? 0.05) + (p.decay ?? 0.1);
}

export function renderSfx(p: SfxParams, sampleRate = SAMPLE_RATE): Float32Array {
  const attack = p.attack ?? 0.003;
  const sustain = p.sustain ?? 0.05;
  const decay = p.decay ?? 0.1;
  const total = Math.max(1, Math.floor((attack + sustain + decay) * sampleRate));
  const out = new Float32Array(total);
  const vol = p.volume ?? 0.5;
  const duty = Math.min(0.95, Math.max(0.05, p.duty ?? 0.5));
  let phase = 0;
  let slide = p.slide ?? 0;
  let octaves = 0;
  let lp = 0;
  let hpPrev = 0;
  let hpOut = 0;
  let noiseVal = 0;
  let noiseSeed = 0x1234abcd;
  const rand = () => {
    // xorshift so noise is deterministic
    noiseSeed ^= noiseSeed << 13;
    noiseSeed ^= noiseSeed >>> 17;
    noiseSeed ^= noiseSeed << 5;
    return ((noiseSeed >>> 0) / 4294967296) * 2 - 1;
  };
  const lpK = p.lowpass ? 1 - Math.exp((-2 * Math.PI * p.lowpass) / sampleRate) : 1;
  const hpK = p.highpass ? Math.exp((-2 * Math.PI * p.highpass) / sampleRate) : 0;
  const levels = p.crush && p.crush > 0 ? Math.pow(2, p.crush) : 0;
  const transientLen = Math.floor(0.008 * sampleRate);

  for (let i = 0; i < total; i++) {
    const t = i / sampleRate;
    slide += (p.deltaSlide ?? 0) / sampleRate;
    octaves += slide / sampleRate;
    let f = p.freq * Math.pow(2, octaves);
    if (p.vibratoDepth) f *= 1 + p.vibratoDepth * Math.sin(2 * Math.PI * (p.vibratoSpeed ?? 8) * t);
    f = Math.max(20, Math.min(sampleRate / 2.1, f));
    const prevPhase = phase;
    phase = (phase + f / sampleRate) % 1;

    let s: number;
    switch (p.wave) {
      case 'square': s = phase < duty ? 1 : -1; break;
      case 'saw': s = 1 - 2 * phase; break;
      case 'triangle': s = phase < 0.5 ? 4 * phase - 1 : 3 - 4 * phase; break;
      case 'sine': s = Math.sin(2 * Math.PI * phase); break;
      default:
        if (phase < prevPhase) noiseVal = rand(); // new noise sample once per cycle
        s = noiseVal;
    }

    if (p.lowpass) {
      lp += lpK * (s - lp);
      s = lp;
    }
    if (p.highpass) {
      hpOut = hpK * (hpOut + s - hpPrev);
      hpPrev = s;
      s = hpOut;
    }
    if (levels) s = Math.round(s * levels) / levels;

    let env: number;
    if (t < attack) env = attack > 0 ? t / attack : 1;
    else if (t < attack + sustain) env = 1 + (p.punch ?? 0) * (1 - (t - attack) / Math.max(sustain, 1e-6));
    else env = Math.max(0, 1 - (t - attack - sustain) / Math.max(decay, 1e-6));

    let v = s * env;
    if (p.transient && i < transientLen) v += rand() * p.transient * (1 - i / transientLen);
    out[i] = v * vol;
  }

  // Normalize only if it would clip; never amplify quiet sounds.
  let peak = 0;
  for (let i = 0; i < total; i++) peak = Math.max(peak, Math.abs(out[i]!));
  if (peak > 0.98) {
    const g = 0.98 / peak;
    for (let i = 0; i < total; i++) out[i] = out[i]! * g;
  }
  return out;
}

export function peakOf(samples: Float32Array): number {
  let p = 0;
  for (const s of samples) p = Math.max(p, Math.abs(s));
  return p;
}

export function rmsOf(samples: Float32Array): number {
  let sum = 0;
  for (const s of samples) sum += s * s;
  return Math.sqrt(sum / Math.max(1, samples.length));
}
