// Pure sim: round worlds that grow 1.45x per tier; a tiny player runs, hops and falls between them.
import type { BalanceSpec, Ctx, InputState, SimEvent } from '../../core/types.ts';

export const TIERS = 9;
export const PR = 14; // player radius, constant: the worlds grow, you do not
export const BALANCE: BalanceSpec[] = [
  { id: 'drain', label: 'Glow loss per second', min: 0, max: 0.12, step: 0.005, default: 0.035 },
  { id: 'drainRamp', label: 'Extra loss per tier', min: 0, max: 0.04, step: 0.002, default: 0.012 },
  { id: 'glintGain', label: 'Glow from a glint', min: 0.02, max: 0.3, step: 0.01, default: 0.12 },
  { id: 'jumpPower', label: 'Hop power', min: 0.7, max: 1.4, step: 0.05, default: 1 },
  { id: 'runSpeed', label: 'Run speed', min: 0.6, max: 1.6, step: 0.05, default: 1 },
  { id: 'blot', label: 'Ink chase speed (x your run)', min: 0, max: 1.2, step: 0.05, default: 0.5 },
  { id: 'wind', label: 'Gust strength (from tier 2)', min: 0, max: 2, step: 0.1, default: 1 },
  { id: 'gravity', label: 'Gravity', min: 0.6, max: 1.6, step: 0.05, default: 1 },
];

export interface Body { x: number; y: number; r: number; f: number; gap: number }
export interface Glint { x: number; y: number; on: boolean; body: number }

export const fOf = (r: number) => Math.pow(r / 100, 0.45);

export function makeWorld(rng: { range(a: number, b: number): number }): { bodies: Body[]; glints: Glint[] } {
  const bodies: Body[] = [];
  let x = 0, y = 0, dir = -Math.PI / 2 + 0.6;
  const dirs: number[] = [];
  for (let i = 0; i < TIERS; i++) {
    const r = 100 * Math.pow(1.45, i);
    const f = fOf(r);
    const gap = 200 * f;
    if (i > 0) {
      const p = bodies[i - 1];
      dir += rng.range(-1, 1) * 1.1;
      dirs.push(dir);
      const d = p.r + gap + r;
      x = p.x + Math.cos(dir) * d;
      y = p.y + Math.sin(dir) * d;
    }
    bodies.push({ x, y, r, f, gap });
  }
  const glints: Glint[] = [];
  for (let i = 0; i < TIERS; i++) {
    const b = bodies[i];
    // ring of glints floating just above the surface, plus an arc toward the next world
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2 + i;
      const h = b.r + 60 * b.f;
      glints.push({ x: b.x + Math.cos(a) * h, y: b.y + Math.sin(a) * h, on: true, body: i });
    }
    if (i < TIERS - 1) {
      const n = bodies[i + 1];
      const a = Math.atan2(n.y - b.y, n.x - b.x);
      const sx = b.x + Math.cos(a) * b.r, sy = b.y + Math.sin(a) * b.r;
      const ex = n.x - Math.cos(a) * n.r, ey = n.y - Math.sin(a) * n.r;
      for (let k = 1; k <= 3; k++) {
        const t = k / 4;
        const lift = Math.sin(t * Math.PI) * 40 * b.f;
        glints.push({ x: sx + (ex - sx) * t + Math.cos(a) * 0, y: sy + (ey - sy) * t - lift * 0, on: true, body: i });
      }
    }
  }
  return { bodies, glints };
}

export interface Mote { body: number; a: number; on: boolean }

