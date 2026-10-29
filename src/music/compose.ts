// Seeded song generator. Deterministic: the same options always give the same song, so a rating ("catchy,
// but the bridge drags") always refers to exactly what was heard.
//
// Craft rules it follows (details and sources in docs/design/06-music-craft.md):
//  - Songs are built from four-bar phrases grouped into sections (intro, verse, pre-chorus, chorus, bridge, outro).
//    Each phrase ends on a cadence: a dominant chord that pulls into the next section's downbeat, with a drum fill
//    and a crash on the arrival. Choruses resolve to the tonic.
//  - Every song has a hook: a one- or two-bar motif with a strong rhythmic identity (syncopation, repeated notes, a
//    leap then a stepwise fall), stated again and again with small changes, in the chorus, foreshadowed in the intro.
//  - The chorus sits higher and denser than the verse, and the pre-chorus climbs into it (sometimes dropping out for a
//    beat first). One-shots build to a key-lifted last chorus and end with a ritardando and a big final chord.
import { Rng } from '../core/rng.ts';
import { beatsOf, eighthsOf, groupStarts, meterSpec } from './meter.ts';
import type { MeterSpec } from './meter.ts';
import { secondsAt } from './timing.ts';
import type { Bar, Character, Inst, Note, Section, SectionKind, Song, SongTrack, StingerEvent, TempoPoint, Voice } from './types.ts';
import { pickForVibe } from './vibe.ts';
import type { Vibe } from './vibe.ts';

export const SCALES: Record<string, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  'harmonic minor': [0, 2, 3, 5, 7, 8, 11],
};

export type DrumStyle = 'rock' | 'four' | 'half' | 'march' | 'funk' | 'soft' | 'sparse' | 'none';
export type BassStyle = 'whole' | 'groups' | 'eighths' | 'octaves' | 'walk' | 'sync' | 'gallop' | 'sparse';

/** Instrumentation and rhythmic feel. */
export interface FeelSpec {
  drums: DrumStyle;
  bass: BassStyle;
  bassVoice: Voice;
  leadVoice: Voice;
  arpVoice: Voice;
  /** 0 = no arpeggio, otherwise how present it is. */
  arp: number;
  /** Arpeggio step in eighth notes (1 = eighths, 0.5 = sixteenths). */
  arpStep: number;
  /** Verses are a repeated power-chord riff instead of a sung line (80s rock). */
  riff: boolean;
  /** Syncopation: how often notes land just before a beat. */
  sync: number;
  /** Melody activity. */
  density: number;
  /** Chorus melody doubled a third below. */
  harmony: boolean;
  /** Pre-chorus drops out for the last beat before the chorus lands. */
  drop: boolean;
  pad: boolean;
}

export const DEFAULT_FEEL: FeelSpec = {
  drums: 'rock', bass: 'groups', bassVoice: 'saw', leadVoice: 'square', arpVoice: 'pluck', arp: 0.5, arpStep: 1,
  riff: false, sync: 0.35, density: 0.6, harmony: true, drop: false, pad: true,
};

export type MeterPlan = string | { cycle: string[] } | { bySection: Partial<Record<SectionKind, string>>; fallback: string };

type SectionPlan = [SectionKind, number][];
export const LAYOUTS: Record<string, SectionPlan> = {
  'loop-8': [['verse', 4], ['chorus', 4]],
  'loop-12': [['verse', 4], ['pre', 4], ['chorus', 4]],
  'loop-16': [['verse', 4], ['pre', 4], ['chorus', 8]],
  /** All hook, all the time: a groove with the hook stated every four bars. For games that bring the hook in as a reward. */
  'groove-8': [['groove', 4], ['groove', 4]],
};

export interface ComposeOptions {
  seed: number;
  name: string;
  description: string;
  style: string;
  mood: string;
  intent?: string;
  form: 'loop';
  /** Force the tonic (MIDI note, around 48 to 59) so stingers and loops in one game share a key. */
  root?: number;
  /** hook (default): a catchy repeating motif. vibe: texture and mood first, at any tempo; a sparse, long-note motif and no doubling. */
  character?: Character;
  layout: keyof typeof LAYOUTS;
  /** Pick mode, tempo and meter from a target vibe; anything given explicitly below wins. */
  vibe?: Partial<Vibe>;
  mode?: string;
  meter?: MeterPlan;
  bpm?: number | [number, number];
  feel?: Partial<FeelSpec>;
  batch?: string;
  index?: number;
}

interface Cell {
  e: number;
  d: number;
}

const PROGS = {
  bright: [[0, 4, 5, 3], [0, 5, 3, 4], [0, 3, 4, 3], [0, 2, 3, 4], [5, 3, 0, 4]],
  dark: [[0, 5, 2, 6], [0, 3, 6, 2], [0, 6, 5, 6], [0, 5, 6, 0], [0, 2, 6, 3]],
  phrygian: [[0, 1, 0, 1], [0, 1, 2, 1], [0, 6, 1, 0]],
  lydian: [[0, 1, 0, 1], [0, 1, 4, 0], [0, 4, 1, 0]],
};
const PRE = { bright: [[3, 4, 3, 4], [5, 3, 4, 4], [1, 4, 1, 4]], dark: [[5, 6, 5, 6], [3, 4, 5, 6], [5, 3, 6, 4]] };
const BRIDGE = { bright: [[5, 3, 5, 4], [3, 5, 3, 4], [1, 3, 4, 4]], dark: [[3, 6, 2, 5], [5, 3, 6, 4], [2, 3, 5, 6]] };

const VELOCITY: Record<SectionKind, number> = { intro: 0.6, verse: 0.8, pre: 0.9, chorus: 1, bridge: 0.75, outro: 0.65, groove: 0.9, stinger: 1 };

function family(mode: string): 'bright' | 'dark' {
  return mode === 'major' || mode === 'lydian' || mode === 'mixolydian' ? 'bright' : 'dark';
}

