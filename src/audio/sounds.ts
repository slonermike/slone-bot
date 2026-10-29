import type { SfxParams } from './sfxr.ts';

/** Default named sounds. Prototypes may define their own with `defineSound`. Each is original (synthesized). */
export const DEFAULT_SOUNDS: Record<string, SfxParams | SfxParams[]> = {
  jump: { wave: 'square', freq: 260, slide: 1.8, duty: 0.4, attack: 0.002, sustain: 0.05, decay: 0.12, volume: 0.35 },
  land: [
    { wave: 'noise', freq: 140, slide: -1.2, attack: 0.002, sustain: 0.02, decay: 0.09, lowpass: 900, transient: 0.3, volume: 0.45 },
    { wave: 'noise', freq: 170, slide: -1.0, attack: 0.002, sustain: 0.02, decay: 0.08, lowpass: 1100, transient: 0.3, volume: 0.45 },
  ],
  hit: [
    { wave: 'saw', freq: 190, slide: -2.2, attack: 0.001, sustain: 0.03, decay: 0.12, transient: 0.5, lowpass: 3000, volume: 0.5 },
    { wave: 'saw', freq: 160, slide: -2.0, attack: 0.001, sustain: 0.03, decay: 0.12, transient: 0.5, lowpass: 2600, volume: 0.5 },
    { wave: 'square', freq: 210, slide: -2.4, duty: 0.3, attack: 0.001, sustain: 0.02, decay: 0.11, transient: 0.45, volume: 0.4 },
  ],
  pickup: { wave: 'square', freq: 520, slide: 0.9, duty: 0.25, attack: 0.001, sustain: 0.04, decay: 0.14, punch: 0.3, volume: 0.35 },
  pressureUp: { wave: 'triangle', freq: 220, slide: 0.6, attack: 0.004, sustain: 0.12, decay: 0.2, vibratoDepth: 0.03, vibratoSpeed: 14, volume: 0.45 },
  fail: { wave: 'saw', freq: 300, slide: -1.4, attack: 0.002, sustain: 0.18, decay: 0.35, lowpass: 1800, vibratoDepth: 0.04, vibratoSpeed: 9, volume: 0.45 },
  recover: { wave: 'sine', freq: 330, slide: 1.1, attack: 0.004, sustain: 0.1, decay: 0.28, punch: 0.2, volume: 0.45 },
  dash: { wave: 'noise', freq: 400, slide: 0.8, attack: 0.002, sustain: 0.05, decay: 0.12, lowpass: 2600, highpass: 300, volume: 0.35 },
  click: { wave: 'square', freq: 700, duty: 0.5, attack: 0.001, sustain: 0.008, decay: 0.03, volume: 0.25 },
  'ui-move': { wave: 'square', freq: 520, duty: 0.5, attack: 0.001, sustain: 0.01, decay: 0.04, volume: 0.2 },
  'ui-select': { wave: 'square', freq: 440, slide: 1.4, duty: 0.4, attack: 0.001, sustain: 0.03, decay: 0.1, volume: 0.28 },
  'ui-back': { wave: 'square', freq: 400, slide: -1.0, duty: 0.5, attack: 0.001, sustain: 0.02, decay: 0.08, volume: 0.25 },
};
