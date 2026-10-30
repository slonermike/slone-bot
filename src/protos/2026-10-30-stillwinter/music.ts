// Stillwinter's music: one key (D dorian) for the loop and every stinger. The loop is built from the game's own
// pulse: while time is frozen only the pad breathes; when time flows the rest of the band comes in, layered by dawn.
import { composeSong, composeStinger } from '../../music/compose.ts';
import type { Inst, Song } from '../../music/types.ts';

const KEY = { mode: 'dorian', root: 50 } as const;

export interface MusicSet {
  loop: Song;
  unlock: Song;
  snap: Song;
  win: Song;
  lose: Song;
  boss: Song;
}

export function composeMusic(): MusicSet {
  const loop = composeSong({
    ...KEY, seed: 3011, form: 'loop', layout: 'loop-12', character: 'hook', bpm: 92,
    name: 'Still Water, Slow Clock',
    description: 'A cold, patient dorian pulse. A pad holds the frozen world; when time is let loose the bass, arpeggio and drums wake and the hook rides above when the cold snaps.',
    style: 'glacial synth pulse', mood: 'tense, hushed, hopeful',
    feel: { drums: 'soft', bass: 'sparse', bassVoice: 'sub', leadVoice: 'bell', arpVoice: 'pluck', arp: 0.7, arpStep: 1, pad: true, density: 0.5, harmony: true, riff: false, sync: 0.2, drop: false },
  });
  const common = { ...KEY, form: 'oneshot' as const, style: 'glacial synth pulse' };
  return {
    loop,
    unlock: composeStinger({ ...common, seed: 3012, name: 'Thaw Opens', description: 'A bright two-bar rise: something new in the ice.', mood: 'curious', event: 'powerup', bpm: 150 }),
    snap: composeStinger({ ...common, seed: 3013, name: 'Cold Snap', description: 'The meter is full: a rushing lift into the snap.', mood: 'charged', event: 'powerup', bpm: 168 }),
    win: composeStinger({ ...common, seed: 3014, name: 'First Light', description: 'Dawn on the ice: a long open resolve.', mood: 'relieved', event: 'win', bpm: 120 }),
    lose: composeStinger({ ...common, seed: 3015, name: 'Beacon Dark', description: 'The light goes out, slowly.', mood: 'hushed', event: 'lose', bpm: 80 }),
    boss: composeStinger({ ...common, seed: 3016, name: 'The Thaw Comes', description: 'Something warm and wrong walks the path.', mood: 'ominous', event: 'boss', bpm: 108 }),
  };
}

export interface MusicInputs {
  /** 0..1 fraction of the way to dawn. */
  dawn: number;
  /** Time is flowing right now. */
  flowing: boolean;
  /** A Cold Snap is happening or ready. */
  snapping: boolean;
  /** The run is over (won or lost). */
  over: boolean;
}

/** Which parts of the loop are audible. Pure so it can be unit-tested. */
export function partsFor(m: MusicInputs): Inst[] {
  if (m.over) return ['pad'];
  const parts: Inst[] = ['pad'];
  if (!m.flowing) {
    // frozen: hush, with a bass note once the night has deepened
    if (m.dawn >= 0.45) parts.push('bass');
    return parts;
  }
  parts.push('bass');
  if (m.dawn >= 0.12) parts.push('arp');
  if (m.dawn >= 0.35) parts.push('drums');
  if (m.dawn >= 0.7) parts.push('riff');
  // the hook is earned: only in a Cold Snap, or on the last stretch to dawn
  if (m.snapping || m.dawn >= 0.9) parts.push('lead', 'harmony');
  return parts;
}
