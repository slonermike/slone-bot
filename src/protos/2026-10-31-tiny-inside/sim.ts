// Pure sim: a sea of round worlds with real n-body gravity. Reach the home world. World types react to you differently.
import { Rng } from '../../core/index.ts';
import type { BalanceSpec, Ctx, InputState, SimEvent } from '../../core/types.ts';

export const PR = 12; // player radius
export type WType = 'rock' | 'sun' | 'crumble' | 'fade' | 'blink' | 'gum' | 'repel' | 'home';

export const BALANCE: BalanceSpec[] = [
  { id: 'gravity', label: 'Gravity', min: 0.6, max: 1.6, step: 0.05, default: 1 },
  { id: 'jumpPower', label: 'Hop power', min: 0.7, max: 1.4, step: 0.05, default: 1 },
  { id: 'runSpeed', label: 'Run speed', min: 0.6, max: 1.6, step: 0.05, default: 1 },
  { id: 'airSteer', label: 'Air steering (a nudge)', min: 0, max: 1.5, step: 0.05, default: 0.2 },
  { id: 'stayTime', label: 'Seconds you can stand on crumbling and fading worlds', min: 1, max: 6, step: 0.5, default: 2.5 },
  { id: 'sunPull', label: 'Sun pull', min: 0.5, max: 2, step: 0.1, default: 1 },
];

export interface World {
  type: WType; r: number; x: number; y: number; vx: number; vy: number;
  ox: number; oy: number; orbit: { rad: number; w: number; ph: number } | null;
  g: number; on: boolean; stay: number; off: number; period: number; onFor: number; phase: number;
}

export interface LevelSpec {
  name: string; seed: number; w: number; h: number; count: number; sep: number; reach: number;
  suns: number; gums: number; repels: number; fades: number; blinks: number; crumbles: number; moving: number; boss: boolean; faceNext: boolean;
}
const L = (o: Partial<LevelSpec> & { name: string; seed: number; w: number; h: number; count: number }): LevelSpec =>
  ({ sep: 190, reach: 1, suns: 0, gums: 0, repels: 0, fades: 0, blinks: 0, crumbles: 0, moving: 0, boss: false, faceNext: false, ...o });

// A sea: worlds scattered through a field, start at the left edge, home at the right. Each level adds one idea.
export const LEVELS: LevelSpec[] = [
  L({ name: 'First Hop', seed: 1, w: 1000, h: 300, count: 3, sep: 200, faceNext: true }),
  L({ name: 'Something Hot', seed: 2, w: 1000, h: 560, count: 6, suns: 1 }),
  L({ name: 'Do Not Linger', seed: 3, w: 1250, h: 640, count: 9, crumbles: 4 }),
  L({ name: 'Fall Toward It', seed: 4, w: 1500, h: 760, count: 10, sep: 230, reach: 1.1, suns: 3 }),
  L({ name: 'Gone Again', seed: 5, w: 1800, h: 860, count: 13, fades: 4, suns: 1 }),
  L({ name: 'Blink', seed: 6, w: 2000, h: 960, count: 15, blinks: 4, suns: 1 }),
  L({ name: 'Springs', seed: 7, w: 2200, h: 1040, count: 17, gums: 4, suns: 1 }),
  L({ name: 'Moons', seed: 8, w: 2400, h: 1140, count: 19, moving: 6, fades: 2, suns: 3 }),
  L({ name: 'The Hunter', seed: 9, w: 2400, h: 1200, count: 19, fades: 3, suns: 3, boss: true }),
  L({ name: 'Push and Pull', seed: 10, w: 2700, h: 1300, count: 22, repels: 5, suns: 2 }),
  L({ name: 'The Sea', seed: 11, w: 3100, h: 1500, count: 28, repels: 3, crumbles: 3, blinks: 3, fades: 3, gums: 3, suns: 5, moving: 5 }),
  L({ name: 'Home', seed: 12, w: 3500, h: 1700, count: 32, sep: 170, repels: 3, crumbles: 3, blinks: 3, fades: 3, gums: 3, suns: 6, moving: 6 }),
];
export const LEVEL_COUNT = LEVELS.length;

const SURFACE_G = 900;
const gOf = (t: WType) => (t === 'sun' ? SURFACE_G * 1.7 : t === 'repel' ? -SURFACE_G * 0.8 : SURFACE_G);
const mk = (type: WType, r: number, x: number, y: number): World => ({ type, r, x, y, vx: 0, vy: 0, ox: x, oy: y, orbit: null, g: gOf(type), on: true, stay: 0, off: 0, period: 0, onFor: 0, phase: 0 });
const isSafeType = (t: WType) => t !== 'sun' && t !== 'repel';

/** Can a hop from world a reach world b? A hop climbs about 2.4 world-radii; the target's own pull helps a little. */
export const canHop = (a: World, b: World, k: number) =>
  Math.hypot(b.ox - a.ox, b.oy - a.oy) - a.r - b.r <= k * (2.4 * (a.r + PR) + 0.3 * b.r) + (a.orbit ? 45 : 0) + (b.orbit ? 45 : 0);

