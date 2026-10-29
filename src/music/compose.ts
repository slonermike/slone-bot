// Seeded loop generator. Deterministic: the same seed and mood always give the same song, so a verdict
// ("keep", "tweak the bass") always refers to exactly the thing that was heard.
import { Rng } from '../core/rng.ts';
import { BEATS_PER_BAR } from './types.ts';
import type { Inst, Note, Song, SongTrack, Voice } from './types.ts';

const SCALES: Record<string, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  'harmonic minor': [0, 2, 3, 5, 7, 8, 11],
};

type DrumStyle = 'driving' | 'backbeat' | 'halftime' | 'soft' | 'sparse' | 'funk' | 'march' | 'none';
type BassStyle = 'whole' | 'eighths' | 'octaves' | 'walk' | 'sparse' | 'gallop' | 'syncopated';

export interface MoodSpec {
  intent: string;
  scales: string[];
  tempo: [number, number];
  progressions: number[][];
  drums: DrumStyle[];
  bass: BassStyle[];
  bassVoice: Voice[];
  leadVoice: Voice[];
  arpVoice: Voice[];
  /** Chance a melody slot is played (0..1). */
  melodyDensity: number;
  arp: number;
  bars: number[];
}

export const MOODS: Record<string, MoodSpec> = {
  tense: {
    intent: 'a tense loop that could sit under rising pressure',
    scales: ['minor', 'phrygian', 'harmonic minor'], tempo: [112, 148],
    progressions: [[0, 5, 3, 4], [0, 0, 5, 4], [0, 1, 0, 6], [0, 3, 5, 4]],
    drums: ['driving', 'backbeat', 'sparse'], bass: ['eighths', 'octaves', 'walk'], bassVoice: ['saw', 'sub'],
    leadVoice: ['saw', 'square'], arpVoice: ['pluck', 'square'], melodyDensity: 0.55, arp: 0.6, bars: [8, 8, 16],
  },
  cozy: {
    intent: 'a warm, unhurried loop for a calm early stretch',
    scales: ['major', 'lydian', 'mixolydian'], tempo: [68, 96],
    progressions: [[0, 3, 4, 0], [0, 5, 3, 4], [3, 0, 4, 0], [0, 2, 3, 4]],
    drums: ['soft', 'none', 'halftime'], bass: ['whole', 'sparse', 'walk'], bassVoice: ['sub'],
    leadVoice: ['pluck', 'bell', 'flute'], arpVoice: ['pluck', 'bell'], melodyDensity: 0.5, arp: 0.35, bars: [8, 8, 16],
  },
  triumphant: {
    intent: 'a bright, rising loop for an earned power moment',
    scales: ['major', 'mixolydian', 'lydian'], tempo: [118, 150],
    progressions: [[0, 4, 5, 3], [0, 3, 4, 4], [0, 5, 3, 4], [3, 4, 0, 0]],
    drums: ['backbeat', 'driving'], bass: ['octaves', 'eighths'], bassVoice: ['saw'],
    leadVoice: ['square', 'saw', 'bell'], arpVoice: ['square', 'pluck'], melodyDensity: 0.7, arp: 0.7, bars: [8, 16],
  },
  eerie: {
    intent: 'a sparse, unsettled loop for something lurking',
    scales: ['phrygian', 'dorian', 'harmonic minor'], tempo: [58, 84],
    progressions: [[0, 1, 0, 1], [0, 0, 6, 5], [0, 5, 6, 0]],
    drums: ['none', 'sparse'], bass: ['whole', 'sparse'], bassVoice: ['sub'],
    leadVoice: ['bell', 'flute'], arpVoice: ['bell'], melodyDensity: 0.3, arp: 0.3, bars: [8, 8, 16],
  },
  playful: {
    intent: 'a bouncy, light loop for a toy-like game',
    scales: ['major', 'mixolydian'], tempo: [124, 162],
    progressions: [[0, 3, 0, 4], [0, 5, 3, 4], [0, 4, 3, 4]],
    drums: ['backbeat', 'halftime', 'soft'], bass: ['walk', 'octaves'], bassVoice: ['sub', 'saw'],
    leadVoice: ['pluck', 'square', 'bell'], arpVoice: ['pluck', 'bell'], melodyDensity: 0.65, arp: 0.5, bars: [8, 8],
  },
  urgent: {
    intent: 'a fast, driving loop for the last stretch of a run',
    scales: ['minor', 'dorian', 'harmonic minor'], tempo: [140, 176],
    progressions: [[0, 5, 3, 6], [0, 6, 5, 6], [0, 0, 3, 4]],
    drums: ['driving'], bass: ['eighths', 'octaves'], bassVoice: ['saw'],
    leadVoice: ['saw', 'square'], arpVoice: ['pluck', 'square'], melodyDensity: 0.6, arp: 0.85, bars: [8, 16],
  },
  melancholy: {
    intent: 'a slow, wistful loop for a quiet aftermath',
    scales: ['minor', 'dorian'], tempo: [60, 88],
    progressions: [[0, 5, 2, 6], [0, 3, 5, 4], [0, 2, 5, 3]],
    drums: ['none', 'soft', 'halftime'], bass: ['whole', 'sparse'], bassVoice: ['sub'],
    leadVoice: ['flute', 'bell', 'pluck'], arpVoice: ['pluck', 'bell'], melodyDensity: 0.4, arp: 0.4, bars: [8, 16],
  },
};

