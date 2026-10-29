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
const chunk = (type: string, body: number[]): number[] => [...ascii(type), ...u32(body.length), ...body];
const metaBytes = (type: number, data: number[]): number[] => [0xff, type, ...vlq(data.length), ...data];

interface Ev {
  at: number;
  bytes: number[];
}

/** Write events with delta times; the track ends at `endAt` (or after the last event, whichever is later). */
function track(events: Ev[], endAt: number): number[] {
  events.sort((a, b) => a.at - b.at || ((a.bytes[0]! & 0xf0) === 0x80 ? -1 : 0) - ((b.bytes[0]! & 0xf0) === 0x80 ? -1 : 0));
  const body: number[] = [];
  let last = 0;
  for (const e of events) {
    body.push(...vlq(e.at - last), ...e.bytes);
    last = e.at;
  }
  body.push(...vlq(Math.max(0, endAt - last)), ...metaBytes(0x2f, []));
  return body;
}

/** Tempo events (a ramp becomes a tempo change every beat) as microseconds per quarter note. */
function tempoEvents(song: Song, endBeat: number): Ev[] {
  const out: Ev[] = [];
  const map = song.tempoMap;
  const usq = (bpm: number) => Math.round(60_000_000 / bpm);
  const put = (beat: number, bpm: number) => {
    const us = usq(bpm);
    out.push({ at: Math.round(beat * PPQ), bytes: metaBytes(0x51, [(us >>> 16) & 255, (us >>> 8) & 255, us & 255]) });
  };
  map.forEach((p, i) => {
    const next = map[i + 1];
    put(p.beat, p.bpm);
    if (p.ramp && next && next.bpm !== p.bpm) {
      for (let b = Math.ceil(p.beat + 1e-9); b < next.beat; b++) put(b, p.bpm + ((next.bpm - p.bpm) * (b - p.beat)) / (next.beat - p.beat));
    }
  });
  void endBeat;
  return out;
}

/** Standard MIDI file, format 1: a conductor track (name, tempo changes, time signatures), then one track per part (drums on channel 10). */
export function writeMidi(song: Song): Uint8Array {
  const last = song.bars[song.bars.length - 1]!;
  const barsEnd = last.start + last.beats;
  const conductor: Ev[] = [{ at: 0, bytes: metaBytes(0x03, ascii(song.name)) }, ...tempoEvents(song, barsEnd)];
  let prev = '';
  for (const b of song.bars) {
    const name = `${b.num}/${b.den}`;
    if (name !== prev) conductor.push({ at: Math.round(b.start * PPQ), bytes: metaBytes(0x58, [b.num, Math.log2(b.den), 24, 8]) });
    prev = name;
  }
  const chunks = [chunk('MTrk', track(conductor, Math.round(barsEnd * PPQ)))];
  let channel = 0;
  for (const tr of song.tracks) {
    const ch = tr.inst === 'drums' ? 9 : channel++ % 9;
    const events: Ev[] = [{ at: 0, bytes: metaBytes(0x03, ascii(`${tr.inst}-${tr.voice}`)) }];
    if (tr.inst !== 'drums') events.push({ at: 0, bytes: [0xc0 | ch, PROGRAM[tr.voice] ?? 0] });
    let end = Math.round(barsEnd * PPQ);
    for (const n of tr.notes) {
      const on = Math.round(n.t * PPQ);
      const off = Math.max(on + 1, Math.round((n.t + n.d) * PPQ));
      end = Math.max(end, off);
      events.push({ at: on, bytes: [0x90 | ch, n.n & 127, Math.max(1, Math.min(127, Math.round(n.v)))] });
      events.push({ at: off, bytes: [0x80 | ch, n.n & 127, 0] });
    }
    chunks.push(chunk('MTrk', track(events, end)));
  }
  return Uint8Array.from([...chunk('MThd', [...u16(1), ...u16(chunks.length), ...u16(PPQ)]), ...chunks.flat()]);
}
