import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { BATCH_1 } from '../../src/music/briefs.ts';
import { composeSong, MOODS, songSeconds } from '../../src/music/compose.ts';
import { writeMidi } from '../../src/music/midi.ts';
import { BEATS_PER_BAR } from '../../src/music/types.ts';
import type { Song } from '../../src/music/types.ts';

describe('music composer', () => {
  it('is deterministic for a seed', () => {
    expect(composeSong({ seed: 42, mood: 'tense' })).toEqual(composeSong({ seed: 42, mood: 'tense' }));
    expect(composeSong({ seed: 42, mood: 'tense' })).not.toEqual(composeSong({ seed: 43, mood: 'tense' }));
  });

  it('every mood makes a playable song: notes inside the loop, MIDI range, a bass and drums or lead', () => {
    for (const mood of Object.keys(MOODS)) {
      for (let seed = 1; seed <= 6; seed++) {
        const s = composeSong({ seed, mood });
        const end = s.bars * BEATS_PER_BAR;
        expect(s.tracks.length).toBeGreaterThan(2);
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
          }
        }
      }
    }
  });

  it('the first batch is 20 songs with tweet-length descriptions, varied tempo and mode', () => {
    expect(BATCH_1).toHaveLength(20);
    const songs = BATCH_1.map((b, i) => composeSong({ ...b, seed: i + 1, batch: 'b01', index: i + 1 }));
    for (const s of songs) {
      expect(s.description.length).toBeGreaterThan(40);
      expect(s.description.length).toBeLessThanOrEqual(280);
    }
    expect(new Set(songs.map((s) => s.scale)).size).toBeGreaterThanOrEqual(6);
    expect(Math.min(...songs.map((s) => s.tempo))).toBeLessThan(70);
    expect(Math.max(...songs.map((s) => s.tempo))).toBeGreaterThan(165);
    expect(new Set(songs.map((s) => s.id)).size).toBe(20);
  });
});

describe('midi writer', () => {
  const song = composeSong({ seed: 7, mood: 'playful' });
  const bytes = writeMidi(song);
  const ascii = (a: number, n: number) => String.fromCharCode(...bytes.slice(a, a + n));

  it('writes a format-1 file with a tempo track and one track per part', () => {
    expect(ascii(0, 4)).toBe('MThd');
    expect((bytes[8]! << 8) | bytes[9]!).toBe(1);
    expect((bytes[10]! << 8) | bytes[11]!).toBe(song.tracks.length + 1);
    expect((bytes[12]! << 8) | bytes[13]!).toBe(480);
  });

  it('every chunk length matches and the file ends cleanly', () => {
    let at = 14;
    let chunks = 0;
    while (at < bytes.length) {
      expect(ascii(at, 4)).toBe('MTrk');
      const len = (bytes[at + 4]! << 24) | (bytes[at + 5]! << 16) | (bytes[at + 6]! << 8) | bytes[at + 7]!;
      at += 8 + len;
      chunks++;
    }
    expect(at).toBe(bytes.length);
    expect(chunks).toBe(song.tracks.length + 1);
  });

  it('puts the tempo in microseconds per beat', () => {
    const i = bytes.findIndex((b, k) => b === 0xff && bytes[k + 1] === 0x51);
    const us = (bytes[i + 3]! << 16) | (bytes[i + 4]! << 8) | bytes[i + 5]!;
    expect(us).toBe(Math.round(60_000_000 / song.tempo));
  });
});

describe('generated songs on disk', () => {
  const dir = path.join(path.resolve(import.meta.dirname, '../..'), 'music', 'songs');
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.json')) : [];
  it('each song file is valid, has a midi twin, and a description of at most 280 chars', () => {
    for (const f of files) {
      const s = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as Song;
      expect(`${s.id}.json`).toBe(f);
      expect(fs.existsSync(path.join(dir, `${s.id}.mid`))).toBe(true);
      expect(s.description.length).toBeLessThanOrEqual(280);
      expect(songSeconds(s)).toBeGreaterThan(5);
    }
  });
});
