import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateManifest } from '../../src/core/manifest.ts';
import type { PrototypeModule } from '../../src/core/types.ts';

// Every game on a branch (anything in src/protos whose name does not start with "_") must meet the scaffold's rules.
// On main there are no games, so this is empty; on a night's branch it checks that night's game.
const dir = path.resolve(__dirname, '../../src/protos');
const games = fs.existsSync(dir) ? fs.readdirSync(dir).filter((d) => !d.startsWith('_') && fs.existsSync(path.join(dir, d, 'prototype.json'))) : [];

it('finds the games on this branch (none on main)', () => {
  for (const g of games) expect(g).toMatch(/^[a-z0-9][a-z0-9_-]*$/);
});

describe.each(games)('game %s', (slug) => {
  it('has a valid manifest whose slug matches its folder', () => {
    const m = JSON.parse(fs.readFileSync(path.join(dir, slug, 'prototype.json'), 'utf8'));
    expect(validateManifest(m)).toEqual([]);
    expect(m.slug).toBe(slug);
  });
  it('exposes 3 to 8 balance knobs with valid ranges, and the required bots', async () => {
    const mod = (await import(path.join(dir, slug, 'index.ts'))) as PrototypeModule;
    const p = mod.createPrototype();
    expect(p.balance?.length ?? 0).toBeGreaterThanOrEqual(3);
    expect(p.balance?.length ?? 0).toBeLessThanOrEqual(8);
    for (const s of p.balance ?? []) {
      expect(s.min).toBeLessThan(s.max);
      expect(s.default).toBeGreaterThanOrEqual(s.min);
      expect(s.default).toBeLessThanOrEqual(s.max);
      expect(s.step).toBeGreaterThan(0);
      expect(s.label.length).toBeGreaterThan(3);
    }
    const names = (mod.bots ?? []).map((b) => b.name);
    expect(names).toContain('greedy');
    expect(names.some((n) => n.startsWith('degenerate'))).toBe(true);
  });
});
