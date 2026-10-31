// Pure sim: a sea of round worlds with real n-body gravity. Reach the home world. World types react to you differently.
import { Rng } from '../../core/index.ts';
import type { BalanceSpec, Ctx, InputState, SimEvent } from '../../core/types.ts';

export const PR = 12; // player radius
export type WType = 'rock' | 'sun' | 'crumble' | 'fade' | 'blink' | 'gum' | 'repel' | 'home';

export const BALANCE: BalanceSpec[] = [
  { id: 'gravity', label: 'Gravity', min: 0.6, max: 1.6, step: 0.05, default: 1 },
  { id: 'jumpPower', label: 'Hop power', min: 0.7, max: 1.4, step: 0.05, default: 1 },
  { id: 'runSpeed', label: 'Run speed', min: 0.6, max: 1.6, step: 0.05, default: 1 },
  { id: 'airSteer', label: 'Air steering', min: 0, max: 2, step: 0.1, default: 1 },
  { id: 'stayTime', label: 'Seconds you can stand on crumbling and fading worlds', min: 1, max: 6, step: 0.5, default: 2.5 },
  { id: 'sunPull', label: 'Sun pull', min: 0.5, max: 2, step: 0.1, default: 1 },
];

export interface World {
  type: WType; r: number; x: number; y: number; vx: number; vy: number;
  ox: number; oy: number; orbit: { rad: number; w: number; ph: number } | null;
  g: number; on: boolean; stay: number; off: number; period: number; onFor: number; phase: number;
}

export interface LevelSpec {
  name: string; seed: number; chain: number; gap: [number, number]; chainTypes: WType[];
  suns: number; gums: number; repels: number; moving: number; blinks: number; fades: number; bend: number; faceNext: boolean; boss: boolean;
}
const L = (o: Partial<LevelSpec> & { name: string; seed: number; chain: number; gap: [number, number] }): LevelSpec =>
  ({ chainTypes: [], suns: 0, gums: 0, repels: 0, moving: 0, blinks: 0, fades: 0, bend: 0.5, faceNext: false, boss: false, ...o });

export const LEVELS: LevelSpec[] = [
  L({ name: 'First Hop', seed: 1, chain: 2, gap: [190, 210], faceNext: true, bend: 0 }),
  L({ name: 'Something Hot', seed: 2, chain: 3, gap: [150, 190], suns: 1, faceNext: true }),
  L({ name: 'Do Not Linger', seed: 3, chain: 4, gap: [150, 200], chainTypes: ['crumble'], bend: 0.3 }),
  L({ name: 'Fall Toward It', seed: 4, chain: 3, gap: [250, 290], suns: 2, bend: 0.3 }),
  L({ name: 'Gone Again', seed: 5, chain: 4, gap: [150, 200], chainTypes: ['fade', 'rock'], suns: 1 }),
  L({ name: 'Blink', seed: 6, chain: 4, gap: [150, 200], chainTypes: ['blink', 'rock'], suns: 1 }),
  L({ name: 'Springs', seed: 7, chain: 4, gap: [160, 220], chainTypes: ['gum', 'rock'], suns: 1, bend: 0.6 }),
  L({ name: 'Moons', seed: 8, chain: 5, gap: [150, 200], chainTypes: ['rock', 'fade'], moving: 2, suns: 1 }),
  L({ name: 'The Hunter', seed: 12, chain: 5, gap: [150, 210], chainTypes: ['rock', 'fade', 'rock'], suns: 1, boss: true, bend: 0.4 }),
  L({ name: 'Push and Pull', seed: 9, chain: 5, gap: [160, 220], chainTypes: ['rock', 'crumble', 'blink'], repels: 2, suns: 2, moving: 1 }),
  L({ name: 'The Sea', seed: 10, chain: 6, gap: [170, 240], chainTypes: ['crumble', 'gum', 'fade', 'blink', 'rock'], suns: 4, gums: 1, repels: 1, moving: 2, blinks: 1, fades: 1 }),
  L({ name: 'Home', seed: 11, chain: 7, gap: [180, 250], chainTypes: ['blink', 'gum', 'rock', 'crumble', 'fade'], suns: 4, gums: 2, repels: 2, moving: 3, blinks: 1, fades: 1 }),
];
export const LEVEL_COUNT = LEVELS.length;

