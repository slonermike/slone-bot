// Identity of the current run. Nights used to be keyed by calendar date, so a second run on the same day hit
// "already rolled tonight" and drew the same seeded atoms, look and genre as the first. A run is now keyed by the
// start stamp that `night-state.mjs start` writes into NIGHT_STATE.md, so runs can happen at any time, any number per day.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** "2026-10-30T04:12:09" for the run that stamped NIGHT_STATE.md, else today's date (no run started yet). */
export function runKey(file = process.env.NIGHT_STATE_FILE || path.join(ROOT, 'NIGHT_STATE.md'), now = new Date()) {
  try {
    const m = /^started:\s*(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/m.exec(fs.readFileSync(file, 'utf8'));
    if (m) return m[1];
  } catch { /* no state file yet */ }
  return now.toISOString().slice(0, 10);
}
