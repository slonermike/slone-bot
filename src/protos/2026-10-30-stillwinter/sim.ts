// Stillwinter sim: pure logic, no Pixi, no DOM, no audio, no Math.random.
// The world is frozen. Time (the `thaw` reserve) only flows after something breaks; enemies, spires and the
// sunrise clock all run on that flowing time. Everything on the grid is in cell coordinates (cell centre = integer).
import type { BalanceSpec, Ctx, InputState, SimEvent } from '../../core/types.ts';

export const N = 9;
export const THAW_CAP = 20;

export type Kind = 'spike' | 'crystal' | 'lantern' | 'chime' | 'prism';
export const KINDS: Kind[] = ['spike', 'crystal', 'lantern', 'chime', 'prism'];
export type EnemyKind = 'drift' | 'ram' | 'glider' | 'wisp' | 'thaw';

export interface SpireDef {
  cost: number;
  hp: number;
  range: number;
  cd: number;
  dmg: number;
  /** Dawn fraction at which the spire type unlocks. */
  unlock: number;
  /** Multiplier on the time released when it shatters. */
  thawMul: number;
  blast: number;
  label: string;
}
export const SPIRE: Record<Kind, SpireDef> = {
  spike: { cost: 3, hp: 4, range: 3.4, cd: 0.7, dmg: 1, unlock: 0, thawMul: 1, blast: 1.8, label: 'Spike' },
  crystal: { cost: 2, hp: 2, range: 2.4, cd: 1.1, dmg: 1, unlock: 0.1, thawMul: 1, blast: 2.2, label: 'Crystal' },
  lantern: { cost: 4, hp: 3, range: 0, cd: 0, dmg: 0, unlock: 0.28, thawMul: 2.5, blast: 1.2, label: 'Lantern' },
  chime: { cost: 5, hp: 4, range: 2.3, cd: 2.2, dmg: 2, unlock: 0.48, thawMul: 1, blast: 2.0, label: 'Chime' },
  prism: { cost: 6, hp: 4, range: 4.6, cd: 1.3, dmg: 2, unlock: 0.68, thawMul: 1, blast: 1.8, label: 'Prism' },
};
export const refundOf = (k: Kind): number => Math.floor(SPIRE[k].cost / 2);

export interface EnemyDef { hp: number; speed: number; chew: number; chewR: number; ice: number; label: string }
export const ENEMY: Record<EnemyKind, EnemyDef> = {
  drift: { hp: 3, speed: 0.8, chew: 0.8, chewR: 1.25, ice: 1, label: 'Drift' },
  ram: { hp: 10, speed: 0.5, chew: 3, chewR: 1.3, ice: 2, label: 'Ram' },
  glider: { hp: 2, speed: 1.7, chew: 0.5, chewR: 1.1, ice: 1, label: 'Glider' },
  wisp: { hp: 3, speed: 0.95, chew: 0, chewR: 0, ice: 1, label: 'Wisp' },
  thaw: { hp: 60, speed: 0.42, chew: 4, chewR: 1.7, ice: 10, label: 'The Thaw' },
};

export const BALANCE: BalanceSpec[] = [
  { id: 'thawPerShatter', label: 'Time released per shatter (seconds)', min: 1, max: 6, step: 0.25, default: 3 },
  { id: 'enemySpeed', label: 'Enemy speed (x)', min: 0.5, max: 1.8, step: 0.1, default: 1 },
  { id: 'spawnRate', label: 'Wave frequency (x)', min: 0.5, max: 2, step: 0.1, default: 1 },
  { id: 'dawnLength', label: 'Thawed seconds until dawn', min: 60, max: 240, step: 10, default: 90 },
  { id: 'startIce', label: 'Starting ice', min: 4, max: 25, step: 1, default: 12 },
  { id: 'hearts', label: 'Beacon hearts (next run)', min: 2, max: 9, step: 1, default: 5 },
  { id: 'killThaw', label: 'Time released per kill (seconds)', min: 0, max: 0.6, step: 0.05, default: 0.15 },
  { id: 'snapGain', label: 'Cold Snap fill speed (x)', min: 0.4, max: 2.5, step: 0.1, default: 1 },
];

interface MapDef { name: string; pts: [number, number][] }
export const MAPS: MapDef[] = [
  { name: 'switchback', pts: [[0, 1], [7, 1], [7, 4], [1, 4], [1, 7], [5, 7]] },
  { name: 'ravine', pts: [[8, 0], [8, 3], [2, 3], [2, 6], [6, 6], [6, 8]] },
  { name: 'spiral', pts: [[0, 7], [3, 7], [3, 1], [6, 1], [6, 5], [4, 5]] },
];

export interface Path {
  name: string;
  poly: [number, number][];
  cum: number[];
  len: number;
  cells: Set<number>;
  beacon: [number, number];
}
export const cellKey = (gx: number, gy: number): number => gy * N + gx;

export function buildPath(def: MapDef): Path {
  const pts = def.pts;
  // extend the start one and a half cells outward so enemies walk in from off the table
  const [a, b] = [pts[0], pts[1]];
  const dx = Math.sign(b[0] - a[0]);
  const dy = Math.sign(b[1] - a[1]);
  const poly: [number, number][] = [[a[0] - dx * 1.5, a[1] - dy * 1.5], ...pts];
  const cum = [0];
  const cells = new Set<number>();
  for (let i = 1; i < poly.length; i++) cum.push(cum[i - 1] + Math.hypot(poly[i][0] - poly[i - 1][0], poly[i][1] - poly[i - 1][1]));
  for (let i = 0; i + 1 < pts.length; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    const sx = Math.sign(x1 - x0);
    const sy = Math.sign(y1 - y0);
    let x = x0;
    let y = y0;
    cells.add(cellKey(x, y));
    while (x !== x1 || y !== y1) {
      x += sx;
      y += sy;
      cells.add(cellKey(x, y));
    }
  }
  const last = pts[pts.length - 1];
  return { name: def.name, poly, cum, len: cum[cum.length - 1], cells, beacon: [last[0], last[1]] };
}

