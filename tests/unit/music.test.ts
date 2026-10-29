import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { Rng, hashSeed } from '../../src/core/rng.ts';
import { BATCH_2 } from '../../src/music/briefs.ts';
import { composeSong, LAYOUTS, songSeconds } from '../../src/music/compose.ts';
import { beatsOf, eighthsOf, meterSpec } from '../../src/music/meter.ts';
import { writeMidi } from '../../src/music/midi.ts';
import { beatAt, secondsAt } from '../../src/music/timing.ts';
import type { Song, TempoPoint } from '../../src/music/types.ts';
import { pickForVibe, vibeOf } from '../../src/music/vibe.ts';

const songs: Song[] = BATCH_2.map((b, i) => composeSong({ ...b, seed: hashSeed(`b02:${i}`), batch: 'b02', index: i + 1 }));
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

  it('every layout makes a valid song in loop and one-shot form', () => {
    for (const layout of Object.keys(LAYOUTS)) {
      const form = layout.startsWith('loop') ? 'loop' : 'oneshot';
      const s = composeSong({ ...base, seed: 3, form, layout, mode: 'dorian', bpm: 110 });
      expect(s.sections.reduce((a, x) => a + x.bars, 0)).toBe(s.bars.length);
    }
  });

  for (const s of songs) {
    describe(s.id, () => {
      it('has consistent bars and sections of whole phrases', () => {
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
          expect([2, 4, 8]).toContain(sec.bars);
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
        expect(s.hookBars.length).toBeGreaterThanOrEqual(2);
        if (s.character !== 'hook') return;
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

      it('ends sections with a drum fill and a form-appropriate ending', () => {
        const drums = s.tracks.find((t) => t.inst === 'drums');
        const last = s.bars.at(-1)!;
        if (s.form === 'loop') {
          if (drums) expect(drums.notes.some((n) => n.n === 38 && n.t >= last.start)).toBe(true);
          expect(s.tempoMap).toHaveLength(1);
        } else {
          const ends = s.tempoMap.at(-1)!;
          if (s.id.includes('last-light')) {
            expect(s.tracks.every((t) => t.notes.filter((n) => n.t >= last.start).every((n) => n.v < 40))).toBe(true);
            expect(drums).toBeUndefined();
          }
          else {
            expect(drums?.notes.some((n) => n.n === 49 && n.t >= last.start)).toBe(true);
            expect(ends.bpm).toBeLessThan(s.tempo);
          }
        }
      });
    });
  }
});

describe('the first batch', () => {
  it('is 20 songs with tweet-length descriptions and unique ids', () => {
    expect(songs).toHaveLength(20);
    for (const s of songs) expect(s.description.length).toBeGreaterThan(60);
    for (const s of songs) expect(s.description.length).toBeLessThanOrEqual(280);
    expect(new Set(songs.map((s) => s.id)).size).toBe(20);
  });
  it('mixes loops and one-shots, hook songs and vibe pieces, at every tempo', () => {
    expect(songs.filter((s) => s.form === 'loop').length).toBeGreaterThanOrEqual(8);
    expect(songs.filter((s) => s.form === 'oneshot').length).toBeGreaterThanOrEqual(5);
    expect(songs.filter((s) => s.character === 'hook').length).toBeGreaterThanOrEqual(8);
    expect(songs.filter((s) => s.character === 'vibe').length).toBeGreaterThanOrEqual(4);
    expect(songs.some((s) => s.character === 'vibe' && s.tempo >= 150)).toBe(true); // frantic is a vibe
    expect(songs.some((s) => s.character === 'hook' && s.tempo <= 105)).toBe(true);
  });
  it('covers many modes and time signatures, including meters that change', () => {
    expect(new Set(songs.map((s) => s.scale)).size).toBeGreaterThanOrEqual(6);
    const meters = new Set(songs.flatMap((s) => s.bars.map((b) => `${b.num}/${b.den}`)));
    for (const m of ['4/4', '2/4', '3/4', '6/8', '7/8', '5/4', '9/8', '12/8']) expect(meters.has(m)).toBe(true);
    expect(songs.filter((s) => s.meter.includes('+')).length).toBeGreaterThanOrEqual(2);
    const cycle = songs.find((s) => s.id.includes('last-throne'))!;
    expect(cycle.bars.slice(0, 4).map((b) => b.beats)).toEqual([4, 4, 4, 3]);
  });
  it('one-shots change tempo and key', () => {
    const shots = songs.filter((s) => s.form === 'oneshot');
    // the fading ballad deliberately keeps its tempo
    expect(shots.filter((s) => !s.id.includes('last-light')).every((s) => s.tempoMap.length > 1)).toBe(true);
    expect(shots.some((s) => s.sections.some((x) => x.transpose > 0))).toBe(true);
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
      expect(songSeconds(s)).toBeGreaterThan(8);
    }
  });
});
