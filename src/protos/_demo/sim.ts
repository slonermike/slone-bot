import type { BalanceSpec, Ctx, InputState, PrototypeMeta, SimEvent } from '../../core/types.ts';

/** Pure sim for the demo: no Pixi, no DOM, no audio, no Math.random. Bots and unit tests import this directly. */
export const FIELD = { left: 40, top: 40, right: 1240, bottom: 760 };
export const BALL_R = 28;
export const HAZARD_R = 24;
export const LIVES = 3;

/** The knobs Slone can tune in the pause menu's Balance screen. Read live through ctx.balance. */
export const BALANCE: BalanceSpec[] = [
  { id: 'heatRamp', label: 'Heat ramp (faster each second)', min: 0, max: 0.6, step: 0.02, default: 0.2 },
  { id: 'pickupRelief', label: 'Heat relief per spark', min: 5, max: 50, step: 1, default: 22 },
  { id: 'hazardHeat', label: 'Heat from a drifter hit', min: 0, max: 50, step: 1, default: 20 },
  { id: 'meterFill', label: 'Surge meter fill speed', min: 0.3, max: 3, step: 0.1, default: 1, unit: 'x' },
  { id: 'surgeSpeed', label: 'Surge speed', min: 600, max: 2400, step: 50, default: 1300, unit: 'px/s' },
  { id: 'surgeSeconds', label: 'Surge length', min: 2, max: 10, step: 0.5, default: 5, unit: 's' },
  { id: 'drifterSpeed', label: 'Drifter speed', min: 0.5, max: 2, step: 0.1, default: 1, unit: 'x' },
  { id: 'lives', label: 'Lives (next run)', min: 1, max: 6, step: 1, default: 3 },
];
const DEFAULTS: Record<string, number> = Object.fromEntries(BALANCE.map((b) => [b.id, b.default]));
/** Run time (seconds) at which each pressure layer switches on: 1 heat, 2 drifters, 3 fading sparks, 4 closing walls. */
export const LAYER_AT = [0, 25, 55, 90];
export const LAYER_NAMES = ['HEAT', 'DRIFTERS', 'FADING SPARKS', 'CLOSING WALLS'];
const MAX_INSET = 110;
const ACCEL = 2600;
const MAX_SPEED = 900;
const DRAG = 1.8;
const RESTITUTION = 0.75;
const DASH_IMPULSE = 650;
const DASH_COOLDOWN = 30;
const PICKUP_R = 18;
const MAX_PICKUPS = 3;
const PICKUP_LIFE = 7;
const SURGE_TURN = 4.5; // rad/s: at surge speed this is a wide, slightly out-of-control arc

export interface Pickup {
  x: number;
  y: number;
  age: number;
}

export interface Hazard {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Seconds of telegraph left; the hazard cannot hurt or move until it reaches 0. */
  warn: number;
  age: number;
}

export class DemoSim {
  x = 640;
  y = 400;
  px = 640;
  py = 400;
  vx = 0;
  vy = 0;
  heat = 20;
  score = 0;
  combo = 0;
  /** Total failures across runs. */
  deaths = 0;
  lives = LIVES;
  maxLives = LIVES;
  dashes = 0;
  pickups: Pickup[] = [];
  hazards: Hazard[] = [];
  /** Total sim time, and time within the current run. */
  time = 0;
  runTime = 0;
  runs = 1;
  layer = 1;
  over = false;
  overT = 0;
  /** Forward pressure: combos fill the meter (0..1); when full the player can trigger a surge. */
  meter = 0;
  ready = false;
  /** Seconds of surge left. */
  surge = 0;
  private active = false;
  heading = 0;
  surges = 0;
  surgeKills = 0;
  streak = 0;
  bestSurvival = 0;
  firstPressure = 0;
  firstFail = 0;
  dashCd = 0;
  invuln = 0;
  private spawnT = 0;
  private hazardT = 0;
  private comboT = 0;
  private level = 0;
  private beatT = 0;
  private recoverIn = 0;
  private beaconT = 0;
  /** Run time of the last failure; the heat ramp restarts from here so failing is a reprieve. */
  private rampStart = 0;
  private out: SimEvent[] = [];
  private ctx!: Ctx;

