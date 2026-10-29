// Quality gate and variety report for a batch of songs. Hard rules are problems (the batch is not done); coverage
// shortfalls are warnings (look at them, but a themed batch may be lopsided on purpose).
import { songSeconds } from './compose.ts';
import type { Song } from './types.ts';

export interface BatchCheck {
  problems: string[];
  warnings: string[];
  report: string[];
}

const count = <T>(items: T[], key: (t: T) => string): Record<string, number> => {
  const out: Record<string, number> = {};
  for (const i of items) out[key(i)] = (out[key(i)] ?? 0) + 1;
  return out;
};
const line = (label: string, c: Record<string, number>) => `${label}: ${Object.entries(c).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ')}`;
const bucket = (bpm: number) => (bpm < 80 ? 'slow (<80)' : bpm < 110 ? 'mid-slow (80-109)' : bpm < 140 ? 'mid-fast (110-139)' : 'fast (140+)');

export function checkBatch(songs: Song[]): BatchCheck {
  const problems: string[] = [];
  const warnings: string[] = [];
  const n = songs.length;

  const seen = new Set<string>();
  const names = new Set<string>();
  const descs = new Set<string>();
  for (const s of songs) {
    if (seen.has(s.id)) problems.push(`duplicate id ${s.id}`);
    seen.add(s.id);
    const nm = s.name.trim().toLowerCase();
    if (names.has(nm)) problems.push(`duplicate name "${s.name}"`);
    names.add(nm);
    if (descs.has(s.description)) problems.push(`${s.id}: description copied from another song`);
    descs.add(s.description);
    if (s.description.length < 60 || s.description.length > 280) problems.push(`${s.id}: description is ${s.description.length} characters (want 60 to 280)`);
    if (s.hookBars.length < 1) problems.push(`${s.id}: no hook bars recorded`);
    const secs = songSeconds(s);
    if (s.form === 'loop') {
      if (s.bars.length < 8) problems.push(`${s.id}: a loop needs at least 8 bars`);
      if (secs < 8) problems.push(`${s.id}: loop is only ${secs}s`);
      if (secs > 90) problems.push(`${s.id}: loop is ${secs}s (over 90)`);
      if (s.tempoMap.length !== 1) problems.push(`${s.id}: a loop must keep one tempo`);
    } else {
      if (s.bars.length > 4) problems.push(`${s.id}: a stinger is at most 4 bars`);
      if (secs > 14) problems.push(`${s.id}: stinger is ${secs}s (over 14)`);
    }
  }

  const loops = songs.filter((s) => s.form === 'loop');
  const stingers = songs.filter((s) => s.form === 'oneshot');
  const modes = count(songs, (s) => s.scale);
  const meters = count(songs, (s) => s.meter);
  const tempo = count(songs, (s) => bucket(s.tempo));
  const character = count(loops, (s) => s.character);
  const styles = count(songs, (s) => s.style.split(',')[0]!.trim());

  // near duplicates: same mode, meter and style family at nearly the same tempo
  const sig = new Map<string, Song[]>();
  for (const s of loops) {
    const k = `${s.scale}|${s.meter}|${s.style.split(',')[0]!.trim()}|${Math.round(s.tempo / 8)}`;
    sig.set(k, [...(sig.get(k) ?? []), s]);
  }
  for (const group of sig.values()) if (group.length > 1) warnings.push(`near duplicates (same mode, meter, style and tempo): ${group.map((g) => g.name).join(', ')}`);

  if (n >= 10) {
    if (Object.keys(modes).length < Math.min(6, Math.ceil(n / 4))) warnings.push(`only ${Object.keys(modes).length} modes used`);
    if (Object.keys(meters).length < Math.min(4, Math.ceil(n / 8))) warnings.push(`only ${Object.keys(meters).length} time signatures used`);
    if (Object.keys(tempo).length < 4) warnings.push(`tempo buckets used: ${Object.keys(tempo).length} of 4`);
    if (!character.hook || !character.vibe) warnings.push('wants both hook songs and vibe pieces');
    if ((character.hook ?? 0) < loops.length * 0.3) warnings.push('fewer than 30% of loops are hook songs');
    if ((character.vibe ?? 0) < loops.length * 0.15) warnings.push('fewer than 15% of loops are vibe pieces');
    if (stingers.length < n * 0.1) warnings.push('fewer than 10% stingers; events need punctuation too');
    if ((meters['4/4'] ?? 0) > n * 0.7) warnings.push('over 70% in plain 4/4');
    if (!songs.some((s) => s.meter.includes('+'))) warnings.push('no song changes meter');
    const biggest = Math.max(...Object.values(styles));
    if (biggest > Math.max(3, n * 0.2)) warnings.push(`one style family makes up ${biggest} of ${n} songs`);
  }

  const report = [
    `${n} songs: ${loops.length} loops, ${stingers.length} stingers`,
    line('modes', modes), line('time signatures', meters), line('tempo', tempo), line('loop character', character), line('style families', styles),
    `loop lengths: ${loops.length ? `${Math.min(...loops.map(songSeconds))}s to ${Math.max(...loops.map(songSeconds))}s` : 'none'}`,
  ];
  return { problems, warnings, report };
}
