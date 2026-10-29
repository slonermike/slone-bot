import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildDemoMusic, partsFor } from '../../src/protos/_demo/music.ts';
import { Rng } from '../../src/core/rng.ts';
import { composeBatch } from '../../src/music/batches.ts';
import { checkBatch } from '../../src/music/coverage.ts';
import { composeSong, LAYOUTS, songSeconds } from '../../src/music/compose.ts';
import { beatsOf, eighthsOf, meterSpec } from '../../src/music/meter.ts';
import { writeMidi } from '../../src/music/midi.ts';
import { beatAt, secondsAt } from '../../src/music/timing.ts';
import type { Song, TempoPoint } from '../../src/music/types.ts';
import { pickForVibe, vibeOf } from '../../src/music/vibe.ts';

const songs: Song[] = composeBatch('b02');
const base = { name: 'T', description: 'x', style: 's', mood: 'm' };

describe('meters', () => {
  it('group sizes add up to the bar', () => {
    for (const [name, eighths] of [['4/4', 8], ['3/4', 6], ['6/8', 6], ['7/8', 7], ['5/4', 10], ['9/8', 9], ['12/8', 12], ['2/4', 4]] as const) {
      expect(eighthsOf(meterSpec(name))).toBe(eighths);
      expect(beatsOf(meterSpec(name))).toBe(eighths / 2);
    }
  });
});

describe('tempo map', () => {
  const steady: TempoPoint[] = [{ beat: 0, bpm: 120 }];
  const ramp: TempoPoint[] = [{ beat: 0, bpm: 100 }, { beat: 8, bpm: 100, ramp: true }, { beat: 16, bpm: 50 }];
  it('constant tempo is beats times 60/bpm', () => {
    expect(secondsAt(steady, 8)).toBeCloseTo(4, 6);
    expect(beatAt(steady, 4)).toBeCloseTo(8, 6);
  });
  it('a ramp matches numeric integration and inverts cleanly', () => {
    let t = 0;
    const n = 100000;
    for (let i = 0; i < n; i++) {
      const x = 8 + ((i + 0.5) * 8) / n;
      t += (60 / (100 + (50 - 100) * ((x - 8) / 8))) * (8 / n);
    }
    expect(secondsAt(ramp, 16) - secondsAt(ramp, 8)).toBeCloseTo(t, 3);
    for (const beat of [0, 3, 8, 11.5, 16, 20]) expect(beatAt(ramp, secondsAt(ramp, beat))).toBeCloseTo(beat, 5);
  });
});

describe('vibe formula', () => {
  it('brighter modes are happier, faster is more energetic, odd meters are quirkier', () => {
    const v = (mode: string, bpm: number, meter = '4/4') => vibeOf({ mode, meters: [meter], bpm });
    expect(v('lydian', 100).valence).toBeGreaterThan(v('phrygian', 100).valence);
    expect(v('major', 170).energy).toBeGreaterThan(v('major', 70).energy);
    expect(v('minor', 100, '7/8').quirk).toBeGreaterThan(v('minor', 100, '4/4').quirk);
    expect(v('minor', 100, '6/8').lilt).toBeGreaterThan(v('minor', 100, '4/4').lilt);
    expect(vibeOf({ mode: 'minor', meters: ['4/4', '3/4'], bpm: 100 }).quirk).toBeGreaterThan(v('minor', 100).quirk);
  });
  it('the inverse finds parameters near the target', () => {
    const p = pickForVibe({ valence: 0.85, energy: 0.9 }, new Rng(1), { meters: ['4/4'] });
    expect(p.vibe.valence).toBeGreaterThan(0.7);
    expect(p.vibe.energy).toBeGreaterThan(0.75);
  });
});

