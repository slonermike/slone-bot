import { composeSong, composeStinger } from '../../music/compose.ts';
import type { Song } from '../../music/types.ts';

const ROOT = 52;
export function makeMusic(): { calm: Song; tense: Song; glint: Song; tier: Song; win: Song; lose: Song } {
  const calm = composeSong({ root: ROOT, seed: 31, name: 'Speck calm', description: 'a music box drifting over a held pad', style: 'music box', mood: 'wonder, small', form: 'loop', layout: 'groove-8', mode: 'lydian', meter: '3/4', bpm: 66, character: 'vibe',
    feel: { drums: 'none', bass: 'whole', bassVoice: 'sub', leadVoice: 'bell', arpVoice: 'pluck', arp: 0.5, arpStep: 1, pad: true, density: 0.3, riff: false, harmony: true } });
  const tense = composeSong({ root: ROOT, seed: 32, name: 'Speck fading', description: 'a shimmering pulse as the glow runs low', style: 'pulse and shimmer', mood: 'dimming', form: 'loop', layout: 'groove-8', mode: 'phrygian', meter: '7/8', bpm: 104, character: 'vibe',
    feel: { drums: 'sparse', bass: 'groups', bassVoice: 'sub', leadVoice: 'bell', arpVoice: 'bell', arp: 0.9, arpStep: 0.5, pad: true, density: 0.3, riff: false, harmony: false } });
  const glint = composeStinger({ root: ROOT, seed: 33, name: 'glint chain', description: 'pickup chain', style: 'sparkle', mood: 'bright', form: 'oneshot', event: 'powerup', mode: 'lydian', bars: 2 });
  const tier = composeStinger({ root: ROOT, seed: 34, name: 'bigger world', description: 'reveal', style: 'swell', mood: 'awe', form: 'oneshot', event: 'secret', mode: 'lydian' });
  const win = composeStinger({ root: ROOT, seed: 35, name: 'the eye', description: 'finale', style: 'swell', mood: 'awe', form: 'oneshot', event: 'win', mode: 'lydian' });
  const lose = composeStinger({ root: ROOT, seed: 36, name: 'fade', description: 'glow out', style: 'sigh', mood: 'soft loss', form: 'oneshot', event: 'lose', mode: 'phrygian' });
  return { calm, tense, glint, tier, win, lose };
}
