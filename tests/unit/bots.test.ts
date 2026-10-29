import { describe, expect, it } from 'vitest';
import { idleBot, randomBot } from '../../src/bots/builtin.ts';
import { blankInput } from '../../src/core/input-state.ts';
import { DemoSim } from '../../src/protos/_demo/sim.ts';
import { makeCtx, replay, runSim } from '../../src/bots/run.ts';
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

describe('demo: failure, reprieve, and layered pressure', () => {
  const noInput = () => blankInput();
  const make = (seed = 1) => {
    const sim = new DemoSim();
    const { ctx, tick } = makeCtx(seed);
    sim.init(ctx);
    return { sim, tick };
  };
  const run = (sim: DemoSim, tick: () => void, steps: number, input = noInput()) => {
    const events: string[] = [];
    for (let i = 0; i < steps; i++) {
      sim.step(1 / 60, input);
      tick();
      events.push(...sim.drain().map((e) => e.type));
    }
    return events;
  };

  it('the pressure ramp restarts after a failure (a reprieve)', () => {
    const { sim, tick } = make();
    let before = 0;
    let failedAt = -1;
    for (let i = 0; i < 60 * 40 && failedAt < 0; i++) {
      before = sim.heatRate;
      const deaths = sim.deaths;
      sim.step(1 / 60, noInput());
      tick();
      sim.drain();
      if (sim.deaths > deaths) failedAt = i;
    }
    expect(failedAt).toBeGreaterThan(0);
    expect(sim.heatRate).toBeLessThan(before);
    expect(sim.heatRate).toBeCloseTo(5, 1);
    expect(sim.heat).toBeLessThan(25);
  });

  it('three failures end the run (hard failure) and the dash button starts a new run', () => {
    const { sim, tick } = make();
    const events = run(sim, tick, 60 * 80);
    expect(events.filter((e) => e === 'fail')).toHaveLength(3);
    expect(events).toContain('gameover');
    expect(sim.over).toBe(true);
    const frozenTime = sim.runTime;
    run(sim, tick, 120);
    expect(sim.runTime).toBe(frozenTime);
    const press = blankInput();
    press.buttons.a.pressed = true;
    press.buttons.a.down = true;
    const after = run(sim, tick, 1, press);
    expect(after).toContain('restart');
    expect(sim.over).toBe(false);
    expect(sim.lives).toBe(3);
    expect(sim.score).toBe(0);
    expect(sim.layer).toBe(1);
  });

  it('pressure layers switch on at 25s, 55s and 90s of run time and add real hazards', () => {
    const { sim, tick } = make();
    sim.heat = -1e9; // isolate the layers from the heat timer
    const seen: number[] = [];
    let hazardsSeen = 0;
    for (let i = 0; i < 60 * 100; i++) {
      sim.heat = 0;
      sim.step(1 / 60, noInput());
      tick();
      for (const e of sim.drain()) if (e.type === 'layer') seen.push(Number(e.data?.level));
      hazardsSeen = Math.max(hazardsSeen, sim.hazards.length);
    }
    expect(seen).toEqual([2, 3, 4]);
    expect(hazardsSeen).toBeGreaterThanOrEqual(2);
    expect(sim.inset).toBeGreaterThan(0);
  });

  it('layer 3 makes uncollected sparks fade, adding heat and breaking the combo', () => {
    const { sim, tick } = make();
    sim.runTime = 60;
    sim.layer = 3;
    sim.pickups.push({ x: 1000, y: 700, age: 7.5 });
    sim.combo = 4;
    const events = run(sim, tick, 2);
    expect(events).toContain('expire');
    expect(sim.combo).toBe(0);
  });

  it('a competent bot outlasts the idle bot and sees every layer', () => {
    const greedy = demo.bots!.find((b) => b.name === 'greedy')!;
    const g = runSim(demo.createPrototype, greedy, { seed: 2, maxSimSeconds: 400 });
    const idle = runSim(demo.createPrototype, idleBot(), { seed: 2, maxSimSeconds: 400 });
    expect(g.telemetry.metrics.survivalSec).toBeGreaterThan(idle.telemetry.metrics.survivalSec! * 3);
    expect(g.telemetry.metrics.layer).toBe(4);
    expect(g.telemetry.outcome).toBe('failed');
  });

  it('combos fill the surge meter, and a full meter is announced and kept until spent', () => {
    const { sim, tick } = make();
    sim.heat = 0;
    const events: string[] = [];
    for (let i = 0; i < 20 && !sim.ready; i++) {
      // drop a pickup on the ball each round
      sim.pickups.push({ x: sim.x, y: sim.y, age: 0 });
      events.push(...run(sim, tick, 2));
      sim.heat = 0;
    }
    expect(sim.ready).toBe(true);
    expect(sim.meter).toBe(1);
    expect(events).toContain('surge-ready');
    // a setback does not dent a full meter
    sim.hazards.push({ x: sim.x, y: sim.y, vx: 0, vy: 0, warn: 0, age: 1 });
    run(sim, tick, 2);
    expect(sim.ready).toBe(true);
  });

  it('the surge: constant speed, steer only, heat frozen, drifters die, and it ends cleanly', () => {
    const { sim, tick } = make();
    sim.ready = true;
    sim.meter = 1;
    sim.heat = 60;
    const press = blankInput();
    press.buttons.x.pressed = true;
    press.buttons.x.down = true;
    press.left.x = 1;
    const started = run(sim, tick, 1, press);
    expect(started).toContain('surge-start');
    expect(sim.surging).toBe(true);
    expect(sim.ready).toBe(false);
    const heatAtStart = sim.heat;
    const steer = blankInput();
    steer.left.y = 1;
    const speeds: number[] = [];
    let kills = 0;
    for (let i = 0; i < 60 * 2; i++) {
      if (i === 30) sim.hazards.push({ x: sim.x + 20, y: sim.y, vx: 0, vy: 0, warn: 0, age: 1 });
      sim.step(1 / 60, steer);
      tick();
      speeds.push(Math.hypot(sim.vx, sim.vy));
      kills += sim.drain().filter((e) => e.type === 'surge-kill').length;
    }
    // constant speed (a wall bounce costs one step of speed before it is restored)
    const sorted = [...speeds].sort((x, y) => x - y);
    expect(sorted[Math.floor(sorted.length / 2)]).toBeGreaterThan(1250);
    expect(Math.max(...speeds)).toBeLessThan(1350);
    expect(sim.heat).toBeLessThanOrEqual(heatAtStart);
    expect(kills).toBeGreaterThanOrEqual(1);
    expect(sim.deaths).toBe(0);
    // run it out, and check the state right when it ends
    let endedAt = false;
    for (let i = 0; i < 60 * 9 && !endedAt; i++) {
      sim.step(1 / 60, steer);
      tick();
      endedAt = sim.drain().some((e) => e.type === 'surge-end');
    }
    expect(endedAt).toBe(true);
    expect(sim.surging).toBe(false);
    expect(sim.meter).toBe(0);
    expect(sim.heat).toBeLessThan(heatAtStart);
  });

  it('a competent bot earns surges now and then, not all the time', () => {
    const greedy = demo.bots!.find((b) => b.name === 'greedy')!;
    const g = runSim(demo.createPrototype, greedy, { seed: 3, maxSimSeconds: 400 });
    expect(g.telemetry.metrics.surges).toBeGreaterThanOrEqual(2);
    expect(g.telemetry.metrics.surges).toBeLessThan(g.telemetry.simSeconds / 15);
    expect(g.telemetry.metrics.surgeKills).toBeGreaterThan(5);
  });
});
