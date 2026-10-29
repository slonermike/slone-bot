import type { Ctx, InputState, PrototypeMeta, SimEvent } from '../../core/types.ts';

/** Pure sim for the demo: no Pixi, no DOM, no audio, no Math.random. Bots and unit tests import this directly. */
export const ARENA = { left: 40, top: 40, right: 1240, bottom: 760 };
export const BALL_R = 28;
const ACCEL = 2600;
const MAX_SPEED = 900;
const DRAG = 1.8;
const RESTITUTION = 0.75;
const DASH_IMPULSE = 650;
const DASH_COOLDOWN = 30;
const PICKUP_R = 18;
const MAX_PICKUPS = 3;

export interface Pickup {
  x: number;
  y: number;
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
  deaths = 0;
  dashes = 0;
  pickups: Pickup[] = [];
  time = 0;
  firstPressure = 0;
  firstFail = 0;
  dashCd = 0;
  invuln = 0;
  private spawnT = 0;
  private comboT = 0;
  private level = 0;
  private beatT = 0;
  private recoverIn = 0;
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
  }

  get heatRate(): number {
    return Math.min(30, 5 + 0.2 * this.time);
  }

  step(dt: number, input: InputState): void {
    this.time += dt;
    this.px = this.x;
    this.py = this.y;
    const { left, buttons } = input;

    // movement
    this.vx += left.x * ACCEL * dt;
    this.vy += left.y * ACCEL * dt;
    const damp = Math.exp(-DRAG * dt);
    this.vx *= damp;
    this.vy *= damp;

    if (this.dashCd > 0) this.dashCd--;
    if (buttons.a.pressed && this.dashCd === 0) {
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
    if (speed > MAX_SPEED) {
      this.vx *= MAX_SPEED / speed;
      this.vy *= MAX_SPEED / speed;
    }
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // walls
    this.wall(this.x - BALL_R < ARENA.left, 'x', ARENA.left + BALL_R, -1);
    this.wall(this.x + BALL_R > ARENA.right, 'x', ARENA.right - BALL_R, 1);
    this.wall(this.y - BALL_R < ARENA.top, 'y', ARENA.top + BALL_R, -1);
    this.wall(this.y + BALL_R > ARENA.bottom, 'y', ARENA.bottom - BALL_R, 1);

    // pickups
    this.spawnT -= dt;
    if (this.pickups.length < MAX_PICKUPS && this.spawnT <= 0) {
      this.pickups.push({
        x: this.ctx.rng.range(ARENA.left + 90, ARENA.right - 90),
        y: this.ctx.rng.range(ARENA.top + 90, ARENA.bottom - 90),
        age: 0,
      });
      this.spawnT = 1.2;
    }
    for (const p of this.pickups) p.age += dt;
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i]!;
      if (Math.hypot(p.x - this.x, p.y - this.y) < BALL_R + PICKUP_R) {
        this.pickups.splice(i, 1);
        this.combo = this.comboT > 0 ? this.combo + 1 : 1;
        this.comboT = 3;
        this.score += 1;
        this.heat = Math.max(0, this.heat - 22);
        this.emit({ type: 'pickup', magnitude: Math.min(1, 0.4 + this.combo * 0.15), x: p.x, y: p.y, data: { combo: this.combo } });
      }
    }
    if (this.comboT > 0) {
      this.comboT -= dt;
      if (this.comboT <= 0) this.combo = 0;
    }

    // pressure
    if (this.invuln > 0) this.invuln--;
    else this.heat += this.heatRate * dt;
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
    if (this.heat >= 100 && this.invuln === 0) this.fail();
    if (this.recoverIn > 0 && --this.recoverIn === 0) this.emit({ type: 'recover', magnitude: 0.6, x: this.x, y: this.y });
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
    if (this.firstFail === 0) this.firstFail = this.time;
    this.emit({ type: 'fail', magnitude: 1, x: this.x, y: this.y });
    this.x = this.px = 640;
    this.y = this.py = 400;
    this.vx = this.vy = 0;
    this.heat = 35;
    this.pickups.length = 0;
    this.combo = 0;
    this.invuln = 60;
    this.level = 0;
    this.recoverIn = 45;
    this.spawnT = 0.6;
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
    };
  }
}
