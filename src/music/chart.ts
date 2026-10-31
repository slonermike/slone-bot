// Derive a playable chart from a song (PURE). Every note the player must hit IS an event in the song: you say which
// instruments become lanes, the builder thins one pass of the loop to a playable density, and `ghostBacking` turns the
// charted notes down so the player's own hits (played as the same sound) are what make them loud. Style-neutral: lanes,
// shares and what counts as an awkward combination are all options.
import type { Inst, Song } from './types.ts';
import { secondsAt } from './timing.ts';

export interface ChartVoice {
  id: string;
  lane: number;
  /** Return the note's pitch (or any id number) if a note of `inst` with MIDI number `n` belongs to this voice, else null. */
  match(inst: Inst, n: number): number | null;
  /** Relative share of the per-second allowance. */
  share: number;
  /** Fewest seconds between two notes of this voice. */
  minGap: number;
  /** Long notes of this voice may become holds. */
  holds?: boolean;
}

export interface ChartOptions {
  voices: ChartVoice[];
  /** Most notes that may start inside any one second (checked in every window, around the loop seam too). */
  maxPerSec: number;
  /** Most notes that may start together. */
  maxSimul: number;
  /** Lanes that cannot be pressed together or held across each other (e.g. opposite face buttons under one thumb). */
  conflict?(a: number, b: number): boolean;
  /** Notes closer than this (seconds) count as together. Default 0.03. */
  together?: number;
}

export interface ChartNote {
  voice: string;
  lane: number;
  /** Seconds from the start of one pass of the loop. */
  t: number;
  /** Hold length in seconds (0 = tap). */
  len: number;
  /** What `match` returned (usually the MIDI pitch). */
  pitch: number;
  /** The song note it came from (for the ghost). */
  src: { inst: Inst; beat: number; n: number };
}

/** Seconds in one pass of the loop. */
export function loopSecondsOf(song: Song): number {
  const last = song.bars[song.bars.length - 1]!;
  return secondsAt(song.tempoMap, last.start + last.beats);
}

interface Cand extends ChartNote { dBeats: number; voiceRef: ChartVoice }

export function chartFromSong(song: Song, opts: ChartOptions): ChartNote[] {
  const L = loopSecondsOf(song);
  const EPS = opts.together ?? 0.03;
  const conflict = opts.conflict ?? (() => false);
  const cands: Cand[] = [];
  for (const tr of song.tracks) {
    for (const note of tr.notes) {
      for (const v of opts.voices) {
        const pitch = v.match(tr.inst, note.n);
        if (pitch === null) continue;
        cands.push({ voice: v.id, lane: v.lane, t: secondsAt(song.tempoMap, note.t), len: 0, pitch, src: { inst: tr.inst, beat: note.t, n: note.n }, dBeats: note.d, voiceRef: v });
        break;
      }
    }
  }
  cands.sort((a, b) => a.t - b.t);
  const dist = (a: number, b: number) => { const d = Math.abs(a - b); return Math.min(d, L - d); };
  const inWindow = (list: Cand[], from: number) => list.filter((k) => (((k.t - from) % L) + L) % L < 1).length;
  const totalShare = opts.voices.reduce((a, v) => a + v.share, 0);
  const taken: Record<string, number> = {};
  const fill = (c: Cand) => (taken[c.voice] ?? 0) / c.voiceRef.share;
  // notes that land together are considered together, least-represented voice first, so no lane is starved by a fixed order
  const clusters: Cand[][] = [];
  for (const c of cands) {
    const last = clusters[clusters.length - 1];
    if (last && c.t - last[0]!.t < EPS) last.push(c); else clusters.push([c]);
  }
  const kept: Cand[] = [];
  const cap = Math.ceil(opts.maxPerSec);
  for (const cluster of clusters) {
    cluster.sort((a, b) => fill(a) - fill(b));
    for (const c of cluster) {
      // each voice has a leaky bucket: allowed only while it is under its share of the per-second allowance
      if ((taken[c.voice] ?? 0) >= (c.voiceRef.share / totalShare) * opts.maxPerSec * c.t + 2) continue;
      let ok = true;
      let simul = 0;
      for (const k of kept) {
        const d = dist(k.t, c.t);
        if (d < EPS) { if (k.lane === c.lane || conflict(k.lane, c.lane)) { ok = false; break; } simul++; }
        else if (k.lane === c.lane && d < c.voiceRef.minGap) { ok = false; break; }
      }
      if (!ok || simul + 1 > opts.maxSimul) continue;
      const trial = [...kept, c];
      if (trial.some((k) => inWindow(trial, k.t) > cap) || inWindow(trial, c.t - 0.999) > cap) continue;
      kept.push(c);
      taken[c.voice] = (taken[c.voice] ?? 0) + 1;
    }
  }
  kept.sort((a, b) => a.t - b.t || a.lane - b.lane);
  // holds: a long note, or a note with a clear gap after it, is held (every other eligible one) while its lane and every conflicting lane stay free
  let k = 0;
  for (const n of kept) {
    if (!n.voiceRef.holds) continue;
    const next = kept.find((m) => m !== n && m.lane === n.lane && m.t > n.t);
    const blocker = kept.find((m) => conflict(m.lane, n.lane) && m.t > n.t && m.t < n.t + 2.2);
    const limit = Math.min(next ? next.t : n.t + L, blocker ? blocker.t : Infinity);
    const room = limit - n.t - n.voiceRef.minGap - 0.1;
    const natural = secondsAt(song.tempoMap, n.src.beat + n.dBeats) - n.t - 0.08;
    const want = Math.max(natural, Math.min(room, 1.3));
    if (want < 0.45 || room < 0.45) continue;
    if (k++ % 2 === 0) n.len = Math.min(want, room, 2);
  }
  return kept.map(({ dBeats: _d, voiceRef: _v, ...n }) => n);
}

/** The song with every charted note turned down to a quiet ghost, so a miss is an audible hole and a hit completes the music. */
export function ghostBacking(song: Song, chart: ChartNote[], ghost = 0.28): Song {
  const key = (inst: string, beat: number, n: number) => `${inst}|${beat.toFixed(4)}|${n}`;
  const hit = new Set(chart.map((c) => key(c.src.inst, c.src.beat, c.src.n)));
  return {
    ...song,
    tracks: song.tracks.map((tr) => ({
      ...tr,
      notes: tr.notes.map((n) => (hit.has(key(tr.inst, n.t, n.n)) ? { ...n, v: Math.max(1, Math.round(n.v * ghost)) } : n)),
    })),
  };
}
