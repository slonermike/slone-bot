// Beat <-> seconds with a tempo map. Segments are constant tempo, or a linear tempo ramp to the next point.
import type { TempoPoint } from './types.ts';

const ln = Math.log;

/** Seconds from the segment start to beat `x` inside segment [x0, x1] going from b0 to b1 bpm. */
function segSeconds(x0: number, x1: number, b0: number, b1: number, ramp: boolean, x: number): number {
  const span = x1 - x0;
  const len = x - x0;
  if (!ramp || b1 === b0 || !Number.isFinite(span) || span <= 0) return (60 * len) / b0;
  const bx = b0 + ((b1 - b0) * len) / span;
  return bx === b0 ? (60 * len) / b0 : ((60 * span) / (b1 - b0)) * ln(bx / b0);
}

function check(map: TempoPoint[]): void {
  if (!map.length || map[0]!.beat !== 0) throw new Error('tempo map must start at beat 0');
}

export function secondsAt(map: TempoPoint[], beat: number): number {
  check(map);
  let total = 0;
  for (let i = 0; i < map.length; i++) {
    const p = map[i]!;
    const next = map[i + 1];
    const end = next ? next.beat : Infinity;
    const b1 = next ? next.bpm : p.bpm;
    if (beat <= end) return total + segSeconds(p.beat, end, p.bpm, b1, !!p.ramp && !!next, beat);
    total += segSeconds(p.beat, end, p.bpm, b1, !!p.ramp, end);
  }
  return total;
}

/** Inverse of secondsAt, for the playhead. */
export function beatAt(map: TempoPoint[], seconds: number): number {
  check(map);
  let t0 = 0;
  for (let i = 0; i < map.length; i++) {
    const p = map[i]!;
    const next = map[i + 1];
    const end = next ? next.beat : Infinity;
    const b1 = next ? next.bpm : p.bpm;
    const ramp = !!p.ramp && !!next && b1 !== p.bpm;
    const segLen = next ? segSeconds(p.beat, end, p.bpm, b1, ramp, end) : Infinity;
    if (seconds <= t0 + segLen) {
      const s = seconds - t0;
      if (!ramp) return p.beat + (s * p.bpm) / 60;
      const bx = p.bpm * Math.exp((s * (b1 - p.bpm)) / (60 * (end - p.beat)));
      return p.beat + ((bx - p.bpm) * (end - p.beat)) / (b1 - p.bpm);
    }
    t0 += segLen;
  }
  return 0;
}
