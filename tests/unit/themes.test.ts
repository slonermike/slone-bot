import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { beforeEach, describe, expect, it } from 'vitest';
import * as themesModule from '../../scripts/themes.mjs';

const themes = themesModule as any;

const SEED = path.resolve(__dirname, '../../themes');
// the real pool grows every night (agents add themes), so tests must not hard-code its size or next id
const POOL_SIZE = JSON.parse(fs.readFileSync(path.join(SEED, 'pool.json'), 'utf8')).length as number;
const FALLBACK_SIZE = JSON.parse(fs.readFileSync(path.join(SEED, 'fallback-pool.json'), 'utf8')).length as number;
// ids are never reused: the script issues max(id in pool and fallback) + 1, and nights remove themes as they use them
const maxId = Math.max(...[...JSON.parse(fs.readFileSync(path.join(SEED, 'pool.json'), 'utf8')), ...JSON.parse(fs.readFileSync(path.join(SEED, 'fallback-pool.json'), 'utf8'))].map((x: { id: string }) => Number(/\d+/.exec(x.id)?.[0] ?? 0)));
const nextId = `t${String(maxId + 1).padStart(3, '0')}`;
let dir: string;
const pool = () => JSON.parse(fs.readFileSync(path.join(dir, 'pool.json'), 'utf8'));
const grave = () => JSON.parse(fs.readFileSync(path.join(dir, 'graveyard.json'), 'utf8'));

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'themes-'));
  for (const f of ['pool.json', 'fallback-pool.json']) fs.copyFileSync(path.join(SEED, f), path.join(dir, f));
  fs.writeFileSync(path.join(dir, 'graveyard.json'), '[]');
  fs.writeFileSync(path.join(dir, 'state.json'), JSON.stringify({ lastRollDate: null, lastResolveDate: null, rollHistory: [] }));
});

describe('roll', () => {
  it('draws n distinct themes and leaks only id, type, text', () => {
    const r = themes.roll({ dir, today: '2030-01-01' });
    expect(r.ids).toHaveLength(3);
    expect(new Set(r.ids).size).toBe(3);
    for (const line of r.text.split('\n')) expect(line.split(' | ')).toHaveLength(3);
    expect(r.text).not.toMatch(/strikes|reasons|source/);
  });
  it('is deterministic per date and refuses a second roll the same night', () => {
    const a = themes.roll({ dir, today: '2030-01-01' });
    expect(() => themes.roll({ dir, today: '2030-01-01' })).toThrow(/already rolled/);
    fs.writeFileSync(path.join(dir, 'state.json'), JSON.stringify({ rollHistory: [] }));
    expect(themes.roll({ dir, today: '2030-01-01' }).ids).toEqual(a.ids);
  });
  it('never repeats an identical trio', () => {
    const seen = new Set<string>();
    for (let d = 1; d <= 28; d++) seen.add([...themes.roll({ dir, today: `2030-02-${String(d).padStart(2, '0')}` }).ids].sort().join());
    expect(seen.size).toBe(28);
  });
  it('warns below the minimum pool and falls back when the pool is smaller than n', () => {
    fs.writeFileSync(path.join(dir, 'pool.json'), JSON.stringify(pool().slice(0, 10)));
    expect(themes.roll({ dir, today: '2030-03-01' }).text).toMatch(/WARNING.*minimum 15/);
    fs.writeFileSync(path.join(dir, 'pool.json'), JSON.stringify(pool().slice(0, 2)));
    const r = themes.roll({ dir, today: '2030-03-02' });
    expect(r.text).toMatch(/Falling back/);
    expect(pool().length).toBe(FALLBACK_SIZE);
  });
});