describe('composer structure', () => {
  it('is deterministic for a seed', () => {
    const o = { ...base, seed: 9, form: 'loop' as const, layout: 'loop-8', mode: 'minor', bpm: 120 };
    expect(composeSong(o)).toEqual(composeSong(o));
    expect(composeSong(o)).not.toEqual(composeSong({ ...o, seed: 10 }));
  });

  it('every layout makes a valid loop', () => {
    for (const layout of Object.keys(LAYOUTS)) {
      const s = composeSong({ ...base, seed: 3, form: 'loop', layout, mode: 'dorian', bpm: 110 });
      expect(s.sections.reduce((a, x) => a + x.bars, 0)).toBe(s.bars.length);
    }
  });

  it('every stinger event makes a short, valid one-shot', () => {
    for (const event of ['win', 'lose', 'boss', 'powerup', 'secret'] as const) {
      const s = composeSong({ ...base, seed: 4, form: 'oneshot', event });
      expect(s.form).toBe('oneshot');
      expect(s.bars.length).toBeGreaterThanOrEqual(2);
      expect(s.bars.length).toBeLessThanOrEqual(4);
      expect(s.tempoMap.length).toBeGreaterThan(1);
    }
  });

  for (const s of songs) {
    describe(s.id, () => {
      it('has consistent bars and sections', () => {
        let at = 0;
        s.bars.forEach((b, i) => {
          expect(b.start).toBeCloseTo(at, 6);
          expect(b.beats).toBeCloseTo((b.num * 4) / b.den, 6);
          at += b.beats;
          expect(i).toBeGreaterThanOrEqual(0);
        });
        let bar = 0;
        for (const sec of s.sections) {
          expect(sec.startBar).toBe(bar);
          expect(s.form === 'loop' ? [2, 4, 8] : [2, 3, 4]).toContain(sec.bars);
          bar += sec.bars;
        }
        expect(bar).toBe(s.bars.length);
      });

      it('keeps every note legal and inside the song (a one-shot may ring past the end)', () => {
        const last = s.bars.at(-1)!;
        const end = last.start + last.beats;
        for (const tr of s.tracks) {
          expect(tr.notes.length).toBeGreaterThan(0);
          for (const n of tr.notes) {
            expect(n.t).toBeGreaterThanOrEqual(0);
            expect(n.t).toBeLessThan(end);
            expect(n.d).toBeGreaterThan(0);
            expect(n.n).toBeGreaterThanOrEqual(0);
            expect(n.n).toBeLessThanOrEqual(127);
            expect(n.v).toBeGreaterThan(0);
            expect(n.v).toBeLessThanOrEqual(127);
            if (s.form === 'loop') expect(n.t + n.d).toBeLessThanOrEqual(end + 1.01);
          }
        }
      });

      it('states a hook, and a hook song repeats it exactly with only the ending changing', () => {
        expect(s.hookBars.length).toBeGreaterThanOrEqual(s.form === 'loop' ? 2 : 1);
        if (s.character !== 'hook' || s.form !== 'loop') return;
        const lead = s.tracks.find((t) => t.inst === 'lead')!;
        const rel = (g: number) => {
          const b = s.bars[g]!;
          return lead.notes.filter((n) => n.t >= b.start && n.t < b.start + b.beats).map((n) => `${(n.t - b.start).toFixed(2)}:${n.n}`);
        };
        const sec = (g: number) => s.sections.find((x) => g >= x.startBar && g < x.startBar + x.bars)!;
        let identical = 0;
        for (let i = 0; i < s.hookBars.length; i++) {
          for (let j = i + 1; j < s.hookBars.length; j++) {
            const a = s.hookBars[i]!;
            const b = s.hookBars[j]!;
            if (sec(a) !== sec(b) || sec(a).kind === 'intro') continue;
            const ra = rel(a);
            const rb = rel(b);
            if (ra.length > 1 && ra.slice(0, -1).join() === rb.slice(0, -1).join()) identical++;
          }
        }
        expect(identical).toBeGreaterThanOrEqual(1);
      });

      it('loops end sections with a fill and keep tempo; stingers punctuate and move tempo', () => {
        const drums = s.tracks.find((t) => t.inst === 'drums');
        const last = s.bars.at(-1)!;
        if (s.form === 'loop') {
          if (drums) expect(drums.notes.some((n) => n.n === 38 && n.t >= last.start)).toBe(true);
          expect(s.tempoMap).toHaveLength(1);
        } else {
          const first = s.tempoMap[0]!.bpm;
          const final = s.tempoMap.at(-1)!.bpm;
          if (s.id.includes('power-up')) expect(final).toBeGreaterThan(first);
          else expect(final).toBeLessThan(first);
          if (s.id.includes('level-clear') || s.id.includes('boss-down')) expect(drums?.notes.some((n) => n.n === 49 && n.t >= last.start)).toBe(true);
          expect(songSeconds(s)).toBeLessThanOrEqual(14);
        }
      });
    });
  }
});

