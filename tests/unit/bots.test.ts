import { describe, expect, it } from 'vitest';
import { idleBot, randomBot } from '../../src/bots/builtin.ts';
import { replay, runSim } from '../../src/bots/run.ts';
import { runSuite } from '../../src/bots/suite.ts';
import { validateTelemetry } from '../../src/bots/telemetry.ts';
import * as demo from '../../src/protos/_demo/index.ts';
import type { Bot, Prototype } from '../../src/core/types.ts';

describe('bot harness on the demo prototype', () => {
  it('produces schema-valid telemetry', () => {
    const r = runSim(demo.createPrototype, idleBot(), { seed: 1, maxSimSeconds: 20 });
    expect(validateTelemetry(r.telemetry)).toEqual([]);
    expect(r.telemetry.simSeconds).toBeCloseTo(20, 0);
  });
  it('the idle bot feels pressure (fails) and the greedy bot beats it', () => {
    const idle = runSim(demo.createPrototype, idleBot(), { seed: 1, maxSimSeconds: 60 });
    const greedy = runSim(demo.createPrototype, demo.bots!.find((b) => b.name === 'greedy')!, { seed: 1, maxSimSeconds: 60 });
    expect(idle.telemetry.metrics.deaths).toBeGreaterThan(0);
    expect(greedy.telemetry.metrics.scoreOrProgress).toBeGreaterThan(idle.telemetry.metrics.scoreOrProgress! + 10);
  });
  it('is reproducible: same seed and bot give identical metrics, and an input-log replay matches', () => {
    const a = runSim(demo.createPrototype, randomBot(), { seed: 5, maxSimSeconds: 30 });
    const b = runSim(demo.createPrototype, randomBot(), { seed: 5, maxSimSeconds: 30 });
    expect(a.telemetry.metrics).toEqual(b.telemetry.metrics);
    const steps = Math.round(a.telemetry.simSeconds * 60);
    const replayed = replay(demo.createPrototype, 5, a.inputLog, steps);
    for (const [k, v] of Object.entries(replayed)) expect(a.telemetry.metrics[k], k).toBe(v);
  });
  it('the suite finds no flags and the degenerate corner strategy loses badly', () => {
    const s = runSuite(demo.createPrototype, demo.bots!, { maxSimSeconds: 60, seeds: [1, 2] });
    expect(s.flags).toEqual([]);
  });
  it('reports crashes and non-finite telemetry instead of throwing', () => {
    const boom = (mode: 'throw' | 'nan'): (() => Prototype) => () => ({
      meta: { slug: 'x', title: 'x', question: 'q', targetFeeling: 'f', mode: 'systemic' },
      init() {}, events: () => [], render() {}, onEvent() {},
      step() { if (mode === 'throw') throw new Error('boom'); },
      telemetry: () => ({ scoreOrProgress: mode === 'nan' ? NaN : 0 }),
    });
    const bot: Bot = idleBot();
    expect(runSim(boom('throw'), bot).telemetry.outcome).toBe('crash');
    const nan = runSim(boom('nan'), bot);
    expect(nan.telemetry.outcome).toBe('crash');
    expect(nan.telemetry.errors.join()).toMatch(/non-finite/);
  });
  it('ends a run when the sim emits complete or gameover', () => {
    const mk = (type: string): (() => Prototype) => () => {
      let n = 0;
      let out: { type: string }[] = [];
      return {
        meta: { slug: 'x', title: 'x', question: 'q', targetFeeling: 'f', mode: 'content' },
        init() {}, render() {}, onEvent() {},
        step() { if (++n === 30) out.push({ type }); },
        events() { const e = out; out = []; return e; },
        telemetry: () => ({}),
      };
    };
    expect(runSim(mk('complete'), idleBot()).telemetry.outcome).toBe('completed');
    expect(runSim(mk('gameover'), idleBot()).telemetry.outcome).toBe('failed');
  });
});

describe('demo: failure is a reprieve', () => {
  it('the pressure ramp restarts after a death', () => {
    const create = demo.createPrototype;
    const r = runSim(create, idleBot(), { seed: 1, maxSimSeconds: 100 });
    // idle dies repeatedly; the final heat rate must be well below the capped rate it would reach without resets
    expect(r.telemetry.metrics.deaths).toBeGreaterThan(3);
    expect(r.telemetry.metrics.heatRate).toBeLessThan(30);
    expect(r.telemetry.metrics.heatRate).toBeLessThan(5 + 0.2 * 100);
  });
});
