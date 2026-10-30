// Chart from a song (PURE). Every note the player must hit IS an event in the song: kick, snare, bass and melody each
// own a lane. The song is thinned to a playable density (max two at once, a minimum gap per lane, a cap per second,
// lowest priority dropped first), and the quiet "ghost" backing keeps the thinned-out notes so the music stays whole.
import type { Song } from '../../music/types.ts';
import { secondsAt } from '../../music/timing.ts';

export type Kind = 'snare' | 'lead' | 'kick' | 'bass';
/** Lane 0 north (Y), 1 east (B), 2 south (A), 3 west (X). */
export const KIND_LANE: Record<Kind, number> = { snare: 0, lead: 1, kick: 2, bass: 3 };
export const LANE_KIND: Kind[] = ['snare', 'lead', 'kick', 'bass'];
/** One thumb on the face buttons: neighbours (A+B, A+X) can be pressed together, opposite buttons (A+Y, B+X) cannot. */
export const opposite = (a: number, b: number) => (a + 2) % 4 === b;
export const LANE_LABEL = ['SNARE', 'MELODY', 'KICK', 'BASS'] as const;

export interface ChartCfg {
  kinds: Kind[];
  holds: boolean;
  /** Most notes allowed to start inside any one second. */
  maxPerSec: number;
  /** Fewest seconds between two notes in one lane, by kind. */
  minGap: Record<Kind, number>;
  /** Most notes that may start together. */
  maxSimul: number;
}

export interface SongNote {
  kind: Kind;
  lane: number;
  /** Seconds from the start of one pass of the loop. */
  t: number;
  /** Hold length in seconds (0 = tap). */
  len: number;
  /** MIDI pitch of the song's own note (drums: 36 or 38). */
  midi: number;
  /** Where it came from, so the backing can ghost it. */
  inst: string;
  beat: number;
}

// the beat comes first, then the hook, then the bass
const PRIORITY: Record<Kind, number> = { kick: 4, snare: 4, lead: 3, bass: 2 };
const EPS = 0.03;
/** How the per-second allowance is shared between the instruments in the chart. */
const SHARE: Record<Kind, number> = { lead: 0.4, kick: 0.25, snare: 0.2, bass: 0.15 };

interface Cand extends SongNote { dBeats: number }

function candidates(song: Song, kinds: Kind[]): Cand[] {
  const out: Cand[] = [];
  const add = (kind: Kind, inst: string, beat: number, d: number, midi: number) => {
    if (!kinds.includes(kind)) return;
    out.push({ kind, lane: KIND_LANE[kind], t: secondsAt(song.tempoMap, beat), len: 0, midi, inst, beat, dBeats: d });
  };
  for (const tr of song.tracks) {
    for (const n of tr.notes) {
      if (tr.inst === 'drums') {
        if (n.n === 36) add('kick', 'drums', n.t, n.d, 36);
        else if (n.n === 38 || n.n === 37) add('snare', 'drums', n.t, n.d, 38);
      } else if (tr.inst === 'bass') add('bass', 'bass', n.t, n.d, n.n);
      else if (tr.inst === 'lead') add('lead', 'lead', n.t, n.d, n.n);
    }
  }
  return out;
}