const SURFACE_G = 900;
const GAPK = 1.0;
const gOf = (t: WType) => (t === 'sun' ? SURFACE_G * 1.7 : t === 'repel' ? -SURFACE_G * 0.8 : SURFACE_G);
const mk = (type: WType, r: number, x: number, y: number): World => ({ type, r, x, y, vx: 0, vy: 0, ox: x, oy: y, orbit: null, g: gOf(type), on: true, stay: 0, off: 0, period: 0, onFor: 0, phase: 0 });

export function generateLevel(spec: LevelSpec): World[] {
  const rng = new Rng(spec.seed * 7919);
  const ws: World[] = [];
  let x = 0, y = 0, dir = 0;
  for (let i = 0; i < spec.chain; i++) {
    const last = i === spec.chain - 1;
    const type: WType = i === 0 ? 'rock' : last ? 'home' : spec.chainTypes.length ? spec.chainTypes[(i - 1) % spec.chainTypes.length] : 'rock';
    const r = last ? (spec.seed === LEVELS[LEVELS.length - 1].seed ? 150 : 85) : i === 0 ? 85 : rng.range(60, 100);
    if (i > 0) {
      const p = ws[i - 1];
      dir += rng.range(-spec.bend, spec.bend);
      dir = Math.max(-1.1, Math.min(1.1, dir));
      const d = p.r + rng.range(spec.gap[0], spec.gap[1]) * GAPK + r;
      x = p.x + Math.cos(dir) * d; y = p.y + Math.sin(dir) * d;
    }
    ws.push(mk(type, r, x, y));
  }
  const free = (cx: number, cy: number, r: number, margin: number) => ws.every((w) => Math.hypot(w.x - cx, w.y - cy) - w.r - r > margin);
  const place = (type: WType, rlo: number, rhi: number) => {
    for (let tries = 0; tries < 80; tries++) {
      const k = rng.int(0, spec.chain - 2);
      const a = ws[k], b = ws[k + 1];
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      const ang = Math.atan2(b.y - a.y, b.x - a.x) + (rng.chance(0.5) ? 1 : -1) * Math.PI / 2;
      const r = rng.range(rlo, rhi), off = r + rng.range(110, 190);
      const cx = mx + Math.cos(ang) * off, cy = my + Math.sin(ang) * off;
      if (free(cx, cy, r, 70)) { ws.push(mk(type, r, cx, cy)); return; }
    }
  };
  for (let i = 0; i < spec.suns; i++) place('sun', 60, 100);
  for (let i = 0; i < spec.gums; i++) place('gum', 40, 60);
  for (let i = 0; i < spec.repels; i++) place('repel', 45, 70);
  for (let i = 0; i < spec.blinks; i++) place('blink', 45, 65);
  for (let i = 0; i < spec.fades; i++) place('fade', 45, 65);
  // timers and motion
  const movers = ws.map((w, i) => ({ w, i })).filter(({ w, i }) => i > 0 && w.type !== 'home' && w.type !== 'sun');
  for (let i = 0; i < spec.moving && movers.length; i++) {
    const m = movers.splice(rng.int(0, movers.length - 1), 1)[0].w;
    m.orbit = { rad: 45, w: (rng.chance(0.5) ? 1 : -1) * rng.range(0.4, 0.7), ph: rng.range(0, 6.28) };
  }
  for (const w of ws) if (w.type === 'blink') { w.period = 5; w.onFor = 3; w.phase = rng.range(0, 5); }
  return ws;
}

export function levelBounds(ws: World[]) {
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const w of ws) { const m = w.r * (w.type === 'home' ? 1.9 : 1) + 60; x0 = Math.min(x0, w.ox - m); x1 = Math.max(x1, w.ox + m); y0 = Math.min(y0, w.oy - m); y1 = Math.max(y1, w.oy + m); }
  return { x0, x1, y0, y1 };
}

