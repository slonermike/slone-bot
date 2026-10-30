import { describe, expect, it } from 'vitest';
import { Rng } from '../../src/core/rng.ts';
import { blankInput } from '../../src/core/index.ts';
import { makeCtx, runSim } from '../../src/bots/index.ts';
import { audio, peakOf } from '../../src/audio/index.ts';
import { BALANCE, SETS, createSim } from '../../src/protos/2026-10-30-blotbeat/sim.ts';
import { syncStep } from '../../src/protos/2026-10-30-blotbeat/sync.ts';
import { SET_DEFS, backingFor, barBeats, chartFor, loopSeconds, partsFor, songFor } from '../../src/protos/2026-10-30-blotbeat/music.ts';
import { secondsAt } from '../../src/music/timing.ts';
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


/** Perfect play for one step: press every note due now, keep holds down until they end. */
function perfectInput(s: ReturnType<typeof freshSim>['s']) {
  const btn = ['y', 'b', 'a', 'x'] as const;
  const input = blankInput();
  for (const n of s.notes) {
    if (n.state === 'live' && Math.abs(n.t - s.setT) < 1 / 120) input.buttons[btn[n.lane]!] = { down: true, pressed: true, released: false, value: 1 };
    else if (n.state === 'holding' && s.setT < n.t + n.len) input.buttons[btn[n.lane]!] = { down: true, pressed: false, released: false, value: 1 };
  }
  return input;
}

