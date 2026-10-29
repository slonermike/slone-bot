import { describe, expect, it } from 'vitest';
import { idleBot } from '../../src/bots/builtin.ts';
import { makeCtx, runSim } from '../../src/bots/run.ts';
import { balanceToText, clampValue, defaultsOf, formatValue, mergeBalance, parseBalanceParam } from '../../src/core/balance.ts';
import { blankInput } from '../../src/core/input-state.ts';
import * as demo from '../../src/protos/_demo/index.ts';
import { BALANCE, DemoSim } from '../../src/protos/_demo/sim.ts';

describe('balance helpers', () => {
  it('defaults, clamping, step snapping, and unknown ids', () => {
    const spec = BALANCE;
    expect(defaultsOf(spec).lives).toBe(3);
    const heat = spec.find((s) => s.id === 'heatRamp')!;
    expect(clampValue(heat, 9)).toBe(0.6);
    expect(clampValue(heat, -1)).toBe(0);
    expect(clampValue(heat, 0.31)).toBe(0.32);
    const merged = mergeBalance(spec, { lives: 5, nope: 3, heatRamp: Number.NaN });
    expect(merged.lives).toBe(5);
    expect(merged.heatRamp).toBe(0.2);
    expect('nope' in merged).toBe(false);
  });
  it('parses the URL override and formats values', () => {
    expect(parseBalanceParam('lives:5, heatRamp:0.3,bad,x:y')).toEqual({ lives: 5, heatRamp: 0.3 });
    const s = BALANCE.find((b) => b.id === 'surgeSeconds')!;
    expect(formatValue(s, 5)).toBe('5.0s');
    expect(balanceToText('_demo', BALANCE, defaultsOf(BALANCE))).toMatch(/BALANCE for _demo[\s\S]*lives: 3/);
  });
  it('every build in the scaffold exposes 3 to 8 knobs with valid ranges', () => {
    const p = demo.createPrototype();
    expect(p.balance!.length).toBeGreaterThanOrEqual(3);
    expect(p.balance!.length).toBeLessThanOrEqual(8);
    for (const s of p.balance!) {
      expect(s.min).toBeLessThan(s.max);
      expect(s.default).toBeGreaterThanOrEqual(s.min);
      expect(s.default).toBeLessThanOrEqual(s.max);
      expect(s.step).toBeGreaterThan(0);
      expect(s.label.length).toBeGreaterThan(3);
    }
  });
});

describe('the demo reads its knobs live', () => {
  const make = (balance: Record<string, number> = {}) => {
    const sim = new DemoSim();
    const { ctx, tick } = makeCtx(1, {}, balance);
    sim.init(ctx);
    return { sim, tick, ctx };
  };

  it('heatRamp 0 keeps the heat rate flat; changing it mid-run takes effect immediately', () => {
    const { sim, tick, ctx } = make({ heatRamp: 0 });
    for (let i = 0; i < 600; i++) { sim.step(1 / 60, blankInput()); tick(); sim.drain(); sim.heat = 0; }
    expect(sim.heatRate).toBeCloseTo(5, 5);
    ctx.balance.heatRamp = 0.6;
    expect(sim.heatRate).toBeGreaterThan(5);
  });

  it('lives = 1 ends the run on the first failure', () => {
    const { sim, tick } = make({ lives: 1 });
    expect(sim.lives).toBe(1);
    const events: string[] = [];
    for (let i = 0; i < 60 * 40 && !sim.over; i++) { sim.step(1 / 60, blankInput()); tick(); events.push(...sim.drain().map((e) => e.type)); }
    expect(sim.over).toBe(true);
    expect(events.filter((e) => e === 'fail')).toHaveLength(1);
  });

  it('a harder setting makes the idle bot die sooner, and runSim records the balance used', () => {
    const easy = runSim(demo.createPrototype, idleBot(), { seed: 1, maxSimSeconds: 200, balance: { heatRamp: 0, pickupRelief: 50 } });
    const hard = runSim(demo.createPrototype, idleBot(), { seed: 1, maxSimSeconds: 200, balance: { heatRamp: 0.6 } });
    expect(hard.telemetry.metrics.idleSurvivalSec).toBeLessThan(easy.telemetry.metrics.idleSurvivalSec!);
    expect(hard.telemetry.balance?.heatRamp).toBe(0.6);
    expect(easy.telemetry.balance?.lives).toBe(3);
  });

  it('a faster meter fills the surge sooner', () => {
    const fill = (meterFill: number) => {
      const { sim, tick } = make({ meterFill });
      sim.heat = 0;
      let steps = 0;
      while (!sim.ready && steps < 400) {
        sim.pickups.push({ x: sim.x, y: sim.y, age: 0 });
        sim.step(1 / 60, blankInput()); tick(); sim.drain(); sim.heat = 0; steps++;
      }
      return steps;
    };
    expect(fill(3)).toBeLessThan(fill(1));
  });
});