/** Playable chart for one pass of the loop (repeat it for each repetition). `loopSeconds` makes the checks wrap around. */
export function chartFromSong(song: Song, cfg: ChartCfg, loopSeconds: number): SongNote[] {
  const cands = candidates(song, cfg.kinds);
  // time order, so the allowance is spread over the whole loop and across instruments; priority only breaks ties
  cands.sort((a, b) => a.t - b.t || PRIORITY[b.kind] - PRIORITY[a.kind]);
  const kept: Cand[] = [];
  const dist = (a: number, b: number) => { const d = Math.abs(a - b); return Math.min(d, loopSeconds - d); };
  /** Notes starting in the one-second window that begins at `from` (wraps around the loop). */
  const inWindow = (list: Cand[], from: number) => list.filter((k) => ((k.t - from) % loopSeconds + loopSeconds) % loopSeconds < 1).length;
  // each instrument has its own leaky bucket: a note is allowed only while the instrument is under its share of the cap
  const total = cfg.kinds.reduce((a, k) => a + SHARE[k], 0);
  const taken: Record<string, number> = {};
  const fill = (k: Kind) => (taken[k] ?? 0) / SHARE[k];
  // notes that land together are considered together, least-represented instrument first, so no lane is starved by a fixed order
  const ordered: Cand[] = [];
  for (let i = 0; i < cands.length;) {
    let j = i;
    while (j < cands.length && cands[j]!.t - cands[i]!.t < EPS) j++;
    ordered.push(...cands.slice(i, j));
    i = j;
  }
  const clusters: Cand[][] = [];
  for (const c of ordered) {
    const last = clusters[clusters.length - 1];
    if (last && c.t - last[0]!.t < EPS) last.push(c); else clusters.push([c]);
  }
  for (const cluster of clusters) {
    cluster.sort((a, b) => fill(a.kind) - fill(b.kind));
    for (const c of cluster) {
    const rate = (SHARE[c.kind] / total) * cfg.maxPerSec;
    if ((taken[c.kind] ?? 0) >= rate * c.t + 2) continue;
    let ok = true;
    let simul = 0;
    for (const k of kept) {
      const d = dist(k.t, c.t);
      if (d < EPS) { if (k.lane === c.lane || opposite(k.lane, c.lane)) { ok = false; break; } simul++; }
      else if (k.lane === c.lane && d < cfg.minGap[c.kind]) { ok = false; break; }
    }
    if (!ok || simul + 1 > cfg.maxSimul) continue;
    // no one-second window may exceed the cap once this note is in
    const trial = [...kept, c];
    const cap = Math.ceil(cfg.maxPerSec);
    if (trial.some((k) => inWindow(trial, k.t) > cap) || inWindow(trial, c.t - 0.999) > cap) continue;
    kept.push(c);
    taken[c.kind] = (taken[c.kind] ?? 0) + 1;
    }
  }
  kept.sort((a, b) => a.t - b.t || a.lane - b.lane);
  // holds: a long melody or bass note becomes a hold if its lane stays free until it ends
  if (cfg.holds) {
    let k = 0;
    for (const n of kept) {
      if (n.kind !== 'lead' && n.kind !== 'bass') continue;
      const next = kept.find((m) => m !== n && m.lane === n.lane && m.t > n.t);
      // the thumb is busy while a button is held: nothing on the opposite button may start until it is released
      const blocker = kept.find((m) => opposite(m.lane, n.lane) && m.t >= n.t - EPS && m.t > n.t - 0.001 && m.t < n.t + 2.2);
      const limit = Math.min(next ? next.t : n.t + loopSeconds, blocker ? blocker.t : Infinity);
      const room = limit - n.t - cfg.minGap[n.kind] - 0.1;
      const natural = secondsAt(song.tempoMap, n.beat + n.dBeats) - n.t - 0.08;
      // a long note, or any note with a clear gap after it, is held (every other one, so taps and holds mix)
      if (Math.max(natural, Math.min(room, 1.3)) < 0.45 || room < 0.45) continue;
      if (k++ % 2 === 0) n.len = Math.min(Math.max(natural, Math.min(room, 1.3)), room, 2);
    }
  }
  return kept.map(({ dBeats: _d, ...n }) => n);
}

/** The song with the charted notes turned down to a ghost, so the player's own hits are what make them loud. */
export function backingSong(song: Song, chart: SongNote[], ghost = 0.28): Song {
  const key = (inst: string, beat: number, midi: number) => `${inst}|${beat.toFixed(4)}|${midi}`;
  const hit = new Set(chart.map((c) => key(c.inst, c.beat, c.midi)));
  return {
    ...song,
    tracks: song.tracks.map((tr) => ({
      ...tr,
      notes: tr.notes.map((n) => (hit.has(key(tr.inst, n.t, tr.inst === 'drums' && n.n === 37 ? 38 : n.n)) ? { ...n, v: Math.max(1, Math.round(n.v * ghost)) } : n)),
    })),
  };
}

/** Seconds in one pass of the loop. */
export function loopSecondsOf(song: Song): number {
  const last = song.bars[song.bars.length - 1]!;
  return secondsAt(song.tempoMap, last.start + last.beats);
}
