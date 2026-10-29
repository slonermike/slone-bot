// The second batch (b02): twenty pieces in the spirit of 8-bit and 16-bit era game music, with 80s rock and 2000s pop
// hook craft mixed in. 15 loops (they play under ongoing action, so they have no fixed length and lead back into
// themselves) and 5 one-shot stingers of two to four bars that mark an event (level cleared, you died, boss down,
// power-up, secret found). Loops are hook songs or vibe pieces (texture and mood first, at any tempo, frantic included); time signatures
// range over 4/4, 2/4, 3/4, 6/8, 7/8, 5/4, 9/8, 12/8, one song changes meter by section and one every few bars.
// Where a brief leaves mode or tempo open, the vibe formula (vibe.ts) picks them from the target vibe.
// Style sketches, not copies: every melody is generated from a seed.
import type { ComposeOptions, StingerOptions } from './compose.ts';

type Brief = Omit<ComposeOptions, 'seed' | 'batch' | 'index'> | Omit<StingerOptions, 'seed' | 'batch' | 'index'>;

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
    name: 'Coastline', style: '2000s pop-flavored seaside drive', mood: 'triumphant', form: 'loop', layout: 'loop-16', description: 'A seaside drive loop with a pop shape: lydian at 121 bpm, four-on-the-floor, octave bass, a saw hook doubled a third below in the chorus. Sixteen bars: verse, a pre-chorus that climbs and drops out for a beat, then an 8-bar chorus that lands hard. Windows-down optimism.',
    mode: 'lydian', meter: '4/4', bpm: [120, 126],
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
    name: 'Last Throne', style: '16-bit final boss', mood: 'urgent', form: 'loop', layout: 'loop-16', description: 'A final-boss loop: phrygian at 152 bpm (the flat 2nd is menace). Mostly 4/4, but every fourth bar drops a beat to 3/4, which makes it lurch. Galloping bass, a saw hook doubled in the chorus, a pre-chorus that climbs and cuts out before the chorus hits.',
    mode: 'phrygian', meter: { cycle: ['4/4', '4/4', '4/4', '3/4'] }, bpm: [150, 156],
    feel: { drums: 'rock', bass: 'gallop', bassVoice: 'saw', leadVoice: 'saw', arpVoice: 'square', arp: 0.8, arpStep: 0.5, sync: 0.5, drop: true, harmony: true },
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
    name: 'Last Light', style: '16-bit ending, wistful ballad', mood: 'melancholy', form: 'loop', layout: 'loop-16', description: 'A wistful ballad loop: minor at 62 bpm in 3/4, a flute-like hook over whole-note bass and a bell arp. Twelve bars: verse, a pre-chorus that climbs, and a chorus that resolves on the tonic and then turns around into the verse. A quiet end-credits feel.',
    mode: 'minor', meter: '3/4', bpm: [62, 66],
    feel: { drums: 'none', bass: 'whole', bassVoice: 'sub', leadVoice: 'flute', arpVoice: 'bell', arp: 0.5 },
  },
  {
    name: 'Echo Cavern', style: '16-bit cave exploration', mood: 'cozy', form: 'loop', layout: 'loop-12', character: 'vibe', description: 'A vibe piece: a cave in changing meter. Verses are in 5/4 and the rest in 4/4, so the floor shifts under you at each section. Dorian at 77 bpm, sparse drums, bell motif, plucked arp like dripping echo. Mysterious but friendly.',
    mode: 'dorian', meter: { bySection: { verse: '5/4' }, fallback: '4/4' }, bpm: [76, 82],
    feel: { drums: 'sparse', bass: 'walk', bassVoice: 'sub', leadVoice: 'bell', arpVoice: 'pluck', arp: 0.7 },
  },
  {
    name: 'Cloud Drift', style: '16-bit sky stage, dreamy', mood: 'cozy', form: 'loop', layout: 'loop-12', character: 'vibe', description: 'A vibe piece: a floating sky stage in 9/8 (three flowing groups of three), mixolydian at 93 bpm. Half-time drums, whole-note sub bass, a flute-like motif and a rolling plucked arp. Weightless and open, the opposite of the chase tracks.',
    mode: 'mixolydian', meter: '9/8', bpm: [92, 98],
    feel: { drums: 'half', bass: 'whole', bassVoice: 'sub', leadVoice: 'flute', arpVoice: 'pluck', arp: 0.9 },
  },
  {
    name: 'Level Clear', style: '8-bit victory stinger', mood: 'playful', form: 'oneshot', event: 'win', description: 'A stinger for beating the level: four bars of 4/4 in major at about 132 bpm. A short hook, the same hook a step higher, a climbing run, then a held final chord with a crash while the tempo slows. Meant to land a hard, happy thump when something big just happened.',
    mode: 'major', meter: '4/4', bpm: [128, 136], bars: 4,
  },
  {
    name: 'Game Over', style: '16-bit defeat stinger', mood: 'melancholy', form: 'oneshot', event: 'lose', character: 'vibe', description: 'A stinger for dying, three bars of 4/4 in minor at about 96 bpm: a falling line over a sinking chord, slowing to about half speed and ending on a very low held tonic. No celebration, no hook, just a heavy slump so the failure registers.',
    mode: 'minor', meter: '4/4', bpm: [92, 100], bars: 3,
  },
  {
    name: 'Boss Down', style: '16-bit boss-defeated stinger', mood: 'triumphant', form: 'oneshot', event: 'boss', description: 'A stinger for a boss going down, four bars of 4/4 in mixolydian at about 112 bpm: a heavy low motif said twice, a leap onto the dominant, then a crash on a deep tonic with the tempo dragging to a stop. Weighty and victorious rather than bright.',
    mode: 'mixolydian', meter: '4/4', bpm: [108, 116], bars: 4,
  },
  {
    name: 'Power Up', style: '8-bit pickup stinger', mood: 'playful', form: 'oneshot', event: 'powerup', character: 'vibe', description: 'A stinger for a power-up, two bars in 6/8 at about 160 bpm and speeding up: a rising lydian arpeggio that climbs two octaves, then the top note rings with a sparkle of bells. Short and bright, under three seconds. A reward cue, not a tune.',
    mode: 'lydian', meter: '6/8', bpm: [150, 168], bars: 2,
  },
  {
    name: 'Secret Found', style: '16-bit discovery stinger', mood: 'eerie', form: 'oneshot', event: 'secret', character: 'vibe', description: 'A stinger for finding a secret, three bars in 3/4 at about 76 bpm: bells climbing out of the dark over a swelling pad, ending on a shimmering lydian chord as it slows. Wonder and mystery, no beat.',
    mode: 'lydian', meter: '3/4', bpm: [72, 80], bars: 3,
  },
];
