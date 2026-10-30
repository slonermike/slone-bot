// A review of a game's music for an agent that cannot listen. It reports what the music does (tempo, meter, mode,
// vibe, how its energy moves bar by bar, which parts can be layered) and flags the traps that make every game sound the
// same: the default mid-tempo 4/4 zone, music with no energy movement, and music that cannot follow pressure.
import { songSeconds } from './compose.ts';
import { vibeOf } from './vibe.ts';
import type { Song } from './types.ts';

export interface SongReview {
  name: string;
  form: string;
  bpm: number;
  bpmRange: [number, number];
  meter: string;
  mode: string;
  seconds: number;
  vibe: { valence: number; energy: number; tension: number; lilt: number; quirk: number };
  /** Normalised note activity per bar (0 to 1), loudest bar = 1. */
  energyCurve: number[];
  /** (max - min) / max of the energy curve: near 0 is a wall of constant sound. */
  dynamicRange: number;
  /** Instruments on each pressure layer, so you can see what setParts can bring in. */
  layers: Record<number, string[]>;
  issues: string[];
}

export function reviewSong(song: Song): SongReview {
  const bpms = song.tempoMap.map((p) => p.bpm);
  const bpmRange: [number, number] = [Math.min(...bpms), Math.max(...bpms)];
  const perBar = song.bars.map(() => 0);
  const layers: Record<number, Set<string>> = {};
  for (const t of song.tracks) {
    (layers[t.layer] ??= new Set()).add(t.inst);
    for (const n of t.notes) {
      const i = song.bars.findIndex((b) => n.t >= b.start && n.t < b.start + b.beats);
      if (i >= 0) perBar[i] += (n.v / 127) * (t.inst === 'drums' ? 0.6 : 1);
    }
  }
  const peak = Math.max(...perBar, 1e-9);
  const energyCurve = perBar.map((v) => Math.round((v / peak) * 100) / 100);
  const dynamicRange = Math.round(((peak - Math.min(...perBar)) / peak) * 100) / 100;
  const vibe = vibeOf({ mode: song.scale, meters: [song.meter], bpm: song.tempo });
  const layerList = Object.fromEntries(Object.entries(layers).map(([k, v]) => [Number(k), [...v]]));

  const issues: string[] = [];
  const midTempo = song.tempo >= 100 && song.tempo <= 125;
  if (midTempo && song.meter === '4/4') issues.push('default zone: 4/4 at 100 to 125 bpm is where most game music lands and what makes games sound alike. Keep it only if the game truly wants it, and say why in the music plan.');
  if (song.form === 'loop' && dynamicRange < 0.25) issues.push('flat energy: the loop barely changes from bar to bar, so it reads as wallpaper. Use sections, a build, or a dropout.');
  if (song.form === 'loop' && Object.keys(layers).length < 2) issues.push('one layer: every part is on layer 0, so the game cannot bring music in or out with pressure (setParts has nothing to do).');
  if (song.form === 'loop' && !song.tracks.some((t) => t.inst === 'drums') && !song.tracks.some((t) => t.inst === 'pad')) issues.push('no drums and no pad: check that this is a deliberate sparse piece and not an empty one.');
  return {
    name: song.name, form: song.form, bpm: song.tempo, bpmRange, meter: song.meter, mode: song.scale,
    seconds: Math.round(songSeconds(song)), vibe, energyCurve, dynamicRange, layers: layerList, issues,
  };
}

export interface GameMusicReview {
  songs: SongReview[];
  issues: string[];
}

/** Review every song of a game (loops and stingers): its own traps, and whether the set has any contrast. */
export function reviewGameMusic(songs: Song[]): GameMusicReview {
  const reviews = songs.map(reviewSong);
  const issues: string[] = [];
  const loops = songs.filter((s) => s.form === 'loop');
  const stingers = songs.filter((s) => s.form === 'oneshot');
  if (loops.length === 0) issues.push('no loop: a game needs music that plays under action.');
  if (stingers.length < 2) issues.push('fewer than two stingers: big moments (win, lose, a power-up, a discovery) should each be punctuated.');
  if (loops.length > 1) {
    const bpms = loops.map((s) => s.tempo);
    const meters = new Set(loops.map((s) => s.meter));
    if (Math.max(...bpms) - Math.min(...bpms) < 12 && meters.size === 1) issues.push('the loops share one tempo and one meter, so switching between them will not change the feel. Make the second loop contrast (tempo, meter, mode brightness or density) if the plan has two moods or phases.');
  }
  for (const r of reviews) for (const i of r.issues) issues.push(`${r.name}: ${i}`);
  return { songs: reviews, issues };
}
