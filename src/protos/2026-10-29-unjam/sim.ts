import type { BalanceSpec, Ctx, InputState, PrototypeMeta, SimEvent } from '../../core/types.ts';

/** Pure sim for Unjam: no Pixi, no DOM, no audio, no Math.random. Bots and unit tests import this directly. */
export const CH = { left: 40, right: 1240, top: 250, bottom: 550 };
export const BASKET_X = 1170;
export const SPAWN_X = 74;
export const WALL_HALF = 13;
export const BOT_R = 24;
export const KIND_R = [15, 23, 17];
/** How hard each blob kind grips a gate; a pop must beat grip * 0.4 at its distance. */
export const KIND_GRIP = [1, 1.3, 1.8];
export const LAYER_AT = [0, 30, 60, 90];
export const LAYER_NAMES = ['PRESSURE', 'FAT BLOBS', 'STICKY BLOBS', 'SECOND GATE'];
export const WAVE_EVERY = 40;
export const CHOICE_SECONDS = 9;
export const UNLOCK_AT = 12;
const DEFAULT_GAP = 100;
const MAX_BLOBS = 150;
const FLOW = 150;
const CHARGE_TIME = 0.55;
const AUTO_FIRE_AFTER = 0.4;
const POP_COOLDOWN = 0.28;
const GAP_CHOICES = [70, 82, 94, 108];
const GAP_MULT = [1.7, 1.4, 1.15, 1.0];

/** The knobs Slone can tune in the pause menu's Balance screen. Read live through ctx.balance. */
export const BALANCE: BalanceSpec[] = [
  { id: 'baseSpawn', label: 'Starting blob rate', min: 0.8, max: 3, step: 0.1, default: 1.5, unit: '/s' },
  { id: 'spawnRamp', label: 'Speed ramp (more blobs each second)', min: 0, max: 0.2, step: 0.01, default: 0.06 },
  { id: 'jamChance', label: 'How easily gates jam', min: 0.3, max: 2.5, step: 0.1, default: 1, unit: 'x' },
  { id: 'burstRate', label: 'How fast the backlog bursts the pipe', min: 0.4, max: 2, step: 0.1, default: 1, unit: 'x' },
  { id: 'popPower', label: 'Pop strength', min: 0.6, max: 1.6, step: 0.05, default: 1, unit: 'x' },
  { id: 'flushFill', label: 'Flush meter fill speed', min: 0.4, max: 2.5, step: 0.1, default: 1, unit: 'x' },
  { id: 'flushSeconds', label: 'Flush length', min: 3, max: 9, step: 0.5, default: 5, unit: 's' },
  { id: 'lives', label: 'Pipe bursts allowed (next run)', min: 1, max: 6, step: 1, default: 3 },
];
const DEFAULTS: Record<string, number> = Object.fromEntries(BALANCE.map((b) => [b.id, b.default]));

export interface Blob {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  kind: number;
  stuck: boolean;
  strain: number;
  grip: number;
  age: number;
  /** Seconds a freed blob cannot wedge again, so a pop actually carries it through. */
  free: number;
}

export interface Gate {
  x: number;
  gap: number;
  cy: number;
  tgap: number;
  tcy: number;
  /** 0 closed .. 1 fully retracted (the flush opens the gates). */
  open: number;
  active: boolean;
  jams: number;
  /** After an unjam the gate runs clear for a moment, so the pile behind it floods through. */
  clearT: number;
}

export interface Offer {
  gap: number;
  cy: number;
  mult: number;
}

