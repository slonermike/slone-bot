// The nightly sound identity roll. Left to themselves, every game's music landed in the same place: 92 to 120 bpm,
// 4/4, dorian or mixolydian, a rock or funk groove with a sync bass and a bell arp, "playful". This roll gives each game a
// different sonic starting point (tempo, meter, mode, texture, structure, and the way the music shapes pacing). The agent
// follows it, may override ONE dimension with a reason in the brief, and records `music: band/meter/mode/texture` in the ledger.
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
  brisk: { bpm: [104, 124], note: 'the default zone almost every game lands in; only on purpose, never 4/4 here' },
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
  'funk-pop groove': { feel: { drums: 'funk', bass: 'sync', bassVoice: 'saw', leadVoice: 'square', arpVoice: 'pluck', arp: 0.5, arpStep: 1, pad: false, density: 0.6, riff: false, harmony: true }, character: 'hook', note: 'the one every game picked by default; allowed only if nothing else fits, and never with a brisk 4/4' },
};
export const LAYOUTS = {
  'loop-8': 'two short sections; compact',
  'loop-12': 'verse, build, payoff; a clear arc inside the loop',
  'loop-16': 'long payoff; for a game with room to breathe',
  'groove-8': 'one steady groove with the hook every four bars; for games that gate the hook behind an earned moment',
};
// Tempo bands and meters each texture pairs well with; keeps the roll coherent while still surprising.
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
const LAYOUT_FOR = { 'beatless drift': ['loop-8', 'loop-12'], 'pulse and shimmer': ['loop-8', 'groove-8'] };

function mulberry32(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];

/** `music: band/meter/mode/texture` tags from the ledger, oldest first. */
export function parseLedgerSounds(md) {
  const out = [];
  for (const line of md.split(/\r?\n/)) {
    const m = /music:\s*([a-z]+)\s*\/\s*([0-9]+\/[0-9]+)\s*\/\s*([a-z ]+?)\s*\/\s*([a-z -]+?)\s*(?:\||$)/.exec(line);
    if (m) out.push({ band: m[1], meter: m[2], mode: m[3], texture: m[4] });
  }
  return out;
}

/**
 * Seeded roll. Band, meter, mode and texture must each differ from the last `recent` games in the ledger (meter 4/4 is
 * allowed to repeat only if no other meter fits). The brisk band never goes with 4/4, and the funk-pop groove default
 * is excluded unless it comes up as the only choice. The role (the music's job in pacing) is free.
 */
export function pickSound(history, seed, recent = 3) {
  const rng = mulberry32(seed);
  const last = history.slice(-recent);
  const bad = (dim, v) => last.some((l) => l[dim] === v);
  for (let tries = 0; tries < 2000; tries++) {
    const texture = pick(rng, Object.keys(TEXTURES).filter((t) => t !== 'funk-pop groove'));
    const fit = FITS[texture];
    const band = pick(rng, fit.bands);
    const meter = pick(rng, fit.meters);
    const mode = pick(rng, Object.keys(MODES));
    if (band === 'brisk' && meter === '4/4') continue;
    if (bad('band', band) || bad('texture', texture) || bad('mode', mode)) continue;
    if (meter !== '4/4' && bad('meter', meter)) continue;
    const [lo, hi] = BANDS[band].bpm;
    const bpm = Math.round(lo + rng() * (hi - lo));
    return {
      role: pick(rng, Object.keys(ROLES)),
      band, bpm, meter, mode, texture,
      layout: pick(rng, LAYOUT_FOR[texture] ?? Object.keys(LAYOUTS)),
    };
  }
  throw new Error('no sound identity satisfies the recent-history rules');
}

export function formatSound(s) {
  const t = TEXTURES[s.texture];
  return [
    `role:    ${s.role}: ${ROLES[s.role]}`,
    `tempo:   ${s.band} (${s.bpm} bpm): ${BANDS[s.band].note}`,
    `meter:   ${s.meter}: ${METERS[s.meter]}`,
    `mode:    ${s.mode}: ${MODES[s.mode]}`,
    `texture: ${s.texture}: ${t.note}`,
    `layout:  ${s.layout}: ${LAYOUTS[s.layout]}`,
    '',
    'Start composeSong from: ' + JSON.stringify({ mode: s.mode, meter: s.meter, bpm: s.bpm, layout: s.layout, character: t.character, feel: t.feel }),
    `ledger tag: music: ${s.band}/${s.meter}/${s.mode}/${s.texture}`,
    'Follow this sound. You may override ONE dimension if the game needs it; say which and why in the brief\'s Music plan.',
    'A game is not one song: write the other loops, the stingers and the layer plan too (docs/design/06-music-craft.md, "Music as a design tool").',
  ].join('\n');
}
