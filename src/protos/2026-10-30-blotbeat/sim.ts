// Blot Beat sim: PURE. No Pixi, DOM, audio or Math.random. A rhythm game on four lanes where every miss drops an
// ink blot; ink is both the danger (too much spills the page) and the fuel (spend it on a STAMP that starts a fever).
import type { Ctx, InputState, SimEvent } from '../../core/types.ts';
import type { Rng } from '../../core/rng.ts';
import type { BalanceSpec } from '../../core/types.ts';
import { laneRing } from './geometry.ts';

export const BALANCE: BalanceSpec[] = [
  { id: 'window', label: 'Hit window (wider = easier)', min: 0.6, max: 1.6, step: 0.05, default: 1 },
  { id: 'inkMax', label: 'Ink well size (blots before a spill)', min: 4, max: 14, step: 1, default: 8 },
  { id: 'stampCost', label: 'Blots needed to stamp', min: 1, max: 6, step: 1, default: 3 },
  { id: 'feverMult', label: 'Fever score multiplier', min: 1, max: 4, step: 0.5, default: 2, unit: 'x' },
  { id: 'pages', label: 'Pages (lives, next run)', min: 1, max: 6, step: 1, default: 3 },
  { id: 'offset', label: 'Timing offset (+ = notes judged later, if hits feel early)', min: -120, max: 120, step: 10, default: 0, unit: 'ms' },
  { id: 'approach', label: 'Note travel time (longer = more warning)', min: 0.8, max: 1.8, step: 0.05, default: 1.25, unit: 's' },
];

export const SETS = [
  { name: 'Doodle', bpm: 100, bars: 18, level: 0, holds: 0, doubles: 0 },
  { name: 'Sketch', bpm: 108, bars: 20, level: 1, holds: 0.55, doubles: 0 },
  { name: 'Scrawl', bpm: 116, bars: 22, level: 2, holds: 0.5, doubles: 0.5 },
  { name: 'Finale', bpm: 126, bars: 24, level: 3, holds: 0.5, doubles: 0.7 },
] as const;
export type SetCfg = (typeof SETS)[number] | { name: string; bpm: number; bars: number; level: number; holds: number; doubles: number };

export const STICKERS = [
  { id: 'nib', name: 'Wide Nib', text: 'Hit windows 25% wider' },
  { id: 'sponge', name: 'Sponge', text: 'Ink well holds 3 more blots' },
  { id: 'bounty', name: 'Blot Bounty', text: 'Each held blot adds 8% to every score' },
  { id: 'thrift', name: 'Thrifty Stamp', text: 'Stamping costs 1 blot less' },
  { id: 'long', name: 'Long Fever', text: 'Fever lasts 3 beats longer' },
  { id: 'blotter', name: 'Blotter', text: 'Every 6 perfects dry half a blot' },
  { id: 'spare', name: 'Spare Page', text: 'One extra page right now' },
] as const;
export type StickerId = (typeof STICKERS)[number]['id'];

export type Grade = 'perfect' | 'good' | 'ok';
export type Phase = 'play' | 'pick' | 'won' | 'lost';
export type NoteState = 'live' | 'holding' | 'hit' | 'missed' | 'dropped' | 'cleared';

export interface Note {
  id: number;
  lane: number;
  /** Strike time in seconds from the set start (the count-in is negative). */
  t: number;
  /** Hold length in seconds (0 = tap). */
  len: number;
  state: NoteState;
  /** Another note strikes at the same moment (a double). */
  pair: boolean;
}

export interface ChartNote {
  lane: number;
  /** In beats from the first downbeat. */
  beat: number;
  /** Hold length in beats. */
  len: number;
}

const WIN = { perfect: 0.07, good: 0.13, ok: 0.19 };
const BASE = { perfect: 100, good: 70, ok: 40 };
const RHYTHMS: number[][][] = [
  [[0, 2, 4, 6], [0, 4], [0, 2, 4], [0, 4, 6]],
  [[0, 2, 3, 4, 6], [0, 3, 4, 6], [0, 2, 4, 5, 6], [0, 2, 4, 6, 7]],
  [[0, 1, 2, 4, 6], [0, 2, 3, 4, 5, 6], [0, 3, 4, 7], [0, 2, 4, 6, 7]],
  [[0, 1, 2, 3, 4, 6], [0, 2, 3, 4, 6, 7], [0, 1, 3, 4, 5, 7], [0, 2, 4, 5, 6, 7]],
];