export class UnjamSim {
  /** The little bot you fly. */
  x = 300;
  y = 400;
  px = 300;
  py = 400;
  vx = 0;
  vy = 0;
  blobs: Blob[] = [];
  gates: Gate[] = [
    { x: 520, gap: DEFAULT_GAP, cy: 400, tgap: DEFAULT_GAP, tcy: 400, open: 0, active: true, jams: 0, clearT: 0 },
    { x: 880, gap: DEFAULT_GAP + 8, cy: 400, tgap: DEFAULT_GAP + 8, tcy: 400, open: 0, active: false, jams: 0, clearT: 0 },
  ];
  score = 0;
  delivered = 0;
  combo = 0;
  comboT = 0;
  maxCombo = 0;
  mult = 1;
  deaths = 0;
  lives = 3;
  maxLives = 3;
  runs = 1;
  layer = 1;
  runTime = 0;
  time = 0;
  over = false;
  overT = 0;
  bestSurvival = 0;
  /** Burst gauge 0..100: the backlog fills it, and at 100 the pipe bursts. */
  burst = 10;
  stalled = 0;
  /** Charging the pop: 0..1, and whether the button is down. */
  charge = 0;
  charging = false;
  popCd = 0;
  pullOn = false;
  pullUnlocked = false;
  /** Forward pressure. */
  meter = 0;
  ready = false;
  active = false;
  surge = 0;
  heading = 0;
  surges = 0;
  surgeBlobs = 0;
  /** Wave choice (the curator step). */
  choosing = false;
  choiceT = 0;
  offers: Offer[] = [];
  sel = 0;
  waves = 0;
  // counters
  pops = 0;
  jams = 0;
  frees = 0;
  floods = 0;
  firstPressure = 0;
  firstFail = 0;
  private nextBlob = 1;
  private spawnAcc = 0;
  private calm = 0;
  private rampStart = 0;
  private level = 0;
  private beatT = 0;
  private beaconT = 0;
  private pullTick = 0;
  private holdFull = 0;
  private inv = 0;
  private floodCount = 0;
  private out: SimEvent[] = [];
  private ctx!: Ctx;

  readonly meta: PrototypeMeta = {
    slug: '2026-10-29-unjam',
    title: 'Unjam',
    question: 'Is the pop-and-whoosh of freeing a jam a toy worth repeating, and does choosing the next hazard from two generated layouts feel like steering the pressure?',
    targetFeeling: 'relief: the plunger-pop after a held breath',
    mode: 'systemic',
  };

  init(ctx: Ctx): void {
    this.ctx = ctx;
    this.maxLives = Math.round(this.bal('lives'));
    this.lives = this.maxLives;
    this.emit({ type: 'run-start', magnitude: 0 });
  }

  bal(id: string): number {
    return this.ctx?.balance?.[id] ?? DEFAULTS[id]!;
  }

  get surging(): boolean {
    return this.active;
  }

  get spawnRate(): number {
    const base = Math.min(6.5, this.bal('baseSpawn') + this.bal('spawnRamp') * (this.runTime - this.rampStart));
    return this.active ? base * 1.6 : base;
  }

  get flushSecs(): number {
    return this.bal('flushSeconds');
  }

  step(dt: number, input: InputState): void {
    this.px = this.x;
    this.py = this.y;
    if (this.over) {
      this.overT += dt;
      this.animateGates(dt);
      if (this.overT > 0.7 && input.buttons.a.pressed) this.restart();
      return;
    }
    this.time += dt;
    this.runTime += dt;
    if (this.calm > 0) this.calm -= dt;
    if (this.inv > 0) this.inv -= dt;

    this.updateLayers();
    if (this.choosing) this.stepChoice(dt, input);
    else this.stepWaves();
    this.moveBot(dt, input);
    if (!this.choosing) this.stepVerbs(dt, input);
    else { this.charging = false; this.charge = 0; this.pullOn = false; }
    this.animateGates(dt);
    this.spawn(dt);
    this.stepBlobs(dt);
    this.wedge();
    this.deliver();
    this.stepMeter(dt);
    this.stepPressure(dt);
    if (this.active && (this.surge -= dt) <= 0) this.endSurge();
  }

  // ---- layers, waves, the curator step ----