export function setWorldTime(w: World, t: number, stayLimit = 2.5) {
  if (w.orbit) {
    const a = w.orbit.w * t + w.orbit.ph;
    w.x = w.ox + Math.cos(a) * w.orbit.rad; w.y = w.oy + Math.sin(a) * w.orbit.rad;
    w.vx = -Math.sin(a) * w.orbit.rad * w.orbit.w; w.vy = Math.cos(a) * w.orbit.rad * w.orbit.w;
  }
  if (w.type === 'blink') w.on = (t + w.phase) % w.period < w.onFor;
  void stayLimit;
}

export function gravityAt(ws: World[], x: number, y: number, k: number, sunK: number) {
  let ax = 0, ay = 0;
  for (const w of ws) {
    if (!w.on) continue;
    const dx = w.x - x, dy = w.y - y, d = Math.hypot(dx, dy) || 1;
    const dd = Math.max(d, w.r + PR);
    const s = w.g * (w.type === 'sun' ? sunK : 1) * k * Math.pow((w.r + PR) / dd, 2);
    ax += (dx / d) * s; ay += (dy / d) * s;
  }
  return { ax, ay };
}

export interface Boss { x: number; y: number; vx: number; vy: number; delay: number; fire: number; charge: number }
export interface Shot { x: number; y: number; vx: number; vy: number; life: number }

export class Sim {
  boss: Boss | null = null; shots: Shot[] = [];
  level = 0; ws: World[] = []; bounds = { x0: 0, x1: 0, y0: 0, y1: 0 };
  x = 0; y = 0; px = 0; py = 0; vx = 0; vy = 0;
  grounded = true; gi = 0; ang = 0; vt = 0;
  cp = 0; cpAng = 0; // checkpoint world and angle
  time = 0; levelTime = 0; buf = 0; coyote = 0; jumpHeld = false;
  deadT = 0; clearT = 0; done = false; deaths = 0; levelDeaths = 0; cleared = 0; danger = false; ticking = false;
  out: SimEvent[] = [];
  ctx!: Ctx;

  init(ctx: Ctx) {
    this.ctx = ctx;
    const start = Number(ctx.params.level ?? 0);
    this.loadLevel(Math.max(0, Math.min(LEVEL_COUNT - 1, start | 0)));
  }
  bal(k: string, d: number) { return this.ctx.balance[k] ?? d; }
  loadLevel(n: number) {
    this.level = n; this.ws = generateLevel(LEVELS[n]); this.bounds = levelBounds(this.ws);
    this.levelTime = 0; this.clearT = 0; this.levelDeaths = 0; this.danger = false; this.cp = 0;
    const s = this.ws[0], nx = this.ws[1];
    this.cpAng = LEVELS[n].faceNext ? Math.atan2(nx.y - s.y, nx.x - s.x) : -Math.PI / 2;
    for (const w of this.ws) setWorldTime(w, 0);
    this.place(0, this.cpAng);
    this.shots = []; this.boss = LEVELS[n].boss ? { x: s.x - 650, y: s.y, vx: 0, vy: 0, delay: 3.5, fire: 2.4, charge: 0 } : null;
    this.out.push({ type: 'level', magnitude: 0.5, x: this.x, y: this.y, data: { level: n } });
  }
  place(gi: number, ang: number) {
    const w = this.ws[gi];
    this.gi = gi; this.ang = ang; this.vt = 0; this.vx = w.vx; this.vy = w.vy; this.grounded = true;
    this.x = w.x + Math.cos(ang) * (w.r + PR); this.y = w.y + Math.sin(ang) * (w.r + PR);
    this.px = this.x; this.py = this.y;
    for (const q of this.ws) { q.stay = 0; if (q.type === 'fade') { q.on = true; q.off = 0; } }
  }
  die(cause: string) {
    if (this.deadT > 0) return;
    this.deadT = 0.4; this.deaths++; this.levelDeaths++;
    this.out.push({ type: 'die', magnitude: 0.8, x: this.x, y: this.y, data: { cause } });
  }
  jump(tx: number, ty: number) {
    const w = this.ws[this.gi];
    const ux = Math.cos(this.ang), uy = Math.sin(this.ang);
    const v0 = 640 * this.bal('jumpPower', 1);
    this.vx = w.vx + ux * v0 + tx * this.vt; this.vy = w.vy + uy * v0 + ty * this.vt;
    this.grounded = false; this.buf = 0; this.coyote = 0;
    this.out.push({ type: 'jump', magnitude: 0.5, x: this.x, y: this.y });
  }
  clone(): Sim { const c = new Sim(); Object.assign(c, this); c.ws = this.ws.map((w) => ({ ...w, orbit: w.orbit ? { ...w.orbit } : null })); c.out = []; c.boss = this.boss ? { ...this.boss } : null; c.shots = this.shots.map((q) => ({ ...q })); return c; }