/** A chart for one set: phrases of four bars (A B A B'), lanes follow a motif per bar type, so it is learnable. Pure. */
export function makeChart(rng: Rng, cfg: SetCfg): ChartNote[] {
  const out: ChartNote[] = [];
  const bank = RHYTHMS[cfg.level]!;
  const playable = cfg.bars - 1; // last bar is silence
  let lane = rng.int(0, 3);
  const nextLane = (l: number) => (l + rng.pick([1, 3, 2, 1, 3])) % 4;
  for (let phrase = 0; phrase * 4 < playable; phrase++) {
    const A = rng.pick(bank);
    const B = rng.pick(bank);
    const laneA: number[] = [];
    const laneB: number[] = [];
    for (let i = 0; i < A.length; i++) { lane = nextLane(lane); laneA.push(lane); }
    for (let i = 0; i < B.length; i++) { lane = nextLane(lane); laneB.push(lane); }
    const tweak = rng.int(0, B.length - 1);
    for (let k = 0; k < 4; k++) {
      const bar = phrase * 4 + k;
      if (bar >= playable) break;
      const useA = k % 2 === 0;
      const slots = useA ? A : B;
      const lanes = useA ? laneA : laneB;
      slots.forEach((slot, i) => {
        if (k === 3 && i === tweak && slot !== 0) return; // the answer bar drops one note: statement/answer
        out.push({ lane: lanes[i]!, beat: bar * 4 + slot / 2, len: 0 });
      });
    }
  }
  out.sort((a, b) => a.beat - b.beat || a.lane - b.lane);
  // holds: a note on a strong slot with room before the next note becomes a hold
  if (cfg.holds > 0) {
    for (let i = 0; i < out.length; i++) {
      const n = out[i]!;
      const next = out.slice(i + 1).find((m) => m.beat > n.beat + 1e-6);
      const gap = (next ? next.beat : cfg.bars * 4) - n.beat;
      const onStrong = Math.abs(n.beat % 2) < 1e-6;
      if (onStrong && gap >= 1.5 && rng.chance(cfg.holds * 0.5)) n.len = Math.min(2, gap - 0.5);
    }
  }
  // doubles: a partner on the opposite lane on some bar downbeats
  if (cfg.doubles > 0) {
    const extra: ChartNote[] = [];
    for (const n of out) {
      if (n.beat % 4 === 0 && n.len === 0 && rng.chance(cfg.doubles)) extra.push({ lane: (n.lane + 2) % 4, beat: n.beat, len: 0 });
    }
    out.push(...extra);
    out.sort((a, b) => a.beat - b.beat || a.lane - b.lane);
  }
  return out;
}

export interface Stats {
  windowMul: number;
  inkMax: number;
  cost: number;
  feverBeats: number;
  bounty: number;
  blotter: boolean;
}

export interface SimState {
  phase: Phase;
  set: number;
  cfg: SetCfg;
  beatDur: number;
  setT: number;
  lastBeat: number;
  notes: Note[];
  endT: number;
  score: number;
  displayScore: number;
  combo: number;
  maxCombo: number;
  mult: number;
  ink: number;
  inkBand: number;
  pages: number;
  pagesMax: number;
  feverT: number;
  feverMax: number;
  restUntil: number;
  graceUntil: number;
  strayInk: number;
  strayAt: number;
  stampLock: number;
  dripAt: number;
  drips: number;
  perfectRun: number;
  stickers: StickerId[];
  options: StickerId[];
  cursor: number;
  laneDown: boolean[];
  laneHold: number[]; // note id held per lane or -1
  endT2: number; // time spent in the won/lost screen
  // counters (telemetry)
  hits: number;
  perfects: number;
  goods: number;
  oks: number;
  misses: number;
  strays: number;
  stamps: number;
  spills: number;
  blots: number;
  notesTotal: number;
  holdsDone: number;
  freeTaps: number;
  setsDone: number;
  feverScore: number;
  stampLastSet: number;
}