  private updateLayers(): void {
    let layer = 1;
    for (let i = 1; i < LAYER_AT.length; i++) if (this.runTime >= LAYER_AT[i]!) layer = i + 1;
    if (layer > this.layer) {
      this.layer = layer;
      if (layer >= 4) {
        const g = this.gates[1]!;
        g.active = true;
        g.cy = g.tcy = 800 - this.gates[0]!.tcy;
      }
      this.emit({ type: 'layer', magnitude: layer / 4, data: { level: layer, name: LAYER_NAMES[layer - 1]! } });
    }
  }

  private stepWaves(): void {
    if (this.active) return;
    if (this.runTime >= WAVE_EVERY * (this.waves + 1) && this.calm <= 0) this.startChoice();
  }

  private startChoice(): void {
    const rng = this.ctx.rng;
    const gapA = rng.int(0, 3);
    let gapB = rng.int(0, 3);
    if (gapB === gapA) gapB = (gapA + 2) % 4;
    const mk = (g: number): Offer => ({ gap: GAP_CHOICES[g]!, cy: 400 + rng.int(-3, 3) * 30, mult: GAP_MULT[g]! });
    this.offers = [mk(gapA), mk(gapB)];
    this.sel = 0;
    this.choosing = true;
    this.choiceT = CHOICE_SECONDS;
    this.emit({ type: 'wave-break', magnitude: 0.6, data: { wave: this.waves + 1 } });
  }

  private stepChoice(dt: number, input: InputState): void {
    this.choiceT -= dt;
    const sx = input.left.x;
    if (sx < -0.5 && this.sel !== 0) { this.sel = 0; this.emit({ type: 'wave-hover', magnitude: 0.3, data: { sel: 0 } }); }
    if (sx > 0.5 && this.sel !== 1) { this.sel = 1; this.emit({ type: 'wave-hover', magnitude: 0.3, data: { sel: 1 } }); }
    if (input.buttons.a.pressed || this.choiceT <= 0) this.applyChoice();
  }

  private applyChoice(): void {
    const o = this.offers[this.sel]!;
    this.choosing = false;
    this.waves++;
    this.mult = o.mult;
    const g1 = this.gates[0]!;
    const g2 = this.gates[1]!;
    g1.tgap = o.gap;
    g1.tcy = o.cy;
    g2.tgap = o.gap + 8;
    g2.tcy = 800 - o.cy;
    this.emit({ type: 'wave-pick', magnitude: 0.7, data: { gap: o.gap, mult: o.mult, wave: this.waves } });
  }

  private animateGates(dt: number): void {
    for (const g of this.gates) {
      g.gap += Math.max(-140 * dt, Math.min(140 * dt, g.tgap - g.gap));
      g.cy += Math.max(-140 * dt, Math.min(140 * dt, g.tcy - g.cy));
      const want = this.active ? 1 : 0;
      g.open += Math.max(-4 * dt, Math.min(4 * dt, want - g.open));
    }
  }

  // ---- the player's bot and its verbs ----

  private moveBot(dt: number, input: InputState): void {
    const left = input.left;
    if (this.active) {
      if (Math.hypot(left.x, left.y) > 0.25) {
        const want = Math.atan2(left.y, left.x);
        let diff = want - this.heading;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        const turn = 5 * dt;
        this.heading += Math.max(-turn, Math.min(turn, diff));
      }
      this.vx = Math.cos(this.heading) * 820;
      this.vy = Math.sin(this.heading) * 820;
    } else {
      this.vx += left.x * 3000 * dt;
      this.vy += left.y * 3000 * dt;
      const damp = Math.exp(-5.5 * dt);
      this.vx *= damp;
      this.vy *= damp;
      const sp = Math.hypot(this.vx, this.vy);
      if (sp > 640) { this.vx *= 640 / sp; this.vy *= 640 / sp; }
    }
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    const min = 40;
    if (this.x < min) { this.x = min; this.vx = Math.abs(this.vx) * 0.5; }
    if (this.x > 1240) { this.x = 1240; this.vx = -Math.abs(this.vx) * 0.5; }
    if (this.y < 90) { this.y = 90; this.vy = Math.abs(this.vy) * 0.5; }
    if (this.y > 760) { this.y = 760; this.vy = -Math.abs(this.vy) * 0.5; }
    if (this.active) this.heading = Math.atan2(this.vy, this.vx);
  }