describe('the chart is the song', () => {
  const sets = [0, 1, 2, 3, 4];
  it('every note the player must hit is a real event in the song', () => {
    for (const i of sets) {
      const song = songFor(i);
      for (const c of chartFor(i)) {
        const track = song.tracks.find((tr) => tr.inst === c.inst)!;
        const found = track.notes.some((n) => Math.abs(secondsAt(song.tempoMap, n.t) - c.t) < 1e-6 && (c.inst !== 'drums' ? n.n === c.midi : (n.n === 36 || n.n === 38 || n.n === 37)));
        expect(found, `set ${i} ${c.kind} at ${c.t}`).toBe(true);
      }
    }
  });
  it('the playing music keeps a quiet ghost of charted notes and everything else at full strength', () => {
    for (const i of sets) {
      const song = songFor(i);
      const backing = backingFor(i);
      const key = (inst: string, beat: number) => `${inst}|${beat.toFixed(4)}`;
      const charted = new Set(chartFor(i).map((c) => key(c.inst, c.beat)));
      let quiet = 0;
      backing.tracks.forEach((tr, ti) => tr.notes.forEach((n, ni) => {
        const orig = song.tracks[ti]!.notes[ni]!;
        if (n.v < orig.v) { quiet++; expect(charted.has(key(tr.inst, n.t))).toBe(true); }
      }));
      expect(quiet).toBeGreaterThan(10);
      expect(backing.tracks.find((tr) => tr.inst === 'pad')!.notes[0]!.v).toBe(song.tracks.find((tr) => tr.inst === 'pad')!.notes[0]!.v);
    }
  });
  it('density is never overwhelming: at most two at once, a gap per lane, a cap per second, around the loop seam too', () => {
    for (const i of sets) {
      const chart = chartFor(i);
      const L = loopSeconds(i);
      const cfg = SET_DEFS[i]!.chart;
      for (const n of chart) {
        const win = chart.filter((m) => (((m.t - n.t) % L) + L) % L < 1).length;
        expect(win, `set ${i} window at ${n.t.toFixed(2)}`).toBeLessThanOrEqual(Math.ceil(cfg.maxPerSec));
        expect(chart.filter((m) => Math.abs(m.t - n.t) < 0.03).length).toBeLessThanOrEqual(cfg.maxSimul);
        const same = chart.filter((m) => m !== n && m.lane === n.lane).map((m) => { const d = Math.abs(m.t - n.t); return Math.min(d, L - d); });
        expect(Math.min(...same)).toBeGreaterThanOrEqual(cfg.minGap[n.kind] - 1e-9);
      }
      expect(chart.length / L).toBeLessThan(3.2);
      expect(chart.length / L).toBeGreaterThan(1.2);
    }
  });
  it('every instrument in a set owns a share of the notes, and holds appear from set 2 only', () => {
    for (const i of sets) {
      const chart = chartFor(i);
      for (const k of SET_DEFS[i]!.chart.kinds) expect(chart.filter((n) => n.kind === k).length, `set ${i} ${k}`).toBeGreaterThan(2);
      expect(chart.filter((n) => n.len > 0).length > 0).toBe(i >= 1);
      for (const h of chart.filter((n) => n.len > 0)) {
        expect(chart.find((m) => m !== h && m.lane === h.lane && m.t > h.t && m.t < h.t + h.len)).toBeUndefined();
      }
    }
  });
  it('one thumb can play it: simultaneous notes are on neighbouring buttons, never opposite, and holds never cross an opposite press', () => {
    const opp = (a: number, b: number) => (a + 2) % 4 === b;
    for (const i of sets) {
      const chart = chartFor(i);
      const L = loopSeconds(i);
      for (const n of chart) {
        for (const m of chart) {
          if (m === n || !opp(n.lane, m.lane)) continue;
          expect(Math.abs(m.t - n.t), `set ${i}: opposite lanes ${n.lane}/${m.lane} together`).toBeGreaterThan(0.03);
          if (n.len > 0) expect(m.t > n.t && m.t < n.t + n.len, `set ${i}: press on ${m.lane} inside a hold on ${n.lane}`).toBe(false);
        }
      }
      void L;
    }
  });
  it('the five songs really differ in tempo, key, mode and feel', () => {
    const songs = sets.map(songFor);
    expect(new Set(songs.map((s) => s.tempo)).size).toBe(5);
    expect(new Set(songs.map((s) => s.root)).size).toBeGreaterThanOrEqual(4);
    expect(new Set(songs.map((s) => s.scale)).size).toBeGreaterThanOrEqual(4);
    expect(new Set(songs.map((s) => s.meter)).size).toBeGreaterThanOrEqual(2);
    expect(Math.max(...songs.map((s) => s.tempo)) - Math.min(...songs.map((s) => s.tempo))).toBeGreaterThan(40);
    expect(barBeats(3)).toBe(3);
    expect(Math.max(...songs.map((s) => s.tempo))).toBeGreaterThanOrEqual(160); // the frantic jam
  });
  it('the difficulty ramps in small steps: no set asks for much more than the one before, and the second set adds no lane', () => {
    const rate = sets.map((i) => chartFor(i).length / loopSeconds(i));
    const lanes = sets.map((i) => new Set(chartFor(i).map((n) => n.lane)).size);
    expect(lanes[1]).toBe(lanes[0]);
    expect(rate[1]! - rate[0]!).toBeLessThanOrEqual(0.6);
    expect(rate[1]!).toBeLessThanOrEqual(2.1);
    for (let i = 1; i < sets.length; i++) expect(rate[i]! - rate[i - 1]!, `set ${i} vs ${i - 1}`).toBeLessThanOrEqual(0.7);
  });
  it('notes struck together are flagged as a pair (so the screen can tie them), and no other note is', () => {
    const { s } = freshSim(1);
    const ns = s.notes;
    for (const n of ns) expect(n.pair).toBe(ns.some((m) => m !== n && Math.abs(m.t - n.t) < 0.03));
    // later sets do contain doubles
    expect(chartFor(2).some((n) => chartFor(2).some((m) => m !== n && Math.abs(m.t - n.t) < 0.03))).toBe(true);
  });
  it('the sim plays the loop through its repetitions on the song clock', () => {
    const { s } = freshSim(3);
    const pass = chartFor(0);
    expect(s.notes.length).toBe(pass.length * SETS[0]!.reps);
    expect(s.notes[0]!.t).toBeCloseTo(pass[0]!.t, 9);
    expect(s.notes[pass.length]!.t).toBeCloseTo(loopSeconds(0) + pass[0]!.t, 9);
    expect(s.beatDur).toBeCloseTo(60 / songFor(0).tempo, 9);
  });
  it('is the same chart every run (the song decides, not chance)', () => {
    expect(freshSim(1).s.notes.map((n) => n.t)).toEqual(freshSim(99).s.notes.map((n) => n.t));
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
  it('Ink Siphon: eight perfects in a row draw a blot', () => {
    const { s, step } = freshSim();
    s.stickers.push('siphon');
    let guard = 0;
    while (s.ink < 1 && guard++ < 60 * 100 && s.phase === 'play') step(perfectInput(s));
    expect(s.perfects).toBeGreaterThanOrEqual(8);
    expect(s.ink).toBeGreaterThanOrEqual(1);
    expect(s.misses).toBeLessThan(3);
  });
  it('a clean set is tidy: a lost page returns, or a bonus is paid when the book is full', () => {
    const play = (lose: boolean) => {
      const { s, step } = freshSim(7);
      if (lose) s.pages = s.pagesMax - 1;
      let guard = 0;
      while (s.phase === 'play' && guard++ < 60 * 200) step(perfectInput(s));
      return s;
    };
    const full = play(false);
    expect(full.phase).toBe('pick');
    expect(full.tidySets).toBe(1);
    expect(full.lastTidy).toBe('bonus');
    const hurt = play(true);
    expect(hurt.lastTidy).toBe('page');
    expect(hurt.pages).toBe(hurt.pagesMax);
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
    expect(g.metrics.setReached).toBe(5);
    expect(g.metrics.score).toBeGreaterThan(30000);
  });
  it('mashing every lane and stamp-farming both lose the run and score far below the greedy bot', () => {
    expect(run('degenerate-mash').outcome).toBe('failed');
    expect(run('degenerate-stamper').outcome).toBe('failed');
    const g = run('greedy').metrics.score!;
    expect(run('degenerate-mash').metrics.score!).toBeLessThan(g * 0.6);
    expect(run('degenerate-stamper').metrics.score!).toBeLessThan(g * 0.3);
  });
  it('is deterministic for a seed', () => {
    expect(run('greedy', 4).metrics.score).toBe(run('greedy', 4).metrics.score);
  });
});

describe('music and sound', () => {
  it('partsFor keeps the charted instruments on, adds tension with ink, and keeps the harmony for the fever', () => {
    expect(partsFor(0, 0, false)).toEqual(['pad', 'bass', 'drums', 'lead']);
    expect(partsFor(1, 0, false)).toContain('arp');
    expect(partsFor(0, 2, false)).toContain('arp');
    expect(partsFor(0, 3, false)).toContain('riff');
    expect(partsFor(3, 3, false)).not.toContain('harmony');
    expect(partsFor(3, 0, true)).toContain('harmony');
    expect(partsFor(3, 3, true, true)).toEqual(['pad', 'bass']);
  });
  it('every sound is audible and does not clip', () => {
    defineBlotSounds();
    const names = audio.names().filter((n) => /^(kick|snare|bassHit|lead|ok|free|stray|splat|glug|stamp|spill|fever|combo|hold|tick|warn|stick|dry|card)/.test(n));
    expect(names.length).toBeGreaterThan(15);
    for (const n of names) {
      const p = Math.max(...audio.samples(n).map((v) => peakOf(v)));
      expect(p, n).toBeGreaterThan(0.03);
      expect(p, n).toBeLessThanOrEqual(1);
    }
  });
});

describe('clock lock to the audio', () => {
  // the game clock advances 1/60 per frame (times a speed error); each frame the lock compares it with the audio clock
  const simulate = (frames: number, simSpeed: number, jitter: (f: number) => number = () => 0, pauseAt = -1, pauseFrames = 0) => {
    const st = { bigFrames: 0 };
    let audio = 0;
    let game = 0;
    let resyncs = 0;
    let worst = 0;
    for (let f = 0; f < frames; f++) {
      audio += 1 / 60;
      const paused = pauseAt >= 0 && f >= pauseAt && f < pauseAt + pauseFrames;
      if (!paused) game += (1 / 60) * simSpeed;
      if (paused) continue; // the renderer does not lock while the game is paused
      const a = syncStep(audio + jitter(f) - game, st);
      if (a.resync) { game = audio; resyncs++; } else game += a.nudge;
      if (f > 120 && !(pauseAt >= 0 && f < pauseAt + pauseFrames + 20)) worst = Math.max(worst, Math.abs(audio - game));
    }
    return { worst, resyncs };
  };
  it('holds a clock that runs 0.5% slow inside 20 ms over a whole set', () => {
    const r = simulate(60 * 60, 0.995);
    expect(r.worst).toBeLessThan(0.02);
    expect(r.resyncs).toBe(0);
  });
  it('holds through audio-clock jitter without jumping', () => {
    const r = simulate(60 * 30, 1, (f) => Math.sin(f) * 0.02);
    expect(r.worst).toBeLessThan(0.03);
    expect(r.resyncs).toBe(0);
  });
  it('jumps back to the music once after a long pause, not repeatedly', () => {
    const r = simulate(60 * 20, 1, () => 0, 300, 180);
    expect(r.resyncs).toBe(1);
    expect(r.worst).toBeLessThan(0.02);
  });
  it('never moves the clock more than a few milliseconds in a frame', () => {
    expect(Math.abs(syncStep(0.15, { bigFrames: 0 }).nudge)).toBeLessThanOrEqual(0.012);
  });
});

describe('keyboard: arrows strike the lanes', () => {
  const stickInput = (x: number, y: number) => { const i = blankInput(); i.left = { x, y }; return i; };
  const strikes = (kb: boolean, x: number, y: number) => {
    const { sim, s, step } = freshSim();
    sim.setKeyboard(kb);
    for (let i = 0; i < 300; i++) step(); // into the song, nothing struck
    const before = s.freeTaps + s.strays + s.hits;
    step(stickInput(x, y));
    return s.freeTaps + s.strays + s.hits - before;
  };
  it('each arrow is its own lane: up, right, down, left strike one lane each', () => {
    expect(strikes(true, 0, -1)).toBe(1);
    expect(strikes(true, 1, 0)).toBe(1);
    expect(strikes(true, 0, 1)).toBe(1);
    expect(strikes(true, -1, 0)).toBe(1);
  });
  it('two neighbouring arrows strike two lanes (a double); opposite arrows cancel', () => {
    expect(strikes(true, 0.707, -0.707)).toBe(2);
    expect(strikes(true, 0, 0)).toBe(0);
  });
  it('a pad stick still strikes only its dominant lane, so a loose diagonal never makes a double', () => {
    expect(strikes(false, 0.8, -0.6)).toBe(1);
    expect(strikes(false, 0.707, 0.707)).toBe(1);
  });
});
