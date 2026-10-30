import { describe, expect, it } from 'vitest';
import { composeSong } from '../../src/music/compose.ts';
import { secondsAt } from '../../src/music/timing.ts';
import { chartFromSong, ghostBacking, loopSecondsOf } from '../../src/music/chart.ts';
import type { ChartOptions } from '../../src/music/chart.ts';
import { clockLockStep, newClockLock } from '../../src/core/index.ts';

const song = (seed: number, bpm: number, meter: string) => composeSong({
  seed, name: 'T', description: 't', style: 'test', mood: 'playful', form: 'loop', layout: 'groove-8', mode: 'dorian', root: 50, bpm, meter,
  feel: { drums: 'funk', bass: 'sync', arp: 0.4, sync: 0.4, density: 0.7 },
});
const opposite = (a: number, b: number) => (a + 2) % 4 === b;
const options: ChartOptions = {
  maxPerSec: 2.6, maxSimul: 2, conflict: opposite,
  voices: [
    { id: 'kick', lane: 2, match: (i, n) => (i === 'drums' && n === 36 ? 36 : null), share: 0.25, minGap: 0.4 },
    { id: 'snare', lane: 0, match: (i, n) => (i === 'drums' && (n === 38 || n === 37) ? 38 : null), share: 0.2, minGap: 0.4 },
    { id: 'bass', lane: 3, match: (i, n) => (i === 'bass' ? n : null), share: 0.15, minGap: 0.45, holds: true },
    { id: 'lead', lane: 1, match: (i, n) => (i === 'lead' ? n : null), share: 0.4, minGap: 0.28, holds: true },
  ],
};
const cases: [number, number, string][] = [[5, 96, '4/4'], [9, 118, '4/4'], [14, 132, '6/8'], [21, 146, '4/4']];

describe('chartFromSong', () => {
  it('every charted note is a real event of the song', () => {
    for (const [seed, bpm, meter] of cases) {
      const s = song(seed, bpm, meter);
      for (const c of chartFromSong(s, options)) {
        const tr = s.tracks.find((t) => t.inst === c.src.inst)!;
        expect(tr.notes.some((n) => n.t === c.src.beat && n.n === c.src.n && Math.abs(secondsAt(s.tempoMap, n.t) - c.t) < 1e-9)).toBe(true);
      }
    }
  });
  it('keeps density bounded: simultaneous, per lane gap, per second (around the loop seam too), no conflicting lanes together', () => {
    for (const [seed, bpm, meter] of cases) {
      const s = song(seed, bpm, meter);
      const L = loopSecondsOf(s);
      const chart = chartFromSong(s, options);
      expect(chart.length).toBeGreaterThan(10);
      for (const n of chart) {
        expect(chart.filter((m) => (((m.t - n.t) % L) + L) % L < 1).length).toBeLessThanOrEqual(Math.ceil(options.maxPerSec));
        expect(chart.filter((m) => Math.abs(m.t - n.t) < 0.03).length).toBeLessThanOrEqual(options.maxSimul);
        for (const m of chart) {
          if (m === n) continue;
          if (opposite(n.lane, m.lane)) {
            expect(Math.abs(m.t - n.t)).toBeGreaterThan(0.03);
            if (n.len > 0) expect(m.t > n.t && m.t < n.t + n.len).toBe(false);
          }
          if (m.lane === n.lane) expect(Math.min(Math.abs(m.t - n.t), L - Math.abs(m.t - n.t))).toBeGreaterThanOrEqual(options.voices.find((v) => v.id === n.voice)!.minGap - 1e-9);
        }
      }
    }
  });
  it('gives every voice a share of the notes, and is deterministic', () => {
    const s = song(14, 132, '6/8');
    const a = chartFromSong(s, options);
    for (const v of options.voices) expect(a.filter((n) => n.voice === v.id).length, v.id).toBeGreaterThan(2);
    expect(chartFromSong(s, options)).toEqual(a);
  });
  it('holds never run into the next note of their lane', () => {
    const chart = chartFromSong(song(9, 118, '4/4'), options);
    expect(chart.some((n) => n.len > 0)).toBe(true);
    for (const h of chart.filter((n) => n.len > 0)) expect(chart.find((m) => m !== h && m.lane === h.lane && m.t > h.t && m.t < h.t + h.len)).toBeUndefined();
  });
});

describe('ghostBacking', () => {
  it('turns exactly the charted notes down and leaves the rest alone', () => {
    const s = song(5, 96, '4/4');
    const chart = chartFromSong(s, options);
    const g = ghostBacking(s, chart, 0.3);
    const charted = new Set(chart.map((c) => `${c.src.inst}|${c.src.beat}|${c.src.n}`));
    let quiet = 0;
    g.tracks.forEach((tr, ti) => tr.notes.forEach((n, ni) => {
      const o = s.tracks[ti]!.notes[ni]!;
      if (charted.has(`${tr.inst}|${n.t}|${n.n}`)) { expect(n.v).toBeLessThan(o.v); quiet++; } else expect(n.v).toBe(o.v);
    }));
    expect(quiet).toBeGreaterThan(10);
  });
});

describe('clockLockStep', () => {
  const run = (frames: number, speed: number, jitter = 0, pause?: [number, number]) => {
    const st = newClockLock();
    let audio = 0, game = 0, resyncs = 0, worst = 0;
    for (let f = 0; f < frames; f++) {
      audio += 1 / 60;
      const paused = pause && f >= pause[0] && f < pause[0] + pause[1];
      if (!paused) game += (1 / 60) * speed;
      if (paused) continue;
      const a = clockLockStep(audio + Math.sin(f) * jitter - game, st);
      if (a.resync) { game = audio; resyncs++; } else game += a.nudge;
      if (f > 120 && !(pause && f < pause[0] + pause[1] + 20)) worst = Math.max(worst, Math.abs(audio - game));
    }
    return { worst, resyncs };
  };
  it('holds a slow clock and tolerates jitter without jumping', () => {
    expect(run(3600, 0.995)).toMatchObject({ resyncs: 0 });
    expect(run(3600, 0.995).worst).toBeLessThan(0.02);
    expect(run(1800, 1, 0.02).resyncs).toBe(0);
  });
  it('jumps once after a long pause', () => {
    expect(run(1200, 1, 0, [300, 180]).resyncs).toBe(1);
  });
  it('never eases by more than maxStep in a frame', () => {
    expect(Math.abs(clockLockStep(0.15, newClockLock()).nudge)).toBeLessThanOrEqual(0.012);
  });
});
