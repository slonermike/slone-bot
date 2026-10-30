// Genre roll for a night's theme. Candidates are listed below; the roll is seeded by the night's date
// (or --seed text), so it is reproducible and the choice is not up to the agent's taste.
// usage: node scripts/genre-roll.mjs [--seed 2026-10-30]
const GENRES = [
  { id: 'tower-defense', name: 'Tower defense', spark: 'Place towers on a lane; waves chew them up; time ticks only when a tower breaks.' },
  { id: 'contraption', name: 'Contraption / bridge builder', spark: 'Place struts and gadgets under load; the world is frozen until a piece fails, then it lurches forward.' },
  { id: 'colony-sim', name: 'Colony / city sim', spark: 'Tend a little settlement; every breakdown advances a day and the weather moves on.' },
  { id: 'stacker', name: 'Stacker / falling-block puzzle', spark: 'Place pieces onto a growing structure; cracks are what advance the clock.' },
  { id: 'clockwork-factory', name: 'Clockwork factory / logistics', spark: 'Lay belts and machines; a jam or breakage is the only tick of the clock.' },
];
const args = process.argv.slice(2);
const seed = args.includes('--seed') ? args[args.indexOf('--seed') + 1] : new Date().toISOString().slice(0, 10);
let h = 2166136261;
for (const c of seed) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0;
const pick = GENRES[h % GENRES.length];
console.log(`seed ${seed}\ncandidates: ${GENRES.map((g) => g.id).join(', ')}\nROLLED: ${pick.id} | ${pick.name}\n${pick.spark}`);
