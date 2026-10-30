import { describe, expect, it } from 'vitest';
import { makeCtx, runSim } from '../../src/bots/index.ts';
import { blankInput } from '../../src/core/index.ts';
import { createPrototype, bots } from '../../src/protos/2026-10-30-stillwinter/index.ts';
import { BALANCE, MAPS, N, buildPath, cellKey, createSim, deltaToStick, stickToDelta, SPIRE, KINDS, type Sim } from '../../src/protos/2026-10-30-stillwinter/sim.ts';
import { partsFor } from '../../src/protos/2026-10-30-stillwinter/music.ts';
import type { InputState } from '../../src/core/types.ts';

const press = (...names: string[]): InputState => {
  const i = blankInput();
  for (const n of names) (i.buttons as Record<string, { down: boolean; pressed: boolean }>)[n] = { ...(i.buttons as Record<string, object>)[n], down: true, pressed: true } as never;
  return i;
};

function fresh(seed = 1, balance: Record<string, number> = {}): Sim {
  const p = createPrototype();
  const { ctx } = makeCtx(seed, {}, { ...Object.fromEntries(BALANCE.map((b) => [b.id, b.default])), ...balance });
  const sim = createSim(ctx);
  sim.init();
  void p;
  return sim;
}
const run = (sim: Sim, seconds: number): void => { for (let i = 0; i < seconds * 60; i++) sim.step(1 / 60, blankInput()); };
/** Place a spike at the first buildable cell and return it. */
function placeAt(sim: Sim, gx: number, gy: number, kind = 'spike'): void {
  sim.s.cx = gx;
  sim.s.cy = gy;
  sim.s.sel = kind as never;
  sim.step(1 / 60, press('a'));
}

describe('Stillwinter maps', () => {
  it.each(MAPS.map((m) => [m.name, m]))('%s has a connected, non-overlapping path on the grid', (_n, m) => {
    const p = buildPath(m);
    const cells = new Set<number>();
    for (let i = 0; i + 1 < m.pts.length; i++) {
      const [x0, y0] = m.pts[i];
      const [x1, y1] = m.pts[i + 1];
      expect(x0 === x1 || y0 === y1).toBe(true);
      const L = Math.abs(x1 - x0) + Math.abs(y1 - y0);
      for (let k = i === 0 ? 0 : 1; k <= L; k++) {
        const key = cellKey(x0 + Math.sign(x1 - x0) * k, y0 + Math.sign(y1 - y0) * k);
        expect(cells.has(key)).toBe(false);
        cells.add(key);
      }
    }
    expect(p.cells.size).toBe(cells.size);
    for (const [x, y] of m.pts) expect(x >= 0 && y >= 0 && x < N && y < N).toBe(true);
  });
});

