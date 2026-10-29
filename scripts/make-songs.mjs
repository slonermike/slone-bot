#!/usr/bin/env node
// Generate a batch of songs into music/songs/ (one .json with the notes and one .mid per song).
//   node scripts/make-songs.mjs --batch b01          # the 20 curated briefs in src/music/briefs.ts
// Deterministic: same batch name and brief order give the same songs.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { composeSong } from '../src/music/compose.ts';
import { writeMidi } from '../src/music/midi.ts';
import { BATCH_1 } from '../src/music/briefs.ts';
import { hashSeed } from '../src/core/rng.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const batch = args[args.indexOf('--batch') + 1] ?? 'b01';
const outDir = path.join(ROOT, 'music', 'songs');
fs.mkdirSync(outDir, { recursive: true });

BATCH_1.forEach((brief, i) => {
  const song = composeSong({ ...brief, seed: hashSeed(`${batch}:${i}`), batch, index: i + 1 });
  fs.writeFileSync(path.join(outDir, `${song.id}.json`), JSON.stringify(song));
  fs.writeFileSync(path.join(outDir, `${song.id}.mid`), writeMidi(song));
  console.log(`${song.id}  ${song.tempo} bpm  ${song.scale}  ${song.bars} bars  [${song.style}]`);
});
