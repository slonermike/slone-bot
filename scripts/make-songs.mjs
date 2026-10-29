#!/usr/bin/env node
// Generate a batch of songs into music/songs/ (one .json with the notes and one .mid per song).
//   node scripts/make-songs.mjs --batch b02          # the 20 curated briefs in src/music/briefs.ts
//   node scripts/make-songs.mjs --facts              # print what each brief turned into, write nothing
// Deterministic: same batch name and brief order give the same songs.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { composeSong, songSeconds } from '../src/music/compose.ts';
import { writeMidi } from '../src/music/midi.ts';
import { BATCH_2 } from '../src/music/briefs.ts';
import { hashSeed } from '../src/core/rng.ts';
import { vibeOf } from '../src/music/vibe.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const batch = args.includes('--batch') ? args[args.indexOf('--batch') + 1] : 'b02';
const factsOnly = args.includes('--facts');
const outDir = path.join(ROOT, 'music', 'songs');
if (!factsOnly) {
  fs.mkdirSync(outDir, { recursive: true });
  for (const f of fs.readdirSync(outDir)) if (f.startsWith(`${batch}-`)) fs.rmSync(path.join(outDir, f));
}

BATCH_2.forEach((brief, i) => {
  const song = composeSong({ ...brief, seed: hashSeed(`${batch}:${i}`), batch, index: i + 1 });
  const v = vibeOf({ mode: song.scale, meters: song.bars.map((b) => `${b.num}/${b.den}`), bpm: song.tempo });
  console.log(`${song.id}  ${song.form} ${song.character}  ${song.tempo} bpm  ${song.scale}  ${song.meter}  ${song.bars.length} bars ${songSeconds(song)}s  hooks ${song.hookBars.length}  E${v.energy.toFixed(2)} V${v.valence.toFixed(2)} T${v.tension.toFixed(2)}`);
  if (factsOnly) return;
  fs.writeFileSync(path.join(outDir, `${song.id}.json`), JSON.stringify(song));
  fs.writeFileSync(path.join(outDir, `${song.id}.mid`), writeMidi(song));
});
