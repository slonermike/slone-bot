// A rough formula for how mode, time signature and tempo combine into a vibe, and its inverse.
//
// These numbers are heuristics from music-theory writing and one perception study (see docs/design/06-music-craft.md),
// not measurements. They are a starting point: Slone's jukebox ratings are what tune them.
import type { Rng } from '../core/rng.ts';

export interface Vibe {
  /** 0 gloomy .. 1 joyful. */
  valence: number;
  /** 0 calm .. 1 driving. */
  energy: number;
  /** 0 settled .. 1 uneasy. */
  tension: number;
  /** 0 straight .. 1 lilting, swaying, rolling. */
  lilt: number;
  /** 0 square and predictable .. 1 off-balance. */
  quirk: number;
}

/** Brightness runs along the circle of fifths: the more sharps a mode has relative to its parallel major, the brighter. */
export const MODE_BRIGHTNESS: Record<string, number> = {
  lydian: 3, major: 2, mixolydian: 1, dorian: 0, minor: -1, 'harmonic minor': -1.5, phrygian: -2,
};
/** How dissonant or dark the mode's signature interval sounds (flat 2nd, raised 7th against a minor 3rd, raised 4th). */
export const MODE_TENSION: Record<string, number> = {
  major: 0.05, mixolydian: 0.2, lydian: 0.25, dorian: 0.3, minor: 0.4, 'harmonic minor': 0.7, phrygian: 0.75,
};

export interface MeterFeel {
  /** How easily the ear finds the beat. */
  stability: number;
  lilt: number;
  quirk: number;
  /** How much forward push the grouping has. */
  drive: number;
}
export const METER_FEEL: Record<string, MeterFeel> = {
  '4/4': { stability: 1.0, lilt: 0.2, quirk: 0.0, drive: 0.8 },
  '2/4': { stability: 0.9, lilt: 0.3, quirk: 0.05, drive: 0.7 }, // march, polka
  '3/4': { stability: 0.7, lilt: 0.8, quirk: 0.1, drive: 0.3 }, // waltz: sway
  '6/8': { stability: 0.75, lilt: 0.9, quirk: 0.1, drive: 0.4 }, // rolling
  '12/8': { stability: 0.75, lilt: 0.9, quirk: 0.1, drive: 0.5 },
  '9/8': { stability: 0.55, lilt: 0.85, quirk: 0.45, drive: 0.4 }, // flowing but off-center
  '5/4': { stability: 0.35, lilt: 0.4, quirk: 0.8, drive: 0.5 }, // a 4/4 with a beat too many
  '5/8': { stability: 0.3, lilt: 0.5, quirk: 0.85, drive: 0.6 },
  '7/8': { stability: 0.3, lilt: 0.5, quirk: 0.8, drive: 0.8 }, // a 4/4 bar cut short: rushed
  '7/4': { stability: 0.35, lilt: 0.45, quirk: 0.75, drive: 0.55 },
};

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

export interface VibeInput {
  mode: string;
  /** Time signatures in use (a changing meter averages, with extra quirk). */
  meters: string[];
  bpm: number;
  /** 0 sparse .. 1 dense note activity. */
  density?: number;
}

export function vibeOf(i: VibeInput): Vibe {
  const feels = i.meters.map((m) => METER_FEEL[m] ?? METER_FEEL['4/4']!);
  const avg = (k: keyof MeterFeel) => feels.reduce((a, f) => a + f[k], 0) / feels.length;
  const changing = new Set(i.meters).size > 1 ? 0.2 : 0;
  const t = clamp01((i.bpm - 50) / 130); // 50 bpm slow .. 180 bpm fast
  const bright = MODE_BRIGHTNESS[i.mode] ?? 0;
  const quirk = clamp01(avg('quirk') + changing);
  return {
    valence: clamp01(0.5 + 0.1 * bright + 0.12 * (t - 0.5) - 0.12 * quirk),
    energy: clamp01(0.12 + 0.6 * t + 0.15 * avg('drive') + 0.1 * (i.density ?? 0.5)),
    tension: clamp01(0.45 * (MODE_TENSION[i.mode] ?? 0.3) + 0.3 * quirk + 0.25 * t),
    lilt: clamp01(avg('lilt')),
    quirk,
  };
}

const WEIGHTS: Record<keyof Vibe, number> = { valence: 1, energy: 1, tension: 0.8, lilt: 0.6, quirk: 0.8 };

export interface Pick {
  mode: string;
  meter: string;
  bpm: number;
  vibe: Vibe;
  error: number;
}

/** Search every mode, meter and tempo for the closest match to a target vibe; return one of the best few at random. */
export function pickForVibe(target: Partial<Vibe>, rng: Rng, opts: { meters?: string[]; modes?: string[]; bpm?: [number, number] } = {}): Pick {
  const modes = opts.modes ?? Object.keys(MODE_BRIGHTNESS);
  const meters = opts.meters ?? Object.keys(METER_FEEL);
  const [lo, hi] = opts.bpm ?? [56, 180];
  const all: Pick[] = [];
  for (const mode of modes) {
    for (const meter of meters) {
      for (let bpm = lo; bpm <= hi; bpm += 4) {
        const vibe = vibeOf({ mode, meters: [meter], bpm });
        let error = 0;
        for (const k of Object.keys(target) as (keyof Vibe)[]) error += WEIGHTS[k] * (vibe[k] - target[k]!) ** 2;
        all.push({ mode, meter, bpm, vibe, error });
      }
    }
  }
  all.sort((a, b) => a.error - b.error);
  return rng.pick(all.slice(0, Math.max(3, Math.floor(all.length * 0.01))));
}