  step(dt: number, input: InputState) {
    if (this.done) return;
    this.px = this.x; this.py = this.y;
    this.time += dt; this.levelTime += dt;
    const stayLimit = this.bal('stayTime', 2.5);
    for (const w of this.ws) {
      const was = w.on;
      setWorldTime(w, this.time);
      if (w.type === 'fade' && !w.on) { w.off -= dt; if (w.off <= 0) { w.on = true; w.stay = 0; this.out.push({ type: 'return', magnitude: 0.3, x: w.x, y: w.y }); } }
      if (was && !w.on && w.type === 'blink') this.out.push({ type: 'blinkoff', magnitude: 0.3, x: w.x, y: w.y });
      if (!was && w.on && w.type === 'blink') this.out.push({ type: 'return', magnitude: 0.3, x: w.x, y: w.y });
    }
    if (this.deadT > 0) { this.deadT -= dt; if (this.deadT <= 0) this.respawn(); return; }
    if (this.clearT > 0) { // standing on the goal: hold, then next level
      this.followGround(dt);
      this.clearT -= dt;
      if (this.clearT <= 0) { if (this.level + 1 >= LEVEL_COUNT) { this.done = true; this.out.push({ type: 'complete', magnitude: 1, x: this.x, y: this.y }); } else this.loadLevel(this.level + 1); }
      return;
    }
    if (input.buttons.a.pressed) this.buf = 0.12;
    this.buf = Math.max(0, this.buf - dt); this.coyote = Math.max(0, this.coyote - dt);
    const sx = input.left.x, sy = input.left.y;
    const gk = this.bal('gravity', 1), sunK = this.bal('sunPull', 1), rs = this.bal('runSpeed', 1);

    if (this.grounded) {
      const w = this.ws[this.gi];
      if (!w.on) { // the world went away under you
        this.grounded = false; this.vx = w.vx + -Math.sin(this.ang) * this.vt; this.vy = w.vy + Math.cos(this.ang) * this.vt;
        this.out.push({ type: 'dropped', magnitude: 0.6, x: this.x, y: this.y });
      } else {
        const tx = -Math.sin(this.ang), ty = Math.cos(this.ang);
        const want = (sx * tx + sy * ty) * 330 * rs;
        const acc = Math.abs(want) > Math.abs(this.vt) ? 2400 : 3200;
        this.vt += Math.max(-acc * dt, Math.min(acc * dt, want - this.vt));
        this.ang += (this.vt * dt) / (w.r + PR);
        this.x = w.x + Math.cos(this.ang) * (w.r + PR); this.y = w.y + Math.sin(this.ang) * (w.r + PR);
        if (this.buf > 0) this.jump(tx, ty);
        // timed worlds
        if (w.type === 'crumble' || w.type === 'fade') {
          const before = w.stay; w.stay += dt;
          if (Math.floor(before * 2) !== Math.floor(w.stay * 2) && stayLimit - w.stay < 1.2) this.out.push({ type: 'tick', magnitude: 0.4, x: this.x, y: this.y });
          if (w.stay >= stayLimit) {
            if (w.type === 'crumble') { this.out.push({ type: 'shatter', magnitude: 0.8, x: w.x, y: w.y }); this.die('crumble'); }
            else { w.on = false; w.off = 3.5; this.out.push({ type: 'vanish', magnitude: 0.7, x: w.x, y: w.y }); }
          }
        }
      }
    }
    if (!this.grounded) {
      const g = gravityAt(this.ws, this.x, this.y, gk, sunK);
      const rising = this.vx * g.ax + this.vy * g.ay < 0;
      const gm = rising && !input.buttons.a.down ? 2.2 : 1;
      this.vx += g.ax * gm * dt + sx * 380 * this.bal('airSteer', 1) * dt;
      this.vy += g.ay * gm * dt + sy * 380 * this.bal('airSteer', 1) * dt;
      const sp = Math.hypot(this.vx, this.vy); if (sp > 1300) { this.vx *= 1300 / sp; this.vy *= 1300 / sp; }
      this.x += this.vx * dt; this.y += this.vy * dt;
      for (let i = 0; i < this.ws.length; i++) {
        const w = this.ws[i];
        if (!w.on) continue;
        const dx = this.x - w.x, dy = this.y - w.y, d = Math.hypot(dx, dy);
        if (d > w.r + PR) continue;
        const ux = dx / d, uy = dy / d, vr = (this.vx - w.vx) * ux + (this.vy - w.vy) * uy;
        if (vr > 0 && w.type !== 'repel') continue;
        if (w.type === 'sun') { this.out.push({ type: 'burn', magnitude: 1, x: this.x, y: this.y }); this.die('sun'); break; }
        this.x = w.x + ux * (w.r + PR); this.y = w.y + uy * (w.r + PR);
        if (w.type === 'gum' || w.type === 'repel') {
          const nv = Math.max(-vr * 0.95, 560);
          this.vx = w.vx + ux * nv + (-uy) * ((this.vx - w.vx) * -uy + (this.vy - w.vy) * ux);
          this.vy = w.vy + uy * nv + ux * ((this.vx - w.vx) * -uy + (this.vy - w.vy) * ux);
          this.out.push({ type: 'bounce', magnitude: 0.7, x: this.x, y: this.y });
          break;
        }
        this.gi = i; this.ang = Math.atan2(uy, ux);
        this.vt = (this.vx - w.vx) * -uy + (this.vy - w.vy) * ux;
        this.grounded = true; this.vx = w.vx; this.vy = w.vy;
        this.out.push({ type: 'land', magnitude: Math.min(1, -vr / 700), x: this.x, y: this.y });
        if (w.type === 'rock') { this.cp = i; this.cpAng = this.ang; }
        if (w.type === 'home') { this.cleared++; this.clearT = 1.8; this.out.push({ type: 'clear', magnitude: 0.6 + 0.4 * this.level / LEVEL_COUNT, x: w.x, y: w.y, data: { level: this.level } }); }
        break;
      }
    }
    if (this.boss && this.deadT <= 0) this.stepBoss(dt, gk);
    // danger (near a sun) and lost
    let dmin = 1e9;
    for (const w of this.ws) if (w.type === 'sun') dmin = Math.min(dmin, Math.hypot(this.x - w.x, this.y - w.y) - w.r);
    const dg = dmin < 150 || (!!this.boss && this.boss.delay <= 0 && Math.hypot(this.x - this.boss.x, this.y - this.boss.y) < 320);
    if (dg !== this.danger) { this.danger = dg; this.out.push({ type: dg ? 'danger' : 'safe', magnitude: 0.4, x: this.x, y: this.y }); }
    const b = this.bounds;
    if (this.x < b.x0 - 500 || this.x > b.x1 + 500 || this.y < b.y0 - 500 || this.y > b.y1 + 500) this.die('lost');
  }
  stepBoss(dt: number, gk: number) {
    const B = this.boss!;
    if (B.delay > 0) { B.delay -= dt; return; }
    const dx = this.x - B.x, dy = this.y - B.y, d = Math.hypot(dx, dy) || 1;
    const sp = 125 + 5 * this.level;
    const g = gravityAt(this.ws, B.x, B.y, gk * 0.25, 1);
    B.vx += ((dx / d) * sp - B.vx) * 1.1 * dt + g.ax * dt; B.vy += ((dy / d) * sp - B.vy) * 1.1 * dt + g.ay * dt;
    B.x += B.vx * dt; B.y += B.vy * dt;
    if (d < 46 + PR) { this.out.push({ type: 'bossHit', magnitude: 1, x: this.x, y: this.y }); this.die('boss'); return; }
    B.fire -= dt;
    if (B.fire <= 0 && B.charge <= 0) { B.fire = 2.8; B.charge = 0.7; this.out.push({ type: 'charge', magnitude: 0.5, x: B.x, y: B.y }); }
    if (B.charge > 0) {
      B.charge -= dt;
      if (B.charge <= 0) { this.shots.push({ x: B.x, y: B.y, vx: (dx / d) * 300, vy: (dy / d) * 300, life: 7 }); this.out.push({ type: 'spit', magnitude: 0.5, x: B.x, y: B.y }); }
    }
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const q = this.shots[i];
      const gg = gravityAt(this.ws, q.x, q.y, gk, 1);
      q.vx += gg.ax * dt; q.vy += gg.ay * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.life -= dt;
      let gone = q.life <= 0;
      for (const w of this.ws) if (w.on && Math.hypot(q.x - w.x, q.y - w.y) < w.r + 6) { gone = true; this.out.push({ type: 'splat', magnitude: 0.4, x: q.x, y: q.y }); break; }
      if (!gone && Math.hypot(q.x - this.x, q.y - this.y) < 8 + PR) { this.out.push({ type: 'bossHit', magnitude: 0.8, x: this.x, y: this.y }); this.die('spit'); gone = true; }
      if (gone) this.shots.splice(i, 1);
    }
  }
  followGround(dt: number) {
    const w = this.ws[this.gi]; void dt;
    this.x = w.x + Math.cos(this.ang) * (w.r + PR); this.y = w.y + Math.sin(this.ang) * (w.r + PR);
  }
  respawn() {
    const cp = this.ws[this.cp].on ? this.cp : 0;
    this.place(cp, cp === this.cp ? this.cpAng : this.ang);
    this.danger = false; this.shots = [];
    if (this.boss) { const a = Math.atan2(this.y - this.ws[this.gi].y, this.x - this.ws[this.gi].x) + Math.PI; this.boss = { x: this.x + Math.cos(a) * 620, y: this.y + Math.sin(a) * 620, vx: 0, vy: 0, delay: 3, fire: 2.4, charge: 0 }; }
    this.out.push({ type: 'respawn', magnitude: 0.5, x: this.x, y: this.y });
  }
  events(): SimEvent[] { const e = this.out; this.out = []; return e; }
}

