#!/usr/bin/env node
// Generate, inspect and check a batch of songs.
//   npm run songs -- --batch b03            # write music/songs/<id>.json and .mid for the batch (replaces that batch's files)
//   npm run songs -- --batch b03 --facts    # print what each brief turned into, write nothing
//   npm run songs -- --batch b03 --check    # variety report; exits 1 if a hard rule is broken
// Batches are registered in src/music/batches.ts. Deterministic: the same briefs give the same songs.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BATCHES, composeBatch } from '../src/music/batches.ts';
import { songSeconds } from '../src/music/compose.ts';
import { checkBatch } from '../src/music/coverage.ts';
import { writeMidi } from '../src/music/midi.ts';
import { vibeOf } from '../src/music/vibe.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const batch = args.includes('--batch') ? args[args.indexOf('--batch') + 1] : undefined;
if (!batch || !BATCHES[batch]) {
  console.error(`usage: npm run songs -- --batch <${Object.keys(BATCHES).join('|')}> [--facts | --check]`);
  process.exit(1);
}
const songs = composeBatch(batch);
const outDir = path.join(ROOT, 'music', 'songs');

if (args.includes('--check')) {
  const c = checkBatch(songs);
  console.log(c.report.join('\n'));
  for (const w of c.warnings) console.log(`warning: ${w}`);
  for (const p of c.problems) console.log(`PROBLEM: ${p}`);
  console.log(c.problems.length ? `\n${c.problems.length} problem(s)` : `\nOK (${c.warnings.length} warning(s))`);
  process.exit(c.problems.length ? 1 : 0);
}

const factsOnly = args.includes('--facts');
if (!factsOnly) {
  fs.mkdirSync(outDir, { recursive: true });
  for (const f of fs.readdirSync(outDir)) if (f.startsWith(`${batch}-`)) fs.rmSync(path.join(outDir, f));
}
for (const song of songs) {
  const v = vibeOf({ mode: song.scale, meters: song.bars.map((b) => `${b.num}/${b.den}`), bpm: song.tempo });
  console.log(`${song.id}  ${song.form} ${song.character}  ${song.tempo} bpm  ${song.scale}  ${song.meter}  ${song.bars.length} bars ${songSeconds(song)}s  hooks ${song.hookBars.length}  E${v.energy.toFixed(2)} V${v.valence.toFixed(2)} T${v.tension.toFixed(2)}`);
  if (factsOnly) continue;
  fs.writeFileSync(path.join(outDir, `${song.id}.json`), JSON.stringify(song));
  fs.writeFileSync(path.join(outDir, `${song.id}.mid`), writeMidi(song));
}