describe('Stillwinter core rule: time only moves when something breaks', () => {
  it('nothing moves while frozen, however long you wait', () => {
    const sim = fresh();
    placeAt(sim, 4, 0);
    run(sim, 60);
    expect(sim.s.dawn).toBe(0);
    expect(sim.s.enemies.length).toBe(0);
    expect(sim.s.thaw).toBe(0);
  });

  it('shattering releases time, and time runs the clock down to a stop', () => {
    const sim = fresh();
    placeAt(sim, 4, 0);
    sim.step(1 / 60, press('x'));
    expect(sim.s.thaw).toBeGreaterThan(2);
    run(sim, 1);
    expect(sim.s.dawn).toBeGreaterThan(0.5);
    run(sim, 10);
    expect(sim.s.thaw).toBe(0);
    const frozenAt = sim.s.dawn;
    run(sim, 5);
    expect(sim.s.dawn).toBe(frozenAt);
  });

  it('placing costs ice, shattering refunds half, and an empty board never soft-locks', () => {
    const sim = fresh();
    const ice0 = sim.s.ice;
    placeAt(sim, 4, 0);
    expect(sim.s.ice).toBe(ice0 - SPIRE.spike.cost);
    sim.step(1 / 60, press('x'));
    expect(sim.s.ice).toBeCloseTo(ice0 - SPIRE.spike.cost + Math.floor(SPIRE.spike.cost / 2), 1);
    sim.s.ice = 0;
    run(sim, 20);
    expect(sim.s.ice).toBeGreaterThanOrEqual(SPIRE.spike.cost);
  });

  it('crystals chain through neighbours and give more time for a longer chain', () => {
    const sim = fresh();
    sim.s.unlockedSet.add('crystal');
    sim.s.ice = 50;
    for (const [x, y] of [[4, 0], [5, 0], [6, 0]]) placeAt(sim, x, y, 'crystal');
    sim.s.cx = 4;
    sim.s.cy = 0;
    expect(sim.chainPreview(4, 0).length).toBe(2);
    sim.step(1 / 60, press('x'));
    expect(sim.s.spires.length).toBe(2);
    run(sim, 1);
    expect(sim.s.spires.length).toBe(0);
    expect(sim.telemetry().maxChain).toBe(3);
  });

  it('a lost heart is a reprieve: enemies are pushed back and ice is refunded; hearts at zero end the run', () => {
    const sim = fresh(1, { hearts: 2 });
    sim.s.thaw = 10;
    sim.s.enemies.push({ id: 99, kind: 'drift', s: sim.path.len - 0.01, hp: 3, maxHp: 3, x: 0, y: 0, px: 0, py: 0, flier: false, fx: 0, fy: 0, hit: 0, alive: true });
    run(sim, 0.2);
    expect(sim.s.hearts).toBe(1);
    expect(sim.s.phase).toBe('play');
    sim.s.thaw = 10;
    sim.s.enemies.push({ id: 100, kind: 'drift', s: sim.path.len - 0.01, hp: 3, maxHp: 3, x: 0, y: 0, px: 0, py: 0, flier: false, fx: 0, fy: 0, hit: 0, alive: true });
    run(sim, 0.2);
    expect(sim.s.phase).toBe('over');
    expect(sim.events().some((e) => e.type === 'gameover')).toBe(true);
  });

  it('new spires unlock as dawn advances', () => {
    const sim = fresh();
    expect(sim.unlocked()).toEqual(['spike']);
    sim.s.dawn = sim.s.dawnLen * 0.5;
    sim.s.thaw = 1;
    run(sim, 0.1);
    expect(sim.unlocked().length).toBeGreaterThanOrEqual(4);
    expect(KINDS.length).toBe(5);
  });
});

describe('Stillwinter controls and bots', () => {
  it('maps the stick onto the isometric grid in eight directions', () => {
    expect(stickToDelta(1, 0)).toEqual([1, -1]);
    expect(stickToDelta(0, 1)).toEqual([1, 1]);
    expect(stickToDelta(0.1, 0.1)).toBeNull();
    for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
      const s = deltaToStick(dx, dy);
      expect(stickToDelta(s.x, s.y)).toEqual([dx, dy]);
    }
  });

  it('is deterministic for a seed', () => {
    const a = runSim(createPrototype, bots[0], { seed: 7, maxSimSeconds: 60 });
    const b = runSim(createPrototype, bots[0], { seed: 7, maxSimSeconds: 60 });
    expect(a.telemetry.metrics).toEqual(b.telemetry.metrics);
  });

  it('the greedy bot reaches dawn and the idle bot proves time really is frozen', () => {
    const g = runSim(createPrototype, bots[0], { seed: 3, maxSimSeconds: 300 });
    expect(g.telemetry.outcome).toBe('completed');
    expect(g.telemetry.errors).toEqual([]);
    const spam = runSim(createPrototype, bots[1], { seed: 3, maxSimSeconds: 300 });
    expect(spam.telemetry.metrics.scoreOrProgress).toBeLessThan(g.telemetry.metrics.scoreOrProgress);
  });
});

