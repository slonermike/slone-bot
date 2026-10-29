// The second batch (b02): twenty songs in the spirit of 8-bit and 16-bit era game music, with 80s rock and 2000s pop
// hook craft mixed in. 12 loops and 8 one-shots; 13 are built around a hook and 7 are vibe pieces (texture and mood first, at any tempo: two of them are fast and frantic); time signatures
// range over 4/4, 2/4, 3/4, 6/8, 7/8, 5/4, 9/8, 12/8, one song changes meter by section and one every few bars.
// Where a brief leaves mode or tempo open, the vibe formula (vibe.ts) picks them from the target vibe.
// Style sketches, not copies: every melody is generated from a seed.
import type { ComposeOptions } from './compose.ts';

type Brief = Omit<ComposeOptions, 'seed' | 'batch' | 'index'>;

export const BATCH_2: Brief[] = [
  {
    name: 'Hero Sprint', style: '8-bit action stage, run-and-gun', mood: 'triumphant', form: 'loop', layout: 'loop-16', description: 'Run-and-gun stage: minor at 167 bpm, galloping saw bass, a nonstop sixteenth-note square arp, and a hook that arrives in the chorus after a pre-chorus climb. A loop, so the last bar leans back into the first. Testing whether the hook cuts through all that arp.',
    mode: 'minor', meter: '4/4', bpm: [164, 170],
    feel: { drums: 'four', bass: 'gallop', bassVoice: 'saw', leadVoice: 'square', arpVoice: 'square', arp: 0.9, arpStep: 0.5, sync: 0.5, harmony: false },
  },
  {
    name: 'Overworld Stroll', style: '8-bit overworld march', mood: 'playful', form: 'loop', layout: 'loop-12', description: 'A bouncy adventure map in 2/4 (a march), lydian at 108 bpm: the raised 4th gives it a sunny, wide-open feel. Snare-march drums, a chirpy square hook, 12 bars that climb through a pre-chorus. Wanted optimism with a skip in its step.',
    meter: '2/4', vibe: { valence: 0.8, energy: 0.55 }, bpm: [100, 126],
    feel: { drums: 'march', bass: 'groups', bassVoice: 'saw', leadVoice: 'square', arpVoice: 'pluck', arp: 0.3, sync: 0.3, density: 0.8 },
  },
  {
    name: 'Cathedral Run', style: '8-bit gothic castle, driving', mood: 'tense', form: 'loop', layout: 'loop-16', description: 'Gothic castle chase: harmonic minor at 137 bpm, galloping bass, saw lead and a fast arp. The raised 7th is the drama. Sixteen bars: verse, a pre-chorus that climbs and drops out for a beat, then an 8-bar chorus with the hook coming back four times.',
    mode: 'harmonic minor', meter: '4/4', bpm: [136, 142],
    feel: { drums: 'rock', bass: 'gallop', bassVoice: 'saw', leadVoice: 'saw', arpVoice: 'square', arp: 0.7, arpStep: 0.5, sync: 0.45, harmony: false },
  },
  {
    name: 'Spinning Blocks', style: 'folk puzzle tune', mood: 'melancholy', form: 'loop', layout: 'loop-8', description: 'A rolling folk-flavored puzzle loop in 6/8 (two groups of three), minor at 130 bpm, plucked hook over a walking bass and a march snare. Short on purpose, 8 bars, so it can repeat for an hour. Testing whether 6/8 gives it that spinning feeling.',
    mode: 'minor', meter: '6/8', bpm: [124, 132],
    feel: { drums: 'march', bass: 'walk', bassVoice: 'saw', leadVoice: 'pluck', arp: 0, sync: 0.25, density: 0.85, harmony: false },
  },
  {
    name: 'Coastline', style: '2000s pop-flavored seaside drive', mood: 'triumphant', form: 'oneshot', layout: 'shot-medium', description: 'A one-shot in lydian at 121 bpm with a pop shape: intro teases the hook, verse, rising pre-chorus that drops out before the chorus, bridge, then a last chorus a tone higher and a touch faster, ending on a slowing, held chord. Aiming for windows-down optimism.',
    mode: 'lydian', meter: '4/4', bpm: [120, 126], keyLift: 2, tempoArc: 'lift', ending: 'big',
    feel: { drums: 'four', bass: 'octaves', bassVoice: 'saw', leadVoice: 'saw', arpVoice: 'pluck', arp: 0.8, sync: 0.6, drop: true, harmony: true },
  },
  {
    name: 'Hearth and Home', style: '16-bit village, pastoral waltz', mood: 'cozy', form: 'loop', layout: 'loop-8', character: 'vibe', description: 'A vibe piece, not an earworm: a safe village in 3/4 (a slow waltz sway), major at 94 bpm. Soft rim-click drums, a walking bass, a flute-like motif that comes and goes. Wanted warmth and nothing demanding your attention.',
    mode: 'major', meter: '3/4', bpm: [90, 98],
    feel: { drums: 'soft', bass: 'walk', bassVoice: 'sub', leadVoice: 'flute', arpVoice: 'pluck', arp: 0.5 },
  },
  {
    name: 'Backroom Bazaar', style: '16-bit shop, jazzy and off-kilter', mood: 'playful', form: 'loop', layout: 'loop-12', description: 'A jazzy shop in 7/8 (grouped 2+2+3, a stumbling bustle), dorian at 121 bpm. Funk drums, syncopated bass, a plucked hook. The odd meter should feel like browsing: quick, a bit off-kilter, still a groove you can nod to.',
    mode: 'dorian', meter: '7/8', bpm: [118, 126],
    feel: { drums: 'funk', bass: 'sync', bassVoice: 'sub', leadVoice: 'pluck', arpVoice: 'bell', arp: 0.3, sync: 0.45, harmony: false },
  },
  {
    name: 'Last Throne', style: '16-bit final boss', mood: 'urgent', form: 'oneshot', layout: 'shot-full', description: 'Final boss as a one-shot, phrygian at 152 bpm (the flat 2nd is menace). Mostly 4/4 but every fourth bar drops a beat to 3/4, which makes it lurch. Intro, verse, climbing pre-chorus, chorus, bridge, then a last chorus a semitone up and faster, ending in a big resolve.',
    mode: 'phrygian', meter: { cycle: ['4/4', '4/4', '4/4', '3/4'] }, bpm: [150, 156], keyLift: 1, tempoArc: 'lift', ending: 'big',
    feel: { drums: 'rock', bass: 'gallop', bassVoice: 'saw', leadVoice: 'saw', arpVoice: 'square', arp: 0.8, arpStep: 0.5, sync: 0.5, drop: true, harmony: true },
  },
  {
    name: 'Press Start', style: '16-bit title screen fanfare', mood: 'triumphant', form: 'oneshot', layout: 'shot-short', description: 'A one-shot title-screen fanfare: major at 101 bpm, steady rock backbeat, bold square hook. It states the hook in the intro, builds through verse and chorus, and lands on a big final chord. Wanted the simplest, most direct tune in the batch.',
    mode: 'major', meter: '4/4', bpm: [98, 104], ending: 'big',
    feel: { drums: 'rock', bass: 'groups', bassVoice: 'saw', leadVoice: 'square', arpVoice: 'pluck', arp: 0.5, harmony: true },
  },
  {
    name: 'Level Clear', style: '8-bit victory jingle', mood: 'playful', form: 'oneshot', layout: 'shot-tiny', description: 'A short win jingle as a one-shot: lydian at 136 bpm, busy square hook, octave-bouncing bass, a chorus repeated with the second one a tone higher, then a held final chord. Pure celebration in about 22 seconds.',
    meter: '4/4', vibe: { valence: 0.95, energy: 0.75 }, bpm: [124, 140], ending: 'big', keyLift: 2,
    feel: { drums: 'rock', bass: 'octaves', bassVoice: 'saw', leadVoice: 'square', arpVoice: 'square', arp: 0.6, sync: 0.5, density: 0.8, harmony: true },
  },
  {
    name: 'Glass Tide', style: '16-bit underwater, ambient', mood: 'eerie', form: 'loop', layout: 'loop-8', character: 'vibe', description: 'A vibe piece: slow underwater drift in 12/8 (four rolling groups of three), lydian at 67 bpm. No drums, a sub bass, a constant bell arp like light through water, and a sparse bell motif. Meant to be heard, not hummed. Floating, a little wonder.',
    mode: 'lydian', meter: '12/8', bpm: [66, 72],
    feel: { drums: 'none', bass: 'whole', bassVoice: 'sub', leadVoice: 'bell', arpVoice: 'bell', arp: 0.9 },
  },
  {
    name: 'Something Listens', style: '16-bit haunted dungeon, ambient', mood: 'eerie', form: 'loop', layout: 'loop-8', character: 'vibe', description: 'A vibe piece: a dungeon in 5/4 (a 4/4 bar with one beat too many, never quite settled), phrygian at 60 bpm. Sparse drums, a lone flute-like motif with long gaps, a faint bell arp. Uneasy through space rather than noise.',
    mode: 'phrygian', meter: '5/4', bpm: [56, 62],
    feel: { drums: 'sparse', bass: 'sparse', bassVoice: 'sub', leadVoice: 'flute', arpVoice: 'bell', arp: 0.4 },
  },
  {
    name: 'Hyperdrive', style: '8-bit space shooter, relentless', mood: 'urgent', form: 'loop', layout: 'loop-12', character: 'vibe', description: 'A frantic vibe piece: phrygian at 160 bpm, relentless eighth-note bass, a nonstop sixteenth square arp and driving drums with only a sparse lead over the top. The texture is the point, a scrolling starfield at speed. Not built to be hummed.',
    meter: '4/4', vibe: { energy: 0.92, tension: 0.6 }, bpm: [140, 160],
    feel: { drums: 'rock', bass: 'eighths', bassVoice: 'saw', leadVoice: 'saw', arpVoice: 'square', arp: 1, arpStep: 0.5, sync: 0.5, harmony: false },
  },
  {
    name: 'Neon Groove', style: '16-bit funk stage', mood: 'playful', form: 'loop', layout: 'loop-16', description: 'A funk stage: dorian at 108 bpm in 4/4, syncopated bass as the star, funk drums, a gritty saw hook. Sixteen bars with a climbing pre-chorus into an 8-bar chorus. Aiming for a head-nod that still sounds like a game level.',
    mode: 'dorian', meter: '4/4', bpm: [106, 112],
    feel: { drums: 'funk', bass: 'sync', bassVoice: 'saw', leadVoice: 'saw', arpVoice: 'pluck', arp: 0.4, sync: 0.6, harmony: false },
  },
  {
    name: 'Hold Forward', style: '16-bit speed run, bright', mood: 'triumphant', form: 'oneshot', layout: 'shot-short', description: 'A speed-run one-shot: lydian at 172 bpm and getting faster, bright square hook over octave bass and a plucked arp. Intro, verse, chorus, and a ritardando into a held final chord. Wanted the feeling of keeping the stick pushed forward.',
    meter: '4/4', vibe: { valence: 0.8, energy: 0.95 }, bpm: [160, 172], tempoArc: 'accel', ending: 'big',
    feel: { drums: 'rock', bass: 'octaves', bassVoice: 'saw', leadVoice: 'square', arpVoice: 'pluck', arp: 0.7, sync: 0.5, harmony: true },
  },
  {
    name: 'Turn Order', style: '16-bit RPG battle', mood: 'tense', form: 'oneshot', layout: 'shot-medium', description: "A turn-based battle as a one-shot: minor at 150 bpm, octave bass, saw hook doubled a third below in the choruses. Intro, verse, pre-chorus that drops out, chorus, bridge, last chorus a tone higher and faster, then a slowing, held ending. Epic, hero's-phrase melody.",
    mode: 'minor', meter: '4/4', bpm: [150, 154], keyLift: 2, tempoArc: 'lift', ending: 'big',
    feel: { drums: 'rock', bass: 'octaves', bassVoice: 'saw', leadVoice: 'saw', arpVoice: 'pluck', arp: 0.5, sync: 0.45, drop: true, harmony: true },
  },
  {
    name: 'Last Light', style: '16-bit ending, wistful ballad', mood: 'melancholy', form: 'oneshot', layout: 'shot-short', description: 'A wistful ballad as a one-shot: minor at 62 bpm in 3/4, flute-like hook over whole-note bass and a bell arp. It states the hook in the intro, grows through verse and chorus, and dies away rather than ending on a bang. A quiet end-credits feel.',
    mode: 'minor', meter: '3/4', bpm: [62, 66], ending: 'fade', tempoArc: 'steady', keyLift: 0,
    feel: { drums: 'none', bass: 'whole', bassVoice: 'sub', leadVoice: 'flute', arpVoice: 'bell', arp: 0.5 },
  },
  {
    name: 'Echo Cavern', style: '16-bit cave exploration', mood: 'cozy', form: 'loop', layout: 'loop-12', character: 'vibe', description: 'A vibe piece: a cave in changing meter. Verses are in 5/4 and the rest in 4/4, so the floor shifts under you at each section. Dorian at 77 bpm, sparse drums, bell motif, plucked arp like dripping echo. Mysterious but friendly.',
    mode: 'dorian', meter: { bySection: { verse: '5/4' }, fallback: '4/4' }, bpm: [76, 82],
    feel: { drums: 'sparse', bass: 'walk', bassVoice: 'sub', leadVoice: 'bell', arpVoice: 'pluck', arp: 0.7 },
  },
  {
    name: 'Panic Arcade', style: '8-bit arcade chase, frantic', mood: 'urgent', form: 'oneshot', layout: 'shot-short', character: 'vibe', description: 'A frantic vibe one-shot: phrygian at 176 bpm and speeding up, relentless eighth-note bass, sixteenth arps, four-on-the-floor drums, a sparse lead. A chase you feel in your pulse. It ends in a big resolve. Not built to be hummed.',
    meter: '4/4', vibe: { energy: 1, tension: 0.8, valence: 0.3 }, bpm: [168, 176], tempoArc: 'accel', ending: 'big',
    feel: { drums: 'four', bass: 'eighths', bassVoice: 'saw', leadVoice: 'square', arpVoice: 'square', arp: 0.9, arpStep: 0.5, sync: 0.5, harmony: true },
  },
  {
    name: 'Cloud Drift', style: '16-bit sky stage, dreamy', mood: 'cozy', form: 'loop', layout: 'loop-12', character: 'vibe', description: 'A vibe piece: a floating sky stage in 9/8 (three flowing groups of three), mixolydian at 93 bpm. Half-time drums, whole-note sub bass, a flute-like motif and a rolling plucked arp. Weightless and open, the opposite of the chase tracks.',
    mode: 'mixolydian', meter: '9/8', bpm: [92, 98],
    feel: { drums: 'half', bass: 'whole', bassVoice: 'sub', leadVoice: 'flute', arpVoice: 'pluck', arp: 0.9 },
  },
];