describe('resolve', () => {
  const rolled = () => themes.roll({ dir, today: '2030-04-01' }).ids as string[];
  it('consumes the pick, strikes the rejects, and records reasons', () => {
    const [a, b, c] = rolled();
    themes.resolve({ dir, today: '2030-04-01', pick: a, rejects: [{ id: b, reason: 'feels like a costume, no mechanic' }, { id: c, reason: 'the verbs do not follow from it' }] });
    const p = pool();
    expect(p.find((t: any) => t.id === a)).toBeUndefined();
    expect(p.find((t: any) => t.id === b).strikes).toBe(1);
    expect(p.find((t: any) => t.id === b).reasons[0].text).toMatch(/costume/);
  });
  it('requires a pick from tonight, reasons for every reject, and one resolve per night', () => {
    const [a, b, c] = rolled();
    expect(() => themes.resolve({ dir, today: '2030-04-01', pick: 't999', rejects: [] })).toThrow(/not one of tonight/);
    expect(() => themes.resolve({ dir, today: '2030-04-01', pick: a, rejects: [{ id: b, reason: '  ' }, { id: c, reason: 'x y' }] })).toThrow(/non-empty/);
    expect(() => themes.resolve({ dir, today: '2030-04-01', pick: a, rejects: [{ id: b, reason: 'weak hook' }] })).toThrow(/must be rejected/);
    themes.resolve({ dir, today: '2030-04-01', pick: a, rejects: [{ id: b, reason: 'weak hook' }, { id: c, reason: 'no verbs' }] });
    expect(() => themes.resolve({ dir, today: '2030-04-01', pick: a, rejects: [] })).toThrow(/already resolved/);
  });
  it('refuses "too hard to build" reasons', () => {
    const [a, b, c] = rolled();
    for (const lazy of ['too hard to build', 'Too difficult', 'too much work', 'too complex to implement']) {
      expect(() => themes.resolve({ dir, today: '2030-04-01', pick: a, rejects: [{ id: b, reason: lazy }, { id: c, reason: 'fine' }] })).toThrow(/reinterpret it smaller instead/);
    }
  });
  it('moves a theme to the graveyard at 3 strikes only if a reason cites the theme itself', () => {
    const target = 't001';
    const setup = (reasons: string[]) => {
      fs.copyFileSync(path.join(SEED, 'pool.json'), path.join(dir, 'pool.json'));
      const p = pool();
      const t = p.find((x: any) => x.id === target);
      t.strikes = 2;
      t.reasons = reasons.map((text) => ({ date: '2029-01-01', text }));
      fs.writeFileSync(path.join(dir, 'pool.json'), JSON.stringify(p));
    };
    const strikeOnce = (day: string, reason: string) => {
      fs.writeFileSync(path.join(dir, 'state.json'), JSON.stringify({ rollHistory: [{ date: day, ids: [target, 't002', 't003'] }], lastRollDate: day, lastResolveDate: null }));
      themes.resolve({ dir, today: day, pick: 't002', rejects: [{ id: target, reason }, { id: 't003', reason: 'meh hook' }] });
    };
    setup(['preferred the other option', 'chose another instead']);
    strikeOnce('2030-05-01', 'rather play the alternative tonight');
    expect(pool().find((t: any) => t.id === target).strikes).toBe(3);
    expect(grave()).toHaveLength(0);
    setup(['preferred the other option', 'chose another instead']);
    strikeOnce('2030-05-02', 'the theme itself gives the player nothing to do');
    expect(grave().map((t: any) => t.id)).toContain(target);
    expect(pool().find((t: any) => t.id === target)).toBeUndefined();
  });
});

describe('add', () => {
  it('adds a theme with a fresh id', () => {
    const r = themes.add({ dir, today: '2030-06-01', text: 'Gravity that only works on weekends', type: 'constraint', env: {} });
    expect(r.text).toContain(`added ${nextId}`);
    expect(pool().at(-1).source).toBe('postmortem');
  });
  it('rejects near-duplicates, bad types, and more than 3 per night', () => {
    expect(() => themes.add({ dir, text: 'Limited space!', type: 'constraint', env: {} })).toThrow(/too similar/);
    expect(() => themes.add({ dir, text: 'A brand new idea', type: 'skin', env: {} })).toThrow(/--type/);
    for (const t of ['Moss grows over your mistakes', 'Echoes that carry orders', 'A leaky boat of promises']) themes.add({ dir, today: '2030-07-01', text: t, type: 'system', env: {} });
    expect(() => themes.add({ dir, today: '2030-07-01', text: 'Fourth unrelated glimmer', type: 'system', env: {} })).toThrow(/at most 3/);
  });
  it('requires source postmortem for nightly runs', () => {
    expect(() => themes.add({ dir, text: 'Fresh glow worm tunnels', type: 'world', source: 'human', env: { NIGHT_RUN: '1' } })).toThrow(/postmortem/);
  });
});

describe('report', () => {
  it('prints strike data for humans and refuses under NIGHT_RUN=1', () => {
    expect(themes.report({ dir, env: {} }).text).toMatch(new RegExp(`pool size: ${POOL_SIZE}`));
    expect(() => themes.report({ dir, env: { NIGHT_RUN: '1' } })).toThrow(/human only/);
  });
  it('the CLI refuses report when NIGHT_RUN=1', () => {
    const run = () => execFileSync('node', ['scripts/themes.mjs', 'report'], { cwd: path.resolve(__dirname, '../..'), env: { ...process.env, NIGHT_RUN: '1', THEMES_DIR: dir }, stdio: 'pipe' });
    expect(run).toThrow();
  });
});