export function createSim() {
  let ctx!: Ctx;
  let out: SimEvent[] = [];
  let nextId = 1;
  let prevStick = -1;
  const s = {} as SimState;

  const bal = (id: string): number => ctx.balance[id] ?? BALANCE.find((b) => b.id === id)!.default;
  const has = (id: StickerId) => s.stickers.includes(id);
  const emit = (e: SimEvent) => out.push(e);

  function stats(): Stats {
    return {
      windowMul: bal('window') * (has('nib') ? 1.25 : 1),
      inkMax: Math.round(bal('inkMax')) + (has('sponge') ? 3 : 0),
      cost: Math.max(1, Math.round(bal('stampCost')) - (has('thrift') ? 1 : 0)),
      feverBeats: 2 + (has('long') ? 3 : 0),
      bounty: has('bounty') ? 0.08 : 0,
      blotter: has('blotter'),
    };
  }

  function reset() {
    s.phase = 'play';
    s.set = 0;
    s.score = 0; s.displayScore = 0; s.combo = 0; s.maxCombo = 0; s.mult = 1;
    s.ink = 0; s.inkBand = 0;
    s.pagesMax = Math.round(bal('pages')); s.pages = s.pagesMax;
    s.feverT = 0; s.feverMax = 0; s.restUntil = -1; s.graceUntil = -1; s.strayInk = 0; s.strayAt = -9; s.stampLock = -1; s.dripAt = 0; s.drips = 0; s.perfectRun = 0;
    s.stickers = []; s.options = []; s.cursor = 0;
    s.laneDown = [false, false, false, false]; s.laneHold = [-1, -1, -1, -1];
    s.endT2 = 0;
    s.hits = s.perfects = s.goods = s.oks = s.misses = s.strays = s.stamps = s.spills = s.blots = 0;
    s.notesTotal = 0; s.holdsDone = 0; s.freeTaps = 0; s.setsDone = 0; s.feverScore = 0; s.stampLastSet = 0;
    s.notes = [];
    startSet(0);
  }

  function startSet(i: number) {
    s.set = i;
    s.cfg = SETS[i]!;
    s.beatDur = 60 / s.cfg.bpm;
    s.setT = -4 * s.beatDur;
    s.lastBeat = -5;
    s.phase = 'play';
    s.ink = 0; s.inkBand = 0; s.feverT = 0; s.restUntil = -1; s.graceUntil = -1; s.strayInk = 0; s.strayAt = -9; s.stampLock = -1; s.dripAt = 0;
    s.stampLastSet = 0;
    s.laneHold = [-1, -1, -1, -1];
    const chart = makeChart(ctx.rng.fork(), s.cfg);
    s.notes = chart.map((c) => ({ id: nextId++, lane: c.lane, t: c.beat * s.beatDur, len: c.len * s.beatDur, state: 'live' as NoteState, pair: false }));
    for (const n of s.notes) n.pair = s.notes.some((m) => m !== n && Math.abs(m.t - n.t) < 1e-6);
    s.notesTotal += s.notes.length;
    s.endT = s.cfg.bars * 4 * s.beatDur;
    emit({ type: 'set-start', magnitude: 0.6, data: { set: i, bpm: s.cfg.bpm } });
  }

  function multNow(): number {
    return 1 + Math.min(3, Math.floor(s.combo / 10));
  }

  function award(points: number, x: number, y: number): number {
    const st = stats();
    const fever = s.feverT > 0 ? bal('feverMult') : 1;
    const v = points * s.mult * fever * (1 + st.bounty * Math.floor(s.ink));
    s.score += v;
    if (s.feverT > 0) s.feverScore += v;
    void x; void y;
    return Math.round(v);
  }

  function addCombo() {
    s.combo++;
    s.maxCombo = Math.max(s.maxCombo, s.combo);
    const m = multNow();
    if (m > s.mult) {
      s.mult = m;
      emit({ type: 'combo-up', magnitude: 0.3 + 0.2 * m, data: { mult: m, combo: s.combo } });
    }
  }

  function breakCombo() {
    if (s.combo >= 10) emit({ type: 'combo-break', magnitude: 0.4, data: { combo: s.combo } });
    s.combo = 0;
    s.mult = 1;
    s.perfectRun = 0;
  }

  function setBand() {
    const m = stats().inkMax;
    const band = s.ink >= m * 0.75 ? 3 : s.ink >= m * 0.5 ? 2 : s.ink >= 1 ? 1 : 0;
    if (band !== s.inkBand) {
      s.inkBand = band;
      emit({ type: 'ink-band', magnitude: band / 3, data: { band } });
    }
  }

  function addInk(amount: number, lane: number) {
    if (s.setT < s.graceUntil || s.phase !== 'play') return;
    const before = Math.floor(s.ink);
    s.ink += s.feverT > 0 ? amount * 0.5 : amount; // fever halves the ink a mistake costs
    if (Math.floor(s.ink) > before) {
      s.blots++;
      const p = laneRing(lane);
      emit({ type: 'blot', magnitude: Math.min(1, s.ink / stats().inkMax), x: p.x, y: p.y, data: { ink: s.ink, lane } });
    }
    setBand();
    if (s.ink >= stats().inkMax) spill();
  }

  function spill() {
    s.spills++;
    s.pages--;
    breakCombo();
    s.ink = 0;
    setBand();
    for (const n of s.notes) if ((n.state === 'live' && n.t < s.setT + bal('approach')) || n.state === 'holding') n.state = 'cleared';
    s.laneHold = [-1, -1, -1, -1];
    s.restUntil = s.setT + 2 * s.beatDur;
    s.graceUntil = s.setT + 5 * s.beatDur;
    emit({ type: 'spill', magnitude: 1, data: { pages: s.pages } });
    if (s.pages <= 0) {
      s.phase = 'lost';
      s.endT2 = 0;
      emit({ type: 'gameover', magnitude: 1, data: { score: Math.round(s.score) } });
    }
  }

  function stamp() {
    const st = stats();
    if (s.feverT > 0 || s.phase !== 'play' || s.ink < st.cost || s.setT < -s.beatDur || s.setT < s.restUntil || s.setT < s.stampLock) return;
    const spent = Math.floor(s.ink);
    s.ink = 0;
    s.stamps++;
    s.stampLastSet++;
    setBand();
    s.feverMax = (st.feverBeats + spent) * s.beatDur;
    s.feverT = s.feverMax;
    emit({ type: 'stamp', magnitude: Math.min(1, 0.5 + spent / 10), data: { spent, beats: st.feverBeats + spent } });
    // the stamp slams every note already on the board
    const ap = bal('approach');
    let k = 0;
    for (const n of s.notes) {
      if ((n.state === 'live') && n.t - s.setT < ap * 0.95 && n.t - s.setT > -WIN.ok) {
        n.state = 'hit';
        if (n.len > 0) s.holdsDone++;
        s.hits++;
        const p = laneRing(n.lane);
        const pts = award(BASE.good, p.x, p.y);
        emit({ type: 'hit', magnitude: 0.6, x: p.x, y: p.y, data: { lane: n.lane, grade: 'good', points: pts, auto: true, order: k++, combo: s.combo } });
      }
    }
  }

  /** The judging clock: the sim clock shifted by the player's timing offset (for audio or display latency). */
  const jt = () => s.setT - bal('offset') / 1000;

  function judge(lane: number) {
    const st = stats();
    const w = st.windowMul * (s.feverT > 0 ? 1.4 : 1);
    let best: Note | null = null;
    let bestD = Infinity;
    for (const n of s.notes) {
      if (n.lane !== lane || n.state !== 'live') continue;
      const d = Math.abs(n.t - jt());
      if (d <= WIN.ok * w && d < bestD) { best = n; bestD = d; }
    }
    const p = laneRing(lane);
    if (!best) {
      // a press with nothing to hit: free tapping is a toy; mashing while notes are close costs a little
      const near = s.notes.some((n) => n.state === 'live' && Math.abs(n.t - jt()) < 0.5);
      if (s.setT < s.restUntil || s.setT < 0 || !near) {
        s.freeTaps++;
        emit({ type: 'free-tap', magnitude: 0.3, x: p.x, y: p.y, data: { lane } });
      } else if (s.setT - s.strayAt < 0.3) {
        s.freeTaps++;
        emit({ type: 'free-tap', magnitude: 0.2, x: p.x, y: p.y, data: { lane } });
      } else {
        s.strays++;
        s.strayAt = s.setT;
        breakCombo();
        s.strayInk += 0.5;
        emit({ type: 'stray', magnitude: 0.4, x: p.x, y: p.y, data: { lane } });
        if (s.strayInk >= 1) { s.strayInk -= 1; addInk(1, lane); }
      }
      return;
    }
    const grade: Grade = bestD <= WIN.perfect * w ? 'perfect' : bestD <= WIN.good * w ? 'good' : 'ok';
    const early = best.t - jt();
    s.hits++;
    if (grade === 'perfect') { s.perfects++; s.perfectRun++; } else if (grade === 'good') { s.goods++; s.perfectRun = 0; } else { s.oks++; s.perfectRun = 0; }
    if (grade !== 'ok') addCombo();
    else if (s.combo === 0) addCombo();
    const pts = award(BASE[grade], p.x, p.y);
    if (best.len > 0) { best.state = 'holding'; s.laneHold[lane] = best.id; } else best.state = 'hit';
    if (st.blotter && s.perfectRun >= 6) {
      s.perfectRun = 0;
      if (s.ink > 0) { s.ink = Math.max(0, s.ink - 0.5); emit({ type: 'dry', magnitude: 0.4, x: p.x, y: p.y, data: { ink: s.ink } }); setBand(); }
    }
    emit({ type: best.len > 0 ? 'hold-start' : 'hit', magnitude: grade === 'perfect' ? 0.8 : grade === 'good' ? 0.55 : 0.35, x: p.x, y: p.y, data: { lane, grade, points: pts, early, combo: s.combo, mult: s.mult, auto: false } });
  }

  function stickLane(input: InputState): number {
    const { x, y } = input.left;
    if (Math.hypot(x, y) < 0.6) return -1;
    if (Math.abs(x) > Math.abs(y)) return x > 0 ? 1 : 3;
    return y < 0 ? 0 : 2;
  }

  function stepPlay(dt: number, input: InputState) {
    const sl = stickLane(input);
    const flick = sl >= 0 && sl !== prevStick ? sl : -1;
    prevStick = sl;
    const b = input.buttons;
    const press = [b.y.pressed, b.b.pressed, b.a.pressed, b.x.pressed];
    const down = [b.y.down, b.b.down, b.a.down, b.x.down];
    if (flick >= 0) press[flick] = true;
    for (let l = 0; l < 4; l++) s.laneDown[l] = down[l]! || sl === l;

    s.setT += dt;
    // beat events
    const beatIdx = Math.floor(s.setT / s.beatDur);
    if (beatIdx !== s.lastBeat) {
      s.lastBeat = beatIdx;
      emit({ type: 'beat', magnitude: beatIdx % 4 === 0 ? 0.8 : 0.4, data: { beat: beatIdx, countIn: s.setT < 0 } });
    }
    // fever ticks down
    if (s.feverT > 0) {
      s.feverT -= dt;
      if (s.feverT <= 0) { s.feverT = 0; s.stampLock = s.setT + 6 * s.beatDur; emit({ type: 'fever-end', magnitude: 0.4 }); }
    }
    if (s.phase !== 'play') return;

    if (b.rb.pressed || b.rt.pressed) stamp();
    for (let l = 0; l < 4; l++) if (press[l]) judge(l);

    // holds
    for (let l = 0; l < 4; l++) {
      const id = s.laneHold[l]!;
      if (id < 0) continue;
      const n = s.notes.find((m) => m.id === id);
      if (!n) { s.laneHold[l] = -1; continue; }
      const end = n.t + n.len;
      const p = laneRing(l);
      if (jt() >= end - 0.06) {
        n.state = 'hit';
        s.laneHold[l] = -1;
        s.holdsDone++;
        addCombo();
        const pts = award(60, p.x, p.y);
        emit({ type: 'hold-done', magnitude: 0.6, x: p.x, y: p.y, data: { lane: l, points: pts } });
      } else if (!s.laneDown[l] && jt() < end - 0.2) {
        n.state = 'dropped';
        s.laneHold[l] = -1;
        breakCombo();
        emit({ type: 'hold-drop', magnitude: 0.3, x: p.x, y: p.y, data: { lane: l } });
      } else {
        s.score += (40 * s.mult * (s.feverT > 0 ? bal('feverMult') : 1)) * dt;
      }
    }

    // from the third set the well leaks: while it is over half full, an extra half blot drips in every four beats
    if (s.set >= 2 && s.ink >= stats().inkMax * 0.5 && s.feverT <= 0 && s.setT >= 0) {
      if (s.dripAt <= 0) s.dripAt = s.setT + 4 * s.beatDur;
      else if (s.setT >= s.dripAt) {
        s.dripAt = s.setT + 4 * s.beatDur;
        s.drips++;
        emit({ type: 'drip', magnitude: 0.4, data: { lane: Math.floor(s.setT / s.beatDur) % 4 } });
        addInk(0.5, Math.floor(s.setT / s.beatDur) % 4);
        if (s.phase !== 'play') return;
      }
    } else s.dripAt = 0;

    // misses and rest-clears
    const w = stats().windowMul * (s.feverT > 0 ? 1.4 : 1);
    for (const n of s.notes) {
      if (n.state !== 'live') continue;
      if (s.setT < s.restUntil && n.t < s.restUntil) { n.state = 'cleared'; continue; }
      if (jt() > n.t + WIN.ok * w) {
        n.state = 'missed';
        s.misses++;
        const p = laneRing(n.lane);
        breakCombo();
        emit({ type: 'miss', magnitude: 0.5, x: p.x, y: p.y, data: { lane: n.lane, free: s.setT < s.graceUntil } });
        addInk(1, n.lane);
        if (s.phase !== 'play') return;
      }
    }

    // set end
    if (s.setT > s.endT) {
      s.setsDone++;
      emit({ type: 'set-end', magnitude: 0.7, data: { set: s.set } });
      if (s.set >= SETS.length - 1) {
        s.phase = 'won';
        s.endT2 = 0;
        emit({ type: 'win', magnitude: 1, data: { score: Math.round(s.score) } });
        emit({ type: 'complete', magnitude: 1 });
      } else {
        s.phase = 'pick';
        s.cursor = 1;
        const pool = STICKERS.map((x) => x.id).filter((id) => !s.stickers.includes(id));
        ctx.rng.shuffle(pool);
        s.options = pool.slice(0, 3);
        s.endT2 = 0;
        emit({ type: 'pick-open', magnitude: 0.5 });
      }
    }
  }

  function stepPick(dt: number, input: InputState) {
    s.endT2 += dt;
    const sl = stickLane(input);
    const flick = sl >= 0 && sl !== prevStick ? sl : -1;
    prevStick = sl;
    const b = input.buttons;
    let move = 0;
    if (b.lb.pressed || flick === 3) move = -1;
    if (b.rb.pressed || flick === 1) move = 1;
    if (move !== 0) {
      s.cursor = Math.max(0, Math.min(s.options.length - 1, s.cursor + move));
      emit({ type: 'cursor', magnitude: 0.2, data: { cursor: s.cursor } });
    }
    if (s.endT2 > 0.6 && (b.a.pressed || b.rt.pressed)) {
      const id = s.options[s.cursor]!;
      s.stickers.push(id);
      if (id === 'spare') { s.pages++; s.pagesMax++; }
      emit({ type: 'sticker', magnitude: 0.8, data: { id, index: s.cursor } });
      startSet(s.set + 1);
    }
  }

  function stepEnd(dt: number, input: InputState) {
    s.endT2 += dt;
    if (s.endT2 > 3 && input.buttons.a.pressed) {
      emit({ type: 'again', magnitude: 0.4 });
      reset();
    }
  }

  return {
    state: s,
    init(c: Ctx) { ctx = c; nextId = 1; out = []; prevStick = -1; reset(); },
    step(dt: number, input: InputState) {
      if (s.phase === 'play') stepPlay(dt, input);
      else if (s.phase === 'pick') stepPick(dt, input);
      else stepEnd(dt, input);
      // the displayed score chases the real one
      s.displayScore += (s.score - s.displayScore) * Math.min(1, dt * 10);
      if (Math.abs(s.score - s.displayScore) < 0.5) s.displayScore = s.score;
    },
    drain(): SimEvent[] { const e = out; out = []; return e; },
    stats,
  };
}
