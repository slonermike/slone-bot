import { BEATS_PER_BAR } from './types.ts';
import type { Song } from './types.ts';

const PPQ = 480;
/** General MIDI programs, picked to sound closest to our synth voices on a stock soundfont. */
const PROGRAM: Record<string, number> = {
  square: 80, saw: 81, pluck: 45, bell: 9, flute: 73, sub: 38, warm: 89,
};

const vlq = (n: number): number[] => {
  const out = [n & 0x7f];
  while ((n >>= 7)) out.unshift((n & 0x7f) | 0x80);
  return out;
};
const u32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const u16 = (n: number) => [(n >>> 8) & 255, n & 255];
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0) & 127);

function chunk(type: string, body: number[]): number[] {
  return [...ascii(type), ...u32(body.length), ...body];
}

function meta(delta: number, type: number, data: number[]): number[] {
  return [...vlq(delta), 0xff, type, ...vlq(data.length), ...data];
}

/** Standard MIDI file, format 1: a tempo track, then one track per part (drums on channel 10). */
export function writeMidi(song: Song): Uint8Array {
  const tempoTrack = [
    ...meta(0, 0x03, ascii(song.name)),
    ...meta(0, 0x51, [(Math.round(60_000_000 / song.tempo) >>> 16) & 255, (Math.round(60_000_000 / song.tempo) >>> 8) & 255, Math.round(60_000_000 / song.tempo) & 255]),
    ...meta(0, 0x58, [BEATS_PER_BAR, 2, 24, 8]),
    ...meta(Math.round(song.bars * BEATS_PER_BAR * PPQ), 0x2f, []),
  ];
  const chunks = [chunk('MTrk', tempoTrack)];
  let channel = 0;
  for (const tr of song.tracks) {
    const ch = tr.inst === 'drums' ? 9 : channel++ % 9;
    const events: { at: number; bytes: number[] }[] = [];
    if (tr.inst !== 'drums') events.push({ at: 0, bytes: [0xc0 | ch, PROGRAM[tr.voice] ?? 0] });
    for (const n of tr.notes) {
      const on = Math.round(n.t * PPQ);
      const off = Math.max(on + 1, Math.round((n.t + n.d) * PPQ));
      events.push({ at: on, bytes: [0x90 | ch, n.n & 127, Math.max(1, Math.min(127, Math.round(n.v)))] });
      events.push({ at: off, bytes: [0x80 | ch, n.n & 127, 0] });
    }
    // note-offs before note-ons at the same tick so repeated notes retrigger cleanly
    events.sort((a, b) => a.at - b.at || ((a.bytes[0]! & 0xf0) === 0x80 ? -1 : 1));
    const body: number[] = [...meta(0, 0x03, ascii(`${tr.inst}-${tr.voice}`))];
    let last = 0;
    for (const e of events) {
      body.push(...vlq(e.at - last), ...e.bytes);
      last = e.at;
    }
    body.push(...meta(Math.max(0, Math.round(song.bars * BEATS_PER_BAR * PPQ) - last), 0x2f, []));
    chunks.push(chunk('MTrk', body));
  }
  return Uint8Array.from([...chunk('MThd', [...u16(1), ...u16(chunks.length), ...u16(PPQ)]), ...chunks.flat()]);
}

