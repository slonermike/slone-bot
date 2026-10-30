// A menu of musical choices, not a roll. Music has to fit the game, so the agent reasons from the game's target feeling,
// pressure and pacing to a choice. Left to habit, every game's music landed in the same place (92 to 120 bpm, 4/4, dorian
// or mixolydian, a rock or funk groove with a sync bass and a bell arp, "playful"), so this lists the whole spectrum with
// what each option does, and which generator settings produce it. `node scripts/night-state.mjs sound` prints it.
export const ROLES = {
  'build by layers': 'a quiet bed (pad, bass) from the start; each pressure layer brings in one more part (drums, arp, lead), so the music itself is the pressure gauge',
  'two moods': 'a calm loop and a tense loop in the same key; the game crossfades between them with its state, so safe and unsafe sound different',
  'silence is a tool': 'long stretches of near-silence (release the loop, keep only feedback sounds), with the music returning for the moments that matter, so its arrival is felt',
  'danger strip': 'the full music plays when safe; when danger rises it strips down to bass and drums with the melody gone, then the melody returns with a crash on relief',
  'reward bloom': 'a sparse, unsettled bed; the hook and harmony appear only when the player earns a power moment, so the hook is the reward',
  'pulse as clock': 'a short chain of loops at rising tempo in one key, swapped as the game gets more urgent; the pulse is the countdown',
  'stinger-led': 'a minimal, almost-ambient loop so that the stingers (win, lose, boss, powerup, secret) carry the personality and every event is punctuated',
  'one big hook': 'the music is the game\'s signature: a strong, catchy hook present all the time; the game is built to be hummed',
};
export const BANDS = {
  slow: { bpm: [54, 78], note: 'unhurried; room to breathe; tension through space and long notes' },
  swaying: { bpm: [80, 100], note: 'walking pace; relaxed, or heavy if the drums are half-time' },
  brisk: { bpm: [104, 124], note: 'the zone almost every game landed in by habit; fine when it truly fits, and most interesting away from 4/4' },
  fast: { bpm: [128, 158], note: 'driving; urgency and momentum' },
  frantic: { bpm: [162, 192], note: 'panic and chase; frantic is a vibe, not noise' },
};
export const METERS = {
  '4/4': 'steady and driving',
  '3/4': 'a sway; waltz, lilt, or tipsy',
  '6/8': 'rolling; a boat, a march in a swing, a lullaby',
  '12/8': 'a slow roll with weight',
  '2/4': 'a march, a polka, a hop',
  '5/4': 'off-balance but graceful; keeps you leaning',
  '7/8': 'rushed and tumbling; a stumble that recovers',
  '9/8': 'a lilting triple of triples; skipping',
};
export const MODES = {
  lydian: 'bright and floating; wonder, lift',
  major: 'open and plain; warm, direct',
  mixolydian: 'bluesy major; swagger, a shrug',
  dorian: 'a hopeful minor; cool and wry',
  minor: 'sad or serious; earnest',
  'harmonic minor': 'dramatic, a little exotic; menace and intrigue',
  phrygian: 'dark and tense; a flat second that bites',
};
// texture: instrumentation and rhythm, as the generator's `feel` options
export const TEXTURES = {
  'beatless drift': { feel: { drums: 'none', bass: 'whole', bassVoice: 'sub', leadVoice: 'flute', arpVoice: 'bell', arp: 0.3, arpStep: 2, pad: true, density: 0.25, riff: false, harmony: false }, character: 'vibe', note: 'no drums at all: a pad, a held bass, a few bell notes; mood and space first' },
  'music box': { feel: { drums: 'sparse', bass: 'sparse', bassVoice: 'warm', leadVoice: 'bell', arpVoice: 'pluck', arp: 0.6, arpStep: 1, pad: false, density: 0.45, riff: false, harmony: false }, character: 'hook', note: 'tiny, bright, delicate; plucks and bells with a whisper of rhythm' },
  'heavy half-time': { feel: { drums: 'half', bass: 'octaves', bassVoice: 'sub', leadVoice: 'saw', arpVoice: 'pluck', arp: 0, arpStep: 1, pad: true, density: 0.4, riff: true, harmony: false }, character: 'hook', note: 'slow, heavy snare on the third beat; low riffs; weight and menace' },
  'driving four-floor': { feel: { drums: 'four', bass: 'eighths', bassVoice: 'saw', leadVoice: 'square', arpVoice: 'pluck', arp: 0.8, arpStep: 0.5, pad: false, density: 0.7, riff: false, harmony: true }, character: 'hook', note: 'kick on every beat, running eighths, fast arpeggio; momentum' },
  'march and brass': { feel: { drums: 'march', bass: 'octaves', bassVoice: 'warm', leadVoice: 'square', arpVoice: 'pluck', arp: 0.2, arpStep: 1, pad: false, density: 0.6, riff: false, harmony: true }, character: 'hook', note: 'a parade; comic or heroic; square lead over snare rolls' },
  'gallop and chase': { feel: { drums: 'rock', bass: 'gallop', bassVoice: 'saw', leadVoice: 'saw', arpVoice: 'pluck', arp: 0.7, arpStep: 0.5, pad: false, density: 0.8, riff: true, harmony: true }, character: 'hook', note: 'galloping bass, riffs, urgency; a chase' },
  'walking bass noir': { feel: { drums: 'soft', bass: 'walk', bassVoice: 'warm', leadVoice: 'flute', arpVoice: 'pluck', arp: 0.2, arpStep: 1, pad: true, density: 0.35, riff: false, harmony: false }, character: 'vibe', note: 'brushed drums, a walking bass, a lonely flute; late-night and unhurried' },
  'pulse and shimmer': { feel: { drums: 'none', bass: 'groups', bassVoice: 'sub', leadVoice: 'bell', arpVoice: 'bell', arp: 0.9, arpStep: 0.5, pad: true, density: 0.3, riff: false, harmony: false }, character: 'vibe', note: 'no drums; a steady bass pulse under a shimmering arpeggio; hypnotic' },
  'funk-pop groove': { feel: { drums: 'funk', bass: 'sync', bassVoice: 'saw', leadVoice: 'square', arpVoice: 'pluck', arp: 0.5, arpStep: 1, pad: false, density: 0.6, riff: false, harmony: true }, character: 'hook', note: 'the one every game picked by default; use it only if it is truly right for the game, not because it is familiar' },
};
export const LAYOUTS = {
  'loop-8': 'two short sections; compact',
  'loop-12': 'verse, build, payoff; a clear arc inside the loop',
  'loop-16': 'long payoff; for a game with room to breathe',
  'groove-8': 'one steady groove with the hook every four bars; for games that gate the hook behind an earned moment',
};
// Tempo bands and meters each texture tends to suit (a guide, not a limit).
const FITS = {
  'beatless drift': { bands: ['slow', 'swaying'], meters: ['4/4', '3/4', '6/8', '12/8', '5/4', '9/8'] },
  'music box': { bands: ['slow', 'swaying', 'brisk'], meters: ['3/4', '6/8', '9/8', '4/4'] },
  'heavy half-time': { bands: ['slow', 'swaying', 'fast'], meters: ['4/4', '7/8', '5/4'] },
  'driving four-floor': { bands: ['fast', 'frantic'], meters: ['4/4', '2/4', '7/8'] },
  'march and brass': { bands: ['swaying', 'brisk', 'fast'], meters: ['2/4', '4/4', '6/8'] },
  'gallop and chase': { bands: ['fast', 'frantic'], meters: ['4/4', '6/8', '7/8', '12/8'] },
  'walking bass noir': { bands: ['slow', 'swaying'], meters: ['4/4', '3/4', '12/8', '5/4'] },
  'pulse and shimmer': { bands: ['swaying', 'fast', 'frantic'], meters: ['4/4', '3/4', '7/8', '5/4', '9/8'] },
  'funk-pop groove': { bands: ['swaying', 'fast'], meters: ['4/4', '7/8'] },
};