export function pathAt(p: Path, s: number): [number, number] {
  if (s <= 0) return [p.poly[0][0], p.poly[0][1]];
  for (let i = 1; i < p.poly.length; i++) {
    if (s <= p.cum[i]) {
      const t = (s - p.cum[i - 1]) / (p.cum[i] - p.cum[i - 1]);
      return [p.poly[i - 1][0] + (p.poly[i][0] - p.poly[i - 1][0]) * t, p.poly[i - 1][1] + (p.poly[i][1] - p.poly[i - 1][1]) * t];
    }
  }
  return [p.beacon[0], p.beacon[1]];
}

export interface Spire {
  id: number;
  kind: Kind;
  gx: number;
  gy: number;
  hp: number;
  cd: number;
  /** Seconds (real) until it shatters in a chain; < 0 when not cracking. */
  crack: number;
  depth: number;
  age: number;
  /** Placed but not yet real: can't shoot, be shattered or be chained until the clock starts (or it settles). */
  queued: boolean;
  /** Seconds until a spire placed while time was flowing settles; Infinity while frozen. */
  settle: number;
}
export interface Enemy {
  id: number;
  kind: EnemyKind;
  s: number;
  hp: number;
  maxHp: number;
  x: number;
  y: number;
  px: number;
  py: number;
  flier: boolean;
  /** Flier line start. */
  fx: number;
  fy: number;
  hit: number;
  alive: boolean;
}

/** 8 stick directions on screen -> grid deltas for the isometric board. */
const DIR8: [number, number][] = [[1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1]];
export function stickToDelta(x: number, y: number): [number, number] | null {
  if (Math.hypot(x, y) < 0.5) return null;
  const sector = (((Math.round(Math.atan2(y, x) / (Math.PI / 4)) % 8) + 8) % 8);
  return DIR8[sector];
}
/** Inverse for bots: a grid delta as a stick vector. */
export function deltaToStick(dx: number, dy: number): { x: number; y: number } {
  const sx = dx - dy;
  const sy = dx + dy;
  const m = Math.hypot(sx, sy) || 1;
  return { x: sx / m, y: sy / m };
}

export const ENEMY_BLURB: Record<EnemyKind, string> = {
  drift: 'DRIFTS walk the path',
  ram: 'RAMS chew spires',
  glider: 'GLIDERS are fast',
  wisp: 'WISPS fly over everything',
  thaw: 'THE THAW',
};

/** dawning: the sun is up and every enemy still on the board breaks, one after another, before the win screen. */
export type Phase = 'play' | 'dawning' | 'over' | 'won';

export interface Sim {
  init(): void;
  step(dt: number, input: InputState): void;
  events(): SimEvent[];
  s: SimState;
  path: Path;
  unlocked(): Kind[];
  telemetry(): Record<string, number>;
  observe(): Record<string, number>;
  canPlace(gx: number, gy: number): boolean;
  chainPreview(gx: number, gy: number): [number, number][];
  coverage(gx: number, gy: number, range: number): number;
}

export interface SimState {
  phase: Phase;
  map: number;
  cx: number;
  cy: number;
  sel: Kind;
  ice: number;
  thaw: number;
  dawn: number;
  dawnLen: number;
  hearts: number;
  maxHearts: number;
  snap: number;
  snapReady: boolean;
  spires: Spire[];
  enemies: Enemy[];
  flowT: number;
  realT: number;
  flowing: boolean;
  unlockedSet: Set<Kind>;
  chain: number;
  /** Fault-line cells (deep ice: a shatter on one releases double time). Revealed at 20% dawn. */
  faults: number[];
  faultsShown: boolean;
  /** A warm front: a row (axis 0) or column (axis 1) that will melt its spires when `t` runs out. */
  front: { axis: 0 | 1; idx: number; t: number; total: number } | null;
  /** After dawn, the player can keep going into the Polar Night: no end but the beacon going dark. */
  endless: boolean;
  polar: number;
}

