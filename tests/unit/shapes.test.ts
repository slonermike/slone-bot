import type { Texture } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { chamfer, ngon, polyRing, slab } from '../../src/juice/shapes.ts';
import { SpritePool } from '../../src/juice/sprites.ts';

describe('polygon helpers', () => {
  it('ngon returns n vertices on the circumradius', () => {
    const p = ngon(10, 20, 5, 6, 0);
    expect(p).toHaveLength(12);
    expect(p[0]).toBeCloseTo(15);
    expect(p[1]).toBeCloseTo(20);
    for (let i = 0; i < p.length; i += 2) expect(Math.hypot(p[i]! - 10, p[i + 1]! - 20)).toBeCloseTo(5);
  });
  it('chamfer cuts four corners into eight vertices inside the rectangle', () => {
    const p = chamfer(0, 0, 100, 50, 10);
    expect(p).toHaveLength(16);
    for (let i = 0; i < p.length; i += 2) {
      expect(p[i]).toBeGreaterThanOrEqual(0);
      expect(p[i]).toBeLessThanOrEqual(100);
      expect(p[i + 1]).toBeGreaterThanOrEqual(0);
      expect(p[i + 1]).toBeLessThanOrEqual(50);
    }
  });
  it('slab shifts only the top edge', () => {
    expect(slab(0, 0, 10, 5, 3)).toEqual([3, 0, 13, 0, 10, 5, 0, 5]);
  });
  it('polyRing fills the outer polygon then cuts the inner one, and ignores rings thinner than their width', () => {
    const calls: string[] = [];
    const g = {
      poly() { calls.push('poly'); return g; },
      fill() { calls.push('fill'); return g; },
      cut() { calls.push('cut'); return g; },
    };
    polyRing(g as never, 0, 0, 50, 6, 6, 0, 0xffffff);
    expect(calls).toEqual(['poly', 'fill', 'poly', 'cut']);
    calls.length = 0;
    polyRing(g as never, 0, 0, 4, 6, 6, 0, 0xffffff);
    expect(calls).toEqual([]);
  });
});

type Fake = { visible: boolean; texture: Texture };

describe('SpritePool', () => {
  const make = () => {
    const added: unknown[] = [];
    const parent = { addChild: (c: unknown) => added.push(c) };
    let created = 0;
    const pool = new SpritePool<Fake>(parent as never, () => { created++; return { visible: false, texture: null as never }; });
    return { pool, added, created: () => created };
  };
  it('creates sprites on demand, reuses them across frames, and hides the unused rest', () => {
    const { pool, added, created } = make();
    const a = { id: 'a' } as unknown as Texture;
    const b = { id: 'b' } as unknown as Texture;
    pool.begin();
    for (let i = 0; i < 5; i++) pool.next(a);
    pool.end();
    expect(created()).toBe(5);
    expect(added).toHaveLength(5);
    pool.begin();
    const s = pool.next(b);
    pool.end();
    expect(created()).toBe(5);
    expect(s.texture).toBe(b);
    expect(s.visible).toBe(true);
    expect(added.filter((x) => (x as Fake).visible)).toHaveLength(1);
    expect(pool.size).toBe(5);
  });
});
