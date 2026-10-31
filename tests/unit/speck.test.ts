import { describe, expect, it } from 'vitest';
import { LEVELS, connected, generateLevel, partsFor } from '../../src/protos/2026-10-31-tiny-inside/sim.ts';
import { reviewGameMusic } from '../../src/music/review.ts';
import { makeMusic } from '../../src/protos/2026-10-31-tiny-inside/music.ts';

describe('speck', () => {
  it('layers grow with level and strip when in danger', () => {
    expect(partsFor(0, false, false)).toEqual(['pad']);
    expect(partsFor(5, false, false)).toContain('lead');
    expect(partsFor(5, true, false)).not.toContain('lead');
  });
  it('every level has a start, a home, and no overlapping worlds', () => {
    for (const spec of LEVELS) {
      const ws = generateLevel(spec);
      expect(ws[0].type).toBe('rock');
      expect(ws.filter((w) => w.type === 'home').length).toBe(1);
      for (let i = 0; i < ws.length; i++) for (let j = i + 1; j < ws.length; j++)
        expect(Math.hypot(ws[i].x - ws[j].x, ws[i].y - ws[j].y), `${spec.name} ${i}/${j}`).toBeGreaterThan(ws[i].r + ws[j].r + 20);
    }
  });
  it('every level is a connected sea that grows', () => {
    let prev = 0;
    for (const spec of LEVELS) { const ws = generateLevel(spec); expect(connected(ws, spec.reach), spec.name).toBe(true); expect(ws.length).toBeGreaterThanOrEqual(prev - 1); prev = ws.length; }
    expect(generateLevel(LEVELS[11]).length).toBeGreaterThan(24);
  });
  it('levels add types one at a time', () => {
    const types = (n: number) => new Set(generateLevel(LEVELS[n]).map((w) => w.type));
    expect(types(0).size).toBe(2);
    expect(types(1).has('sun')).toBe(true);
    expect(types(2).has('crumble')).toBe(true);
  });
  it('music reviews', () => {
    const m = makeMusic();
    expect(reviewGameMusic([m.calm, m.tense, m.glint, m.tier, m.win, m.lose])).toBeTruthy();
  });
});