describe('the first batch', () => {
  const loops = songs.filter((s) => s.form === 'loop');
  const stingers = songs.filter((s) => s.form === 'oneshot');
  it('is 20 pieces with tweet-length descriptions and unique ids', () => {
    expect(songs).toHaveLength(20);
    for (const s of songs) expect(s.description.length).toBeGreaterThan(60);
    for (const s of songs) expect(s.description.length).toBeLessThanOrEqual(280);
    expect(new Set(songs.map((s) => s.id)).size).toBe(20);
  });
  it('is mostly loops, with a few stingers of a couple of bars for events', () => {
    expect(loops.length).toBeGreaterThanOrEqual(12);
    expect(stingers.length).toBeGreaterThanOrEqual(4);
    for (const s of stingers) {
      expect(s.bars.length).toBeLessThanOrEqual(4);
      expect(songSeconds(s)).toBeLessThanOrEqual(14);
    }
    for (const s of loops) expect(s.bars.length).toBeGreaterThanOrEqual(8);
  });
  it('mixes hook songs and vibe pieces at every tempo', () => {
    expect(loops.filter((s) => s.character === 'hook').length).toBeGreaterThanOrEqual(6);
    expect(loops.filter((s) => s.character === 'vibe').length).toBeGreaterThanOrEqual(4);
    expect(loops.some((s) => s.character === 'vibe' && s.tempo >= 150)).toBe(true); // frantic is a vibe
    expect(loops.some((s) => s.character === 'hook' && s.tempo <= 105)).toBe(true);
  });
  it('covers many modes and time signatures, including meters that change', () => {
    expect(new Set(songs.map((s) => s.scale)).size).toBeGreaterThanOrEqual(6);
    const meters = new Set(songs.flatMap((s) => s.bars.map((b) => `${b.num}/${b.den}`)));
    for (const m of ['4/4', '2/4', '3/4', '6/8', '7/8', '5/4', '9/8', '12/8']) expect(meters.has(m)).toBe(true);
    expect(songs.filter((s) => s.meter.includes('+')).length).toBeGreaterThanOrEqual(2);
    const cycle = songs.find((s) => s.id.includes('last-throne'))!;
    expect(cycle.bars.slice(0, 4).map((b) => b.beats)).toEqual([4, 4, 4, 3]);
  });
});

