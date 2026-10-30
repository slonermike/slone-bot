import { describe, expect, it } from 'vitest';
import { Rng } from '../../src/core/rng.ts';
import { blankInput } from '../../src/core/index.ts';
import { makeCtx, runSim } from '../../src/bots/index.ts';
import { audio, peakOf } from '../../src/audio/index.ts';
import { BALANCE, SETS, createSim, makeChart } from '../../src/protos/2026-10-30-blotbeat/sim.ts';
import { partsFor } from '../../src/protos/2026-10-30-blotbeat/music.ts';
import { bots, createPrototype } from '../../src/protos/2026-10-30-blotbeat/index.ts';
import { defineBlotSounds } from '../../src/protos/2026-10-30-blotbeat/sounds.ts';

const SLUG_BOT = (n: string) => bots.find((b) => b.name === n)!;

function freshSim(seed = 1, balance: Record<string, number> = {}) {
  const sim = createSim();
  const { ctx, tick } = makeCtx(seed, {}, balance);
  sim.init(ctx);
  const step = (input = blankInput()) => { sim.step(1 / 60, input); tick(); };
  return { sim, s: sim.state, step };
}

describe('makeChart', () => {
  it('is deterministic per seed and differs between seeds', () => {
    const a = makeChart(new Rng(5), SETS[2]);
    const b = makeChart(new Rng(5), SETS[2]);
    const c = makeChart(new Rng(6), SETS[2]);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });
  it('keeps notes on four lanes inside the set, never two on the same lane at once', () => {
    for (let set = 0; set < SETS.length; set++) {
      for (let seed = 1; seed <= 8; seed++) {
        const cfg = SETS[set]!;
        const chart = makeChart(new Rng(seed), cfg);
        expect(chart.length).toBeGreaterThan(cfg.bars * 2);
        const seen = new Set<string>();
        for (const n of chart) {
          expect(n.lane).toBeGreaterThanOrEqual(0);
          expect(n.lane).toBeLessThanOrEqual(3);
          expect(n.beat).toBeGreaterThanOrEqual(0);
          expect(n.beat + n.len).toBeLessThan(cfg.bars * 4);
          const key = `${n.beat}:${n.lane}`;
          expect(seen.has(key)).toBe(false);
          seen.add(key);
        }
      }
    }
  });
  it('introduces holds in set 2 and doubles in set 3, none before', () => {
    const holds = (set: number) => makeChart(new Rng(3), SETS[set]!).filter((n) => n.len > 0).length;
    const doubles = (set: number) => {
      const c = makeChart(new Rng(3), SETS[set]!);
      return c.filter((n) => c.some((m) => m !== n && m.beat === n.beat)).length;
    };
    expect(holds(0)).toBe(0);
    expect(holds(1)).toBeGreaterThan(0);
    expect(doubles(0)).toBe(0);
    expect(doubles(1)).toBe(0);
    expect(doubles(2)).toBeGreaterThan(0);
  });
  it('a hold leaves its lane free until it ends', () => {
    const chart = makeChart(new Rng(9), SETS[3]);
    for (const h of chart.filter((n) => n.len > 0)) {
      const clash = chart.find((m) => m !== h && m.lane === h.lane && m.beat > h.beat && m.beat < h.beat + h.len);
      expect(clash).toBeUndefined();
    }
  });
});

