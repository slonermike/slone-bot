// Time signatures. A meter is described on the eighth-note grid: `groups` is how its eighths are grouped into
// beats (7/8 as 2+2+3, 6/8 as 3+3). Everything rhythmic (drums, bass, melody) hangs off the groups, so any
// meter gets a sensible backbeat and pulse.
export interface MeterSpec {
  num: number;
  den: number;
  groups: number[];
}

/** Common groupings per time signature; a song picks one so odd meters keep a consistent feel. */
export const GROUPINGS: Record<string, number[][]> = {
  '4/4': [[2, 2, 2, 2]],
  '2/4': [[2, 2]],
  '3/4': [[2, 2, 2]],
  '6/8': [[3, 3]],
  '9/8': [[3, 3, 3]],
  '12/8': [[3, 3, 3, 3]],
  '5/4': [[3, 2, 3, 2], [2, 3, 2, 3], [3, 3, 2, 2]],
  '5/8': [[3, 2], [2, 3]],
  '7/8': [[2, 2, 3], [3, 2, 2], [2, 3, 2]],
  '7/4': [[2, 2, 2, 2, 3, 3]],
};

export function parseMeter(name: string): { num: number; den: number } {
  const m = /^(\d+)\/(\d+)$/.exec(name);
  if (!m) throw new Error(`bad time signature "${name}"`);
  return { num: Number(m[1]), den: Number(m[2]) };
}

export function meterSpec(name: string, grouping = 0): MeterSpec {
  const { num, den } = parseMeter(name);
  const options = GROUPINGS[name];
  if (!options) throw new Error(`unsupported time signature "${name}"`);
  const groups = options[grouping % options.length]!;
  return { num, den, groups };
}

/** Eighth notes in a bar. */
export const eighthsOf = (m: Pick<MeterSpec, 'groups'>): number => m.groups.reduce((a, b) => a + b, 0);
/** Quarter-note beats in a bar. */
export const beatsOf = (m: Pick<MeterSpec, 'num' | 'den'>): number => (m.num * 4) / m.den;
/** Eighth offsets where each group begins. */
export function groupStarts(m: Pick<MeterSpec, 'groups'>): number[] {
  const out: number[] = [];
  let at = 0;
  for (const g of m.groups) { out.push(at); at += g; }
  return out;
}