describe('Stillwinter music parts follow the game', () => {
  it('frozen is a pad; flowing wakes the band; the hook is earned', () => {
    expect(partsFor({ dawn: 0.2, flowing: false, snapping: false, over: false })).toEqual(['pad']);
    const mid = partsFor({ dawn: 0.5, flowing: true, snapping: false, over: false });
    expect(mid).toEqual(expect.arrayContaining(['pad', 'bass', 'arp', 'drums']));
    expect(mid).not.toContain('lead');
    expect(partsFor({ dawn: 0.5, flowing: true, snapping: true, over: false })).toContain('lead');
    expect(partsFor({ dawn: 0.95, flowing: true, snapping: false, over: false })).toContain('harmony');
    expect(partsFor({ dawn: 0.5, flowing: true, snapping: true, over: true })).toEqual(['pad']);
  });
});

describe('Stillwinter sounds', () => {
  it('every sound is audible and never clips', async () => {
    const { defineSounds, SOUND_NAMES } = await import('../../src/protos/2026-10-30-stillwinter/index.ts');
    const { audio, peakOf, rmsOf } = await import('../../src/audio/index.ts');
    defineSounds();
    for (const name of SOUND_NAMES) {
      const variants = audio.samples(name);
      expect(variants.length, name).toBeGreaterThan(0);
      for (const s of variants) {
        expect(peakOf(s), `${name} peak`).toBeLessThanOrEqual(1);
        expect(rmsOf(s), `${name} rms`).toBeGreaterThan(0.002);
      }
    }
  });
});

describe('Stillwinter balance knobs', () => {
  it('each knob changes what the sim does', () => {
    const base = runSim(createPrototype, bots[0], { seed: 4, maxSimSeconds: 400 });
    for (const spec of BALANCE) {
      const lo = runSim(createPrototype, bots[0], { seed: 4, maxSimSeconds: 400, balance: { [spec.id]: spec.min } });
      const hi = runSim(createPrototype, bots[0], { seed: 4, maxSimSeconds: 400, balance: { [spec.id]: spec.max } });
      const key = (r: typeof base) => JSON.stringify([r.telemetry.outcome, r.telemetry.simSeconds, r.telemetry.metrics]);
      expect(key(lo) !== key(base) || key(hi) !== key(base), spec.id).toBe(true);
    }
  });
});

describe('Stillwinter Polar Night', () => {
  it('after dawn, Y continues into an endless mode that keeps scaling', () => {
    const sim = fresh();
    sim.s.dawn = sim.s.dawnLen - 0.01;
    sim.s.thaw = 5;
    run(sim, 0.5);
    expect(sim.s.phase).toBe('won');
    expect(sim.events().some((e) => e.type === 'complete')).toBe(true);
    sim.step(1 / 60, press('y'));
    expect(sim.s.phase).toBe('play');
    expect(sim.s.endless).toBe(true);
    sim.s.thaw = 10;
    run(sim, 4);
    expect(sim.s.polar).toBeGreaterThan(3);
    expect(sim.telemetry().won).toBe(1);
  });
});

describe('Stillwinter music passes the repo quality gate', () => {
  it('composes a loop and five stingers in one key with no problems', async () => {
    const { composeMusic } = await import('../../src/protos/2026-10-30-stillwinter/music.ts');
    const { checkBatch } = await import('../../src/music/coverage.ts');
    const m = composeMusic();
    expect(checkBatch(Object.values(m)).problems).toEqual([]);
    expect(new Set(Object.values(m).map((s) => s.root + s.scale)).size).toBe(1);
  });
});

describe('genre roll script', () => {
  it('is seeded and picks one of five genres', async () => {
    const { execFileSync } = await import('node:child_process');
    const run = (seed: string) => execFileSync('node', ['scripts/genre-roll.mjs', '--seed', seed], { encoding: 'utf8' });
    expect(run('2026-10-30')).toBe(run('2026-10-30'));
    expect(run('2026-10-30')).toMatch(/ROLLED: tower-defense/);
    expect(run('x').match(/candidates: (.*)/)![1].split(', ').length).toBe(5);
  });
});