  private stepVerbs(dt: number, input: InputState): void {
    const b = input.buttons;
    if (this.popCd > 0) this.popCd -= dt;
    if (this.active) {
      this.charging = false;
      this.charge = 0;
      this.pullOn = false;
      this.plow();
      return;
    }
    // charge-and-release pop (hold A)
    if (b.a.down && this.popCd <= 0) {
      if (!this.charging) this.emit({ type: 'charge-start', magnitude: 0.2, x: this.x, y: this.y });
      this.charging = true;
      this.charge = Math.min(1, this.charge + dt / CHARGE_TIME);
      if (this.charge >= 1) {
        this.holdFull += dt;
        if (this.holdFull > AUTO_FIRE_AFTER) this.firePop();
      }
    } else if (this.charging) {
      this.firePop();
    }
    if (!b.a.down) this.holdFull = 0;
    // pull (hold X), unlocked by delivering enough blobs
    this.pullOn = this.pullUnlocked && b.x.down && !this.charging;
    if (this.pullOn) this.stepPull(dt);
    // flush trigger
    if (b.y.pressed && this.ready && !this.active) this.startSurge(input.left);
  }

  private firePop(): void {
    const p = (0.3 + 0.7 * this.charge) * this.bal('popPower');
    const R = 90 + 190 * p;
    const strongest = this.charge;
    this.charging = false;
    this.charge = 0;
    this.holdFull = 0;
    this.popCd = POP_COOLDOWN + 0.5 * strongest;
    this.pops++;
    let freed = 0;
    let cx = 0;
    let cy = 0;
    let forward = 0;
    for (const b of this.blobs) {
      const dx = b.x - this.x;
      const dy = b.y - this.y;
      const d = Math.hypot(dx, dy);
      if (d > R) continue;
      const f = 1 - d / R;
      const ux = d > 3 ? dx / d : 1;
      const uy = d > 3 ? dy / d : 0;
      if (b.stuck) {
        if (p * (1 - 0.5 * (d / R)) >= b.grip * 0.4) {
          b.stuck = false;
          b.strain = 0;
          b.free = 1.1;
          b.vx = ux * (330 + 520 * p);
          b.vy = uy * (330 + 520 * p) * 0.6;
          freed++;
          cx += b.x;
          cy += b.y;
          if (ux > 0) forward++;
        } else {
          b.strain += 0.6;
        }
      } else {
        const k = 200 + 760 * p;
        b.vx += ux * k * f;
        b.vy += uy * k * f;
      }
    }
    this.emit({ type: 'pop', magnitude: Math.min(1, p), x: this.x, y: this.y, data: { power: Math.round(p * 100) / 100, radius: Math.round(R), freed } });
    if (freed > 0) {
      this.frees += freed;
      for (const g of this.gates) if (g.active && Math.abs(g.x - cx / freed) < 120) g.clearT = 1.7;
      this.floodCount = 0;
      this.comboT = Math.max(this.comboT, 2.2);
      this.emit({
        type: 'unjam',
        magnitude: Math.min(1, 0.4 + freed * 0.15),
        x: cx / freed,
        y: cy / freed,
        data: { count: freed, power: Math.round(p * 100) / 100, forward: forward >= freed / 2 },
      });
    }
  }

  private stepPull(dt: number): void {
    const R = 300;
    for (const b of this.blobs) {
      if (b.stuck) continue;
      const dx = this.x - b.x;
      const dy = this.y - b.y;
      const d = Math.hypot(dx, dy);
      if (d > R || d < 6) continue;
      const k = 1500 * (1 - d / R);
      b.vx += (dx / d) * k * dt;
      b.vy += (dy / d) * k * dt;
    }
    this.pullTick -= dt;
    if (this.pullTick <= 0) {
      this.pullTick = 0.14;
      this.emit({ type: 'pull-tick', magnitude: 0.3, x: this.x, y: this.y });
    }
  }

