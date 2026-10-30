// Blot Beat sounds: all synthesized in code (original, no attribution). Each lane is a pitch of a D minor 7 arpeggio,
// so tapping the lanes plays notes in the key of the music.
import { defineSound } from '../../audio/index.ts';

export const midiHz = (m: number) => 440 * 2 ** ((m - 69) / 12);
/** Playback-rate ratio that turns a sound authored at `baseMidi` into `midi`. */
export const pitchFor = (midi: number, baseMidi: number) => 2 ** ((midi - baseMidi) / 12);

let done = false;
export function defineBlotSounds(): void {
  if (done) return;
  done = true;
  // the player's hits ARE the song's instruments: drums as they are, pitched voices authored at one note and re-pitched to the song's own note
  defineSound('kick', { wave: 'sine', freq: 130, slide: -2.4, attack: 0.001, sustain: 0.04, decay: 0.28, transient: 0.5, volume: 0.8 });
  defineSound('snare', { wave: 'noise', freq: 1800, slide: -0.3, attack: 0.001, sustain: 0.03, decay: 0.17, highpass: 900, transient: 0.4, volume: 0.5 });
  defineSound('snareBody', { wave: 'triangle', freq: 190, slide: -1, attack: 0.001, sustain: 0.02, decay: 0.12, volume: 0.4 });
  defineSound('bassHit', { wave: 'saw', freq: midiHz(45), attack: 0.004, sustain: 0.1, decay: 0.3, lowpass: 700, transient: 0.2, volume: 0.55 });
  defineSound('leadPluck', { wave: 'triangle', freq: 440, attack: 0.002, sustain: 0.03, decay: 0.3, lowpass: 4200, transient: 0.25, volume: 0.5 });
  defineSound('leadSquare', { wave: 'square', freq: 440, duty: 0.5, attack: 0.003, sustain: 0.08, decay: 0.22, lowpass: 2600, volume: 0.3 });
  defineSound('leadFlute', { wave: 'sine', freq: 440, vibratoDepth: 0.15, vibratoSpeed: 5, attack: 0.03, sustain: 0.12, decay: 0.26, volume: 0.5 });
  defineSound('ok', { wave: 'square', freq: 300, attack: 0.001, sustain: 0.02, decay: 0.08, lowpass: 1800, volume: 0.18 });
  defineSound('free', { wave: 'noise', freq: 800, attack: 0.001, sustain: 0.005, decay: 0.05, highpass: 1800, volume: 0.12 });
  defineSound('stray', { wave: 'square', freq: 130, slide: -0.7, attack: 0.001, sustain: 0.03, decay: 0.12, lowpass: 900, transient: 0.2, volume: 0.35 });
  defineSound('splat', { wave: 'noise', freq: 600, slide: -1.6, attack: 0.001, sustain: 0.04, decay: 0.26, lowpass: 1100, transient: 0.4, volume: 0.55 });
  defineSound('glug', { wave: 'sine', freq: 160, slide: 1.8, attack: 0.003, sustain: 0.04, decay: 0.16, volume: 0.45 });
  defineSound('stampBoom', { wave: 'sine', freq: 80, slide: -1.1, attack: 0.002, sustain: 0.12, decay: 0.55, transient: 0.5, volume: 0.62 });
  defineSound('stampCrack', { wave: 'noise', freq: 900, slide: -0.8, attack: 0.001, sustain: 0.06, decay: 0.4, lowpass: 3600, volume: 0.4 });
  defineSound('stampRise', { wave: 'saw', freq: 180, slide: 2.4, attack: 0.01, sustain: 0.12, decay: 0.3, lowpass: 3000, volume: 0.35 });
  defineSound('spill', { wave: 'noise', freq: 700, slide: -0.9, attack: 0.002, sustain: 0.3, decay: 0.9, lowpass: 1300, transient: 0.4, volume: 0.6 });
  defineSound('spillDrop', { wave: 'saw', freq: 340, slide: -1.6, attack: 0.002, sustain: 0.2, decay: 0.7, lowpass: 1400, volume: 0.3 });
  defineSound('feverEnd', { wave: 'sine', freq: 700, slide: -1.4, attack: 0.002, sustain: 0.05, decay: 0.32, volume: 0.3 });
  defineSound('comboUp', { wave: 'sine', freq: 660, attack: 0.002, sustain: 0.05, decay: 0.3, volume: 0.3 });
  defineSound('holdDone', [{ wave: 'sine', freq: 1318, attack: 0.002, sustain: 0.1, decay: 0.45, volume: 0.35 }]);
  defineSound('holdHum', { wave: 'triangle', freq: 440, vibratoDepth: 0.25, vibratoSpeed: 6, attack: 0.03, sustain: 0.8, decay: 0.2, lowpass: 2400, volume: 0.28 });
  defineSound('holdDrop', { wave: 'triangle', freq: 400, slide: -1.2, attack: 0.002, sustain: 0.03, decay: 0.2, volume: 0.3 });
  defineSound('tickLo', { wave: 'square', freq: 900, attack: 0.001, sustain: 0.01, decay: 0.05, lowpass: 3000, volume: 0.22 });
  defineSound('tickHi', { wave: 'square', freq: 1500, attack: 0.001, sustain: 0.01, decay: 0.06, lowpass: 4000, volume: 0.28 });
  defineSound('warn', { wave: 'triangle', freq: 196, attack: 0.002, sustain: 0.04, decay: 0.12, volume: 0.28 });
  defineSound('stick', { wave: 'square', freq: 520, slide: 1.4, attack: 0.001, sustain: 0.04, decay: 0.16, lowpass: 3500, transient: 0.3, volume: 0.4 });
  defineSound('dry', { wave: 'noise', freq: 1200, attack: 0.002, sustain: 0.04, decay: 0.2, highpass: 2500, volume: 0.2 });
  defineSound('cardMove', { wave: 'triangle', freq: 440, slide: 0.4, attack: 0.001, sustain: 0.01, decay: 0.08, volume: 0.3 });
}