  readonly meta: PrototypeMeta = {
    slug: '_demo',
    title: 'Demo Ball',
    question: 'Does pushing a ball around feel good before anything else happens?',
    targetFeeling: 'a small, springy toy that talks back',
    mode: 'systemic',
  };

  init(ctx: Ctx): void {
    this.ctx = ctx;
    this.maxLives = Math.round(this.bal('lives'));
    this.lives = this.maxLives;
    // tells the music (render side) a run has begun; delivered on the first playing step
    this.emit({ type: 'run-start', magnitude: 0 });
  }

  /** A live balance value (falls back to the spec default, e.g. in tests that build a bare ctx). */
  bal(id: string): number {
    return this.ctx?.balance?.[id] ?? DEFAULTS[id]!;
  }

  /** Run time at which layer `i` (0-based) switches on. */
  layerAt(i: number): number {
    return LAYER_AT[i]!;
  }

  get surgeSecs(): number {
    return this.bal('surgeSeconds');
  }

  /** Playfield; the walls close in during layer 4. */
  get inset(): number {
    return Math.max(0, Math.min(1, (this.runTime - this.layerAt(3)) / 90)) * MAX_INSET;
  }
  get arena(): { left: number; top: number; right: number; bottom: number } {
    const i = this.inset;
    return { left: FIELD.left + i, top: FIELD.top + i, right: FIELD.right - i, bottom: FIELD.bottom - i };
  }

  get heatRate(): number {
    return Math.min(30, 5 + this.bal('heatRamp') * (this.runTime - this.rampStart));
  }

  get surging(): boolean {
    return this.active;
  }

  get hazardCap(): number {
    const base = this.layer < 2 ? 0 : Math.min(6, 2 + Math.floor((this.runTime - this.layerAt(1)) / 25));
    return this.surging ? base + 2 : base;
  }

  step(dt: number, input: InputState): void {
    this.px = this.x;
    this.py = this.y;
    if (this.over) {
      this.overT += dt;
      if (this.overT > 0.7 && input.buttons.a.pressed) this.restart();
      return;
    }
    this.time += dt;
    this.runTime += dt;
    const { left, buttons } = input;
    const arena = this.arena;

    // surge trigger: the player chooses when to spend the full meter
    if (buttons.x.pressed && this.ready && !this.surging) this.startSurge(left);

    if (this.surging) {
      // constant speed, steer only: the stick turns the heading, nothing else changes the speed
      if (Math.hypot(left.x, left.y) > 0.25) {
        const want = Math.atan2(left.y, left.x);
        let diff = want - this.heading;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        const turn = SURGE_TURN * dt;
        this.heading += Math.max(-turn, Math.min(turn, diff));
      }
      this.vx = Math.cos(this.heading) * this.bal('surgeSpeed');
      this.vy = Math.sin(this.heading) * this.bal('surgeSpeed');
      this.surge -= dt;
    } else {
      this.vx += left.x * ACCEL * dt;
      this.vy += left.y * ACCEL * dt;
      const damp = Math.exp(-DRAG * dt);
      this.vx *= damp;
      this.vy *= damp;
    }

    if (this.dashCd > 0) this.dashCd--;
    if (buttons.a.pressed && this.dashCd === 0 && !this.surging) {
      let dx = left.x;
      let dy = left.y;
      const m = Math.hypot(dx, dy);
      if (m < 0.2) {
        const sp = Math.hypot(this.vx, this.vy);
        dx = sp > 1 ? this.vx / sp : 1;
        dy = sp > 1 ? this.vy / sp : 0;
      } else {
        dx /= m;
        dy /= m;
      }
      this.vx += dx * DASH_IMPULSE;
      this.vy += dy * DASH_IMPULSE;
      this.dashCd = DASH_COOLDOWN;
      this.dashes++;
      this.emit({ type: 'dash', magnitude: 0.5, x: this.x, y: this.y, data: { dx, dy } });
    }

    const speed = Math.hypot(this.vx, this.vy);
    if (!this.surging && speed > MAX_SPEED) {
      this.vx *= MAX_SPEED / speed;
      this.vy *= MAX_SPEED / speed;
    }
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // walls
    this.wall(this.x - BALL_R < arena.left, 'x', arena.left + BALL_R, -1);
    this.wall(this.x + BALL_R > arena.right, 'x', arena.right - BALL_R, 1);
    this.wall(this.y - BALL_R < arena.top, 'y', arena.top + BALL_R, -1);
    this.wall(this.y + BALL_R > arena.bottom, 'y', arena.bottom - BALL_R, 1);

    if (this.surging) {
      const sp = Math.hypot(this.vx, this.vy);
      if (sp > 1) this.heading = Math.atan2(this.vy, this.vx); // walls reflect the heading
    }

    this.updateLayers();
    this.updatePickups(dt, arena);
    this.updateHazards(dt, arena);
    this.updateMeter(dt);

    // base pressure: heat (frozen while surging)
    if (this.invuln > 0) this.invuln--;
    else if (!this.surging) this.heat += this.heatRate * dt;
    const thresholds = [50, 75, 90];
    let lvl = 0;
    for (const t of thresholds) if (this.heat >= t) lvl++;
    if (lvl > this.level) {
      if (this.firstPressure === 0) this.firstPressure = this.time;
      this.emit({ type: 'pressure', magnitude: lvl / 3, data: { level: lvl } });
    }
    this.level = lvl;
    if (this.heat > 60) {
      this.beatT -= dt;
      if (this.beatT <= 0) {
        this.beatT = 1.1 - 0.7 * Math.min(1, (this.heat - 60) / 40);
        this.emit({ type: 'heartbeat', magnitude: Math.min(1, (this.heat - 60) / 40) });
      }
    }
    if (this.heat >= 100 && this.invuln === 0 && !this.surging) this.fail();
    if (this.surging && this.surge <= 0) this.endSurge();
    if (this.recoverIn > 0 && --this.recoverIn === 0 && !this.over) this.emit({ type: 'recover', magnitude: 0.6, x: this.x, y: this.y });
  }