/** MIDI note for a scale degree (negative or past one octave allowed). */
export function degreeNote(root: number, scale: number[], degree: number): number {
  const len = scale.length;
  return root + scale[((degree % len) + len) % len]! + 12 * Math.floor(degree / len);
}

interface Chord {
  deg: number;
  /** Dominant function: raise the third so it pulls to the tonic. */
  dom: boolean;
}

function chordTones(root: number, scale: number[], c: Chord): number[] {
  const r = degreeNote(root, scale, c.deg);
  let third = degreeNote(root, scale, c.deg + 2);
  if (c.dom && third - r === 3) third += 1;
  return [r, third, degreeNote(root, scale, c.deg + 4)];
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Random onsets on a bar's eighth grid, weighted toward group starts and syncopated anticipations. */
function genRhythm(rng: Rng, m: MeterSpec, o: { sync: number; density: number; min: number; max: number; sixteenths?: boolean }): Cell[] {
  const E = eighthsOf(m);
  const starts = groupStarts(m);
  const cand: { e: number; w: number }[] = [];
  for (let e = 0; e < E; e++) {
    const w = starts.includes(e) ? (e === 0 ? 1.4 : 0.9) : starts.includes(e + 1) ? o.sync : o.density * 0.55;
    cand.push({ e, w });
    if (o.sixteenths) cand.push({ e: e + 0.5, w: o.density * 0.12 });
  }
  const chosen = new Set<number>();
  if (rng.chance(0.85)) chosen.add(0);
  const target = Math.min(rng.int(o.min, o.max), cand.length);
  while (chosen.size < target) {
    const pool = cand.filter((c) => !chosen.has(c.e));
    const total = pool.reduce((a, c) => a + c.w, 0);
    let r = rng.next() * total;
    for (const c of pool) {
      r -= c.w;
      if (r <= 0) { chosen.add(c.e); break; }
    }
    if (pool.length === 0) break;
  }
  const on = [...chosen].sort((a, b) => a - b);
  return on.map((e, i) => ({ e, d: Math.min((on[i + 1] ?? E) - e, 4) }));
}

/** Pitch offsets (in scale steps) for n notes: shapes that earworm research favors, a familiar contour with a leap. */
function genContour(rng: Rng, n: number): number[] {
  if (n <= 1) return [0];
  const kind = rng.pick(['leapFall', 'leapFall', 'arch', 'arch', 'hammer', 'hammer', 'stairs']);
  const L = rng.pick([2, 3, 4, 4, 5]);
  const out: number[] = [];
  if (kind === 'leapFall') {
    for (let i = 0; i < n; i++) out.push(i === 0 ? 0 : Math.max(0, L - (i - 1)));
  } else if (kind === 'arch') {
    const peak = Math.max(1, Math.round((n - 1) * 0.6));
    for (let i = 0; i < n; i++) out.push(i <= peak ? i : Math.max(-1, 2 * peak - i));
  } else if (kind === 'hammer') {
    const k = Math.min(n - 1, rng.pick([2, 3]));
    for (let i = 0; i < n; i++) out.push(i < k ? 0 : Math.max(0, L - (i - k)));
  } else {
    for (let i = 0; i < n; i++) out.push(Math.floor(i / 2));
  }
  return out;
}

const mod7 = (d: number) => ((d % 7) + 7) % 7;
/** Nearest degree to d whose scale position is one of `positions`. */
function nearestPos(d: number, positions: number[]): number {
  let best = d;
  let dist = Infinity;
  for (let k = d - 4; k <= d + 4; k++) {
    if (positions.includes(mod7(k)) && Math.abs(k - d) < dist) { best = k; dist = Math.abs(k - d); }
  }
  return best;
}

interface HookNote {
  bar: number;
  e: number;
  d: number;
  deg: number;
}
interface Hook {
  len: 1 | 2;
  notes: HookNote[];
  /** Degree of a one-eighth pickup note before the first bar, if any. */
  pickup: number | null;
}

type Ending = 'open' | 'vary' | 'closed';

export function composeSong(opts: ComposeOptions | StingerOptions): Song {
  return opts.form === 'oneshot' ? composeStinger(opts) : composeLoop(opts);
}

function composeLoop(opts: ComposeOptions): Song {
  const rng = new Rng(opts.seed);
  const character: Character = opts.character ?? 'hook';
  const vibeOnly = character === 'vibe';
  const feel: FeelSpec = { ...DEFAULT_FEEL, ...opts.feel, ...(vibeOnly ? { harmony: false, drop: false, riff: false } : {}) };

  // ---- 1. mode, tempo and meter: explicit values win, a target vibe fills in the rest
  const plan: MeterPlan = opts.meter ?? '4/4';
  const planNames = typeof plan === 'string' ? [plan] : 'cycle' in plan ? plan.cycle : [...new Set([...Object.values(plan.bySection), plan.fallback])];
  const bpmRange: [number, number] = Array.isArray(opts.bpm) ? opts.bpm : opts.bpm ? [opts.bpm, opts.bpm] : [60, 176];
  let scaleName = opts.mode;
  let tempo = typeof opts.bpm === 'number' ? opts.bpm : undefined;
  if (opts.vibe && (!scaleName || tempo === undefined)) {
    const pick = pickForVibe(opts.vibe, rng, { meters: planNames.length === 1 ? planNames : undefined, modes: scaleName ? [scaleName] : undefined, bpm: bpmRange });
    scaleName ??= pick.mode;
    tempo ??= pick.bpm;
  }
  scaleName ??= 'major';
  tempo = Math.round(tempo ?? rng.range(bpmRange[0], bpmRange[1]));
  const scale = SCALES[scaleName];
  if (!scale) throw new Error(`unknown mode "${scaleName}"`);
  const rootPick = 48 + rng.int(0, 11);
  const root = opts.root ?? rootPick;
  const fam = family(scaleName);
  const pickProg = (set: number[][]) => rng.pick(set);
  const mainProg = pickProg(scaleName === 'phrygian' ? PROGS.phrygian : scaleName === 'lydian' && rng.chance(0.6) ? PROGS.lydian : PROGS[fam]);
  const chorusProg = rng.chance(0.5) ? mainProg : pickProg(PROGS[fam]);
  const preProg = pickProg(PRE[fam]);
  const bridgeProg = pickProg(BRIDGE[fam]);
  const progFor: Record<SectionKind, number[]> = { intro: mainProg, verse: mainProg, pre: preProg, chorus: chorusProg, bridge: bridgeProg, outro: mainProg, groove: chorusProg, stinger: mainProg };

  // ---- 2. sections, then bars (each with its own time signature)
  const layout = LAYOUTS[opts.layout];
  if (!layout) throw new Error(`unknown layout "${opts.layout}"`);
  const groupingPick: Record<string, number> = {};
  const specFor = (name: string): MeterSpec => meterSpec(name, (groupingPick[name] ??= rng.int(0, 2)));
  const sections: Section[] = [];
  const counts: Partial<Record<SectionKind, number>> = {};
  let bar0 = 0;
  for (const [kind, n] of layout) {
    counts[kind] = (counts[kind] ?? 0) + 1;
    const multi = layout.filter(([k]) => k === kind).length > 1;
    const label = kind === 'pre' ? 'Pre-chorus' : kind[0]!.toUpperCase() + kind.slice(1);
    sections.push({ kind, name: multi ? `${label} ${counts[kind]}` : label, startBar: bar0, bars: n, transpose: 0 });
    bar0 += n;
  }
  const barCount = bar0;
  const specs: MeterSpec[] = [];
  const bars: Bar[] = [];
  let at = 0;
  for (const sec of sections) {
    for (let j = 0; j < sec.bars; j++) {
      const g = sec.startBar + j;
      const name = typeof plan === 'string' ? plan : 'cycle' in plan ? plan.cycle[g % plan.cycle.length]! : plan.bySection[sec.kind] ?? plan.fallback;
      const spec = specFor(name);
      specs.push(spec);
      bars.push({ start: at, beats: beatsOf(spec), num: spec.num, den: spec.den });
      at += beatsOf(spec);
    }
  }
  const meterNames = [...new Set(bars.map((b) => `${b.num}/${b.den}`))];
  const meterLabel = meterNames.length === 1 ? meterNames[0]! : meterNames.join(' + ');
  const mainSpec = specs[sections.find((s) => s.kind === 'chorus' || s.kind === 'groove')?.startBar ?? 0]!;
  const T = (g: number, e: number) => bars[g]!.start + e * 0.5;

  // ---- 3. the hook (and the smaller motifs it grows from)
  const hookLen: 1 | 2 = rng.chance(0.5) ? 1 : 2;
  const hookEs = eighthsOf(mainSpec);
  // a hook is busy and syncopated; a vibe piece's motif is one or two long notes over a texture (which can be frantic)
  const hookRhythm = (): Cell[] => vibeOnly
    ? genRhythm(rng, mainSpec, { sync: 0.05, density: 0.15, min: 1, max: 2 }).map((c) => ({ e: c.e, d: Math.min(8, Math.max(c.d, 3)) }))
    : genRhythm(rng, mainSpec, { sync: Math.max(feel.sync, 0.4), density: 0.7, min: Math.ceil(hookEs / 3) + 1, max: Math.ceil(hookEs / 2) + 1 });
  const flat: HookNote[] = [];
  const r1 = hookRhythm();
  const r2 = hookLen === 2 ? hookRhythm() : [];
  for (const c of r1) flat.push({ bar: 0, e: c.e, d: c.d, deg: 0 });
  for (const c of r2) flat.push({ bar: 1, e: c.e, d: c.d, deg: 0 });
  const base = rng.pick([2, 4, 4, 5]);
  genContour(rng, flat.length).forEach((off, i) => { flat[i]!.deg = Math.min(9, Math.max(0, base + off)); });
  const hook: Hook = { len: hookLen, notes: flat, pickup: !vibeOnly && rng.chance(0.5) ? nearestPos(base - 1, [0, 1, 2, 4, 5, 6]) : null };

  const hookNotesFor = (cell: number, ending: Ending): HookNote[] => {
    const out = hook.notes.filter((n) => n.bar === cell).map((n) => ({ ...n }));
    if (cell !== hook.len - 1 || !out.length) return out;
    const last = out[out.length - 1]!;
    if (ending === 'open') last.deg = nearestPos(last.deg, [1, 4]);
    else if (ending === 'closed') {
      last.deg = nearestPos(last.deg, [0]);
      if (out.length > 1) out[out.length - 2]!.deg = Math.max(0, last.deg + (rng.chance(0.5) ? 1 : -1));
    } else last.deg = Math.max(0, last.deg + rng.pick([-1, 1]));
    return out;
  };

  const verseRhythm = (): Cell[] => genRhythm(rng, mainSpec, { sync: 0.3, density: 0.3, min: 2, max: Math.max(3, Math.ceil(hookEs / 3)) });
  const verseCells = [verseRhythm(), verseRhythm()].map((rh) => {
    const c = genContour(rng, rh.length).map((o) => Math.max(0, o > 2 ? o - 2 : o));
    const b = rng.pick([0, 1, 2, 3]);
    return rh.map((r, i) => ({ ...r, deg: b + c[i]! }));
  });
  const riffCell = genRhythm(rng, mainSpec, { sync: 0.55, density: 0.6, min: Math.ceil(hookEs / 2), max: hookEs - 1 });

  // ---- 4. play it out, bar by bar
  const parts: Record<Inst, Note[]> = { bass: [], pad: [], lead: [], harmony: [], riff: [], arp: [], drums: [] };
  const hookBars: number[] = [];
  const lastSection = sections.length - 1;
  const shape = rng.pick([[0, 1, 2, 1], [0, 2, 1, 2], [2, 1, 0, 1], [0, 1, 2, 3]]);

  const chordsFor = (si: number): Chord[] => {
    const sec = sections[si]!;
    const prog = progFor[sec.kind];
    const out: Chord[] = [];
    const isLast = si === lastSection;
    const resolves = sec.kind === 'chorus' || sec.kind === 'groove';
    for (let j = 0; j < sec.bars; j++) {
      let c: Chord = { deg: prog[j % 4]!, dom: false };
      const phraseEnd = j % 4 === 3 || (sec.bars < 4 && j === sec.bars - 1);
      const lastPhrase = j >= sec.bars - Math.min(4, sec.bars);
      if (phraseEnd) {
        if (resolves && !(lastPhrase && isLast)) c = { deg: 0, dom: false };
        else if (lastPhrase || rng.chance(0.5)) c = { deg: 4, dom: true };
      }
      if (sec.bars === 2 && j === 0) c = { deg: prog[0]!, dom: false };
      out.push(c);
    }
    return out;
  };

  sections.forEach((sec, si) => {
    const rootS = root + sec.transpose;
    const chords = chordsFor(si);
    const vel = VELOCITY[sec.kind];
    const chorusLike = sec.kind === 'chorus' || sec.kind === 'groove';
    const drumLevel: 'none' | 'light' | 'full' | 'half' | 'build' =
      sec.kind === 'intro' ? 'none'
        : sec.kind === 'verse' ? (feel.drums === 'four' || feel.drums === 'march' ? 'full' : 'light')
          : sec.kind === 'pre' ? 'build' : sec.kind === 'bridge' ? 'half' : 'full';

    for (let j = 0; j < sec.bars; j++) {
      const g = sec.startBar + j;
      const bar = bars[g]!;
      const m = specs[g]!;
      const E = eighthsOf(m);
      const starts = groupStarts(m);
      const chord = chords[j]!;
      const tones = chordTones(rootS, scale, chord);
      const lastBarOfSection = j === sec.bars - 1;
      const bassRoot = tones[0]! - 12;
      const bassFifth = degreeNote(rootS, scale, chord.deg + 4) - 12;

      if (feel.pad && sec.kind !== 'groove') for (const n of tones) parts.pad.push({ t: bar.start, d: bar.beats, n: n + 12, v: Math.round(48 * vel) });
      else if (feel.pad) for (const n of tones) parts.pad.push({ t: bar.start, d: bar.beats, n: n + 12, v: 42 });

      // bass
      if (sec.kind !== 'intro') bassBar(parts.bass, feel.bass, m, bar.start, bassRoot, bassFifth, Math.round(96 * vel));

      // drums
      const nextHasDrums = si < lastSection ? sections[si + 1]!.kind !== 'intro' : true;
      const kit = feel.drums !== 'none';
      if (kit && drumLevel !== 'none') drumBar(parts.drums, feel.drums, m, bar.start, drumLevel, j, sec.bars, vel);
      if (kit && lastBarOfSection && (drumLevel !== 'none' || sec.kind === 'intro') && nextHasDrums) fillBar(parts.drums, m, bar.start, vel);
      if (kit && j === 0 && si > 0 && (chorusLike || sec.kind === 'verse') && sections[si - 1]!.kind !== 'intro') parts.drums.push({ t: bar.start, d: 1, n: 49, v: 108 });

      // arp
      if (feel.arp * (sec.kind === 'intro' ? 1 : sec.kind === 'verse' ? 0.4 : sec.kind === 'bridge' ? 0.5 : 1) >= 0.25) {
        const hi = [...tones.map((n) => n + 12), tones[0]! + 24];
        let k = 0;
        for (let e = 0; e + feel.arpStep <= E; e += feel.arpStep) {
          parts.arp.push({ t: bar.start + e * 0.5, d: feel.arpStep * 0.45, n: hi[shape[k++ % shape.length]!]!, v: Math.round((starts.includes(e) ? 70 : 54) * vel) });
        }
      }

      // lead, riff, harmony
      const lead = (e: number, d: number, deg: number, v: number, voiceNote = 12) => {
        parts.lead.push({ t: bar.start + e * 0.5, d: Math.max(0.2, d * 0.5 * 0.92), n: degreeNote(rootS, scale, deg) + voiceNote, v: Math.round(v * vel) });
      };
      if (chorusLike || (sec.kind === 'intro' && j >= sec.bars - hook.len)) {
        const statementOf = (): { cell: number; ending: Ending } => {
          if (sec.kind === 'intro') return { cell: j - (sec.bars - hook.len), ending: 'open' };
          const k = j % 4;
          const closedOK = chord.deg === 0 && !chord.dom;
          if (hook.len === 1) return { cell: 0, ending: k === 3 ? (closedOK ? 'closed' : 'open') : k === 1 ? 'vary' : 'open' };
          return { cell: k % 2, ending: k >= 2 ? (closedOK ? 'closed' : 'open') : 'open' };
        };
        const { cell, ending } = statementOf();
        // a vibe piece states its motif every other bar and leaves the rest to the texture
        if (vibeOnly && sec.kind !== 'intro' && j % 2 === 1) { /* rest */ } else {
        if (cell === 0) hookBars.push(g);
        const intro = sec.kind === 'intro';
        for (const hn of hookNotesFor(cell, ending)) {
          lead(hn.e, hn.d, hn.deg, intro ? 62 : 96);
          if (feel.harmony && !intro && chorusLike) parts.harmony.push({ t: bar.start + hn.e * 0.5, d: Math.max(0.2, hn.d * 0.46), n: degreeNote(rootS, scale, hn.deg - 2) + 12, v: Math.round(74 * vel) });
        }
        if (cell === 0 && hook.pickup !== null && g > 0 && !intro) {
          const pe = bars[g - 1]!.beats * 2 - 1;
          parts.lead.push({ t: bars[g - 1]!.start + pe * 0.5, d: 0.4, n: degreeNote(rootS, scale, hook.pickup) + 12, v: Math.round(80 * vel) });
        }
        }
      } else if (sec.kind === 'verse') {
        if (feel.riff) {
          for (const c of riffCell) {
            for (const n of [tones[0]!, tones[0]! + 7, tones[0]! + 12]) parts.riff.push({ t: bar.start + c.e * 0.5, d: Math.max(0.2, c.d * 0.5 * 0.7), n, v: Math.round(86 * vel) });
          }
        } else {
          const k = j % 4;
          const cell = verseCells[k % 2]!;
          cell.forEach((c, i) => {
            let deg = c.deg;
            if (k === 3 && i === cell.length - 1) deg = nearestPos(deg, [1, 4]);
            lead(c.e, c.d, deg, 80, 12);
          });
        }
      } else if (sec.kind === 'pre') {
        const total = sec.bars;
        const notesThisBar = Math.min(starts.length, 1 + Math.floor((j / Math.max(1, total - 1)) * (starts.length - 1)));
        const idx0 = j * 2;
        for (let i = 0; i < notesThisBar; i++) {
          const heldLast = lastBarOfSection;
          const e = starts[i]!;
          const nextE = starts[i + 1] ?? E;
          lead(e, heldLast ? E - e : nextE - e, 1 + idx0 + i, 84 + j * 4);
        }
      } else if (sec.kind === 'bridge') {
        const d = [chord.deg + 2, chord.deg + 4, chord.deg + 2, chord.deg + 1][j % 4]!;
        lead(0, E - 1, Math.max(0, Math.min(8, d)), 72);
      }

      // the pre-chorus drops out for the last group before the chorus lands
      if (feel.drop && sec.kind === 'pre' && lastBarOfSection && starts.length > 1) {
        const cut = bar.start + starts[starts.length - 1]! * 0.5;
        for (const inst of ['bass', 'pad', 'lead', 'arp', 'harmony', 'riff'] as Inst[]) parts[inst] = parts[inst].filter((n) => !(n.t >= cut && n.t < bar.start + bar.beats));
        parts.drums = parts.drums.filter((n) => !(n.t >= cut && n.t < bar.start + bar.beats && n.n !== 38));
      }
    }
  });

  // a loop's last bar is a dominant turnaround with a fill, so it leads back into the first bar
  const tempoMap: TempoPoint[] = [{ beat: 0, bpm: tempo }];

  // ---- 7. assemble
  const tracks: SongTrack[] = [];
  const addTrack = (inst: Inst, voice: Voice, layer: number) => {
    const notes = parts[inst];
    if (notes.length) tracks.push({ inst, voice, layer, notes: notes.sort((a, b) => a.t - b.t) });
  };
  addTrack('pad', 'warm', 0);
  addTrack('bass', feel.bassVoice, 1);
  addTrack('drums', 'sub', 2);
  addTrack('arp', feel.arpVoice, 3);
  addTrack('riff', 'saw', 1);
  addTrack('lead', feel.leadVoice, 1);
  addTrack('harmony', feel.leadVoice === 'square' ? 'square' : feel.leadVoice, 3);

  const id = `${opts.batch ?? 'b00'}-${String(opts.index ?? 0).padStart(2, '0')}-${slug(opts.name)}`;
  return {
    id, name: opts.name, description: opts.description, intent: opts.intent ?? opts.description, mood: opts.mood, style: opts.style,
    seed: opts.seed >>> 0, form: opts.form, character, tempo, tempoMap, root, scale: scaleName, meter: meterLabel, bars, sections, hookBars, tracks,
  };
}

// ---- rhythm sections ------------------------------------------------------------------------------------------------

function bassBar(out: Note[], style: BassStyle, m: MeterSpec, start: number, root: number, fifth: number, v: number): void {
  const E = eighthsOf(m);
  const starts = groupStarts(m);
  const put = (e: number, d: number, n: number, vel = v) => out.push({ t: start + e * 0.5, d: Math.max(0.15, d * 0.5 * 0.92), n, v: vel });
  switch (style) {
    case 'whole': put(0, E - 1, root); break;
    case 'sparse': put(0, 3, root); if (starts.length > 2) put(starts[starts.length - 1]!, starts.length ? m.groups[m.groups.length - 1]! : 2, fifth, v - 12); break;
    case 'groups': starts.forEach((e, i) => put(e, m.groups[i]!, i === starts.length - 1 && starts.length >= 4 ? fifth : root, i === 0 ? v : v - 8)); break;
    case 'eighths': for (let e = 0; e < E; e++) put(e, 1, root, starts.includes(e) ? v : v - 14); break;
    case 'octaves': for (let e = 0; e < E; e++) put(e, 1, e % 2 ? root + 12 : root, e % 2 ? v - 14 : v); break;
    case 'walk': { const seq = [root, fifth, root + 12, fifth]; starts.forEach((e, i) => put(e, m.groups[i]!, seq[i % 4]!, v - (i % 2) * 8)); break; }
    case 'sync': {
      const on = new Set<number>(starts);
      starts.forEach((s, i) => { if (i % 2 === 1 && s > 0) on.add(s - 1); });
      [...on].sort((a, b) => a - b).forEach((e, i) => put(e, 1.5, i % 3 === 2 ? fifth : root, starts.includes(e) ? v : v - 10));
      break;
    }
    case 'gallop': starts.forEach((s, i) => { const g = m.groups[i]!; put(s, 1, root, v); if (g >= 2) { put(s + 1, 0.5, root, v - 14); put(s + 1.5, 0.5, root + 12, v - 14); } }); break;
  }
}

interface Hit { e: number; n: number; v: number }

function drumHits(style: DrumStyle, m: MeterSpec, levelIn: 'light' | 'full' | 'half' | 'build', idx: number, total: number): Hit[] {
  if (style === 'none') return [];
  // gentle kits do not do snare-roll builds
  const level = levelIn === 'build' && (style === 'sparse' || style === 'soft') ? 'light' : levelIn;
  const starts = groupStarts(m);
  const ng = starts.length;
  const E = eighthsOf(m);
  const hits: Hit[] = [];
  const kick = (e: number, v = 112) => hits.push({ e, n: 36, v });
  const snare = (e: number, v = 104) => hits.push({ e, n: 38, v });
  const rim = (e: number, v = 66) => hits.push({ e, n: 37, v });
  const hat = (e: number, v: number) => hits.push({ e, n: 42, v });
  const mid = Math.floor(ng / 2);
  const backbeats = ng === 2 ? [1] : ng === 3 ? [1, 2] : starts.map((_, i) => i).filter((i) => i % 2 === 1 && !(ng % 2 === 1 && i === ng - 1));
  if (level === 'build') {
    kick(0, 100);
    const density = 0.4 + (idx / Math.max(1, total - 1)) * 0.6;
    for (let e = 0; e < E; e += density > 0.8 ? 1 : 2) snare(e, Math.round(50 + 50 * (e / E) * density));
    return hits;
  }
  if (style === 'sparse') { kick(0); hat(starts[mid]!, 60); return hits; }
  if (style === 'soft') {
    kick(0, 96);
    if (ng >= 4) kick(starts[mid]!, 84);
    if (level === 'full') for (const i of backbeats) rim(starts[i]!);
    for (const s of starts) hat(s, 52);
    return hits;
  }
  if (level === 'half') {
    kick(0);
    snare(starts[Math.min(ng - 1, Math.max(1, mid))]!);
    for (const s of starts) hat(s, 58);
    return hits;
  }
  if (style === 'four' || style === 'march') for (const s of starts) kick(s, style === 'four' ? 108 : 96);
  else {
    kick(0);
    if (ng >= 4) kick(starts[mid]!, 104);
    else if (ng === 3) kick(starts[2]! - 1, 90);
    if (style === 'funk') { kick(starts[1]! + m.groups[1]! - 1, 96); if (ng >= 3) kick(starts[2]! + m.groups[2]! - 1, 88); }
  }
  if (level === 'full') {
    if (style === 'march') for (const s of starts) { snare(s, 80); if (m.groups[starts.indexOf(s)]! >= 2) snare(s + 1, 56); }
    else for (const i of backbeats) snare(starts[i]!, ng === 3 ? 78 : 104);
  }
  if (style === 'four') for (const s of starts) hat(s + Math.min(1, m.groups[starts.indexOf(s)]! - 1), 72);
  else if (style === 'march') { /* snare carries it */ }
  else if (style === 'rock' || style === 'funk') for (let e = 0; e < E; e++) hat(e, starts.includes(e) ? 76 : 58);
  else for (const s of starts) hat(s, 60);
  if (style === 'four') hits.push({ e: E - 1, n: 46, v: 70 });
  return hits;
}

function drumBar(out: Note[], style: DrumStyle, m: MeterSpec, start: number, level: 'light' | 'full' | 'half' | 'build', idx: number, total: number, vel: number): void {
  for (const h of drumHits(style, m, level === 'light' ? 'light' : level, idx, total)) {
    if (level === 'light' && h.n === 38) continue;
    out.push({ t: start + h.e * 0.5, d: 0.2, n: h.n, v: Math.max(1, Math.round(h.v * (0.7 + 0.3 * vel))) });
  }
}

/** Snare run over the last beat group into the next section's downbeat. */
function fillBar(out: Note[], m: MeterSpec, start: number, vel: number): void {
  const E = eighthsOf(m);
  const last = m.groups[m.groups.length - 1]!;
  const from = E - last;
  const steps = last * 2;
  for (let i = 0; i < steps; i++) out.push({ t: start + (from + i * 0.5) * 0.5, d: 0.15, n: 38, v: Math.round((60 + (i / steps) * 50) * (0.7 + 0.3 * vel)) });
}

/** Song length in seconds for one pass (a loop's period, a one-shot's playing time before its tail). */
export function songSeconds(song: Pick<Song, 'bars' | 'tempoMap'>): number {
  const last = song.bars[song.bars.length - 1]!;
  return Math.round(secondsAt(song.tempoMap, last.start + last.beats) * 10) / 10;
}

// ---- stingers ------------------------------------------------------------------------------------------------------
// A one-shot is not a short song: it is a few bars that mark something that just happened (you beat the level, you
// died, the boss went down). It states a tiny hook, then lands: a big resolve, a slump, a swell. Tempo moves with the
// moment (a rising pickup speeds up; a loss slows to a stop).

export interface StingerOptions {
  seed: number;
  name: string;
  description: string;
  style: string;
  mood: string;
  intent?: string;
  form: 'oneshot';
  event: StingerEvent;
  mode?: string;
  meter?: string;
  bpm?: number | [number, number];
  /** 2 to 4 bars. */
  bars?: 2 | 3 | 4;
  /** Force the tonic so the stinger matches the game's loop. */
  root?: number;
  character?: Character;
  leadVoice?: Voice;
  batch?: string;
  index?: number;
}

const STINGERS: Record<StingerEvent, { modes: string[]; tempo: [number, number]; bars: 2 | 3 | 4; voice: Voice }> = {
  win: { modes: ['major', 'lydian', 'mixolydian'], tempo: [124, 140], bars: 4, voice: 'square' },
  lose: { modes: ['minor', 'phrygian', 'harmonic minor'], tempo: [76, 92], bars: 3, voice: 'saw' },
  boss: { modes: ['dorian', 'phrygian', 'minor'], tempo: [104, 120], bars: 4, voice: 'saw' },
  powerup: { modes: ['major', 'lydian'], tempo: [150, 172], bars: 2, voice: 'square' },
  secret: { modes: ['lydian', 'mixolydian', 'dorian'], tempo: [70, 84], bars: 3, voice: 'bell' },
};

export function composeStinger(opts: StingerOptions): Song {
  const rng = new Rng(opts.seed);
  const spec = STINGERS[opts.event];
  const scaleName = opts.mode ?? rng.pick(spec.modes);
  const scale = SCALES[scaleName];
  if (!scale) throw new Error(`unknown mode "${scaleName}"`);
  const rootPick = 48 + rng.int(0, 11);
  const root = opts.root ?? rootPick;
  const bpmOpt = opts.bpm ?? spec.tempo;
  const tempo = Math.round(Array.isArray(bpmOpt) ? rng.range(bpmOpt[0], bpmOpt[1]) : bpmOpt);
  const nBars = opts.bars ?? spec.bars;
  const meterName = opts.meter ?? '4/4';
  const m = meterSpec(meterName, rng.int(0, 2));
  const E = eighthsOf(m);
  const starts = groupStarts(m);
  const bars: Bar[] = [];
  for (let i = 0; i < nBars; i++) bars.push({ start: i * beatsOf(m), beats: beatsOf(m), num: m.num, den: m.den });
  const last = bars[nBars - 1]!;
  const end = last.start + last.beats;
  const parts: Record<Inst, Note[]> = { bass: [], pad: [], lead: [], harmony: [], riff: [], arp: [], drums: [] };
  const lead = (g: number, e: number, d: number, deg: number, v = 100, oct = 12) => {
    parts.lead.push({ t: bars[g]!.start + e * 0.5, d: Math.max(0.2, d * 0.5 * 0.92), n: degreeNote(root, scale, deg) + oct, v });
  };
  const chordAt = (g: number, c: Chord, v = 54) => {
    for (const n of chordTones(root, scale, c)) parts.pad.push({ t: bars[g]!.start, d: bars[g]!.beats, n: n + 12, v });
  };
  const hit = (g: number, e: number, n: number, v: number) => parts.drums.push({ t: bars[g]!.start + e * 0.5, d: 0.2, n, v });
  const tonic: Chord = { deg: 0, dom: false };
  const dom: Chord = { deg: 4, dom: true };
  const tempoMap: TempoPoint[] = [{ beat: 0, bpm: tempo }];
  const base = rng.pick([2, 4, 4]);
  // the tiny hook: a few onsets, the same rhythm reused as a sequence one step higher
  const rhythm = genRhythm(rng, m, { sync: 0.45, density: 0.6, min: 3, max: Math.min(5, E - 1) });
  const finalBar = nBars - 1;

  switch (opts.event) {
    case 'win': {
      // statement, the same motif a step higher, a climbing run, then the arrival
      const contour = genContour(rng, rhythm.length).map((o) => Math.abs(o));
      rhythm.forEach((c, i) => lead(0, c.e, c.d, base + contour[i]!, 96));
      rhythm.forEach((c, i) => lead(1, c.e, c.d, base + 1 + contour[i]!, 100));
      if (nBars >= 4) for (let i = 0; i < E; i++) lead(2, i, 1, base + 1 + Math.round((i / (E - 1)) * 4), 100 + i);
      lead(finalBar, 0, E * 2, 7, 112);
      parts.harmony.push({ t: last.start, d: last.beats * 2, n: degreeNote(root, scale, 4) + 12, v: 94 });
      chordAt(0, tonic); chordAt(1, { deg: 3, dom: false }); if (nBars >= 4) chordAt(2, dom, 62);
      chordAt(finalBar, tonic, 82);
      for (let g = 0; g < nBars - 1; g++) { hit(g, 0, 36, 100); for (let e = 0; e < E; e += g === nBars - 2 ? 1 : 2) hit(g, e, 38, 50 + g * 14 + e * 2); }
      hit(finalBar, 0, 36, 124); hit(finalBar, 0, 49, 120);
      parts.bass.push({ t: last.start, d: last.beats * 2, n: degreeNote(root, scale, 0) - 12, v: 110 });
      for (let g = 0; g < nBars - 1; g++) starts.forEach((e) => parts.bass.push({ t: bars[g]!.start + e * 0.5, d: 0.4, n: degreeNote(root, scale, g === 1 ? 3 : g === 2 ? 4 : 0) - 12, v: 92 }));
      // pushes forward through the run, then slows across the last bar into the held chord
      tempoMap.splice(0, 1, { beat: 0, bpm: tempo, ramp: true }, { beat: last.start, bpm: Math.round(tempo * 1.08), ramp: true }, { beat: end, bpm: Math.round(tempo * 0.62) });
      break;
    }
    case 'lose': {
      // a falling line over a minor chord that sinks, slowing to a halt on a low tonic
      const run = [4, 3, 2, 1, 0, -1];
      starts.forEach((e, i) => lead(0, e, m.groups[i]!, run[i % run.length]!, 92));
      starts.forEach((e, i) => lead(1, e, m.groups[i]!, run[(i + starts.length) % run.length]! - 1, 88));
      lead(finalBar, 0, E * 2, -3, 100, 0);
      chordAt(0, tonic); chordAt(1, { deg: rng.pick([3, 5]), dom: false }, 50); chordAt(finalBar, tonic, 70);
      hit(0, 0, 36, 100); hit(1, 0, 36, 90); hit(finalBar, 0, 36, 124);
      parts.bass.push({ t: 0, d: bars[0]!.beats, n: degreeNote(root, scale, 0) - 12, v: 90 }, { t: bars[1]!.start, d: bars[1]!.beats, n: degreeNote(root, scale, 5) - 12, v: 86 }, { t: last.start, d: last.beats * 2, n: degreeNote(root, scale, 0) - 24, v: 112 });
      tempoMap.splice(0, 1, { beat: 0, bpm: tempo, ramp: true }, { beat: end, bpm: Math.round(tempo * 0.55) });
      break;
    }
    case 'boss': {
      // a heavy low motif said twice, a leap onto the dominant, then a crash on the tonic
      const contour = genContour(rng, rhythm.length);
      rhythm.forEach((c, i) => lead(0, c.e, c.d, base - 2 + contour[i]!, 108, 0));
      rhythm.forEach((c, i) => lead(1, c.e, c.d, base - 2 + contour[i]!, 108, 0));
      if (nBars >= 4) starts.forEach((e, i) => lead(2, e, m.groups[i]!, 4 + i, 104, 0));
      lead(finalBar, 0, E * 2, 0, 116, 0);
      parts.harmony.push({ t: last.start, d: last.beats * 2, n: degreeNote(root, scale, 4) + 0, v: 100 });
      for (let g = 0; g < nBars; g++) chordAt(g, g === nBars - 2 ? dom : tonic, g === finalBar ? 86 : 60);
      for (let g = 0; g < nBars - 1; g++) starts.forEach((e, i) => { hit(g, e, 36, 110); if (i % 2 === 1) hit(g, e, 38, 108); });
      hit(finalBar, 0, 36, 126); hit(finalBar, 0, 49, 124);
      for (let g = 0; g < nBars - 1; g++) for (let e = 0; e < E; e++) parts.bass.push({ t: bars[g]!.start + e * 0.5, d: 0.4, n: degreeNote(root, scale, g === nBars - 2 ? 4 : 0) - 12, v: starts.includes(e) ? 100 : 82 });
      parts.bass.push({ t: last.start, d: last.beats * 2, n: degreeNote(root, scale, 0) - 24, v: 116 });
      tempoMap.push({ beat: last.start, bpm: tempo, ramp: true }, { beat: end, bpm: Math.round(tempo * 0.6) });
      break;
    }
    case 'powerup': {
      // a rising arpeggio that speeds up, then the top note rings with sparkle
      const total = E * 2;
      const tones = [0, 2, 4, 7, 9, 11, 14, 16];
      for (let i = 0; i < total; i++) {
        const k = Math.min(tones.length - 1, Math.floor((i / total) * tones.length));
        parts.arp.push({ t: i * 0.25, d: 0.2, n: degreeNote(root, scale, tones[k]!) + 12, v: 80 + Math.round((i / total) * 30) });
      }
      lead(finalBar, 0, E * 2, 14, 110, 12);
      for (let i = 0; i < Math.floor(last.beats * 2); i++) parts.arp.push({ t: last.start + i * 0.5, d: 0.3, n: degreeNote(root, scale, 14 + (i % 2) * 2) + 12, v: 70 });
      chordAt(0, tonic); chordAt(finalBar, tonic, 70);
      hit(0, 0, 36, 100); hit(finalBar, 0, 49, 100);
      parts.bass.push({ t: 0, d: bars[0]!.beats, n: degreeNote(root, scale, 0) - 12, v: 96 }, { t: last.start, d: last.beats, n: degreeNote(root, scale, 0) - 12, v: 100 });
      tempoMap.splice(0, 1, { beat: 0, bpm: tempo, ramp: true }, { beat: last.start, bpm: Math.round(tempo * 1.2) });
      break;
    }
    case 'secret': {
      // bells climbing out of the dark, a swelling pad, a shimmering chord, slowing as it settles
      const degs = [0, 2, 4, 6, 7, 9];
      degs.forEach((d, i) => lead(Math.min(nBars - 2, Math.floor(i / 3)), (i % 3) * Math.max(1, Math.floor(E / 3)), 2, d + base - 2, 78 + i * 4));
      lead(finalBar, 0, E * 2, 11, 100);
      for (let g = 0; g < nBars; g++) chordAt(g, g === 1 ? { deg: 1, dom: false } : g === finalBar ? { deg: 0, dom: false } : tonic, 40 + g * 14);
      for (let i = 0; i < Math.floor(last.beats * 2); i++) parts.arp.push({ t: last.start + i * 0.5, d: 0.35, n: degreeNote(root, scale, 7 + (i % 4) * 2) + 12, v: 60 - i * 3 });
      parts.bass.push({ t: last.start, d: last.beats * 2, n: degreeNote(root, scale, 0) - 12, v: 90 });
      tempoMap.push({ beat: bars[Math.max(0, nBars - 2)]!.start, bpm: tempo, ramp: true }, { beat: end, bpm: Math.round(tempo * 0.7) });
      break;
    }
  }

  const tracks: SongTrack[] = [];
  const addTrack = (inst: Inst, voice: Voice) => {
    const notes = parts[inst];
    if (notes.length) tracks.push({ inst, voice, layer: 0, notes: notes.sort((a, b) => a.t - b.t) });
  };
  addTrack('pad', 'warm');
  addTrack('bass', opts.event === 'secret' ? 'sub' : 'saw');
  addTrack('drums', 'sub');
  addTrack('arp', opts.event === 'powerup' ? 'square' : 'bell');
  addTrack('lead', opts.leadVoice ?? spec.voice);
  addTrack('harmony', opts.leadVoice ?? spec.voice);
  const sections: Section[] = [{ kind: 'stinger', name: 'Stinger', startBar: 0, bars: nBars, transpose: 0 }];
  const id = `${opts.batch ?? 'b00'}-${String(opts.index ?? 0).padStart(2, '0')}-${slug(opts.name)}`;
  return {
    id, name: opts.name, description: opts.description, intent: opts.intent ?? opts.description, mood: opts.mood, style: opts.style,
    seed: opts.seed >>> 0, form: 'oneshot', character: opts.character ?? 'hook', tempo, tempoMap: cleanMap(tempoMap), root, scale: scaleName,
    meter: meterName, bars, sections, hookBars: [0], tracks,
  };
}

/** Sort and de-duplicate tempo points (same beat: the later one wins) so the map is always valid. */
function cleanMap(map: TempoPoint[]): TempoPoint[] {
  const sorted = [...map].sort((a, b) => a.beat - b.beat);
  const out: TempoPoint[] = [];
  for (const p of sorted) {
    if (out.length && out[out.length - 1]!.beat === p.beat) out[out.length - 1] = p;
    else out.push(p);
  }
  if (out[0]!.beat !== 0) out.unshift({ beat: 0, bpm: out[0]!.bpm });
  return out;
}
