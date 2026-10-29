import { describe, expect, it } from 'vitest';
import { idleBot, runSim } from '../../src/bots/index.ts';
import { blankInput } from '../../src/core/index.ts';
import type { Bot } from '../../src/core/types.ts';
import * as unjam from '../../src/protos/2026-10-29-unjam/index.ts';
import { partsFor } from '../../src/protos/2026-10-29-unjam/music.ts';
import { BALANCE, UnjamSim } from '../../src/protos/2026-10-29-unjam/sim.ts';

describe('unjam music', () => {
  it('adds parts with the pressure layers and holds the hook for the flush', () => {
    expect(partsFor(1, false)).toEqual(['pad', 'bass']);
    expect(partsFor(2, false)).toContain('drums');
    expect(partsFor(3, false)).toContain('arp');
    expect(partsFor(3, false)).not.toContain('lead');
    expect(partsFor(3, true)).toEqual(expect.arrayContaining(['lead', 'harmony']));
  });
});

describe('unjam sim', () => {
  it('declares 3 to 8 balance knobs', () => {
    expect(BALANCE.length).toBeGreaterThanOrEqual(3);
    expect(BALANCE.length).toBeLessThanOrEqual(8);
  });

  it('applies back pressure with no input: the idle bot loses a life', () => {
    const r = runSim(unjam.createPrototype, idleBot(), { seed: 1, maxSimSeconds: 120 });
    expect(r.telemetry.metrics.deaths).toBeGreaterThan(0);
  });

  it('the greedy bot beats the idle bot and the hold-A probe', () => {
    const score = (bot: Bot) => {
      let sum = 0;
      for (const seed of [1, 2, 3]) sum += runSim(unjam.createPrototype, bot, { seed, maxSimSeconds: 120 }).telemetry.metrics.scoreOrProgress ?? 0;
      return sum;
    };
    const greedy = unjam.bots!.find((b) => b.name === 'greedy')!;
    const holder = unjam.bots!.find((b) => b.name === 'degenerate-holder')!;
    const idle = score(idleBot());
    expect(score(greedy)).toBeGreaterThan(idle * 2);
    expect(score(greedy)).toBeGreaterThan(score(holder));
  });

  it('hold A on a wedged blob in reach frees it; a tap, or being out of reach, does not', () => {
    const make = (botX: number) => {
      const sim = new UnjamSim();
      sim.init({ seed: 1, dt: 1 / 60, rng: { next: () => 0.5, range: (a: number, b: number) => (a + b) / 2, int: (a: number) => a, chance: () => true, pick: <T>(x: T[]) => x[0]!, gauss: () => 0, shuffle: <T>(x: T[]) => x, fork() { return this; } }, vfxRng: undefined, time: { steps: 0, seconds: 0 }, params: {}, balance: {} } as never);
      sim.blobs.push({ id: 999, x: 440, y: 400, vx: 0, vy: 0, r: 15, kind: 0, stuck: true, strain: 0, grip: 1, age: 0, free: 0 });
      sim.x = botX;
      sim.y = 400;
      return sim;
    };
    const hold = (sim: UnjamSim, steps: number) => {
      const down = blankInput();
      down.buttons.a.down = true;
      for (let i = 0; i < steps; i++) sim.step(1 / 60, down);
      sim.step(1 / 60, blankInput());
    };
    const tap = make(340);
    hold(tap, 3);
    expect(tap.blobs.find((b) => b.id === 999)?.stuck).toBe(true);
    const far = make(100);
    hold(far, 60);
    expect(far.blobs.find((b) => b.id === 999)?.stuck).toBe(true);
    const near = make(340);
    hold(near, 30);
    expect(near.blobs.find((b) => b.id === 999)?.stuck).toBe(false);
    expect(near.lockId).toBe(0);
  });

  it('delivering a wave quota clears the wave and opens the layout choice', () => {
    const sim = new UnjamSim();
    sim.init({ seed: 1, dt: 1 / 60, rng: { next: () => 0.5, range: (a: number, b: number) => (a + b) / 2, int: (a: number) => a, chance: () => false, pick: <T>(x: T[]) => x[0]!, gauss: () => 0, shuffle: <T>(x: T[]) => x, fork() { return this; } }, vfxRng: undefined, time: { steps: 0, seconds: 0 }, params: {}, balance: {} } as never);
    sim.waveDelivered = sim.goal;
    sim.step(1 / 60, blankInput());
    expect(sim.choosing).toBe(true);
    expect(sim.drain().some((e) => e.type === 'wave-clear')).toBe(true);
  });
});