export class Sim {
  bodies: Body[] = [];
  glints: Glint[] = [];
  motes: Mote[] = [];
  bloomed: boolean[] = [];
  blooms = 0;
  x = 0; y = 0; px = 0; py = 0; vx = 0; vy = 0;
  grounded = true;
  cur = 0; // body the player is nearest to
  best = 0;
  glow = 1; low = false;
  vt = 0; // tangential speed when grounded
  angle = -Math.PI / 2;
  blotBody = -1; blots: number[] = []; blotA = 0; blotOn = false; blotDelay = 0; blotHit = 0;
  windT = 6; windOn = 0; windA = 0;
  coyote = 0; buf = 0; combo = 0; comboT = 0;
  grace = 12; // seconds without drain at the start
  glints_got = 0; deaths = 0; time = 0; done = false;
  out: SimEvent[] = [];
  private ctx!: Ctx;

  init(ctx: Ctx) {
    this.ctx = ctx;
    const w = makeWorld(ctx.rng);
    this.bodies = w.bodies;
    this.glints = w.glints;
    this.bloomed = this.bodies.map(() => false);
    this.motes = [];
    this.bodies.forEach((_, i) => { const n = 3 + i; const o = this.ctx.rng.range(0, 6.28); for (let k = 0; k < n; k++) this.motes.push({ body: i, a: o + (k / n) * Math.PI * 2, on: true }); });
    this.spawn(0);
  }
  bal(k: string, d: number) { return this.ctx.balance[k] ?? d; }
  spawn(i: number) {
    const b = this.bodies[i];
    this.cur = i;
    const a = i === 0 ? -Math.PI / 2 : Math.atan2(this.bodies[i - 1].y - b.y, this.bodies[i - 1].x - b.x);
    this.angle = a;
    this.vt = 0; this.vx = this.vy = 0; this.grounded = true;
    this.x = b.x + Math.cos(a) * (b.r + PR); this.y = b.y + Math.sin(a) * (b.r + PR);
    this.px = this.x; this.py = this.y;
    this.startBlot();
  }
  startBlot() {
    this.blotBody = this.cur; this.blotDelay = 2.2;
    this.blotOn = !this.bloomed[this.cur] && this.cur >= 1; // tier 0 is a pure toy
    this.blots = [this.angle + Math.PI];
    if (this.cur >= 4) this.blots.push(this.angle + Math.PI * 0.5); // pincer: a second ink from the side
  }
  nearest(): number {
    let bi = 0, bd = Infinity;
    for (let i = 0; i < this.bodies.length; i++) {
      const b = this.bodies[i];
      const d = Math.hypot(this.x - b.x, this.y - b.y) - b.r;
      if (d < bd) { bd = d; bi = i; }
    }
    return bi;
  }
  up() { const b = this.bodies[this.cur]; const d = Math.hypot(this.x - b.x, this.y - b.y) || 1; return { x: (this.x - b.x) / d, y: (this.y - b.y) / d }; }