describe('sim rules', () => {
  it('an idle player misses, drops ink, spills a page and eventually loses', () => {
    const { s, step } = freshSim();
    let guard = 0;
    while (s.phase === 'play' && guard++ < 60 * 120) step();
    expect(s.phase).toBe('lost');
    expect(s.spills).toBe(3);
    expect(s.pages).toBe(0);
    expect(s.misses).toBeGreaterThan(10);
  });
  it('a perfectly timed strike scores and builds combo', () => {
    const { s, step } = freshSim();
    // run to just before the first note
    const n0 = s.notes[0]!;
    while (s.setT < n0.t - 1 / 120) step();
    const input = blankInput();
    const btn = (['y', 'b', 'a', 'x'] as const)[n0.lane]!;
    input.buttons[btn] = { down: true, pressed: true, released: false, value: 1 };
    step(input);
    expect(s.hits).toBe(1);
    expect(s.perfects).toBe(1);
    expect(s.combo).toBe(1);
    expect(s.score).toBeGreaterThan(0);
  });
  it('tapping with nothing near is a free toy tap, not a mistake', () => {
    const { s, step } = freshSim();
    const input = blankInput();
    input.buttons.a = { down: true, pressed: true, released: false, value: 1 };
    step(input);
    expect(s.freeTaps).toBe(1);
    expect(s.strays).toBe(0);
    expect(s.ink).toBe(0);
  });
  it('cannot stamp without enough ink; stamping spends it all, starts a fever, then ink must dry', () => {
    const { sim, s, step } = freshSim();
    const rb = () => { const i = blankInput(); i.buttons.rb = { down: true, pressed: true, released: false, value: 1 }; return i; };
    for (let i = 0; i < 400; i++) step(); // count-in done, nothing struck yet
    s.ink = 2;
    s.restUntil = -1; s.graceUntil = -1;
    step(rb());
    expect(s.feverT).toBe(0);
    s.ink = 5;
    step(rb());
    expect(s.stamps).toBe(1);
    expect(s.ink).toBe(0);
    expect(s.feverT).toBeGreaterThan(0);
    expect(s.feverMax).toBeCloseTo((sim.stats().feverBeats + 5) * s.beatDur, 5);
    // run the fever out, then the stamp stays locked for a few beats
    let guard = 0;
    while (s.feverT > 0 && guard++ < 3000) step();
    s.ink = 5;
    step(rb());
    expect(s.stamps).toBe(1);
    expect(s.setT).toBeLessThan(s.stampLock);
  });
  it('a spill is a reprieve: ink and combo reset and notes on the board are cleared', () => {
    const { s, step } = freshSim(2);
    for (let i = 0; i < 400; i++) step();
    s.ink = 7.9;
    s.combo = 12;
    let guard = 0;
    const pagesBefore = s.pages;
    while (s.pages === pagesBefore && guard++ < 3000) step();
    expect(s.pages).toBe(pagesBefore - 1);
    expect(s.ink).toBe(0);
    expect(s.combo).toBe(0);
    expect(s.setT).toBeLessThan(s.graceUntil);
  });
  it('balance knobs change the sim', () => {
    expect(BALANCE.length).toBeGreaterThanOrEqual(3);
    expect(BALANCE.length).toBeLessThanOrEqual(8);
    const easy = freshSim(1, { inkMax: 14, pages: 6 });
    const hard = freshSim(1, { inkMax: 4, pages: 1 });
    expect(easy.s.pages).toBe(6);
    expect(hard.s.pages).toBe(1);
    expect(easy.sim.stats().inkMax).toBe(14);
    expect(hard.sim.stats().inkMax).toBe(4);
  });
});

describe('bots', () => {
  const run = (name: string, seed = 1) => runSim(createPrototype, SLUG_BOT(name), { seed, maxSimSeconds: 400 }).telemetry;
  it('the greedy bot finishes all four sets and scores far above idle', () => {
    const g = run('greedy');
    expect(g.outcome).toBe('completed');
    expect(g.metrics.setReached).toBe(4);
    expect(g.metrics.score).toBeGreaterThan(30000);
  });
  it('mashing every lane and stamp-farming both score well below the greedy bot', () => {
    const g = run('greedy').metrics.score!;
    expect(run('degenerate-mash').metrics.score!).toBeLessThan(g * 0.6);
    expect(run('degenerate-stamper').metrics.score!).toBeLessThan(g * 0.3);
  });
  it('is deterministic for a seed', () => {
    expect(run('greedy', 4).metrics.score).toBe(run('greedy', 4).metrics.score);
  });
});

describe('music and sound', () => {
  it('partsFor adds layers with the set and ink, and keeps the hook for the fever', () => {
    expect(partsFor(0, 0, false)).toEqual(['pad', 'bass']);
    expect(partsFor(1, 0, false)).toContain('drums');
    expect(partsFor(2, 0, false)).toContain('arp');
    expect(partsFor(0, 2, false)).toContain('arp');
    expect(partsFor(0, 3, false)).toContain('riff');
    expect(partsFor(3, 3, false)).not.toContain('lead');
    expect(partsFor(3, 0, true)).toContain('lead');
    expect(partsFor(3, 3, true, true)).toEqual(['pad', 'bass']);
  });
  it('every sound is audible and does not clip', () => {
    defineBlotSounds();
    const names = audio.names().filter((n) => /^(tap|spark|ok|free|stray|splat|glug|stamp|spill|fever|combo|hold|tick|warn|stick|dry|card)/.test(n));
    expect(names.length).toBeGreaterThan(15);
    for (const n of names) {
      const p = Math.max(...audio.samples(n).map((v) => peakOf(v)));
      expect(p, n).toBeGreaterThan(0.03);
      expect(p, n).toBeLessThanOrEqual(1);
    }
  });
});
