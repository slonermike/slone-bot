import { describe, expect, it } from 'vitest';
import { partsFor, makeWorld, TIERS } from '../../src/protos/2026-10-31-tiny-inside/sim.ts';
import { Rng } from '../../src/core/index.ts';
import { reviewGameMusic } from '../../src/music/review.ts';
import { makeMusic } from '../../src/protos/2026-10-31-tiny-inside/music.ts';

describe('speck', () => {
  it('layers grow with tier and thin when low', () => {
    expect(partsFor(0, false, false)).toEqual(['pad']);
    expect(partsFor(5, false, false)).toContain('lead');
    expect(partsFor(5, true, false)).not.toContain('lead');
  });
  it('worlds never overlap', () => {
    const { bodies } = makeWorld(new Rng(7));
    expect(bodies.length).toBe(TIERS);
    for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++)
      expect(Math.hypot(bodies[i].x - bodies[j].x, bodies[i].y - bodies[j].y)).toBeGreaterThan(bodies[i].r + bodies[j].r);
  });
  it('music reviews', () => {
    const m = makeMusic();
    const r = reviewGameMusic([m.calm, m.tense, m.glint, m.tier, m.win, m.lose]);
    expect(r).toBeTruthy();
  });
});