const row = (k, v) => `  ${k.padEnd(20)} ${v}`;
/** The full menu, as text. Nothing here is recommended or random: choose from the game's feeling, pressure and pacing. */
export function formatMenu() {
  const out = [];
  out.push('MUSIC MENU. Nothing here is rolled or recommended: reason from the game (target feeling, pressure, pacing) to a choice, and write it in the brief\'s Music plan.');
  out.push('Weigh at least three options from different parts of the spectrum, say what each would do to the game, then choose. The default every earlier game fell into: 4/4 at 100 to 125 bpm in dorian or mixolydian with a groove.', '');
  out.push('HOW MUSIC CAN SHAPE THE GAME (pick one or combine):');
  for (const [k, v] of Object.entries(ROLES)) out.push(row(k, v));
  out.push('', 'TEMPO BANDS:');
  for (const [k, v] of Object.entries(BANDS)) out.push(row(`${k} ${v.bpm[0]}-${v.bpm[1]}`, v.note));
  out.push('', 'METERS:');
  for (const [k, v] of Object.entries(METERS)) out.push(row(k, v));
  out.push('', 'MODES:');
  for (const [k, v] of Object.entries(MODES)) out.push(row(k, v));
  out.push('', 'TEXTURES (generator `feel` and `character`; bands and meters they tend to suit):');
  for (const [k, v] of Object.entries(TEXTURES)) {
    out.push(row(k, v.note));
    out.push(row('', `suits: ${FITS[k].bands.join(', ')}; ${FITS[k].meters.join(' ')}; character: ${v.character}; feel: ${JSON.stringify(v.feel)}`));
  }
  out.push('', 'LAYOUTS:');
  for (const [k, v] of Object.entries(LAYOUTS)) out.push(row(k, v));
  out.push('', 'A game is a set, not one song: a calm and a tense loop (or a real layer plan), and three to five stingers. Keep one tonic (`root`) across the set; modes may differ on purpose.',
    'Techniques and the feeling-to-sound table: docs/design/06-music-craft.md, "Music is a design tool". Check the result with reviewGameMusic (src/music/review.ts).',
    'Ledger tag (a record, not a constraint): music: <band>/<meter>/<mode>/<texture>');
  return out.join('\n');
}
export { FITS };