describe('midi writer', () => {
  const song = songs.find((s) => s.id.includes('last-throne'))!;
  const bytes = writeMidi(song);
  const ascii = (a: number, n: number) => String.fromCharCode(...bytes.slice(a, a + n));
  const find = (type: number) => {
    const at: number[] = [];
    for (let k = 0; k < bytes.length - 2; k++) if (bytes[k] === 0xff && bytes[k + 1] === type) at.push(k);
    return at;
  };

  it('writes a format-1 file with a conductor track and one track per part', () => {
    expect(ascii(0, 4)).toBe('MThd');
    expect((bytes[8]! << 8) | bytes[9]!).toBe(1);
    expect((bytes[10]! << 8) | bytes[11]!).toBe(song.tracks.length + 1);
  });

  it('every chunk length matches', () => {
    let at = 14;
    while (at < bytes.length) {
      expect(ascii(at, 4)).toBe('MTrk');
      at += 8 + ((bytes[at + 4]! << 24) | (bytes[at + 5]! << 16) | (bytes[at + 6]! << 8) | bytes[at + 7]!);
    }
    expect(at).toBe(bytes.length);
  });

  it('a stinger writes its tempo ramp as tempo changes', () => {
    const st = songs.find((x) => x.id.includes('game-over'))!;
    const b = writeMidi(st);
    let n = 0;
    for (let k = 0; k < b.length - 2; k++) if (b[k] === 0xff && b[k + 1] === 0x51) n++;
    expect(n).toBeGreaterThan(2);
  });

  it('writes a time signature at every meter change and tempo changes for the tempo map', () => {
    const changes = song.bars.filter((b, i) => i === 0 || `${b.num}/${b.den}` !== `${song.bars[i - 1]!.num}/${song.bars[i - 1]!.den}`).length;
    expect(find(0x58).length).toBe(changes);
    expect(find(0x51).length).toBeGreaterThanOrEqual(song.tempoMap.length);
  });
});

describe('generated songs on disk', () => {
  const dir = path.join(path.resolve(import.meta.dirname, '../..'), 'music', 'songs');
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.startsWith('b02-') && f.endsWith('.json')) : [];
  it('matches what the briefs generate, with a midi twin', () => {
    expect(files).toHaveLength(20);
    for (const f of files) {
      const s = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as Song;
      expect(songs.some((x) => x.id === s.id)).toBe(true);
      expect(fs.existsSync(path.join(dir, `${s.id}.mid`))).toBe(true);
      expect(songSeconds(s)).toBeGreaterThan(1);
    }
  });
});

describe('batch quality gate', () => {
  it('the first batch passes with no problems or warnings', () => {
    const c = checkBatch(songs);
    expect(c.problems).toEqual([]);
    expect(c.warnings).toEqual([]);
  });
  it('flags duplicate names, copied descriptions, bad lengths and lopsided batches', () => {
    const a = songs[0]!;
    const dup = { ...songs[1]!, name: a.name, description: a.description };
    const longLoop = { ...songs[2]!, description: 'x'.repeat(300) };
    const c = checkBatch([a, dup, longLoop]);
    expect(c.problems.join('|')).toMatch(/duplicate name/);
    expect(c.problems.join('|')).toMatch(/copied/);
    expect(c.problems.join('|')).toMatch(/300 characters/);
    const lopsided = checkBatch(Array.from({ length: 12 }, (_, i) => ({ ...songs[0]!, id: `x-${i}`, name: `n${i}`, description: `d${i} `.repeat(20) })));
    expect(lopsided.warnings.length).toBeGreaterThan(2);
  });
});

describe('the demo game music', () => {
  const m = buildDemoMusic();
  it('is a hook loop with every part, and two stingers in the same key', () => {
    expect(m.loop.form).toBe('loop');
    for (const inst of ['pad', 'bass', 'drums', 'arp', 'lead', 'harmony']) expect(m.loop.tracks.some((t) => t.inst === inst)).toBe(true);
    expect(m.loop.hookBars.length).toBeGreaterThanOrEqual(2);
    for (const st of [m.powerup, m.lose]) {
      expect(st.form).toBe('oneshot');
      expect(st.bars.length).toBeLessThanOrEqual(4);
      expect(st.root).toBe(m.loop.root);
      expect(st.scale).toBe(m.loop.scale);
    }
  });
  it('is deterministic', () => {
    expect(buildDemoMusic()).toEqual(m);
  });
  it('brings parts in with pressure and earns the hook with the surge', () => {
    expect(partsFor(1, false)).toEqual(['pad', 'bass']);
    expect(partsFor(2, false)).toContain('drums');
    expect(partsFor(3, false)).toContain('arp');
    expect(partsFor(3, false)).not.toContain('lead');
    expect(partsFor(1, true)).toEqual(expect.arrayContaining(['lead', 'harmony']));
    expect(partsFor(4, true).length).toBeGreaterThan(partsFor(1, true).length);
  });
});
