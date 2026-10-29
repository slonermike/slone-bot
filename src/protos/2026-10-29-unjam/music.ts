// Unjam's music, composed at start-up from a brief (src/music/). Built to match the game:
//  - F mixolydian at 112 bpm: a bouncy, bright major with a bluesy flat seventh, like a plunger popping,
//  - parts enter with the pressure layers (pad, bass, drums, arp), so the pipe sounds busier as it fills,
//  - the hook (lead and its harmony) is held back for the flush: you earn the tune,
//  - a stinger when the flush is ready, when a new gate layout is picked, and when the pipe finally bursts for good.
import { composeSong, composeStinger } from '../../music/compose.ts';
import type { Inst, Song } from '../../music/types.ts';

const ROOT = 53; // F3
const BASE = { mode: 'mixolydian', root: ROOT, meter: '4/4' } as const;

export interface UnjamMusic {
  loop: Song;
  powerup: Song;
  secret: Song;
  lose: Song;
}

export function buildUnjamMusic(): UnjamMusic {
  return {
    loop: composeSong({
      ...BASE, seed: 21, name: 'Plunger Groove', style: 'bouncy plumbing groove', mood: 'playful', form: 'loop', layout: 'groove-8', bpm: 112,
      description: 'Unjam\'s loop: F mixolydian at 112 bpm, a bouncy sub bass and rock drums under a bell arp, with the hook held back for the flush.',
      feel: { drums: 'rock', bass: 'sync', bassVoice: 'sub', leadVoice: 'square', arpVoice: 'bell', arp: 0.7, arpStep: 1, sync: 0.6, harmony: true },
    }),
    powerup: composeStinger({ ...BASE, seed: 22, name: 'Flush Ready', style: 'pickup stinger', mood: 'playful', form: 'oneshot', event: 'powerup', bpm: 150, description: 'The flush meter is full: a rising arpeggio and a ringing top note in the game\'s key.' }),
    secret: composeStinger({ ...BASE, seed: 23, name: 'New Verb', style: 'discovery stinger', mood: 'playful', form: 'oneshot', event: 'secret', bpm: 100, description: 'The pull ability unlocks: bells climbing over a swelling pad, in the game\'s key.' }),
    lose: composeStinger({ ...BASE, seed: 24, name: 'Burst for Good', style: 'defeat stinger', mood: 'melancholy', form: 'oneshot', event: 'lose', bpm: 92, description: 'The last pipe bursts: a falling line that slows to a halt on a low tonic, in the game\'s key.' }),
  };
}

/** Which parts are audible: pressure layers add them one at a time, and the flush earns the hook. Pure, so it is tested. */
export function partsFor(layer: number, flushing: boolean): Inst[] {
  const parts: Inst[] = ['pad', 'bass'];
  if (layer >= 2) parts.push('drums');
  if (layer >= 3) parts.push('arp');
  if (flushing) parts.push('lead', 'harmony');
  return parts;
}
