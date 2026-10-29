// Registry of song batches. To add a batch: write src/music/batches/bNN.ts exporting an array of briefs, import it
// here, and run `npm run songs -- --batch bNN` (see docs/tech/11-music-batch-runbook.md).
import { composeSong } from './compose.ts';
import { hashSeed } from '../core/rng.ts';
import type { Brief } from './briefs.ts';
import { BATCH_2 } from './briefs.ts';
import type { Song } from './types.ts';

export const BATCHES: Record<string, Brief[]> = {
  b02: BATCH_2,
};

/** Songs of a batch, in brief order. The seed comes from the batch name and position (so never reorder or delete briefs in a published batch), unless the brief carries its own `seed`. */
export function composeBatch(name: string): Song[] {
  const briefs = BATCHES[name];
  if (!briefs) throw new Error(`unknown batch "${name}"; known: ${Object.keys(BATCHES).join(', ')}`);
  return briefs.map((b, i) => composeSong({ ...b, seed: b.seed ?? hashSeed(`${name}:${i}`), batch: name, index: i + 1 }));
}
