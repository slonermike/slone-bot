import { describe, expect, it } from 'vitest';
import { composeSong, composeStinger } from '../../src/music/compose.ts';
import { reviewGameMusic, reviewSong } from '../../src/music/review.ts';
import * as sounds from '../../scripts/sounds.mjs';

const { formatMenu: menu, TEXTURES, FITS, BANDS } = sounds as any;

describe('music menu', () => {
  it('lists the whole spectrum and is not random', () => {
    const text = menu();
    for (const k of Object.keys(TEXTURES)) expect(text).toContain(k);
    for (const m of ['4/4', '3/4', '6/8', '7/8', '5/4']) expect(text).toContain(m);
    for (const mode of ['lydian', 'dorian', 'phrygian', 'harmonic minor']) expect(text).toContain(mode);
    expect(text).toMatch(/Nothing here is rolled/);
    expect(menu()).toBe(text);
  });
  it('every texture composes a loop at every band and meter it suits, and a stinger', () => {
    let seed = 1;
    for (const [name, tex] of Object.entries<any>(TEXTURES)) {
      for (const band of FITS[name].bands) {
        for (const meter of FITS[name].meters) {
          const bpm = Math.round((BANDS[band].bpm[0] + BANDS[band].bpm[1]) / 2);
          const loop = composeSong({ seed: seed++, name: `${name}-${band}-${meter}`, description: 'x'.repeat(70), style: 's', mood: 'm', form: 'loop', layout: 'loop-8', mode: 'dorian', meter, bpm, character: tex.character, feel: tex.feel });
          expect(loop.bars.length).toBeGreaterThanOrEqual(8);
          expect(loop.tracks.length).toBeGreaterThan(0);
        }
      }
      composeStinger({ seed: seed++, name: `st-${name}`, description: 'x'.repeat(70), style: 's', mood: 'm', form: 'oneshot', event: 'win', mode: 'minor', bpm: 120 });
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