  step(dt: number, input: InputState) {
    if (this.done) return;
    this.px = this.x; this.py = this.y;
    this.time += dt;
    const g = this.bal('gravity', 1), js = this.bal('jumpPower', 1), rs = this.bal('runSpeed', 1);
    if (input.buttons.a.pressed) this.buf = 0.12;
    this.buf = Math.max(0, this.buf - dt);
    this.coyote = Math.max(0, this.coyote - dt);
    this.comboT = Math.max(0, this.comboT - dt); if (this.comboT === 0) this.combo = 0;
    const sx = input.left.x, sy = input.left.y;
    if (this.best >= 2) {
      if (this.windOn > 0) this.windOn -= dt;
      else { this.windT -= dt; if (this.windT <= 0) { this.windOn = 2.2; this.windA = this.ctx.rng.range(0, Math.PI * 2); this.windT = this.ctx.rng.range(7, 11) * Math.max(0.45, 1 - 0.07 * this.best); this.out.push({ type: 'gust', magnitude: 0.5, x: this.x, y: this.y, data: { a: this.windA } }); } }
    }

    if (this.grounded) {
      const b = this.bodies[this.cur];
      this.coyote = 0.1;
      // tangent direction (counterclockwise in screen space for +angle)
      const tx = -Math.sin(this.angle), ty = Math.cos(this.angle);
      const want = (sx * tx + sy * ty) * 420 * rs * b.f;
      const acc = (Math.abs(want) > Math.abs(this.vt) ? 2600 : 3400) * b.f;
      this.vt += Math.max(-acc * dt, Math.min(acc * dt, want - this.vt));
      this.angle += (this.vt * dt) / (b.r + PR);
      this.x = b.x + Math.cos(this.angle) * (b.r + PR);
      this.y = b.y + Math.sin(this.angle) * (b.r + PR);
      if (this.buf > 0) this.jump(tx, ty);
    } else {
      this.cur = this.nearest();
      const b = this.bodies[this.cur];
      const dx = b.x - this.x, dy = b.y - this.y, d = Math.hypot(dx, dy) || 1;
      const G = 1500 * b.f * g;
      const rising = this.vx * -dx / d + this.vy * -dy / d > 0;
      const gm = rising && !input.buttons.a.down ? 2.3 : 1;
      this.vx += (dx / d) * G * gm * dt; this.vy += (dy / d) * G * gm * dt;
      if (this.windOn > 0 && this.windOn < 1.4) { const w = (500 + 60 * this.best) * b.f * this.bal('wind', 1); this.vx += Math.cos(this.windA) * w * dt; this.vy += Math.sin(this.windA) * w * dt; }
      this.vx += sx * 900 * b.f * dt; this.vy += sy * 900 * b.f * dt;
      const sp = Math.hypot(this.vx, this.vy), cap = 1700 * b.f;
      if (sp > cap) { this.vx *= cap / sp; this.vy *= cap / sp; }
      this.x += this.vx * dt; this.y += this.vy * dt;
      const nd = Math.hypot(this.x - b.x, this.y - b.y);
      if (nd <= b.r + PR) {
        const ux = (this.x - b.x) / nd, uy = (this.y - b.y) / nd;
        const vr = this.vx * ux + this.vy * uy;
        if (vr <= 0) {
          this.angle = Math.atan2(uy, ux);
          this.vt = this.vx * -uy + this.vy * ux;
          this.grounded = true;
          if (this.cur !== this.blotBody) this.startBlot();
          this.x = b.x + ux * (b.r + PR); this.y = b.y + uy * (b.r + PR);
          this.out.push({ type: 'land', magnitude: Math.min(1, -vr / (900 * b.f)), x: this.x, y: this.y });
          if (this.cur > this.best) {
            this.best = this.cur;
            this.glow = this.bloomed[this.cur - 1] ? 1 : Math.min(1, this.glow + 0.35);
            const L = ({ 1: 'ink', 2: 'gusts', 4: 'pincer', 6: 'drifters' } as Record<number, string>)[this.cur];
            if (L) this.out.push({ type: 'layer', magnitude: 0.5, x: this.x, y: this.y, data: { name: L } });
            this.out.push({ type: this.cur === TIERS - 1 ? 'finale' : 'tier', magnitude: 0.4 + 0.6 * (this.cur / TIERS), x: this.x, y: this.y, data: { tier: this.cur } });
            if (this.cur === TIERS - 1) { this.done = true; this.out.push({ type: 'complete', magnitude: 1, x: this.x, y: this.y }); }
          }
          if (this.buf > 0) this.jump(-uy, ux);
        }
      }
    }
    if (this.blotOn && this.grounded && this.blotBody === this.cur) {
      const b = this.bodies[this.cur];
      if (this.blotDelay > 0) this.blotDelay -= dt;
      else {
        const sp = (this.bal('blot', 0.5) + 0.04 * this.best) * 420 * this.bal('runSpeed', 1) * b.f;
        const om = sp / (b.r + PR), hw = (70 * b.f) / (b.r + PR);
        let touching = false;
        for (let i = 0; i < this.blots.length; i++) {
          let d = this.angle - this.blots[i]; d = Math.atan2(Math.sin(d), Math.cos(d));
          this.blots[i] += Math.sign(d) * Math.min(Math.abs(d), om * dt * (i ? 0.8 : 1));
          if (Math.abs(d) < hw) touching = true;
        }
        this.blotA = this.blots[0];
        if (touching) {
          this.glow -= 0.4 * dt; this.blotHit -= dt;
          if (this.blotHit <= 0) { this.blotHit = 0.45; this.out.push({ type: 'ink', magnitude: 0.5, x: this.x, y: this.y }); }
        }
      }
    }
    // glints
    const pr = 46 * this.bodies[this.cur].f;
    for (const gl of this.glints) {
      if (!gl.on) continue;
      if (Math.hypot(gl.x - this.x, gl.y - this.y) < pr + PR) {
        gl.on = false; this.glints_got++;
        this.combo++; this.comboT = 1.6;
        this.glow = Math.min(1, this.glow + this.bal('glintGain', 0.12));
        this.out.push({ type: 'glint', magnitude: Math.min(1, 0.3 + this.combo * 0.1), x: gl.x, y: gl.y, data: { combo: this.combo } });
      }
    }
    for (const m of this.motes) if (m.on && m.body >= 6) m.a += (m.body % 2 ? 1 : -1) * 0.12 * (m.body - 5) * dt;
    if (this.grounded) {
      const b = this.bodies[this.cur];
      for (const m of this.motes) {
        if (!m.on || m.body !== this.cur) continue;
        const mx = b.x + Math.cos(m.a) * (b.r + PR), my = b.y + Math.sin(m.a) * (b.r + PR);
        if (Math.hypot(mx - this.x, my - this.y) < 36 * b.f + PR) {
          m.on = false; this.glow = Math.min(1, this.glow + 0.06);
          const left = this.motes.filter((q) => q.body === this.cur && q.on).length;
          this.out.push({ type: 'mote', magnitude: 0.5, x: mx, y: my, data: { left } });
          if (left === 0) { this.bloomed[this.cur] = true; this.blotOn = false; this.blooms++; this.glow = Math.min(1, this.glow + 0.3); this.out.push({ type: 'bloom', magnitude: 0.6 + 0.4 * this.cur / TIERS, x: b.x, y: b.y, data: { body: this.cur } }); }
        }
      }
    }
    // glow drain
    if (this.grace > 0) this.grace -= dt;
    else {
      const r = this.bal('drain', 0.035) + this.bal('drainRamp', 0.012) * this.best;
      this.glow -= r * dt;
    }
    const low = this.glow < 0.3;
    if (low !== this.low) { this.low = low; this.out.push({ type: low ? 'low' : 'recover', magnitude: 0.5, x: this.x, y: this.y }); }
    if (this.glow <= 0) {
      this.deaths++;
      this.out.push({ type: 'faded', magnitude: 0.8, x: this.x, y: this.y });
      this.spawn(Math.max(0, this.best - 1)); this.cur = Math.max(0, this.best - 1);
      this.glow = 0.7; this.low = false;
      for (const gl of this.glints) gl.on = true;
    }
  }
  jump(tx: number, ty: number) {
    const b = this.bodies[this.cur];
    const u = this.up();
    const v0 = 780 * Math.pow(b.f, 1.0) * this.bal('jumpPower', 1);
    this.vx = u.x * v0 + tx * this.vt; this.vy = u.y * v0 + ty * this.vt;
    this.grounded = false; this.buf = 0; this.coyote = 0;
    this.out.push({ type: 'jump', magnitude: 0.5, x: this.x, y: this.y });
  }
  events(): SimEvent[] { const e = this.out; this.out = []; return e; }
}

export function partsFor(tier: number, low: boolean, finale: boolean): string[] {
  const p = ['pad'];
  if (tier >= 1) p.push('bass');
  if (tier >= 3) p.push('arp');
  if (tier >= 5 || finale) p.push('lead');
  if (tier >= 7) p.push('harmony');
  if (low) return p.filter((x) => x !== 'lead' && x !== 'harmony').concat(tier >= 2 ? ['drums'] : []);
  return p;
}
