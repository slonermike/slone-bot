// Blot Beat's music: four different songs, one per set, each with its own tempo, key, mode, meter and feel, and a
// chart DERIVED from each song (chart.ts): kick, snare, bass and melody are the lanes, so the inputs are the rhythm
// you hear. Stingers are composed in the key of the set they follow. Everything here is pure data (no audio calls).
import { composeSong, composeStinger } from '../../music/compose.ts';
import type { ComposeOptions } from '../../music/compose.ts';
import type { Inst, Song } from '../../music/types.ts';
import { backingSong, chartFromSong, loopSecondsOf } from './chart.ts';
import type { ChartCfg, SongNote } from './chart.ts';

export interface SetDef {
  name: string;
  /** Shown under the set name. */
  info: string;
  spec: Pick<ComposeOptions, 'mode' | 'root' | 'seed' | 'bpm' | 'meter' | 'feel' | 'name' | 'description' | 'style' | 'mood'>;
  chart: ChartCfg;
  /** Times through the loop in this set. */
  reps: number;
}

export const SET_DEFS: SetDef[] = [
  {
    name: 'Doodle', info: '96 BPM, D mixolydian, funk',
    spec: { name: 'Doodle Funk', description: 'Bouncy funk in D mixolydian: syncopated bass, plucky hook.', style: 'cheeky funk groove', mood: 'playful', mode: 'mixolydian', root: 50, seed: 5, bpm: 96, meter: '4/4',
      feel: { drums: 'funk', bass: 'sync', bassVoice: 'saw', leadVoice: 'pluck', arp: 0.4, sync: 0.5, density: 0.6, harmony: true } },
    chart: { kinds: ['kick', 'snare', 'lead'], holds: false, maxPerSec: 2, minGap: { kick: 0.42, snare: 0.42, lead: 0.3, bass: 0.5 }, maxSimul: 2 }, reps: 3,
  },
  {
    name: 'Sketch', info: '118 BPM, A minor, driving rock',
    spec: { name: 'Sketch Drive', description: 'Driving minor rock: galloping saw bass, square lead.', style: 'driving rock chase', mood: 'tense', mode: 'minor', root: 57, seed: 9, bpm: 118, meter: '4/4',
      feel: { drums: 'rock', bass: 'gallop', bassVoice: 'saw', leadVoice: 'square', arp: 0.6, arpStep: 0.5, sync: 0.3, density: 0.7, harmony: true } },
    // a gentle second step: still three lanes (no bass yet), a sparser beat, and long melody notes as the one new thing
    chart: { kinds: ['kick', 'snare', 'lead'], holds: true, holdKinds: ['lead'], maxPerSec: 1.9, minGap: { kick: 0.55, snare: 0.55, lead: 0.36, bass: 0.6 }, maxSimul: 2 }, reps: 3,
  },
  {
    name: 'Turbo', info: '164 BPM, E harmonic minor, frantic',
    spec: { name: 'Turbo Jam', description: 'A frantic 90s action-stage jam-out: galloping saw bass, shredding square lead, nonstop sixteenth arps.', style: 'frantic 90s action stage', mood: 'tense', mode: 'harmonic minor', root: 52, seed: 33, bpm: 164, meter: '4/4',
      feel: { drums: 'rock', bass: 'gallop', bassVoice: 'saw', leadVoice: 'square', arp: 0.9, arpStep: 0.5, sync: 0.5, density: 0.9, harmony: true } },
    // the bass lane joins here; the song is fast but the chart stays readable
    chart: { kinds: ['kick', 'snare', 'lead', 'bass'], holds: true, holdKinds: ['lead', 'bass'], maxPerSec: 2.1, minGap: { kick: 0.45, snare: 0.45, lead: 0.32, bass: 0.55 }, maxSimul: 2 }, reps: 4,
  },
  {
    name: 'Scrawl', info: '132 BPM, E dorian, swaying 6/8',
    spec: { name: 'Scrawl Waltz', description: 'A swaying 6/8 march in E dorian with a deep sub bass and a flute hook.', style: 'folk march in six', mood: 'wistful', mode: 'dorian', root: 52, seed: 14, bpm: 132, meter: '6/8',
      feel: { drums: 'march', bass: 'groups', bassVoice: 'sub', leadVoice: 'flute', arp: 0.3, sync: 0.2, density: 0.5, harmony: true } },
    chart: { kinds: ['kick', 'snare', 'lead', 'bass'], holds: true, holdKinds: ['lead', 'bass'], maxPerSec: 2.3, minGap: { kick: 0.38, snare: 0.38, lead: 0.26, bass: 0.45 }, maxSimul: 2 }, reps: 5,
  },
  {
    name: 'Finale', info: '146 BPM, G lydian, soaring',
    spec: { name: 'Finale Rush', description: 'A fast, bright lydian rush with eighth-note saw bass and a square lead.', style: 'bright arcade rush', mood: 'triumphant', mode: 'lydian', root: 55, seed: 21, bpm: 146, meter: '4/4',
      feel: { drums: 'four', bass: 'eighths', bassVoice: 'saw', leadVoice: 'square', arp: 0.7, arpStep: 0.5, sync: 0.4, density: 0.8, harmony: true } },
    chart: { kinds: ['kick', 'snare', 'lead', 'bass'], holds: true, holdKinds: ['lead', 'bass'], maxPerSec: 2.7, minGap: { kick: 0.36, snare: 0.36, lead: 0.25, bass: 0.4 }, maxSimul: 2 }, reps: 4,
  },
];