const ADJECTIVES = ['Amber', 'Brass', 'Cinder', 'Dusk', 'Ember', 'Fable', 'Glass', 'Hollow', 'Ivory', 'Jade', 'Kite', 'Lantern', 'Marble', 'Neon', 'Onyx', 'Pebble', 'Quartz', 'Rust', 'Saffron', 'Tin', 'Umber', 'Velvet', 'Willow', 'Zephyr'];
const NOUNS = ['Orbit', 'Harbor', 'Chase', 'Garden', 'Signal', 'Drift', 'Furnace', 'Lullaby', 'Parade', 'Tide', 'Echo', 'Spark', 'Ridge', 'Carousel', 'Static', 'Bloom', 'Engine', 'Canyon', 'Ferry', 'Lighthouse', 'Market', 'Comet', 'Tunnel', 'Meadow'];

/** MIDI note for a scale degree (can be negative or above one octave). */
function degreeNote(root: number, scale: number[], degree: number): number {
  const len = scale.length;
  const oct = Math.floor(degree / len);
  return root + scale[((degree % len) + len) % len]! + 12 * oct;
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const MELODY_RHYTHMS: [number, number][][] = [
  [[0, 1], [1, 1], [2, 1], [3, 1]],
  [[0, 1.5], [1.5, 0.5], [2, 1], [3, 1]],
  [[0, 0.5], [0.5, 0.5], [1, 1], [2, 2]],
  [[0, 2], [2, 1], [3, 1]],
  [[0, 0.75], [0.75, 0.75], [1.5, 0.5], [2, 2]],
  [[0, 0.5], [0.5, 0.5], [1, 0.5], [1.5, 0.5], [2, 1], [3, 1]],
  [[0.5, 1], [1.5, 1], [2.5, 1.5]],
];

const DRUMS: Record<DrumStyle, { kick: number[]; snare: number[]; hat: number[]; open?: number[]; rim?: number[] }> = {
  driving: { kick: [0, 4, 8, 12], snare: [4, 12], hat: [2, 6, 10, 14], open: [14] },
  backbeat: { kick: [0, 7, 10], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14] },
  halftime: { kick: [0, 10], snare: [8], hat: [0, 4, 8, 12] },
  soft: { kick: [0, 10], snare: [], hat: [4, 12], rim: [8] },
  sparse: { kick: [0], snare: [], hat: [8], rim: [] },
  funk: { kick: [0, 3, 6, 10], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14], open: [15] },
  march: { kick: [0, 8], snare: [4, 12, 14, 15], hat: [] },
  none: { kick: [], snare: [], hat: [] },
};

export interface ComposeOptions {
  seed: number;
  /** Base mood from MOODS. */
  mood: string;
  /** Overrides on the mood (scale, tempo, drums, voices...), and the style label shown in the jukebox. */
  override?: Partial<MoodSpec>;
  style?: string;
  /** Fixed name and tweet-length description; without them the name is generated and the description is the mood's intent. */
  name?: string;
  description?: string;
  /** Prefix for the id and name sequence, e.g. "b01". */
  batch?: string;
  index?: number;
}

