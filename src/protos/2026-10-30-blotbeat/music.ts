// Blot Beat's own music: one tonic and mode (D dorian) for the four set loops and the stingers. The loops share a
// seed (same hook, faster each set); the parts follow the ink and the set, and the hook (lead) is held for the fever.
import { composeSong, composeStinger } from '../../music/compose.ts';
import type { Inst, Song } from '../../music/types.ts';

const KEY = { mode: 'dorian', root: 50 } as const;
export const SET_BPM = [100, 108, 116, 126] as const;

export type MusicParts = Inst[];

/** Which parts are audible: the set adds layers, ink raises tension, the hook (lead and harmony) is the fever's reward. */
export function partsFor(set: number, inkBand: number, fever: boolean, calm = false): MusicParts {
  if (calm) return ['pad', 'bass'];
  const parts: MusicParts = ['pad', 'bass'];
  if (set >= 1 || inkBand >= 1) parts.push('drums');
  if (set >= 2 || inkBand >= 2) parts.push('arp');
  if (inkBand >= 3) parts.push('riff');
  if (fever) { parts.push('lead'); if (set >= 1) parts.push('harmony'); }
  return parts;
}

let loops: Song[] | null = null;
let stingers: { win: Song; lose: Song; pick: Song } | null = null;

export function setLoops(): Song[] {
  loops ??= SET_BPM.map((bpm) => composeSong({
    ...KEY, seed: 21, name: 'Blot Beat', description: 'A jaunty dorian groove with a plucky hook; faster each set.',
    style: 'cheeky funk-pop groove', mood: 'playful', form: 'loop', layout: 'groove-8', meter: '4/4', bpm,
    feel: { drums: 'funk', bass: 'sync', bassVoice: 'saw', leadVoice: 'square', arpVoice: 'pluck', arp: 0.5, arpStep: 1, sync: 0.45, density: 0.6, harmony: true },
  }));
  return loops;
}

export function gameStingers() {
  stingers ??= {
    win: composeStinger({ ...KEY, seed: 31, name: 'Signed', description: 'The page is signed.', style: 'triumphant flourish', mood: 'triumphant', form: 'oneshot', event: 'win', bpm: 126 }),
    lose: composeStinger({ ...KEY, seed: 32, name: 'Ruined', description: 'Out of pages.', style: 'comic sag', mood: 'melancholy', form: 'oneshot', event: 'lose', bpm: 96 }),
    pick: composeStinger({ ...KEY, seed: 33, name: 'Pick', description: 'A set ends; pick a sticker.', style: 'bright sparkle', mood: 'playful', form: 'oneshot', event: 'powerup', bpm: 132, bars: 2 }),
  };
  return stingers;
}