/** Predicted path (world positions held at their current place) for the hop-preview dots. */
export function predictPath(s: Sim, a: boolean, steps: number, every: number): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  let x = s.x, y = s.y, vx = s.vx, vy = s.vy;
  if (s.grounded) {
    const w = s.ws[s.gi], v0 = 640 * (s.ctx.balance.jumpPower ?? 1);
    vx = w.vx + Math.cos(s.ang) * v0 - Math.sin(s.ang) * s.vt; vy = w.vy + Math.sin(s.ang) * v0 + Math.cos(s.ang) * s.vt;
  }
  const dt = 1 / 60, gk = s.ctx.balance.gravity ?? 1, sunK = s.ctx.balance.sunPull ?? 1;
  for (let i = 0; i < steps; i++) {
    const g = gravityAt(s.ws, x, y, gk, sunK);
    const rising = vx * g.ax + vy * g.ay < 0;
    const gm = rising && !a ? 2.2 : 1;
    vx += g.ax * gm * dt; vy += g.ay * gm * dt; x += vx * dt; y += vy * dt;
    if (i % every === every - 1) pts.push([x, y]);
    let hit = false;
    for (const w of s.ws) if (w.on && Math.hypot(x - w.x, y - w.y) < w.r + PR) hit = true;
    if (hit) break;
  }
  return pts;
}

export function partsFor(level: number, danger: boolean, finale: boolean): string[] {
  const p = ['pad'];
  if (level >= 1) p.push('bass');
  if (level >= 3) p.push('arp');
  if (level >= 5 || finale) p.push('lead');
  if (level >= 7) p.push('harmony');
  if (danger) return p.filter((x) => x !== 'lead' && x !== 'harmony').concat(level >= 2 ? ['drums'] : []);
  return p;
}