  /** Pressure layers switch on as the run goes on; the heat timer stays underneath all of them. */
  private updateLayers(): void {
    let layer = 1;
    for (let i = 1; i < LAYER_AT.length; i++) if (this.runTime >= this.layerAt(i)) layer = i + 1;
    if (layer > this.layer) {
      this.layer = layer;
      this.emit({ type: 'layer', magnitude: layer / 4, data: { level: layer, name: LAYER_NAMES[layer - 1]! } });
    }
  }

  private updatePickups(dt: number, a: { left: number; top: number; right: number; bottom: number }): void {
    this.spawnT -= dt;
    if (this.pickups.length < MAX_PICKUPS && this.spawnT <= 0) {
      this.pickups.push({ x: this.ctx.rng.range(a.left + 90, a.right - 90), y: this.ctx.rng.range(a.top + 90, a.bottom - 90), age: 0 });
      this.spawnT = 1.2;
    }
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i]!;
      if (!this.surging) p.age += dt;
      // closing walls push pickups inward so none end up out of reach
      p.x = Math.min(a.right - 40, Math.max(a.left + 40, p.x));
      p.y = Math.min(a.bottom - 40, Math.max(a.top + 40, p.y));
      if (Math.hypot(p.x - this.x, p.y - this.y) < BALL_R + PICKUP_R) {
        this.pickups.splice(i, 1);
        this.combo = this.comboT > 0 ? this.combo + 1 : 1;
        this.comboT = 3;
        this.score += this.surging ? 2 : 1;
        this.heat = Math.max(0, this.heat - this.bal('pickupRelief'));
        if (!this.surging && !this.ready) {
          this.meter = Math.min(1, this.meter + (0.045 + 0.006 * Math.min(this.combo, 8)) * this.bal('meterFill'));
          if (this.meter >= 1) {
            this.ready = true;
            this.beaconT = 0.4;
            this.emit({ type: 'surge-ready', magnitude: 1, x: this.x, y: this.y });
          }
        }
        this.emit({ type: 'pickup', magnitude: Math.min(1, 0.4 + this.combo * 0.15), x: p.x, y: p.y, data: { combo: this.combo, meter: Math.round(this.meter * 100) / 100 } });
      } else if (this.layer >= 3 && p.age > PICKUP_LIFE) {
        // layer 3: uncollected sparks fade, add heat, and break the combo
        this.pickups.splice(i, 1);
        this.heat += 8;
        this.combo = 0;
        this.comboT = 0;
        this.dent(0.25);
        this.emit({ type: 'expire', magnitude: 0.5, x: p.x, y: p.y });
      }
    }
    if (this.comboT > 0) {
      this.comboT -= dt;
      if (this.comboT <= 0) this.combo = 0;
    }
  }

  private updateHazards(dt: number, a: { left: number; top: number; right: number; bottom: number }): void {
    if ((this.layer >= 2 || this.surging) && this.invuln === 0) {
      this.hazardT -= dt;
      if (this.hazards.length < this.hazardCap && this.hazardT <= 0) {
        const rng = this.ctx.rng;
        let hx = 0;
        let hy = 0;
        for (let tries = 0; tries < 12; tries++) {
          hx = rng.range(a.left + 60, a.right - 60);
          hy = rng.range(a.top + 60, a.bottom - 60);
          if (Math.hypot(hx - this.x, hy - this.y) > 260) break;
        }
        const ang = rng.range(0, Math.PI * 2);
        const sp = rng.range(150, 230) * this.bal('drifterSpeed');
        this.hazards.push({ x: hx, y: hy, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, warn: this.surging ? 0.35 : 1, age: 0 });
        this.hazardT = this.surging ? 0.9 : 4;
        this.emit({ type: 'hazard-warn', magnitude: 0.4, x: hx, y: hy });
      }
    }
    for (let i = this.hazards.length - 1; i >= 0; i--) {
      const h = this.hazards[i]!;
      h.age += dt;
      if (h.warn > 0) {
        h.warn -= dt;
        continue;
      }
      h.x += h.vx * dt;
      h.y += h.vy * dt;
      if (h.x - HAZARD_R < a.left) { h.x = a.left + HAZARD_R; h.vx = Math.abs(h.vx); }
      if (h.x + HAZARD_R > a.right) { h.x = a.right - HAZARD_R; h.vx = -Math.abs(h.vx); }
      if (h.y - HAZARD_R < a.top) { h.y = a.top + HAZARD_R; h.vy = Math.abs(h.vy); }
      if (h.y + HAZARD_R > a.bottom) { h.y = a.bottom - HAZARD_R; h.vy = -Math.abs(h.vy); }
      if (this.surging && Math.hypot(h.x - this.x, h.y - this.y) < BALL_R + HAZARD_R + 12) {
        // surge: whatever you touch dies, adds score, and extends the surge
        this.hazards.splice(i, 1);
        this.streak++;
        this.surgeKills++;
        this.score += 3;
        this.surge = Math.min(this.surgeSecs + 2, this.surge + 0.25);
        this.emit({ type: 'surge-kill', magnitude: 1, x: h.x, y: h.y, data: { streak: this.streak, angle: Math.atan2(h.vy, h.vx) } });
        continue;
      }
      if (this.invuln === 0 && !this.surging && Math.hypot(h.x - this.x, h.y - this.y) < BALL_R + HAZARD_R) {
        const d = Math.hypot(this.x - h.x, this.y - h.y) || 1;
        this.vx += ((this.x - h.x) / d) * 520;
        this.vy += ((this.y - h.y) / d) * 520;
        this.hazards.splice(i, 1);
        this.heat += this.bal('hazardHeat');
        this.combo = 0;
        this.comboT = 0;
        this.dent(0.25);
        this.emit({ type: 'hazard-hit', magnitude: 0.8, x: h.x, y: h.y });
      }
    }
  }

  /** A setback dents the meter (unless it is already full: a full meter is kept until spent). */
  private dent(amount: number): void {
    if (!this.ready) this.meter = Math.max(0, this.meter - amount);
  }

  private updateMeter(dt: number): void {
    if (this.ready) {
      this.beaconT -= dt;
      if (this.beaconT <= 0) {
        this.beaconT = 1.4;
        this.emit({ type: 'surge-beacon', magnitude: 0.6, x: this.x, y: this.y });
      }
    } else if (!this.surging && this.combo === 0) {
      this.meter = Math.max(0, this.meter - 0.05 * dt);
    }
  }

  private startSurge(stick: { x: number; y: number }): void {
    this.ready = false;
    this.active = true;
    this.surge = this.surgeSecs;
    this.streak = 0;
    this.surges++;
    this.hazardT = 0.2;
    const sp = Math.hypot(this.vx, this.vy);
    if (Math.hypot(stick.x, stick.y) > 0.25) this.heading = Math.atan2(stick.y, stick.x);
    else if (sp > 50) this.heading = Math.atan2(this.vy, this.vx);
    this.emit({ type: 'surge-start', magnitude: 1, x: this.x, y: this.y, data: { seconds: this.surgeSecs } });
  }

  private endSurge(): void {
    this.active = false;
    this.surge = 0;
    this.meter = 0;
    this.heat = Math.max(0, this.heat - 30);
    this.invuln = 30;
    this.vx *= 0.3;
    this.vy *= 0.3;
    this.emit({ type: 'surge-end', magnitude: 0.6, x: this.x, y: this.y, data: { kills: this.streak } });
  }

  private wall(hit: boolean, axis: 'x' | 'y', pos: number, sign: -1 | 1): void {
    if (!hit) return;
    const v = axis === 'x' ? this.vx : this.vy;
    if (axis === 'x') this.x = pos; else this.y = pos;
    if (v * sign <= 0) return;
    const bounced = -v * RESTITUTION;
    if (axis === 'x') this.vx = bounced; else this.vy = bounced;
    if (Math.abs(v) > 120) {
      this.emit({
        type: 'hit',
        magnitude: Math.min(1, Math.abs(v) / 800),
        x: axis === 'x' ? pos + sign * BALL_R : this.x,
        y: axis === 'y' ? pos + sign * BALL_R : this.y,
        data: { axis: axis === 'x' ? 0 : 1 },
      });
    }
  }

  private fail(): void {
    this.deaths++;
    this.lives--;
    if (this.firstFail === 0) this.firstFail = this.time;
    this.emit({ type: 'fail', magnitude: 1, x: this.x, y: this.y, data: { lives: this.lives } });
    this.x = this.px = 640;
    this.y = this.py = 400;
    this.vx = this.vy = 0;
    this.heat = 20;
    this.rampStart = this.runTime;
    this.meter = 0;
    this.ready = false;
    this.pickups.length = 0;
    this.hazards.length = 0;
    this.hazardT = 3;
    this.combo = 0;
    this.invuln = 90;
    this.level = 0;
    this.recoverIn = 45;
    this.spawnT = 0.6;
    if (this.lives <= 0) {
      // hard failure: the run ends. A result screen waits for the player; pressing the dash button starts over.
      this.over = true;
      this.overT = 0;
      this.bestSurvival = Math.max(this.bestSurvival, this.runTime);
      this.emit({ type: 'gameover', magnitude: 1, x: this.x, y: this.y, data: { score: this.score, seconds: Math.round(this.runTime) } });
    }
  }

  private restart(): void {
    this.runs++;
    this.x = this.px = 640;
    this.y = this.py = 400;
    this.vx = this.vy = 0;
    this.heat = 20;
    this.score = 0;
    this.meter = 0;
    this.ready = false;
    this.active = false;
    this.surge = 0;
    this.combo = 0;
    this.comboT = 0;
    this.maxLives = Math.round(this.bal('lives'));
    this.lives = this.maxLives;
    this.pickups.length = 0;
    this.hazards.length = 0;
    this.runTime = 0;
    this.rampStart = 0;
    this.layer = 1;
    this.level = 0;
    this.invuln = 60;
    this.over = false;
    this.overT = 0;
    this.spawnT = 0.5;
    this.hazardT = 0;
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
      mainVerbCount: this.dashes,
      scoreOrProgress: this.score,
      heat: Math.round(this.heat * 10) / 10,
      heatRate: Math.round(this.heatRate * 10) / 10,
      lives: this.lives,
      maxLives: this.maxLives,
      layer: this.layer,
      runs: this.runs,
      meter: Math.round(this.meter * 100) / 100,
      surges: this.surges,
      surgeKills: this.surgeKills,
      survivalSec: Math.round(Math.max(this.bestSurvival, this.runTime) * 100) / 100,
    };
  }
}