function reachable(ws: World[], k: number): Set<number> {
  const seen = new Set<number>([0]); const q = [0];
  while (q.length) {
    const i = q.shift()!;
    ws.forEach((w, j) => { if (!seen.has(j) && isSafeType(w.type) && canHop(ws[i], w, k)) { seen.add(j); q.push(j); } });
  }
  return seen;
}
/** Safe worlds joined by hops a world can make: is home reachable from the start? */
export function connected(ws: World[], k: number): boolean {
  const seen = reachable(ws, k);
  return ws.some((w, j) => w.type === 'home' && seen.has(j));
}

export function generateLevel(spec: LevelSpec): World[] {
  for (let attempt = 0; attempt < 60; attempt++) {
    const ws = tryGenerate(spec, spec.seed * 7919 + attempt * 104729);
    if (connected(ws, spec.reach) || attempt === 59) return ws;
  }
  return tryGenerate(spec, spec.seed);
}

function tryGenerate(spec0: LevelSpec, seed: number): World[] {
  const rng = new Rng(seed);
  const k = spec0.seed === 1 ? 1 : 1.35; // the sea is wide: worlds are far apart, so each hop is a decision
  const spec = { ...spec0, w: spec0.w * k, h: spec0.h * k };
  const last = spec.seed === LEVELS[LEVELS.length - 1].seed;
  const ws: World[] = [mk('rock', 85, 0, spec.h / 2)];
  const home = mk('home', last ? 150 : 85, spec.w, spec.h / 2 + (spec.count > 2 ? rng.range(-spec.h * 0.25, spec.h * 0.25) : 0));
  ws.push(home);
  if (spec.faceNext) ws[1].y = 0;
  const free = (cx: number, cy: number, r: number, margin: number) => ws.every((w) => Math.hypot(w.x - cx, w.y - cy) - w.r - r > margin);
  const kinds: WType[] = [];
  for (let i = 0; i < spec.suns; i++) kinds.push('sun');
  for (let i = 0; i < spec.crumbles; i++) kinds.push('crumble');
  for (let i = 0; i < spec.fades; i++) kinds.push('fade');
  for (let i = 0; i < spec.blinks; i++) kinds.push('blink');
  for (let i = 0; i < spec.gums; i++) kinds.push('gum');
  for (let i = 0; i < spec.repels; i++) kinds.push('repel');
  while (kinds.length < spec.count - 2) kinds.push('rock');
  rng.shuffle(kinds);
  const radiusOf = (t: WType) => (t === 'sun' ? rng.range(60, 100) : t === 'gum' ? rng.range(40, 60) : t === 'repel' ? rng.range(45, 70) : t === 'rock' ? rng.range(55, 105) : rng.range(45, 75));
  for (const kind of kinds) {
    for (let tries = 0; tries < 200; tries++) {
      const r = radiusOf(kind);
      const x = rng.range(150, spec.w - 150), y = rng.range(-spec.h * 0.1, spec.h * 1.1);
      const nearStart = Math.hypot(x - ws[0].x, y - ws[0].y) - ws[0].r - r;
      if (kind === 'sun' && nearStart < 230) continue;
      if (free(x, y, r, spec.sep)) { ws.push(mk(kind, r, x, y)); break; }
    }
  }
  // bridge any gap the scatter left: drop a rock within hop reach of the nearest reachable world
  for (let k = 0; k < 80 && !connected(ws, spec.reach); k++) {
    const seen = reachable(ws, spec.reach);
    let best: { a: number; b: number; d: number } | null = null;
    ws.forEach((a, i) => { if (!seen.has(i)) return; ws.forEach((b, j) => { if (seen.has(j) || !isSafeType(b.type)) return; const d = Math.hypot(a.x - b.x, a.y - b.y) - a.r - b.r; if (!best || d < best.d) best = { a: i, b: j, d }; }); });
    if (!best) break;
    const A = ws[(best as { a: number }).a], B = ws[(best as { b: number }).b];
    const ang = Math.atan2(B.y - A.y, B.x - A.x), r = rng.range(60, 95);
    let placed = false;
    for (const mg of [0.6, 0.4, 0.25]) for (const f of [0.8, 0.65, 0.5, 0.35]) for (const off of [0, 70, -70, 140, -140, 210, -210]) { if (placed) break; const gap = f * spec.reach * (2.4 * (A.r + PR) + 0.3 * r), dd = A.r + gap + r, cx = A.x + Math.cos(ang) * dd - Math.sin(ang) * off, cy = A.y + Math.sin(ang) * dd + Math.cos(ang) * off; if (free(cx, cy, r, spec.sep * mg)) { ws.push(mk('rock', r, cx, cy)); placed = true; } }
    if (!placed) break;
  }
  const movers = ws.map((w, i) => ({ w, i })).filter(({ w, i }) => i > 1 && isSafeType(w.type));
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
    const s = w.g * (w.type === 'sun' ? sunK : 1) * k * Math.pow((w.r + PR) / dd, 3);
    ax += (dx / d) * s; ay += (dy / d) * s;
  }
  return { ax, ay };
}