  /** While flushing the bot is a bulldozer: blobs near it are carried along the heading. */
  private plow(): void {
    const dirx = Math.cos(this.heading);
    const diry = Math.sin(this.heading);
    for (const b of this.blobs) {
      const d = Math.hypot(b.x - this.x, b.y - this.y);
      if (d > 95) continue;
      if (b.stuck) { b.stuck = false; b.strain = 0; }
      b.vx = dirx * 700 + (b.x - this.x) * 3;
      b.vy = diry * 700 + (b.y - this.y) * 3;
      this.surgeBlobs++;
    }
  }

  // ---- blobs ----

  private spawn(dt: number): void {
    if (this.choosing || this.calm > 0) return;
    this.spawnAcc += this.spawnRate * dt;
    while (this.spawnAcc >= 1) {
      this.spawnAcc -= 1;
      if (this.blobs.length >= MAX_BLOBS) continue;
      const rng = this.ctx.rng;
      const roll = rng.next();
      let kind = 0;
      if (this.layer >= 3) kind = roll < 0.22 ? 2 : roll < 0.45 ? 1 : 0;
      else if (this.layer >= 2) kind = roll < 0.28 ? 1 : 0;
      const r = KIND_R[kind]!;
      this.blobs.push({
        id: this.nextBlob++,
        x: SPAWN_X + rng.range(-10, 20),
        y: rng.range(CH.top + r + 4, CH.bottom - r - 4),
        vx: FLOW,
        vy: rng.range(-30, 30),
        r,
        kind,
        stuck: false,
        strain: 0,
        grip: KIND_GRIP[kind]!,
        age: 0,
        free: 0,
      });
    }
  }

  private stepBlobs(dt: number): void {
    const boost = this.active ? 2.6 : 1;
    const wob = this.active ? Math.sin(this.time * 7) * 120 : 0;
    const bl = this.blobs;
    for (const b of bl) {
      b.age += dt;
      if (b.free > 0) b.free -= dt;
      if (b.stuck) {
        b.vx = 0;
        b.vy = 0;
        b.strain += dt;
        continue;
      }
      b.vx += (FLOW * boost - b.vx) * Math.min(1, 2.4 * dt);
      b.vy += (wob * (b.id % 2 ? 1 : -1) - b.vy) * Math.min(1, 2 * dt);
      b.x += b.vx * dt;
      b.y += b.vy * dt;
    }
    // soft circle separation (sorted sweep), a few passes so piles hold
    bl.sort((a, b) => a.x - b.x);
    for (let pass = 0; pass < 3; pass++) {
      for (let i = 0; i < bl.length; i++) {
        const a = bl[i]!;
        for (let j = i + 1; j < bl.length; j++) {
          const c = bl[j]!;
          const reach = a.r + c.r;
          if (c.x - a.x > reach) break;
          const dx = c.x - a.x;
          const dy = c.y - a.y;
          const d2 = dx * dx + dy * dy;
          if (d2 >= reach * reach) continue;
          const d = Math.sqrt(d2) || 0.01;
          const push = (reach - d) / d;
          const wa = a.stuck ? 0 : 1;
          const wc = c.stuck ? 0 : 1;
          const w = wa + wc;
          if (w === 0) continue;
          a.x -= (dx * push * wa) / w;
          a.y -= (dy * push * wa) / w;
          c.x += (dx * push * wc) / w;
          c.y += (dy * push * wc) / w;
          if (pass === 0) {
            // exchange a little momentum; sticky blobs share velocity (clumps move as one)
            const k = a.kind === 2 || c.kind === 2 ? 0.35 : 0.08;
            const mvx = (a.vx + c.vx) / 2;
            const mvy = (a.vy + c.vy) / 2;
            if (!a.stuck) { a.vx += (mvx - a.vx) * k; a.vy += (mvy - a.vy) * k; }
            if (!c.stuck) { c.vx += (mvx - c.vx) * k; c.vy += (mvy - c.vy) * k; }
          }
        }
      }
      for (const b of bl) this.collideWalls(b);
    }
  }