export type MusicParts = Inst[];

/** Which parts are audible. The charted instruments are always on (they carry the ghost the player completes); ink adds
 *  tension layers, and the harmony joins for the fever, the earned moment. */
export function partsFor(set: number, inkBand: number, fever: boolean, calm = false): MusicParts {
  if (calm) return ['pad', 'bass'];
  const parts: MusicParts = ['pad', 'bass', 'drums', 'lead'];
  if (set >= 1 || inkBand >= 2) parts.push('arp');
  if (inkBand >= 3) parts.push('riff');
  if (fever) parts.push('harmony');
  return parts;
}

const songs: (Song | undefined)[] = [];
const charts: (SongNote[] | undefined)[] = [];
const backings: (Song | undefined)[] = [];

export function songFor(set: number): Song {
  return (songs[set] ??= composeSong({ ...SET_DEFS[set]!.spec, form: 'loop', layout: 'groove-8' }));
}
export function loopSeconds(set: number): number { return loopSecondsOf(songFor(set)); }
export function chartFor(set: number): SongNote[] {
  return (charts[set] ??= chartFromSong(songFor(set), SET_DEFS[set]!.chart, loopSeconds(set)));
}
/** What actually plays under the set: the song with the charted notes at a quiet ghost. */
export function backingFor(set: number): Song {
  return (backings[set] ??= backingSong(songFor(set), chartFor(set)));
}
/** Beats in the count-in: one bar of the song. */
export function barBeats(set: number): number { return Math.round(songFor(set).bars[0]!.beats); }

const stingers: Record<string, Song> = {};
export function stingerFor(kind: 'win' | 'lose' | 'pick', set: number): Song {
  const k = `${kind}${set}`;
  const d = SET_DEFS[set]!.spec;
  return (stingers[k] ??= composeStinger({
    mode: d.mode, root: d.root, seed: d.seed + 100 + (kind === 'win' ? 1 : kind === 'lose' ? 2 : 3),
    name: `${d.name} ${kind}`, description: `${kind} stinger in the key of ${d.name}.`, style: d.style, mood: kind === 'lose' ? 'melancholy' : d.mood,
    form: 'oneshot', event: kind === 'pick' ? 'powerup' : kind, bpm: typeof d.bpm === 'number' ? d.bpm : 120, bars: kind === 'pick' ? 2 : undefined,
  }));
}