export interface Boss { x: number; y: number; vx: number; vy: number; delay: number; fire: number; charge: number }
export interface Shot { x: number; y: number; vx: number; vy: number; life: number }

/** A hop is a fixed share of the world's escape speed: you never leave a world on one hop unless another world pulls you,
 *  and big worlds throw you farther than small ones. */
export const HOP_FRAC = 0.95;
/** Pull falls off as 1/d^3, so the escape speed is sqrt(g (r+PR)). */
export const escapeSpeed = (w: World) => Math.sqrt(Math.abs(w.g) * (w.r + PR));
export const hopSpeed = (w: World) => HOP_FRAC * escapeSpeed(w);

export class Sim {
  slung = false; slings = 0;
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
    const v0 = hopSpeed(w) * this.bal('jumpPower', 1);
    this.vx = w.vx + ux * v0 + tx * this.vt; this.vy = w.vy + uy * v0 + ty * this.vt;
    const cap = hopSpeed(w) * this.bal('jumpPower', 1), rel = Math.hypot(this.vx - w.vx, this.vy - w.vy);
    if (rel > cap) { this.vx = w.vx + (this.vx - w.vx) * (cap / rel); this.vy = w.vy + (this.vy - w.vy) * (cap / rel); }
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
      this.vx += g.ax * gm * dt + sx * 380 * this.bal('airSteer', 0.2) * dt;
      this.vy += g.ay * gm * dt + sy * 380 * this.bal('airSteer', 0.2) * dt;
      const sp = Math.hypot(this.vx, this.vy); if (sp > 900) { this.vx *= 900 / sp; this.vy *= 900 / sp; }
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
          const nv = Math.max(-vr * 0.95, 300);
          this.vx = w.vx + ux * nv + (-uy) * ((this.vx - w.vx) * -uy + (this.vy - w.vy) * ux);
          this.vy = w.vy + uy * nv + ux * ((this.vx - w.vx) * -uy + (this.vy - w.vy) * ux);
          this.out.push({ type: 'bounce', magnitude: 0.7, x: this.x, y: this.y });
          break;
        }
        this.gi = i; this.ang = Math.atan2(uy, ux);
        this.vt = (this.vx - w.vx) * -uy + (this.vy - w.vy) * ux;
        this.grounded = true; this.vx = w.vx; this.vy = w.vy;
        this.out.push({ type: 'land', magnitude: Math.min(1, -vr / 350), x: this.x, y: this.y });
        if (w.type === 'rock') { this.cp = i; this.cpAng = this.ang; }
        if (w.type === 'home') { this.cleared++; this.clearT = 1.8; this.out.push({ type: 'clear', magnitude: 0.6 + 0.4 * this.level / LEVEL_COUNT, x: w.x, y: w.y, data: { level: this.level } }); }
        break;
      }
    }
    if (this.boss && this.deadT <= 0) this.stepBoss(dt, gk);
    // danger (near a sun) and lost
    let dmin = 1e9;
    for (const w of this.ws) if (w.type === 'sun') dmin = Math.min(dmin, Math.hypot(this.x - w.x, this.y - w.y) - w.r);
    const spd = Math.hypot(this.vx, this.vy);
    if (!this.grounded && !this.slung && dmin < 90 && spd > 330) { this.slung = true; this.slings++; this.out.push({ type: 'sling', magnitude: Math.min(1, spd / 900), x: this.x, y: this.y }); }
    if (dmin > 220) this.slung = false;
    const dg = dmin < 150 || (!!this.boss && this.boss.delay <= 0 && Math.hypot(this.x - this.boss.x, this.y - this.boss.y) < 320);
    if (dg !== this.danger) { this.danger = dg; this.out.push({ type: dg ? 'danger' : 'safe', magnitude: 0.4, x: this.x, y: this.y }); }
    const b = this.bounds;
    const lm = this.level < 4 ? 260 : 450;
    if (this.x < b.x0 - lm || this.x > b.x1 + lm || this.y < b.y0 - lm || this.y > b.y1 + lm) this.die('lost');
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
    const w = s.ws[s.gi], v0 = hopSpeed(w) * (s.ctx.balance.jumpPower ?? 1);
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

/** Graph distance from every world to home over safe worlds (centre to centre, hops of up to 420 surface gap). A compass for bots and audits. */
export function graphDistToHome(ws: World[]): number[] {
  const n = ws.length, d = new Array(n).fill(1e9), done = new Array(n).fill(false);
  const hi = ws.findIndex((w) => w.type === 'home'); d[hi] = 0;
  for (let it = 0; it < n; it++) {
    let u = -1; for (let i = 0; i < n; i++) if (!done[i] && (u < 0 || d[i] < d[u])) u = i;
    if (u < 0 || d[u] >= 1e9) break; done[u] = true;
    for (let v = 0; v < n; v++) { const w = ws[v]; if (done[v] || !isSafeType(w.type)) continue; const e = Math.hypot(w.ox - ws[u].ox, w.oy - ws[u].oy); if (e - w.r - ws[u].r < 420 && d[u] + e < d[v]) d[v] = d[u] + e; }
  }
  return d;
}
