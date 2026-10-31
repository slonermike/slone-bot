import { describe, expect, it } from 'vitest';
import { arcPath } from '../../src/juice/arc.ts';

describe('arcPath', () => {
  it('starts with a moveTo at the arc start and only lineTo after, all on the circle', () => {
    const calls: Array<['m' | 'l', number, number]> = [];
    arcPath({ moveTo: (x, y) => calls.push(['m', x, y]), lineTo: (x, y) => calls.push(['l', x, y]) }, 100, 50, 20, 0, Math.PI);
    expect(calls[0]).toEqual(['m', 120, 50]);
    expect(calls.slice(1).every((c) => c[0] === 'l')).toBe(true);
    for (const [, x, y] of calls) expect(Math.hypot(x - 100, y - 50)).toBeCloseTo(20, 6);
    const last = calls[calls.length - 1];
    expect(last[1]).toBeCloseTo(80, 6);
    expect(last[2]).toBeCloseTo(50, 6);
  });
  it('never goes near the origin for an arc far from it', () => {
    const pts: number[][] = [];
    arcPath({ moveTo: (x, y) => pts.push([x, y]), lineTo: (x, y) => pts.push([x, y]) }, 5000, 5000, 300, 1, 4);
    expect(Math.min(...pts.map(([x, y]) => Math.hypot(x, y)))).toBeGreaterThan(4000);
  });
});
