import { describe, expect, it } from 'vitest';
import { composeSong, composeStinger } from '../../src/music/compose.ts';
import { reviewGameMusic, reviewSong } from '../../src/music/review.ts';
import * as sounds from '../../scripts/sounds.mjs';

const { pickSound, parseLedgerSounds, TEXTURES } = sounds as any;

describe('sound roll', () => {
  it('is deterministic, keeps 4/4 under a third of rolls, never rolls the default zone or the default groove', () => {
    expect(pickSound([], 5)).toEqual(pickSound([], 5));
    let fourFour = 0;
    const bands = new Set<string>();
    for (let seed = 1; seed <= 300; seed++) {
      const s = pickSound([], seed);
      if (s.meter === '4/4') fourFour++;
      bands.add(s.band);
      expect(s.band === 'brisk' && s.meter === '4/4').toBe(false);
      expect(s.texture).not.toBe('funk-pop groove');
    }
    expect(fourFour / 300).toBeLessThan(0.33);
    expect(bands.size).toBeGreaterThanOrEqual(4);
  });
  it('avoids the band, mode and texture of the last three games', () => {
    const ledger = [
      '2030-01-01 | a | systemic | atoms: x | music: slow/6/8/dorian/music box | verdict: pending',
      '2030-01-02 | b | systemic | atoms: x | music: fast/4/4/minor/driving four-floor | verdict: pending',
    ].join('\n');
    const history = parseLedgerSounds(ledger);
    expect(history).toEqual([
      { band: 'slow', meter: '6/8', mode: 'dorian', texture: 'music box' },
      { band: 'fast', meter: '4/4', mode: 'minor', texture: 'driving four-floor' },
    ]);
    for (let seed = 1; seed <= 100; seed++) {
      const s = pickSound(history, seed);
      expect(['slow', 'fast']).not.toContain(s.band);
      expect(['dorian', 'minor']).not.toContain(s.mode);
      expect(['music box', 'driving four-floor']).not.toContain(s.texture);
    }
  });
  it('every rolled identity composes a loop and a stinger', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const s = pickSound([], seed);
      const loop = composeSong({ seed, name: `n${seed}`, description: 'x'.repeat(70), style: 's', mood: 'm', form: 'loop', layout: s.layout, mode: s.mode, meter: s.meter, bpm: s.bpm, character: TEXTURES[s.texture].character, feel: TEXTURES[s.texture].feel });
      expect(loop.bars.length).toBeGreaterThanOrEqual(8);
      expect(loop.tracks.length).toBeGreaterThan(0);
      composeStinger({ seed, name: `st${seed}`, description: 'x'.repeat(70), style: 's', mood: 'm', form: 'oneshot', event: 'win', mode: s.mode, bpm: s.bpm });
    }
  });
});

describe('music review', () => {
  it('flags the default zone, and passes a contrasting set', () => {
    const base = { name: 'a', description: 'x'.repeat(70), style: 's', mood: 'm', form: 'loop' as const, layout: 'loop-12' as const, mode: 'dorian', root: 50 };
    const dflt = composeSong({ ...base, seed: 1, meter: '4/4', bpm: 112 });
    expect(reviewSong(dflt).issues.join(' ')).toMatch(/default zone/);
    const odd = composeSong({ ...base, seed: 2, name: 'b', meter: '7/8', bpm: 150 });
    expect(reviewSong(odd).issues.join(' ')).not.toMatch(/default zone/);
    const set = reviewGameMusic([odd, composeSong({ ...base, seed: 3, name: 'c', meter: '6/8', bpm: 72 }), composeStinger({ ...base, seed: 4, name: 'w', form: 'oneshot', event: 'win', bpm: 120 }), composeStinger({ ...base, seed: 5, name: 'l', form: 'oneshot', event: 'lose', bpm: 90 })]);
    expect(set.issues.filter((i) => /share one tempo/.test(i))).toEqual([]);
    const same = reviewGameMusic([dflt, composeSong({ ...base, seed: 6, name: 'd', meter: '4/4', bpm: 114 })]);
    expect(same.issues.join(' ')).toMatch(/share one tempo/);
  });
  it('reports an energy curve and the layers', () => {
    const r = reviewSong(composeSong({ seed: 9, name: 'x', description: 'x'.repeat(70), style: 's', mood: 'm', form: 'loop', layout: 'loop-12', mode: 'minor', meter: '4/4', bpm: 90 }));
    expect(r.energyCurve.length).toBeGreaterThan(8);
    expect(Math.max(...r.energyCurve)).toBe(1);
    expect(Object.keys(r.layers).length).toBeGreaterThan(0);
  });
});
