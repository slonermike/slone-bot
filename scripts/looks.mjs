// The nightly visual identity roll. Every game gets a different look so the collection does not converge on one style
// (the demo's look is deliberately excluded). A look is five dimensions; the agent follows it, may override ONE
// dimension with a one-line reason in the brief, and records `look: palette/shapes/rendering` in the ledger.
export const PALETTES = {
  ember: 'deep charcoal ground; amber, orange and brick-red accents',
  lagoon: 'navy-teal ground; aqua and seafoam, one coral highlight',
  paper: 'warm off-white ground; ink-black lines; one spot color',
  candy: 'cream ground; pastel pink, mint and lilac; soft shadows',
  'neon-noir': 'near-black ground; two saturated neons (magenta and cyan) and nothing else',
  earth: 'ochre, olive, brick and bone; no pure white or black',
  'mono-plus-one': 'one hue in five tints, plus white and one contrasting accent',
  sunset: 'a violet-to-orange gradient sky; dark silhouettes against it',
  forest: 'deep greens, moss and bone; one red accent',
  arctic: 'pale blues, white and slate; one orange accent',
  'sun-bleached': 'washed-out yellows, sand and sky blue; high key, low contrast',
  'deep-space': 'ink-purple ground; cold white points and one hot-pink accent',
};
export const SHAPES = {
  'circles and blobs': 'round, soft, squishy forms',
  'hard polygons': 'angular shards and facets',
  'thin lines': 'wireframes and single-pixel-feel strokes, mostly empty space',
  'pixel blocks': 'chunky grid cells, everything snaps to a grid',
  'paper cutouts': 'flat shapes with a small offset drop shadow, like layered paper',
  'rounded cards': 'rounded rectangles, tiles and badges',
  'stars and spikes': 'pointed, radiating forms',
  'ribbons and curves': 'flowing bezier strands and swooshes',
};
export const RENDERINGS = {
  'flat fills': 'solid fills, no outlines, no gradients',
  'thick outlines': 'fat dark outlines around everything, like ink',
  'glow on dark': 'bright forms with bloom on a dark ground',
  'soft gradients': 'smooth shading and gradients',
  'hatched lines': 'texture from lines and stipple, like an engraving',
  dithered: 'two-tone dither patterns and few colors',
};
export const FRAMINGS = {
  'top-down arena': 'one screen, seen from above',
  'side view': 'a side-on screen with a sense of gravity',
  'vertical shaft': 'a tall column the action moves along',
  'radial': 'everything arranged around a center',
  'scrolling lane': 'a lane or track scrolling past',
  'faux isometric': 'a diagonal, isometric-feeling tabletop',
};
export const UIS = {
  'minimal text': 'tiny, quiet text; almost no chrome',
  'bold arcade': 'big, chunky score and labels',
  'in the world': 'UI drawn as part of the scene',
  'stickers': 'badges and stickers',
};

/** The demo (a navy ground, an amber ball, rainbow confetti, glow) is a test fixture, not a house style. */
export const DEMO_LOOK = { palette: 'ember', shapes: 'circles and blobs', rendering: 'glow on dark' };

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

/** `look: palette/shapes/rendering` entries from the ledger, oldest first. */
export function parseLedgerLooks(md) {
  const out = [];
  for (const line of md.split(/\r?\n/)) {
    const m = /look:\s*([a-z0-9-]+)\s*\/\s*([a-z ]+?)\s*\/\s*([a-z ]+?)\s*(?:\||$)/.exec(line);
    if (m) out.push({ palette: m[1], shapes: m[2], rendering: m[3] });
  }
  return out;
}

const pick = (rng, obj) => {
  const keys = Object.keys(obj);
  return keys[Math.floor(rng() * keys.length)];
};

/**
 * Seeded roll. Palette, shapes and rendering must each differ from the last `recent` looks in the ledger, and the
 * whole look may not share two of the three with the demo. Framing and UI are free hints (the core verb decides).
 */
export function pickLook(history, seed, recent = 3) {
  const rng = mulberry32(seed);
  const last = history.slice(-recent);
  const bad = (dim, v) => last.some((l) => l[dim] === v);
  for (let tries = 0; tries < 1000; tries++) {
    const look = {
      palette: pick(rng, PALETTES),
      shapes: pick(rng, SHAPES),
      rendering: pick(rng, RENDERINGS),
      framing: pick(rng, FRAMINGS),
      ui: pick(rng, UIS),
    };
    if (bad('palette', look.palette) || bad('shapes', look.shapes) || bad('rendering', look.rendering)) continue;
    const likeDemo = ['palette', 'shapes', 'rendering'].filter((d) => look[d] === DEMO_LOOK[d]).length;
    if (likeDemo >= 2) continue;
    return look;
  }
  throw new Error('no look satisfies the recent-history rules');
}

export function formatLook(look) {
  return [
    `palette:   ${look.palette}: ${PALETTES[look.palette]}`,
    `shapes:    ${look.shapes}: ${SHAPES[look.shapes]}`,
    `rendering: ${look.rendering}: ${RENDERINGS[look.rendering]}`,
    `framing:   ${look.framing}: ${FRAMINGS[look.framing]} (a hint; the core verb decides)`,
    `ui:        ${look.ui}: ${UIS[look.ui]}`,
    '',
    `ledger tag: look: ${look.palette}/${look.shapes}/${look.rendering}`,
    'Follow this look. You may override ONE dimension if the core verb needs it; say which and why in the brief.',
  ].join('\n');
}
