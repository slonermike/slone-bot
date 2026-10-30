import type { Texture } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { SpritePool } from '../../src/juice/sprites.ts';

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