export function composeSong(opts: ComposeOptions): Song {
  const base = MOODS[opts.mood];
  if (!base) throw new Error(`unknown mood "${opts.mood}"`);
  const spec: MoodSpec = { ...base, ...opts.override };
  const rng = new Rng(opts.seed);
  const scaleName = rng.pick(spec.scales);
  const scale = SCALES[scaleName]!;
  const root = 48 + rng.int(0, 11); // C3..B3
  const tempo = Math.round(rng.range(spec.tempo[0], spec.tempo[1]));
  const bars = rng.pick(spec.bars);
  const prog = rng.pick(spec.progressions);
  const chordAt = (bar: number) => prog[Math.floor(bar % prog.length)]!;
  const chordTones = (deg: number) => [degreeNote(root, scale, deg), degreeNote(root, scale, deg + 2), degreeNote(root, scale, deg + 4)];
  const tracks: SongTrack[] = [];
  const bassStyle = rng.pick(spec.bass);
  const drumStyle = rng.pick(spec.drums);
  const bassVoice = rng.pick(spec.bassVoice);
  const leadVoice = rng.pick(spec.leadVoice);
  const arpVoice = rng.pick(spec.arpVoice);

  const add = (inst: Inst, voice: Voice, layer: number, notes: Note[]) => {
    if (notes.length) tracks.push({ inst, voice, layer, notes });
  };

  // pad: one chord per bar, soft and wide
  const pad: Note[] = [];
  for (let b = 0; b < bars; b++) {
    for (const n of chordTones(chordAt(b))) pad.push({ t: b * BEATS_PER_BAR, d: BEATS_PER_BAR, n: n + 12, v: 52 });
  }
  add('pad', 'warm', 0, pad);

  // bass
  const bass: Note[] = [];
  for (let b = 0; b < bars; b++) {
    const r = degreeNote(root, scale, chordAt(b)) - 12;
    const fifth = degreeNote(root, scale, chordAt(b) + 4) - 12;
    const t0 = b * BEATS_PER_BAR;
    if (bassStyle === 'whole') bass.push({ t: t0, d: 3.5, n: r, v: 92 });
    else if (bassStyle === 'sparse') { bass.push({ t: t0, d: 1.5, n: r, v: 92 }); if (rng.chance(0.6)) bass.push({ t: t0 + 2.5, d: 1, n: fifth, v: 80 }); }
    else if (bassStyle === 'walk') for (let i = 0; i < 4; i++) bass.push({ t: t0 + i, d: 0.9, n: [r, fifth, r + 12, fifth][i]!, v: 88 - (i % 2) * 8 });
    else if (bassStyle === 'gallop') for (let i = 0; i < 4; i++) for (const [off, d, up] of [[0, 0.45, 0], [0.5, 0.2, 0], [0.75, 0.2, 12]] as const) bass.push({ t: t0 + i + off, d, n: r + up, v: off === 0 ? 96 : 80 });
    else if (bassStyle === 'syncopated') for (const [off, d, n] of [[0, 0.7, r], [0.75, 0.2, r], [1.5, 0.45, fifth], [2.5, 0.45, r + 12], [3, 0.7, fifth], [3.5, 0.4, r]] as const) bass.push({ t: t0 + off, d, n, v: off % 1 ? 80 : 94 });
    else for (let i = 0; i < 8; i++) bass.push({ t: t0 + i * 0.5, d: 0.45, n: bassStyle === 'octaves' && i % 2 ? r + 12 : r, v: i % 2 ? 78 : 94 });
  }
  add('bass', bassVoice, 1, bass);

  // drums
  const pattern = DRUMS[drumStyle];
  const drums: Note[] = [];
  for (let b = 0; b < bars; b++) {
    const t0 = b * BEATS_PER_BAR;
    const hit = (steps: number[] | undefined, n: number, v: number) => steps?.forEach((s) => drums.push({ t: t0 + s * 0.25, d: 0.2, n, v }));
    const fill = drumStyle !== 'none' && drumStyle !== 'sparse' && (b + 1) % 4 === 0;
    hit(pattern.kick, 36, 112);
    hit(fill ? [4, 10, 12, 13, 14, 15] : pattern.snare, 38, fill ? 100 : 104);
    hit(pattern.hat, 42, 70);
    hit(pattern.open, 46, 74);
    hit(pattern.rim, 37, 70);
  }
  add('drums', 'sub', 2, drums);

  // arp: chord tones in 8ths or 16ths, played on a share of the bars
  const arp: Note[] = [];
  if (rng.chance(spec.arp)) {
    const step = rng.chance(0.5) ? 0.25 : 0.5;
    const shape = rng.pick([[0, 1, 2, 1], [0, 2, 1, 2], [2, 1, 0, 1], [0, 1, 2, 3]]);
    for (let b = 0; b < bars; b++) {
      const tones = [...chordTones(chordAt(b)), degreeNote(root, scale, chordAt(b)) + 12].map((n) => n + 12);
      for (let i = 0; i < BEATS_PER_BAR / step; i++) arp.push({ t: b * BEATS_PER_BAR + i * step, d: step * 0.9, n: tones[shape[i % shape.length]!]!, v: 60 + (i % 4 === 0 ? 14 : 0) });
    }
  }
  add('arp', arpVoice, 3, arp);

  // lead: a four-bar phrase, played again with a changed ending
  const phraseBars = prog.length;
  const rhythm = rng.pick(MELODY_RHYTHMS);
  const motif = rng.pick(MELODY_RHYTHMS);
  const lead: Note[] = [];
  let pos = rng.pick([2, 4, 4, 5]); // scale degree above the tonic, to start
  const phrase = (variation: boolean): Note[] => {
    const out: Note[] = [];
    for (let pb = 0; pb < phraseBars; pb++) {
      const bar = pb;
      const chord = chordTones(chordAt(bar));
      const slots = variation && pb >= phraseBars - 2 ? motif : rhythm;
      slots.forEach(([off, dur], i) => {
        if (i > 0 && !rng.chance(spec.melodyDensity + 0.25)) return;
        if (i === 0 && !rng.chance(spec.melodyDensity + 0.35)) return;
        // strong beats lean toward chord tones, the rest walk stepwise
        if (off % 2 === 0 && rng.chance(0.6)) {
          const target = rng.pick(chord) + 12;
          pos = nearestDegree(root, scale, target);
        } else pos += rng.pick([-2, -1, -1, 1, 1, 2]);
        pos = Math.max(0, Math.min(scale.length * 2 + 1, pos));
        out.push({ t: bar * BEATS_PER_BAR + off, d: dur * 0.92, n: degreeNote(root, scale, pos) + 12, v: 82 + (off === 0 ? 12 : 0) });
      });
    }
    return out;
  };
  for (let start = 0; start < bars; start += phraseBars) {
    const p = phrase(start > 0);
    for (const n of p) lead.push({ ...n, t: n.t + start * BEATS_PER_BAR });
  }
  add('lead', leadVoice, 1, lead);

  const generated = `${rng.pick(ADJECTIVES)} ${rng.pick(NOUNS)}`;
  const name = opts.name ?? generated;
  const id = `${opts.batch ?? 'b00'}-${String(opts.index ?? 0).padStart(2, '0')}-${slug(name)}`;
  return { id, name, description: opts.description ?? spec.intent, intent: spec.intent, mood: opts.mood, style: opts.style ?? opts.mood, seed: opts.seed >>> 0, tempo, root, scale: scaleName, bars, tracks };
}

function nearestDegree(root: number, scale: number[], note: number): number {
  let best = 0;
  let bestDist = Infinity;
  for (let d = 0; d <= scale.length * 2 + 1; d++) {
    const dist = Math.abs(degreeNote(root, scale, d) + 12 - note);
    if (dist < bestDist) { best = d; bestDist = dist; }
  }
  return best;
}

/** Song length in seconds for one pass of the loop. */
export function songSeconds(song: Pick<Song, 'bars' | 'tempo'>): number {
  return Math.round(((song.bars * BEATS_PER_BAR * 60) / song.tempo) * 10) / 10;
}