  private collideWalls(b: Blob): void {
    if (b.stuck) return;
    if (b.y < CH.top + b.r) { b.y = CH.top + b.r; b.vy = Math.abs(b.vy) * 0.3; }
    if (b.y > CH.bottom - b.r) { b.y = CH.bottom - b.r; b.vy = -Math.abs(b.vy) * 0.3; }
    if (b.x < CH.left + b.r) { b.x = CH.left + b.r; b.vx = Math.abs(b.vx) * 0.3; }
    for (const g of this.gates) {
      if (!g.active || g.open > 0.5) continue;
      this.rectPush(b, g.x - WALL_HALF, CH.top, g.x + WALL_HALF, g.cy - g.gap / 2);
      this.rectPush(b, g.x - WALL_HALF, g.cy + g.gap / 2, g.x + WALL_HALF, CH.bottom);
    }
  }

  private rectPush(b: Blob, x0: number, y0: number, x1: number, y1: number): void {
    const cx = Math.max(x0, Math.min(b.x, x1));
    const cy = Math.max(y0, Math.min(b.y, y1));
    const dx = b.x - cx;
    const dy = b.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 >= b.r * b.r) return;
    if (d2 < 0.0001) {
      b.x = x0 - b.r;
      b.vx = -Math.abs(b.vx) * 0.2;
      return;
    }
    const d = Math.sqrt(d2);
    const push = (b.r - d) / d;
    b.x += dx * push;
    b.y += dy * push;
    if (Math.abs(dx) > Math.abs(dy)) b.vx = (dx > 0 ? 1 : -1) * Math.abs(b.vx) * 0.1; else b.vy *= -0.2;
  }

  /** A gate wedges when too many blobs try to squeeze through together with a pile pushing behind. */
  private wedge(): void {
    if (this.active) return;
    for (const g of this.gates) {
      if (!g.active || g.open > 0.2) continue;
      if (g.clearT > 0) { g.clearT -= 1 / 60; continue; }
      const zone: Blob[] = [];
      let pile = 0;
      for (const b of this.blobs) {
        if (b.stuck) continue;
        if (b.free > 0) { if (Math.abs(b.x - g.x) < 90) pile++; continue; }
        if (Math.abs(b.x - g.x) < WALL_HALF + b.r * 0.6 && Math.abs(b.y - g.cy) < g.gap / 2 + b.r * 0.5) zone.push(b);
        else if (b.x < g.x - WALL_HALF && b.x > g.x - 190 && Math.abs(b.y - g.cy) < g.gap + 60) pile++;
      }
      if (zone.length < 2) continue;
      let sum = 0;
      for (const b of zone) sum += b.r * 2;
      if (sum <= g.gap * 0.55) continue;
      const p = Math.min(1, 0.035 * this.bal('jamChance') * (1 + 0.2 * pile) * (zone.length >= 3 ? 3 : 1));
      // the first jam is a gift: it arrives early so the verb is learned within seconds
      if (!(this.jams === 0 && this.runTime > 6) && !this.ctx.rng.chance(p)) continue;
      let grip = 0;
      let cx = 0;
      let cy = 0;
      for (const b of zone) {
        b.stuck = true;
        b.strain = 0;
        grip = Math.max(grip, b.grip);
        cx += b.x;
        cy += b.y;
      }
      for (const b of zone) b.grip = grip;
      g.jams++;
      this.jams++;
      this.emit({ type: 'wedge', magnitude: Math.min(1, 0.4 + 0.2 * zone.length), x: cx / zone.length, y: cy / zone.length, data: { count: zone.length, grip } });
    }
  }

  private deliver(): void {
    for (let i = this.blobs.length - 1; i >= 0; i--) {
      const b = this.blobs[i]!;
      if (b.x < BASKET_X) continue;
      this.blobs.splice(i, 1);
      this.delivered++;
      this.combo = this.comboT > 0 ? this.combo + 1 : 1;
      this.comboT = 1.4;
      this.floodCount++;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
      const pts = (1 + Math.floor(this.combo / 8)) * (this.active ? 3 : 1) * this.mult;
      this.score += pts;
      if (!this.active && !this.ready) {
        this.meter = Math.min(1, this.meter + 0.0042 * (1 + Math.min(this.combo, 30) / 12) * this.bal('flushFill'));
        if (this.meter >= 1) {
          this.ready = true;
          this.beaconT = 0.4;
          this.emit({ type: 'flush-ready', magnitude: 1, x: this.x, y: this.y });
        }
      }
      this.emit({
        type: 'deliver',
        magnitude: Math.min(1, 0.25 + this.combo * 0.03),
        x: BASKET_X,
        y: b.y,
        data: { combo: this.combo, steps: Math.min(7, Math.floor(this.combo / 3)), kind: b.kind, pts: Math.round(pts * 10) / 10, meter: Math.round(this.meter * 100) / 100 },
      });
      if (this.combo > 0 && this.combo % 10 === 0) {
        this.floods++;
        this.burst = Math.max(0, this.burst - 8);
        this.emit({ type: 'flood', magnitude: Math.min(1, this.combo / 40 + 0.4), x: BASKET_X - 60, y: 400, data: { combo: this.combo } });
      }
      if (!this.pullUnlocked && this.delivered >= UNLOCK_AT) {
        this.pullUnlocked = true;
        this.emit({ type: 'unlock', magnitude: 1, x: this.x, y: this.y });
      }
    }
  }

  // ---- meters, flush, pressure ----

  private stepMeter(dt: number): void {
    if (this.comboT > 0) {
      this.comboT -= dt;
      if (this.comboT <= 0) {
        if (this.combo >= 10) this.emit({ type: 'combo-drop', magnitude: 0.3, data: { combo: this.combo } });
        this.combo = 0;
      }
    }
    if (this.ready) {
      this.beaconT -= dt;
      if (this.beaconT <= 0) {
        this.beaconT = 1.4;
        this.emit({ type: 'flush-beacon', magnitude: 0.6, x: this.x, y: this.y });
      }
    } else if (!this.active && this.combo === 0) {
      this.meter = Math.max(0, this.meter - 0.015 * dt);
    }
  }

  private startSurge(stick: { x: number; y: number }): void {
    this.ready = false;
    this.active = true;
    this.surge = this.flushSecs;
    this.surges++;
    this.surgeBlobs = 0;
    this.heading = Math.hypot(stick.x, stick.y) > 0.25 ? Math.atan2(stick.y, stick.x) : 0;
    for (const b of this.blobs) { b.stuck = false; b.strain = 0; }
    this.emit({ type: 'flush-start', magnitude: 1, x: this.x, y: this.y, data: { seconds: this.flushSecs } });
  }

  private endSurge(): void {
    this.active = false;
    this.surge = 0;
    this.meter = 0;
    this.burst = Math.max(0, this.burst - 35);
    this.vx *= 0.3;
    this.vy *= 0.3;
    this.emit({ type: 'flush-end', magnitude: 0.6, x: this.x, y: this.y, data: { carried: this.surgeBlobs } });
  }

  private stepPressure(dt: number): void {
    let stalled = 0;
    for (const b of this.blobs) if (Math.hypot(b.vx, b.vy) < 90 && b.x < BASKET_X - 20) stalled++;
    this.stalled = stalled;
    if (this.active || this.choosing) this.burst = Math.max(0, this.burst - 6 * dt);
    else if (stalled > 12) this.burst += (stalled - 12) * 1.3 * this.bal('burstRate') * dt;
    else this.burst = Math.max(0, this.burst - 7 * dt);
    this.burst = Math.min(100, this.burst);
    let lvl = 0;
    for (const t of [50, 75, 90]) if (this.burst >= t) lvl++;
    if (lvl > this.level) {
      if (this.firstPressure === 0) this.firstPressure = this.time;
      this.emit({ type: 'pressure', magnitude: lvl / 3, data: { level: lvl } });
    }
    this.level = lvl;
    if (this.burst > 55) {
      this.beatT -= dt;
      if (this.beatT <= 0) {
        this.beatT = 1.1 - 0.7 * Math.min(1, (this.burst - 55) / 45);
        this.emit({ type: 'heartbeat', magnitude: Math.min(1, (this.burst - 55) / 45) });
      }
    }
    if (this.burst >= 100 && this.inv <= 0) this.fail();
  }

  private fail(): void {
    this.deaths++;
    this.lives--;
    if (this.firstFail === 0) this.firstFail = this.time;
    this.emit({ type: 'burst', magnitude: 1, x: 640, y: 400, data: { lives: this.lives, blobs: this.blobs.length } });
    // reprieve: the pipe flushes clear, the ramp restarts, the player gets a calm beat
    this.blobs.length = 0;
    this.burst = 10;
    this.rampStart = this.runTime;
    this.calm = 3;
    this.inv = 3;
    this.spawnAcc = 0;
    this.combo = 0;
    this.comboT = 0;
    this.ready = false;
    this.meter = 0;
    this.level = 0;
    this.charging = false;
    this.charge = 0;
    if (this.lives <= 0) {
      this.over = true;
      this.overT = 0;
      this.bestSurvival = Math.max(this.bestSurvival, this.runTime);
      this.emit({ type: 'gameover', magnitude: 1, data: { score: Math.round(this.score), seconds: Math.round(this.runTime) } });
    } else {
      this.emit({ type: 'recover', magnitude: 0.6, x: this.x, y: this.y });
    }
  }

  private restart(): void {
    this.runs++;
    this.blobs.length = 0;
    this.score = 0;
    this.delivered = 0;
    this.combo = 0;
    this.comboT = 0;
    this.mult = 1;
    this.runTime = 0;
    this.rampStart = 0;
    this.layer = 1;
    this.level = 0;
    this.burst = 10;
    this.meter = 0;
    this.ready = false;
    this.active = false;
    this.surge = 0;
    this.choosing = false;
    this.waves = 0;
    this.pullUnlocked = false;
    this.maxLives = Math.round(this.bal('lives'));
    this.lives = this.maxLives;
    this.calm = 1.5;
    this.inv = 2;
    this.over = false;
    this.overT = 0;
    this.spawnAcc = 0;
    for (const g of this.gates) { g.tgap = g.gap = g === this.gates[0] ? DEFAULT_GAP : DEFAULT_GAP + 8; g.tcy = g.cy = 400; g.active = g === this.gates[0]; g.open = 0; g.jams = 0; g.clearT = 0; }
    this.emit({ type: 'restart', magnitude: 0.6, x: this.x, y: this.y });
  }

  private emit(e: SimEvent): void {
    this.out.push(e);
  }

  drain(): SimEvent[] {
    const e = this.out;
    this.out = [];
    return e;
  }

  telemetry(): Record<string, number> {
    return {
      runLength: Math.round(this.time * 100) / 100,
      deaths: this.deaths,
      firstPressureSimSec: Math.round(this.firstPressure * 100) / 100,
      idleSurvivalSec: Math.round((this.firstFail || this.time) * 100) / 100,
      mainVerbCount: this.pops,
      scoreOrProgress: Math.round(this.score),
      delivered: this.delivered,
      jams: this.jams,
      frees: this.frees,
      floods: this.floods,
      maxCombo: this.maxCombo,
      burst: Math.round(this.burst),
      stalled: this.stalled,
      lives: this.lives,
      maxLives: this.maxLives,
      layer: this.layer,
      waves: this.waves,
      runs: this.runs,
      surges: this.surges,
      blobs: this.blobs.length,
      survivalSec: Math.round(Math.max(this.bestSurvival, this.runTime) * 100) / 100,
    };
  }
}
