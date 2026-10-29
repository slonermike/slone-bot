// The demo's music, composed at start-up from a brief (src/music/). It is built to match the game:
//  - a groove in D dorian at 120 bpm: springy and a little tense, like the ball,
//  - parts enter with the pressure layers (pad, then bass, then drums, then the arp), so the music gets
//    denser as the screen gets more dangerous,
//  - the hook (lead and its harmony) is held back until the surge: you earn the tune,
//  - a stinger when the surge is ready and another when the run ends.
import { composeSong, composeStinger } from '../../music/compose.ts';
import type { Inst, Song } from '../../music/types.ts';

const ROOT = 50; // D3
const BASE = { mode: 'dorian', root: ROOT, meter: '4/4' } as const;

export interface DemoMusic {
  loop: Song;
  powerup: Song;
  lose: Song;
}

export function buildDemoMusic(): DemoMusic {
  return {
    loop: composeSong({
      ...BASE, seed: 11, name: 'Rising Tide', style: 'springy toy groove', mood: 'playful', form: 'loop', layout: 'groove-8', bpm: 120,
      description: 'The demo game\'s loop: D dorian at 120 bpm, a sub bass and rock drums under a bell arp, with the hook held back for the surge.',
      feel: { drums: 'rock', bass: 'sync', bassVoice: 'sub', leadVoice: 'square', arpVoice: 'bell', arp: 0.8, arpStep: 1, sync: 0.5, harmony: true },
    }),
    powerup: composeStinger({ ...BASE, seed: 12, name: 'Surge Ready', style: 'pickup stinger', mood: 'playful', form: 'oneshot', event: 'powerup', bpm: 150, description: 'The surge meter is full: a rising arpeggio and a ringing top note in the game\'s key.' }),
    lose: composeStinger({ ...BASE, seed: 13, name: 'Out of Lives', style: 'defeat stinger', mood: 'melancholy', form: 'oneshot', event: 'lose', bpm: 96, description: 'The run is over: a falling line that slows to a halt on a low tonic, in the game\'s key.' }),
  };
}

/** Which parts are audible: pressure layers add them one at a time, and the surge earns the hook. Pure, so it is tested. */
export function partsFor(level: number, surging: boolean): Inst[] {
  const parts: Inst[] = ['pad', 'bass'];
  if (level >= 2) parts.push('drums');
  if (level >= 3) parts.push('arp');
  if (surging) parts.push('lead', 'harmony');
  return parts;
}