export function createSim(ctx: Ctx): Sim {
  const bal = (k: string, d: number): number => ctx.balance?.[k] ?? d;
  let out: SimEvent[] = [];
  const emit = (type: string, x: number, y: number, magnitude = 0.5, data?: SimEvent['data']): void => {
    out.push({ type, x, y, magnitude, data });
  };

  let path = buildPath(MAPS[0]);
  let nextId = 1;
  let s!: SimState;
  let spawnT = 0;
  let queue: EnemyKind[] = [];
  let queueT = 0;
  let reprieve = 0;
  let nextBoss = 0.88;
  let tickT = 0;
  let tickParity = 0;
  let dawnStepSeen = 0;
  let moveT = 0;
  let lastDelta: [number, number] | null = null;
  let frozenStretch = 0;
  let frontT = 14;
  let victoryT = 0;
  let victoryN = 0;
  const introSeen = new Set<EnemyKind>();
  let steps = 0;
  const tel = { thawed: 0, shatters: 0, maxChain: 0, kills: 0, placed: 0, heartsLost: 0, longestFrozen: 0, eaten: 0, snaps: 0, deniedPlace: 0, enemiesSeen: 0, firstPressure: 0, maxEnemies: 0, kindsSeen: 0, stuck: 0, fronts: 0, frontMelts: 0, faultShatters: 0 };
  const kindsSeen = new Set<EnemyKind>();

  const spireAt = (gx: number, gy: number): Spire | undefined => s.spires.find((p) => p.gx === gx && p.gy === gy);
  const canPlace = (gx: number, gy: number): boolean => {
    if (gx < 0 || gy < 0 || gx >= N || gy >= N) return false;
    if (path.cells.has(cellKey(gx, gy))) return false;
    return !spireAt(gx, gy);
  };

  function init(): void {
    const map = ctx.seed % MAPS.length;
    path = buildPath(MAPS[map]);
    nextId = 1;
    spawnT = 0.4;
    queue = [];
    queueT = 0;
    reprieve = 0;
    tickT = 0;
    tickParity = 0;
    dawnStepSeen = 0;
    moveT = 0;
    lastDelta = null;
    frozenStretch = 0;
    kindsSeen.clear();
    const hearts = Math.round(bal('hearts', 5));
    s = {
      phase: 'play', map, cx: path.beacon[0], cy: path.beacon[1] - 2 < 0 ? path.beacon[1] + 2 : path.beacon[1] - 2,
      sel: 'spike', ice: bal('startIce', 10), thaw: 0, dawn: 0, dawnLen: bal('dawnLength', 90),
      hearts, maxHearts: hearts, snap: 0, snapReady: false, spires: [], enemies: [], flowT: 0, realT: 0, flowing: false,
      unlockedSet: new Set<Kind>(['spike']), chain: 0, faults: [], faultsShown: false, front: null, endless: false, polar: 0,
    };
    nextBoss = 0.88;
    frontT = 14;
    introSeen.clear();
    // fault lines: three quiet cells away from the path, picked now so the run is deterministic
    const quiet: number[] = [];
    for (let gy = 1; gy < N - 1; gy++) for (let gx = 1; gx < N - 1; gx++) if (!path.cells.has(cellKey(gx, gy)) && !(gx === path.beacon[0] && gy === path.beacon[1])) quiet.push(cellKey(gx, gy));
    ctx.rng.shuffle(quiet);
    s.faults = quiet.slice(0, 3);
    // the board starts with three real spikes, so there is always something to break
    const starts = cells().filter((c) => c.gx > 0 && c.gy > 0 && c.gx < N - 1 && c.gy < N - 1).sort((a, b) => b.c - a.c);
    for (const c of starts) {
      if (s.spires.length >= 3) break;
      if (s.spires.some((p) => Math.max(Math.abs(p.gx - c.gx), Math.abs(p.gy - c.gy)) < 2)) continue;
      s.spires.push({ id: nextId++, kind: 'spike', gx: c.gx, gy: c.gy, hp: SPIRE.spike.hp, cd: 0.4, crack: -1, depth: 0, age: 0, queued: false, settle: Infinity });
    }
    if (!canPlace(s.cx, s.cy)) { s.cx = 4; s.cy = 0; for (let y = 0; y < N && !canPlace(s.cx, s.cy); y++) s.cy = y; }
    // debug/test hooks: ?dawn=0.5 starts that far along (unlocking what it should), ?ice=40 adds ice
    const dawn0 = Number(ctx.params?.dawn ?? 0);
    if (dawn0 > 0) {
      s.dawn = dawn0 * s.dawnLen;
      for (const k of KINDS) if (SPIRE[k].unlock <= dawn0) s.unlockedSet.add(k);
      dawnStepSeen = Math.floor(dawn0 * 10);
      s.sel = 'crystal';
    }
    if (ctx.params?.ice) s.ice = Number(ctx.params.ice);
    emit('run-start', s.cx, s.cy, 0.3, { map });
  }

  const unlocked = (): Kind[] => KINDS.filter((k) => s.unlockedSet.has(k));

  function addThaw(sec: number, x: number, y: number): void {
    const before = s.thaw;
    s.thaw = Math.min(THAW_CAP, s.thaw + sec);
    tel.thawed += s.thaw - before;
    void x; void y;
  }

  function damage(e: Enemy, d: number, blast: boolean): void {
    if (!e.alive) return;
    e.hp -= d;
    e.hit = 0.2;
    if (e.hp <= 0) {
      e.alive = false;
      s.ice += ENEMY[e.kind].ice;
      addThaw(bal('killThaw', 0.15), e.x, e.y);
      tel.kills++;
      emit('kill', e.x, e.y, e.kind === 'thaw' ? 1 : e.kind === 'ram' ? 0.6 : 0.35, { kind: e.kind, blast, thaw: bal('killThaw', 0.15) });
    } else {
      emit('hit', e.x, e.y, Math.min(1, 0.2 + d * 0.1), { kind: e.kind });
    }
  }

  function solidify(sp: Spire): void {
    if (!sp.queued) return;
    sp.queued = false;
    sp.settle = Infinity;
    emit('solidify', sp.gx, sp.gy, 0.4, { kind: sp.kind });
  }

  function neighbours(sp: Spire): Spire[] {
    return s.spires.filter((o) => o !== sp && !o.queued && Math.max(Math.abs(o.gx - sp.gx), Math.abs(o.gy - sp.gy)) === 1 && (sp.kind === 'crystal' || o.kind === 'crystal'));
  }

  /** Remove a spire: refund, release time, blast, crack its neighbours. */
  function breakSpire(sp: Spire, reason: 'player' | 'eaten' | 'melt' | 'chain' | 'snap'): void {
    const idx = s.spires.indexOf(sp);
    if (idx < 0) return;
    s.spires.splice(idx, 1);
    const def = SPIRE[sp.kind];
    const depth = reason === 'chain' ? sp.depth : 0;
    s.ice += reason === 'snap' || s.dawn < s.dawnLen * 0.1 ? def.cost : refundOf(sp.kind); // the first tenth of the night is free to learn in
    const base = reason === 'eaten' || reason === 'melt' ? 1.5 : bal('thawPerShatter', 1.5) * (reason === 'snap' ? 0.5 : 1);
    const onFault = s.faultsShown && s.faults.includes(cellKey(sp.gx, sp.gy));
    const gain = base * def.thawMul * (1 + 0.2 * depth) * (onFault ? 2 : 1);
    if (onFault) tel.faultShatters++;
    const wasFrozen = s.thaw <= 0;
    addThaw(gain, sp.gx, sp.gy);
    tel.shatters++;
    if (reason === 'eaten') tel.eaten++;
    tel.maxChain = Math.max(tel.maxChain, depth + 1);
    s.chain = depth + 1;
    const dmg = reason === 'snap' ? 7 : (sp.kind === 'crystal' || sp.kind === 'prism' ? 2 : 1) + depth;
    for (const e of s.enemies) {
      if (!e.alive) continue;
      if (Math.hypot(e.x - sp.gx, e.y - sp.gy) <= def.blast + (reason === 'snap' ? 0.8 : 0)) damage(e, dmg, true);
    }
    if (reason !== 'eaten' && reason !== 'melt' && reason !== 'snap') {
      s.snap = Math.min(100, s.snap + (depth === 0 ? 2 : 12) * bal('snapGain', 1));
    }
    emit('shatter', sp.gx, sp.gy, Math.min(1, 0.45 + 0.12 * depth + (def.thawMul > 1 ? 0.2 : 0)), { kind: sp.kind, depth, reason, thaw: gain, wasFrozen, fault: onFault });
    if (reason !== 'snap') {
      for (const o of neighbours(sp)) {
        if (o.crack >= 0) continue;
        o.crack = 0.15 + 0.02 * depth;
        o.depth = depth + 1;
        emit('crack', o.gx, o.gy, 0.3, { depth: depth + 1 });
      }
    }
    if (!s.snapReady && s.snap >= 100) {
      s.snapReady = true;
      emit('snap-ready', sp.gx, sp.gy, 1);
    }
  }

  function spawn(kind: EnemyKind): void {
    const def = ENEMY[kind];
    const flier = kind === 'wisp';
    const corners: [number, number][] = [[-1.5, -1.5], [N + 0.5, -1.5], [-1.5, N + 0.5], [N + 0.5, N + 0.5]];
    const c = flier ? ctx.rng.pick(corners) : path.poly[0];
    const e: Enemy = {
      id: nextId++, kind, s: 0, hp: Math.round(def.hp * (kind === 'thaw' ? 1 + 1.2 * Math.max(0, s.dawn / s.dawnLen - 0.88) : 1 + 3.2 * Math.min(2.2, s.dawn / s.dawnLen))), maxHp: 0, x: c[0], y: c[1], px: c[0], py: c[1], flier,
      fx: c[0], fy: c[1], hit: 0, alive: true,
    };
    e.maxHp = e.hp;
    s.enemies.push(e);
    tel.enemiesSeen++;
    if (!tel.firstPressure) tel.firstPressure = s.realT;
    kindsSeen.add(kind);
    tel.kindsSeen = kindsSeen.size;
    emit('spawn', e.x, e.y, kind === 'thaw' ? 1 : 0.3, { kind });
    if (!introSeen.has(kind) && kind !== 'drift' && kind !== 'thaw') { introSeen.add(kind); emit('new-enemy', e.x, e.y, 0.5, { kind }); }
  }

  function pickKind(f: number): EnemyKind {
    const w: [EnemyKind, number][] = [['drift', 1]];
    if (f >= 0.15) w.push(["ram", 0.45]);
    if (f >= 0.3) w.push(["glider", 0.6]);
    if (f >= 0.5) w.push(["wisp", 0.55]);
    let total = 0;
    for (const [, v] of w) total += v;
    let r = ctx.rng.next() * total;
    for (const [k, v] of w) { r -= v; if (r <= 0) return k; }
    return 'drift';
  }

  function heartLost(e: Enemy): void {
    s.hearts--;
    tel.heartsLost++;
    e.alive = false;
    emit('heart-lost', path.beacon[0], path.beacon[1], 1, { hearts: s.hearts, thaw: 1 });
    addThaw(1.0, 0, 0);
    s.ice += 4; // the beacon's light melts into ice: a failure is also a rebuild
    // reprieve: everything is blasted back and the next waves come slower
    for (const o of s.enemies) {
      if (!o.alive) continue;
      if (o.flier) o.s = Math.max(0, o.s - 4);
      else o.s = Math.max(0, o.s - 5);
      o.hit = 0.3;
    }
    reprieve = 25;
    queue = [];
    spawnT = Math.max(spawnT, 5);
    if (s.hearts <= 0) {
      s.phase = 'over';
      emit('gameover', path.beacon[0], path.beacon[1], 1, { dawn: s.dawn / s.dawnLen });
    }
  }

  function moveEnemies(wdt: number): void {
    const spd = bal('enemySpeed', 1);
    for (const e of s.enemies) {
      if (!e.alive) continue;
      e.px = e.x;
      e.py = e.y;
      const def = ENEMY[e.kind];
      e.s += def.speed * spd * wdt;
      e.hit = Math.max(0, e.hit - wdt);
      if (e.flier) {
        const bx = path.beacon[0];
        const by = path.beacon[1];
        const total = Math.hypot(bx - e.fx, by - e.fy);
        const t = Math.min(1, e.s / total);
        e.x = e.fx + (bx - e.fx) * t;
        e.y = e.fy + (by - e.fy) * t;
        if (t >= 1) heartLost(e);
      } else {
        const [x, y] = pathAt(path, e.s);
        e.x = x;
        e.y = y;
        if (e.s >= path.len) heartLost(e);
      }
      if (s.phase !== 'play') return;
      // chew the nearest spire in reach
      if (def.chew > 0 && e.alive) {
        let best: Spire | null = null;
        let bd = def.chewR;
        for (const sp of s.spires) {
          if (sp.queued) continue;
          const d = Math.hypot(sp.gx - e.x, sp.gy - e.y);
          if (d < bd) { bd = d; best = sp; }
        }
        if (best) {
          best.hp -= def.chew * wdt;
          if (best.hp <= 0) breakSpire(best, 'eaten');
        }
      }
    }
  }

  function fireSpires(wdt: number): void {
    for (const sp of s.spires) {
      if (sp.queued) continue;
      const def = SPIRE[sp.kind];
      sp.age += wdt;
      if (def.dmg === 0) continue;
      sp.cd -= wdt;
      if (sp.cd > 0) continue;
      if (sp.kind === 'chime') {
        const inR = s.enemies.filter((e) => e.alive && Math.hypot(e.x - sp.gx, e.y - sp.gy) <= def.range);
        if (!inR.length) continue;
        sp.cd = def.cd;
        emit('pulse', sp.gx, sp.gy, 0.5, { r: def.range });
        for (const e of inR) damage(e, def.dmg, false);
        continue;
      }
      let target: Enemy | null = null;
      let best = -1;
      for (const e of s.enemies) {
        if (!e.alive) continue;
        if (Math.hypot(e.x - sp.gx, e.y - sp.gy) > def.range) continue;
        const prog = e.flier ? e.s + 100 : e.s;
        if (prog > best) { best = prog; target = e; }
      }
      if (!target) continue;
      sp.cd = def.cd;
      emit('shot', sp.gx, sp.gy, sp.kind === 'prism' ? 0.6 : 0.3, { tx: target.x, ty: target.y, kind: sp.kind });
      if (sp.kind === 'prism') {
        const dx = target.x - sp.gx;
        const dy = target.y - sp.gy;
        const L = Math.hypot(dx, dy) || 1;
        for (const e of s.enemies) {
          if (!e.alive) continue;
          const t = ((e.x - sp.gx) * dx + (e.y - sp.gy) * dy) / L;
          if (t < 0 || t > def.range + 1) continue;
          const perp = Math.abs((e.x - sp.gx) * dy - (e.y - sp.gy) * dx) / L;
          if (perp <= 0.55) damage(e, def.dmg, false);
        }
      } else {
        damage(target, def.dmg, false);
      }
    }
  }

  function worldStep(wdt: number): void {
    s.flowT += wdt;
    s.dawn += wdt;
    s.ice += 0.18 * wdt;
    const f = s.dawn / s.dawnLen;
    // unlocks open new verbs as dawn advances
    for (const k of KINDS) {
      if (!s.unlockedSet.has(k) && f >= SPIRE[k].unlock) {
        s.unlockedSet.add(k);
        s.sel = k; // a new verb is put in your hand
        emit('unlock', s.cx, s.cy, 0.8, { kind: k });
      }
    }
    const step10 = Math.floor(f * 10);
    if (step10 > dawnStepSeen) { dawnStepSeen = step10; emit('dawn-step', 0, 0, f, { step: step10 }); }
    if (!s.faultsShown && f >= 0.2) { s.faultsShown = true; emit('faults', s.cx, s.cy, 0.6, { n: s.faults.length }); }
    // warm fronts: a telegraphed line of warmth that melts the spires in it (and so also pays out time)
    if (s.front) {
      s.front.t -= wdt;
      if (s.front.t <= 0) {
        const fr = s.front;
        s.front = null;
        emit('front-hit', fr.axis === 0 ? 0 : fr.idx, fr.axis === 0 ? fr.idx : 0, 0.8, { axis: fr.axis, idx: fr.idx });
        for (const sp of [...s.spires]) {
          if (sp.queued || (fr.axis === 0 ? sp.gy : sp.gx) !== fr.idx) continue;
          sp.hp -= 2;
          tel.frontMelts++;
          emit('melt', sp.gx, sp.gy, 0.5, { hp: sp.hp });
          if (sp.hp <= 0) breakSpire(sp, 'melt');
        }
      }
    } else if (f >= 0.4 && (f < 0.95 || s.endless)) {
      frontT -= wdt;
      if (frontT <= 0) {
        frontT = 22 - 8 * f;
        const axis = (ctx.rng.chance(0.5) ? 0 : 1) as 0 | 1;
        const lines: number[] = [];
        for (let i = 0; i < N; i++) if (s.spires.some((p) => (axis === 0 ? p.gy : p.gx) === i)) lines.push(i);
        const idx = lines.length ? ctx.rng.pick(lines) : ctx.rng.int(0, N - 1);
        s.front = { axis, idx, t: 6, total: 6 };
        tel.fronts++;
        emit('front-warn', axis === 0 ? 0 : idx, axis === 0 ? idx : 0, 0.6, { axis, idx });
      }
    }
    // spawning
    reprieve = Math.max(0, reprieve - wdt);
    spawnT -= wdt;
    if (spawnT <= 0 && (f < 0.97 || s.endless)) {
      const interval = Math.max(0.9, (3.0 - 1.6 * Math.min(1, f)) / bal('spawnRate', 1) / (1 + Math.max(0, f - 1) * 0.7)) * (reprieve > 0 ? 1.5 : 1);
      spawnT = interval;
      let n = 1;
      if (f > 0.3 && ctx.rng.chance(0.5)) n++;
      if (f > 0.6 && ctx.rng.chance(0.4)) n++;
      for (let i = 0; i < n; i++) queue.push(pickKind(f));
    }
    if (f >= nextBoss) {
      nextBoss = s.endless ? nextBoss + 0.35 : 99;
      queue.push('thaw');
      emit('boss', path.poly[0][0], path.poly[0][1], 1);
    }
    queueT -= wdt;
    if (queue.length && queueT <= 0) {
      spawn(queue.shift()!);
      queueT = 0.9;
    }
    moveEnemies(wdt);
    if (s.phase !== 'play') return;
    fireSpires(wdt);
    s.enemies = s.enemies.filter((e) => e.alive);
    tel.maxEnemies = Math.max(tel.maxEnemies, s.enemies.length);
    tickT += wdt;
    if (tickT >= 0.25) { tickT -= 0.25; tickParity ^= 1; emit('tick', 0, 0, tickParity); }
    if (s.endless) s.polar += wdt;
    if (s.dawn >= s.dawnLen && !s.endless) {
      s.phase = 'dawning';
      victoryT = 2.6; // the sun comes up and the beacon charges before it fires
      victoryN = 0;
      queue = [];
      emit('dawn-break', path.beacon[0], path.beacon[1], 1, { enemies: s.enemies.length });
    }
  }

  function snap(): void {
    if (!s.snapReady || !s.spires.some((p) => !p.queued)) return;
    s.snapReady = false;
    s.snap = 0;
    tel.snaps++;
    const bx = path.beacon[0];
    const by = path.beacon[1];
    const order = s.spires.filter((p) => !p.queued).sort((a, b) => Math.hypot(a.gx - bx, a.gy - by) - Math.hypot(b.gx - bx, b.gy - by));
    order.forEach((sp, i) => { sp.crack = 0.06 * (i + 1); sp.depth = -1; });
    emit('snap', bx, by, 1, { n: order.length });
  }

  function handleInput(dt: number, input: InputState): void {
    // cursor: 8 directions, repeating
    const d = stickToDelta(input.left.x, input.left.y);
    moveT -= dt;
    if (d) {
      const changed = !lastDelta || lastDelta[0] !== d[0] || lastDelta[1] !== d[1];
      if (changed || moveT <= 0) {
        s.cx = Math.max(0, Math.min(N - 1, s.cx + d[0]));
        s.cy = Math.max(0, Math.min(N - 1, s.cy + d[1]));
        moveT = changed ? 0.22 : 0.085;
        emit('cursor', s.cx, s.cy, 0.1);
      }
    } else moveT = 0;
    lastDelta = d;
    if (s.phase !== 'play') return;
    const b = input.buttons;
    const list = unlocked();
    if (b.rb.pressed || b.lb.pressed) {
      const i = list.indexOf(s.sel);
      s.sel = list[(i + (b.rb.pressed ? 1 : -1) + list.length) % list.length];
      emit('select', s.cx, s.cy, 0.2, { kind: s.sel });
    }
    if (b.a.pressed) {
      const def = SPIRE[s.sel];
      if (canPlace(s.cx, s.cy) && s.ice >= def.cost) {
        s.ice -= def.cost;
        s.spires.push({ id: nextId++, kind: s.sel, gx: s.cx, gy: s.cy, hp: def.hp, cd: def.cd * 0.5, crack: -1, depth: 0, age: 0, queued: true, settle: s.thaw > 0 ? 1.5 : Infinity });
        tel.placed++;
        emit('place', s.cx, s.cy, 0.4, { kind: s.sel, queued: true });
      } else {
        tel.deniedPlace++;
        emit('deny', s.cx, s.cy, 0.3, { why: canPlace(s.cx, s.cy) ? 'ice' : 'cell' });
      }
    }
    if (b.x.pressed) {
      const sp = spireAt(s.cx, s.cy);
      if (sp && sp.queued) emit('deny', s.cx, s.cy, 0.3, { why: 'queued' });
      else if (sp && sp.crack < 0) breakSpire(sp, 'player');
      else emit('deny', s.cx, s.cy, 0.2, { why: 'nothing' });
    }
    if (b.y.pressed && s.snapReady) snap();
    if (b.b.pressed && s.spires.length) {
      // B: hop the cursor to the next spire
      const order = [...s.spires].sort((p, q) => p.gy * N + p.gx - (q.gy * N + q.gx));
      const here = order.findIndex((p) => p.gx === s.cx && p.gy === s.cy);
      const nxt = order[(here + 1) % order.length];
      s.cx = nxt.gx;
      s.cy = nxt.gy;
      emit('cursor', s.cx, s.cy, 0.1);
    }
    if (b.rt.pressed) {
      // RT: hop to a good building cell near the lead enemy
      const lead = [...s.enemies].sort((p, q) => q.s - p.s)[0];
      if (lead) {
        let best: { gx: number; gy: number } | null = null;
        let bd = 99;
        for (const c of cells()) {
          if (!canPlace(c.gx, c.gy)) continue;
          const d = Math.abs(Math.hypot(c.gx - lead.x, c.gy - lead.y) - 2.3);
          if (d < bd) { bd = d; best = c; }
        }
        if (best) { s.cx = best.gx; s.cy = best.gy; emit('cursor', s.cx, s.cy, 0.1); }
      }
    }
  }

  function step(dt: number, input: InputState): void {
    steps++;
    s.realT += dt;
    handleInput(dt, input);
    if (s.phase === 'dawning') {
      // the win, made unmistakable: the sun is up and every enemy on the board breaks in turn, nearest the beacon first
      victoryT -= dt;
      if (victoryT <= 0) {
        const next = [...s.enemies].filter((e) => e.alive).sort((a, b) => (b.flier ? b.s + 100 : b.s) - (a.flier ? a.s + 100 : a.s))[0];
        if (next) {
          next.alive = false;
          s.enemies = s.enemies.filter((e) => e.alive);
          emit('beacon-fire', next.x, next.y, 1, { n: victoryN });
          emit('kill', next.x, next.y, next.kind === 'thaw' ? 1 : 0.6, { kind: next.kind, blast: true, thaw: 0, victory: true, n: victoryN++ });
          victoryT = Math.max(0.16, 0.42 - 0.03 * victoryN);
        } else {
          s.phase = 'won';
          emit('complete', path.beacon[0], path.beacon[1], 1, { hearts: s.hearts, cleared: victoryN });
        }
      }
      return;
    }
    if (s.phase === 'over' || s.phase === 'won') {
      if (input.buttons.a.pressed) init();
      else if (s.phase === 'won' && input.buttons.y.pressed) {
        s.phase = 'play';
        s.endless = true;
        s.hearts = Math.min(s.maxHearts, s.hearts + 1);
        s.ice += 6;
        s.thaw = Math.max(s.thaw, 3);
        emit('endless', path.beacon[0], path.beacon[1], 1);
      }
      return;
    }
    // chain cracks run on real time: breaking is what starts the clock
    for (const sp of [...s.spires]) {
      if (sp.crack >= 0) {
        sp.crack -= dt;
        if (sp.crack <= 0) breakSpire(sp, sp.depth < 0 ? 'snap' : 'chain');
      }
    }
    // spires placed while time flows take a moment to set
    for (const sp of s.spires) {
      if (sp.queued && Number.isFinite(sp.settle)) {
        sp.settle -= dt;
        if (sp.settle <= 0) solidify(sp);
      }
    }
    const flowing = s.thaw > 0;
    if (flowing !== s.flowing) {
      s.flowing = flowing;
      if (flowing) {
        emit('thaw-on', 0, 0, 0.5);
        frozenStretch = 0;
        for (const sp of s.spires) if (sp.queued) solidify(sp); // the clock is running: everything queued becomes real
      } else emit('thaw-off', 0, 0, 0.5);
    }
    // nothing solid left to break while frozen: the cold wins
    if (!flowing && s.phase === 'play' && !s.spires.some((p) => !p.queued || p.crack >= 0)) {
      s.phase = 'over';
      tel.stuck++;
      emit('gameover', path.beacon[0], path.beacon[1], 1, { dawn: s.dawn / s.dawnLen, reason: 'stuck' });
      return;
    }
    if (flowing) {
      const scale = Math.min(1, s.thaw / 0.35);
      s.thaw = Math.max(0, s.thaw - dt);
      worldStep(dt * scale);
    } else {
      frozenStretch += dt;
      tel.longestFrozen = Math.max(tel.longestFrozen, frozenStretch);
    }
  }

  function events(): SimEvent[] {
    const e = out;
    out = [];
    return e;
  }

  function telemetry(): Record<string, number> {
    return {
      scoreOrProgress: Math.round(((s.dawn / s.dawnLen) * 100 + tel.kills * 0.5 + (s.phase === 'won' || s.endless ? 50 : 0) + s.polar * 0.5) * 10) / 10,
      dawnPct: Math.round((s.dawn / s.dawnLen) * 1000) / 10,
      thawedSeconds: Math.round(tel.thawed * 10) / 10,
      shatters: tel.shatters,
      mainVerbCount: tel.shatters,
      maxChain: tel.maxChain,
      kills: tel.kills,
      placed: tel.placed,
      heartsLost: tel.heartsLost,
      hearts: s.hearts,
      deaths: s.phase === 'over' ? 1 : 0,
      firstPressureSimSec: Math.round(tel.firstPressure * 10) / 10,
      longestFrozenSec: Math.round(tel.longestFrozen * 10) / 10,
      spiresEaten: tel.eaten,
      stuck: tel.stuck,
      solid: s.spires.filter((p) => !p.queued).length,
      fronts: tel.fronts,
      frontMelts: tel.frontMelts,
      faultShatters: tel.faultShatters,
      snaps: tel.snaps,
      deniedPlace: tel.deniedPlace,
      maxEnemies: tel.maxEnemies,
      enemyKindsSeen: tel.kindsSeen,
      ice: Math.round(s.ice * 10) / 10,
      won: s.phase === 'won' || s.endless ? 1 : 0,
      polarSeconds: Math.round(s.polar * 10) / 10,
    };
  }

  const coverage = (gx: number, gy: number, range: number): number => {
    let c = 0;
    for (let i = 0; i < path.len; i += 0.5) {
      const [x, y] = pathAt(path, i);
      if (Math.hypot(x - gx, y - gy) <= range) c++;
    }
    return c;
  };

  /** Cells that would chain-crack if the spire at (gx,gy) shatters now (breadth first). */
  function chainPreview(gx: number, gy: number): [number, number][] {
    const start = spireAt(gx, gy);
    if (!start) return [];
    const seen = new Set<Spire>([start]);
    const q = [start];
    const res: [number, number][] = [];
    while (q.length) {
      const cur = q.shift()!;
      for (const o of neighbours(cur)) {
        if (seen.has(o)) continue;
        seen.add(o);
        q.push(o);
        res.push([o.gx, o.gy]);
      }
    }
    return res;
  }

  function observe(): Record<string, number> {
    const p = plan();
    const c = planChain(p);
    for (const k of ['act', 'tx', 'ty', 'kind']) p[`c_${k}`] = c[k];
    return p;
  }

  /** A second bot plan that plays for chains: a cluster of crystals as a time-bank, defenders kept apart from it. */
  function planChain(base: Record<string, number>): Record<string, number> {
    const out: Record<string, number> = { act: base.act, tx: base.tx, ty: base.ty, kind: base.kind };
    if (s.phase !== 'play') return out;
    const allCrystals = s.spires.filter((p) => p.kind === 'crystal' && p.crack < 0);
    const crystals = allCrystals.filter((p) => !p.queued);
    const fuelKind = s.unlockedSet.has('crystal') ? 'crystal' : null;
    if (!fuelKind) return out;
    if (s.thaw < 0.5 && crystals.length >= 3) {
      // fire the end of the cluster: the one with the fewest crystal neighbours
      const end = [...crystals].sort((a, b) => crystals.filter((o) => o !== a && Math.max(Math.abs(o.gx - a.gx), Math.abs(o.gy - a.gy)) === 1).length - crystals.filter((o) => o !== b && Math.max(Math.abs(o.gx - b.gx), Math.abs(o.gy - b.gy)) === 1).length)[0];
      return { act: 2, tx: end.gx, ty: end.gy, kind: 0 };
    }
    if (allCrystals.length < 4 && s.ice >= SPIRE.crystal.cost && (s.thaw < 0.5 || base.act !== 1)) {
      const defenders = s.spires.filter((p) => p.kind !== 'crystal');
      const free: { gx: number; gy: number; w: number }[] = [];
      for (const c of cells()) {
        if (!canPlace(c.gx, c.gy)) continue;
        if (defenders.some((d) => Math.max(Math.abs(d.gx - c.gx), Math.abs(d.gy - c.gy)) <= 1)) continue;
        const near = allCrystals.filter((o) => Math.max(Math.abs(o.gx - c.gx), Math.abs(o.gy - c.gy)) === 1).length;
        if (allCrystals.length && !near) continue;
        free.push({ gx: c.gx, gy: c.gy, w: near * 10 + (c.c < 6 ? 1 : 0) });
      }
      free.sort((a, b) => b.w - a.w);
      if (free[0]) return { act: 1, tx: free[0].gx, ty: free[0].gy, kind: KINDS.indexOf('crystal') };
    }
    return out;
  }

  // ---- greedy-bot support: a small numeric plan the bot can follow with the stick and buttons ----
  let covCache: { map: number; cells: { gx: number; gy: number; c: number }[] } | null = null;
  function cells(): { gx: number; gy: number; c: number }[] {
    if (covCache && covCache.map === s.map) return covCache.cells;
    const list: { gx: number; gy: number; c: number }[] = [];
    for (let gy = 0; gy < N; gy++) for (let gx = 0; gx < N; gx++) {
      if (path.cells.has(cellKey(gx, gy))) continue;
      // cells right beside the path get chewed: only count coverage from cells out of the chew radius, but keep the rest as a fallback
      let near = 9;
      for (let i = 0; i < path.len; i += 0.5) { const [x, y] = pathAt(path, i); near = Math.min(near, Math.hypot(x - gx, y - gy)); }
      list.push({ gx, gy, c: coverage(gx, gy, SPIRE.spike.range) * (near >= 1.4 ? 1 : 0.4) });
    }
    covCache = { map: s.map, cells: list };
    return list;
  }

  function plan(): Record<string, number> {
    const f = s.dawn / s.dawnLen;
    const alive = s.enemies.length;
    const base: Record<string, number> = {
      cx: s.cx, cy: s.cy, ice: s.ice, thaw: s.thaw, hearts: s.hearts, enemies: alive, spires: s.spires.length,
      snapReady: s.snapReady ? 1 : 0, phase: s.phase === 'play' ? 0 : 1, sel: KINDS.indexOf(s.sel),
      act: 0, tx: s.cx, ty: s.cy, kind: 0, dawn: f,
    };
    if (s.phase !== 'play') { base.act = 4; return base; }
    const kinds = unlocked();
    const attackers = s.spires.filter((p) => SPIRE[p.kind].dmg > 0).length;
    const target = 3 + Math.floor(f * 8);
    const free = cells().filter((c) => canPlace(c.gx, c.gy));
    if (s.snapReady && alive >= 3 && s.spires.filter((p) => !p.queued).length >= 3) { base.act = 3; return base; }
    const wantAttacker = attackers < target;
    const pickAttacker = (): Kind => {
      const opts = kinds.filter((k) => SPIRE[k].dmg > 0 && k !== 'crystal' && s.ice >= SPIRE[k].cost);
      if (!opts.length) return 'spike';
      return opts[attackers % opts.length];
    };
    const solid = s.spires.filter((p) => !p.queued && p.crack < 0);
    const fuelKind: Kind = kinds.includes('lantern') && s.ice >= SPIRE.lantern.cost ? 'lantern' : kinds.includes('crystal') && s.ice >= SPIRE.crystal.cost ? 'crystal' : 'spike';
    const reserve = s.spires.filter((p) => p.kind === 'lantern' || p.kind === 'crystal').length;
    const stock = (): boolean => {
      if (s.ice < SPIRE[fuelKind].cost) return false;
      const quiet = free.filter((c) => !s.spires.some((p) => Math.max(Math.abs(p.gx - c.gx), Math.abs(p.gy - c.gy)) === 1)).sort((a, b) => a.c - b.c)[0];
      if (!quiet) return false;
      base.act = 1; base.tx = quiet.gx; base.ty = quiet.gy; base.kind = KINDS.indexOf(fuelKind);
      return true;
    };
    if (s.thaw < 0.5) {
      // make time: shatter a solid fuel spire, else the least useful solid spire
      const fuel = solid.find((p) => p.kind === 'lantern') ?? solid.find((p) => p.kind === 'crystal');
      if (fuel) { base.act = 2; base.tx = fuel.gx; base.ty = fuel.gy; return base; }
      const weakest = [...solid].sort((a, b) => coverage(a.gx, a.gy, 3.4) - coverage(b.gx, b.gy, 3.4))[0];
      if (weakest) { base.act = 2; base.tx = weakest.gx; base.ty = weakest.gy; return base; }
    }
    // restock the bench while time still runs: queued fuel becomes real the next time the clock starts
    if ((reserve < 2 || solid.length <= 2) && fuelKind !== 'spike' && stock()) return base;
    if (solid.length <= 2 && fuelKind === 'spike' && s.ice >= SPIRE.spike.cost && stock()) return base;
    if (wantAttacker) {
      const k = pickAttacker();
      if (s.ice >= SPIRE[k].cost) {
        const best = free.filter((c) => !spireAt(c.gx, c.gy)).sort((a, b) => b.c - a.c)[0];
        if (best) { base.act = 1; base.tx = best.gx; base.ty = best.gy; base.kind = KINDS.indexOf(k); return base; }
      }
    }
    return base;
  }

  const sim: Sim = {
    init, step, events,
    get s() { return s; },
    get path() { return path; },
    unlocked, telemetry, observe, canPlace, chainPreview, coverage,
  } as Sim;
  void steps;
  return sim;
}
