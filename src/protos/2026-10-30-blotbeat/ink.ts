// The ink, shown without words. One connected story, all of it on the board the player is already looking at:
//  - a missed note turns into ink and runs along its own lane (a channel) into the creature in the middle;
//  - the creature is a glass bottle and the ink inside is the level; pressure is the glass straining (bulge, cracks,
//    bubbles, rattling cork, ink creeping over the lip), and the ink creeps up by itself while it is over half full;
//  - a bright mark on the glass shows how much is enough, and when it is reached he glows and a key cap appears: press it
//    and he leaps and slams, spraying his ink back out along the lanes; his level then drains while the board glows;
//  - too much: the cork pops, ink floods out along every lane over the page, and the ruined sheet lifts away off a
//    physical stack of sheets that the board sits on (the stack is the lives).
// Render side only. No text anywhere in this file.
import { Container, Graphics } from 'pixi.js';
import { Eyes, SquashStretch, chase, ease, tween } from '../../juice/index.ts';
import type { Particles } from '../../juice/index.ts';
import type { SimState, Stats } from './sim.ts';
import { CX, CY, HH, HW, laneRing, laneStart } from './geometry.ts';
import { C, chip } from './ui.ts';

const BASE_Y = CY + 74;
const SCALE = 1.27;
/** Where inflowing ink goes: the middle of the creature's body. */
const MOUTH = { x: CX, y: CY + 30 };
const LIQ_BOTTOM = -3;
const LIQ_H = 80;
const BODY_HALF = 46;

export interface InkHooks {
  /** A packet of ink reached the creature. */
  arrive(amount: number): void;
  /** The creature landed from the stamp leap. */
  stampImpact(): void;
  /** The cork popped. */
  spillPop(): void;
  /** A ruined sheet left the stack. */
  sheetGone(): void;
  /** Where the RB key cap should be named (glyph of the stamp button). */
  stampKey(): string;
}

export interface InkDeps {
  boardC: Container;
  fxC: Container;
  particles: Particles;
  rnd: () => number;
  s: SimState;
  stats: () => Stats;
  hooks: InkHooks;
}

interface Flow {
  x0: number; y0: number; x1: number; y1: number;
  t: number; delay: number; dur: number;
  amount: number; width: number; out: boolean; lane: number;
}

interface Source { kind: 'note' | 'tap'; lane: number; x: number; y: number }

const PAPER = [0xf1ecff, 0xd8cbf7];

export class InkView {
  readonly eyes = new Eyes({ size: 6, color: C.white, pupil: C.ink });
  private readonly d: InkDeps;
  private readonly s: SimState;
  // layers
  private stackC = new Container();
  private channelG: Graphics[] = [];
  private root = new Container();
  private hopC = new Container();
  private strainC = new Container();
  private bodyC = new Container();
  private glowG = new Graphics();
  private liquidG = new Graphics();
  private cracksG = new Graphics();
  private markG = new Graphics();
  private lipG = new Graphics();
  private lidC = new Container();
  private chipC = new Container();
  private flowG = new Graphics();
  private ss!: SquashStretch;
  // state
  private flows: Flow[] = [];
  private sources: Source[] = [];
  private bubbles: { x: number; y: number; vy: number; r: number }[] = [];
  private lastInk = 0;
  private inflight = 0;
  private shown = 0;
  private channelGlow = [0, 0, 0, 0];
  private time = 0;
  private pagesShown = -1;
  private spillingUntil = 0;
  private geyserT = 0;
  private ruined: Graphics | null = null;
  private lidFlying = false;
  private markKey = '';
  private chipKey = '';
  private readyAmt = 0;
  private stackKey = '';

  constructor(deps: InkDeps) {
    this.d = deps;
    this.s = deps.s;
  }

  // ------------------------------------------------------------------ building
  /** The stack of sheets under the board (lives). Add this BEFORE the board art. */
  buildStack(parent: Container): void {
    parent.addChild(this.stackC);
  }

  /** The channels: the faint groove from each target ring to the creature, which lights when ink runs through it. */
  buildChannels(parent: Container): void {
    for (let l = 0; l < 4; l++) {
      const a = laneRing(l);
      const g = new Graphics();
      g.moveTo(a.x, a.y).lineTo(MOUTH.x, MOUTH.y).stroke({ width: 12, color: C.ink, alpha: 0.55, cap: 'round' });
      g.moveTo(a.x, a.y).lineTo(MOUTH.x, MOUTH.y).stroke({ width: 4, color: C.line, alpha: 0.7, cap: 'round' });
      const hot = new Graphics();
      hot.moveTo(a.x, a.y).lineTo(MOUTH.x, MOUTH.y).stroke({ width: 14, color: C.ink, cap: 'round' });
      hot.moveTo(a.x, a.y).lineTo(MOUTH.x, MOUTH.y).stroke({ width: 7, color: C.lime, cap: 'round' });
      hot.alpha = 0;
      parent.addChild(g, hot);
      this.channelG.push(hot);
    }
  }

  /** The creature: a glass bottle with a corked head that has a face. */
  buildCreature(parent: Container): void {
    this.root.position.set(CX, BASE_Y);
    this.root.scale.set(SCALE);
    const shadow = new Graphics().ellipse(0, 4, 62, 16).fill({ color: C.ink, alpha: 0.75 });
    this.glowG.alpha = 0;
    // the empty inside of the glass
    const inside = new Graphics();
    const shape = (g: Graphics) => {
      g.roundRect(-BODY_HALF, -64, BODY_HALF * 2, 64, 22);
      g.roundRect(-16, -90, 32, 36, 6);
      return g;
    };
    // a lime halo that lights HIM when he is ready (and while the fever burns), not a disc on the floor
    this.glowG.roundRect(-16, -90, 32, 36, 6).stroke({ width: 22, color: C.lime, join: 'round' });
    this.glowG.roundRect(-BODY_HALF, -64, BODY_HALF * 2, 64, 22).stroke({ width: 22, color: C.lime, join: 'round' });
    this.glowG.roundRect(-24, -118, 48, 30, 11).stroke({ width: 18, color: C.lime, join: 'round' });
    shape(inside).fill(0x64469f);
    const mask = shape(new Graphics()).fill(0xffffff);
    this.liquidG = new Graphics();
    const liquid = new Container();
    liquid.addChild(this.liquidG);
    liquid.mask = mask;
    // glass front: thick outline, a highlight and the cracks
    const glass = new Graphics();
    glass.roundRect(-16, -90, 32, 36, 6).stroke({ width: 7, color: C.ink, join: 'round' });
    glass.roundRect(-BODY_HALF, -64, BODY_HALF * 2, 64, 22).stroke({ width: 8, color: C.ink, join: 'round' });
    glass.roundRect(-BODY_HALF, -64, BODY_HALF * 2, 64, 22).fill({ color: C.ink, alpha: 0 });
    glass.rect(-12, -64, 24, 8).fill(0x64469f); // hides the neck seam
    glass.roundRect(-BODY_HALF + 6, -58, BODY_HALF * 2 - 12, 52, 16).stroke({ width: 2, color: C.tint, alpha: 0.6 });
    glass.moveTo(-34, -52).lineTo(-34, -22).stroke({ width: 4, color: C.white, alpha: 0.55, cap: 'round' });
    glass.moveTo(-9, -84).lineTo(-9, -66).stroke({ width: 3, color: C.white, alpha: 0.5, cap: 'round' });
    for (const pts of [[[-30, -60], [-20, -44], [-28, -30], [-18, -14]], [[26, -58], [18, -42], [30, -26]], [[-4, -88], [3, -74], [-3, -66]]] as const) {
      this.cracksG.moveTo(pts[0]![0]!, pts[0]![1]!);
      for (const p of pts.slice(1)) this.cracksG.lineTo(p[0]!, p[1]!);
    }
    this.cracksG.stroke({ width: 3, color: C.ink, join: 'round', cap: 'round' });
    this.cracksG.alpha = 0;
    // the head: a cork with a face
    const cork = new Graphics();
    cork.roundRect(-24, -118, 48, 30, 11).fill(C.white).stroke({ width: 7, color: C.ink, join: 'round' });
    this.eyes.container.position.set(0, -102);
    this.lidC.addChild(cork, this.eyes.container);
    this.bodyC.addChild(this.glowG, inside, liquid, mask, this.markG, glass, this.cracksG, this.lipG, this.lidC);
    this.strainC.addChild(this.bodyC);
    this.hopC.addChild(this.strainC);
    this.root.addChild(shadow, this.hopC);
    this.ss = new SquashStretch(this.bodyC);
    this.chipC.position.set(CX + 118, CY - 64);
    parent.addChild(this.root, this.chipC);
  }

  /** The things that fly: ink in transit. Add LAST so it draws over the notes and the creature. */
  buildFlows(parent: Container): void {
    parent.addChild(this.flowG);
  }

  // ------------------------------------------------------------------ cause: where ink comes from
  /** A note was missed (or a stray struck) at (x, y) on `lane`; if the ink total rises this frame, it runs from here. */
  source(kind: 'note' | 'tap', lane: number, x: number, y: number): void {
    this.sources.push({ kind, lane, x, y });
  }

  /** The ink creeps up by itself (the leak): bubbles and a flash of cracks, the level steps up. */
  seep(): void {
    for (let i = 0; i < 6; i++) this.bubbles.push({ x: (this.d.rnd() - 0.5) * 70, y: LIQ_BOTTOM - 4, vy: 40 + this.d.rnd() * 50, r: 3 + this.d.rnd() * 4 });
    this.crackFlash = 1;
    this.ss.pop(0.12, 'x');
  }
  private crackFlash = 0;
  /** How full the bottle looks when the fever starts: more ink spent, a fuller bottle and a longer drain. */
  private feverStart = 0.5;

  pop(amount: number, axis: 'x' | 'y' = 'y'): void {
    this.ss.pop(amount, axis);
  }

  reset(): void {
    this.flows = [];
    this.sources = [];
    this.bubbles = [];
    this.inflight = 0;
    this.shown = 0;
    this.lastInk = this.s.ink;
    this.ruined?.destroy();
    this.ruined = null;
    this.pagesShown = -1;
    this.stackKey = '';
    this.spillingUntil = 0;
    this.geyserT = 0;
    this.hopC.y = 0;
    this.lidC.position.set(0, 0);
    this.lidC.rotation = 0;
    this.lidFlying = false;
  }

  // ------------------------------------------------------------------ effects
  /** The stamp: the creature leaps, slams, and sprays his ink out along every lane. */
  stamp(spentRatio: number): void {
    this.feverStart = Math.max(0.3, Math.min(1, spentRatio));
    tween(this.hopC, { y: -78 }, 120, ease.outQuad, {
      onComplete: () => tween(this.hopC, { y: 0 }, 90, ease.inQuad, {
        onComplete: () => {
          this.ss.pop(0.5, 'y');
          // the print he leaves on the board
          const mark = new Graphics().ellipse(0, 0, 150, 62).fill({ color: C.lime, alpha: 0.85 }).stroke({ width: 8, color: C.ink });
          mark.position.set(CX, CY + 60);
          mark.scale.set(0.3);
          this.d.boardC.addChildAt(mark, this.d.boardC.getChildIndex(this.root)); // under him, on the page
          tween(mark, { scale: 1 }, 160, ease.outBack);
          tween({ v: 0 }, { v: 1 }, 700, ease.linear, { onComplete: () => tween(mark, { alpha: 0 }, 700, ease.linear, { onComplete: () => mark.destroy() }) });
          for (let l = 0; l < 4; l++) {
            const a = laneStart(l);
            this.flows.push({ x0: MOUTH.x, y0: MOUTH.y, x1: a.x, y1: a.y, t: 0, delay: 0, dur: 0.5, amount: 0, width: 16, out: true, lane: l });
          }
          this.d.hooks.stampImpact();
        },
      }),
    });
  }

  /** Too much: the cork pops, ink floods out along every lane over the page, the ruined sheet lifts off the stack. */
  spill(pagesLeft: number): void {
    this.spillingUntil = this.time + 2.4;
    this.flows = this.flows.filter((f) => f.out);
    this.inflight = 0;
    this.d.hooks.spillPop();
    // cork flies off
    this.lidFlying = true;
    tween(this.lidC, { y: -240, x: 60, rotation: 7 }, 520, ease.outQuad, {
      onComplete: () => tween(this.lidC, { y: 0, x: 0, rotation: 0 }, 420, ease.outBounce, { delay: 700, onComplete: () => { this.lidFlying = false; } }),
    });
    this.geyserT = 0.9;
    for (let l = 0; l < 4; l++) {
      const a = laneStart(l);
      this.flows.push({ x0: MOUTH.x, y0: MOUTH.y - 40, x1: a.x, y1: a.y, t: 0, delay: 0.1, dur: 0.55, amount: 0, width: 20, out: true, lane: l });
    }
    // the page is ruined: ink floods the whole sheet
    const sheet = new Graphics();
    sheet.poly([0, -HH, HW, 0, 0, HH, -HW, 0]).fill(C.lime).stroke({ width: 10, color: C.ink, join: 'round' });
    for (let i = 0; i < 9; i++) {
      const a = this.d.rnd() * Math.PI * 2;
      const r = 60 + this.d.rnd() * 300;
      sheet.ellipse(Math.cos(a) * r, Math.sin(a) * r * 0.5, 30 + this.d.rnd() * 40, 14 + this.d.rnd() * 16).fill({ color: 0xe4ff8a, alpha: 0.7 });
    }
    sheet.position.set(CX, CY);
    sheet.scale.set(0.12);
    sheet.alpha = 0.95;
    this.d.fxC.addChild(sheet);
    this.ruined = sheet;
    tween(sheet, { scale: 1 }, 420, ease.outCubic, { delay: 220 });
    if (pagesLeft > 0) {
      // ...then peels away, and the stack under it is one sheet thinner
      tween({ v: 0 }, { v: 1 }, 1250, ease.linear, {
        onComplete: () => {
          this.pagesShown = this.s.pages;
          this.drawStack();
          this.d.hooks.sheetGone();
          tween(sheet, { x: CX - 420, y: CY + 80, rotation: -0.4, alpha: 0 }, 760, ease.inQuad, { onComplete: () => { sheet.destroy(); if (this.ruined === sheet) this.ruined = null; } });
        },
      });
    }
  }

  /** The win: the creature swells and fires his ink up. */
  win(): void {
    this.geyserT = 1.8;
    tween(this.root, { scale: 1.15 }, 380, ease.outBack, { onComplete: () => tween(this.root, { scale: SCALE }, 700, ease.outElastic) });
  }

  // ------------------------------------------------------------------ per frame
  update(dt: number): void {
    this.time += dt;
    const s = this.s;
    const st = this.d.stats();
    this.eyes.update(dt);
    this.ss.update(dt, 0, 0);

    // ink total changed: new ink runs in from where it was made; less ink (stamp, spill, dry) just drops the level
    const delta = s.ink - this.lastInk;
    if (delta > 1e-6) {
      const src = this.sources.length ? this.sources : [null];
      const each = delta / src.length;
      for (const q of src) {
        if (!q) { this.shown = Math.min(this.shown + each, s.ink); continue; } // the leak: the level just rises
        const w = 8 + 8 * Math.min(1, each);
        this.flows.push({ x0: q.x, y0: q.y, x1: MOUTH.x, y1: MOUTH.y, t: 0, delay: 0, dur: 0.62, amount: each, width: w, out: false, lane: q.lane });
        this.inflight += each;
      }
    } else if (delta < -1e-6) {
      this.inflight = Math.min(this.inflight, Math.max(0, s.ink));
      if (s.ink < 0.01) { this.flows = this.flows.filter((f) => f.out); this.inflight = 0; }
    }
    this.sources = [];
    this.lastInk = s.ink;
    const fever = s.feverT > 0;
    const target = Math.max(0, s.ink - this.inflight);
    this.shown = target < this.shown ? chase(this.shown, target, 0.2) : chase(this.shown, target, 0.25);
    if (s.ink < 0.01 && this.shown < 0.02) this.shown = 0;

    // flows
    this.flowG.clear();
    for (const f of this.flows) {
      f.t += dt;
      const u = Math.min(1, Math.max(0, (f.t - f.delay) / f.dur));
      if (f.t >= f.delay) {
        const head = f.out ? ease.outCubic(u) : ease.inQuad(u);
        const tail = f.out ? Math.max(0, head - 0.5) : Math.max(0, head - 0.34);
        const hx = f.x0 + (f.x1 - f.x0) * head; const hy = f.y0 + (f.y1 - f.y0) * head;
        const tx = f.x0 + (f.x1 - f.x0) * tail; const ty = f.y0 + (f.y1 - f.y0) * tail;
        this.flowG.moveTo(tx, ty).lineTo(hx, hy).stroke({ width: f.width + 8, color: C.ink, cap: 'round' });
        this.flowG.moveTo(tx, ty).lineTo(hx, hy).stroke({ width: f.width, color: C.lime, cap: 'round' });
        this.flowG.moveTo(tx, ty).lineTo(hx, hy).stroke({ width: Math.max(2, f.width * 0.25), color: 0xf3ffb0, cap: 'round' });
        if (!f.out) {
          const sh = 1 - 0.55 * u;
          this.flowG.ellipse(hx, hy, f.width * 1.05 * sh, f.width * 0.8 * sh).fill(C.lime).stroke({ width: 5, color: C.ink });
        }
        this.channelGlow[f.lane] = 1;
      }
      if (u >= 1) {
        f.dur = -1;
        if (!f.out) { this.inflight = Math.max(0, this.inflight - f.amount); this.ss.pop(0.18 + 0.2 * f.amount, 'y'); this.d.hooks.arrive(f.amount); }
      }
    }
    this.flows = this.flows.filter((f) => f.dur > 0);
    for (let l = 0; l < 4; l++) { this.channelG[l]!.alpha = this.channelGlow[l]!; this.channelGlow[l] = chase(this.channelGlow[l]!, 0, 0.12); }

    // pressure
    const r = Math.min(1, this.shown / Math.max(1, st.inkMax));
    const ready = !fever && s.ink >= st.cost && s.phase === 'play' && s.setT >= s.stampLock && s.setT >= s.restUntil;
    this.readyAmt = chase(this.readyAmt, ready ? 1 : 0, 0.2);
    const level = fever ? this.feverStart * Math.min(1, s.feverT / Math.max(0.001, s.feverMax)) + 0.04 : r;
    this.drawLiquid(level, fever, r);
    this.cracksG.alpha = fever ? 0 : Math.max(0, Math.min(1, (r - 0.42) * 2.2)) + this.crackFlash * 0.6;
    this.crackFlash = chase(this.crackFlash, 0, 0.12);
    const strain = fever ? 0 : Math.max(0, (r - 0.7) / 0.3);
    this.strainC.rotation = strain > 0 ? Math.sin(this.time * 34) * 0.018 * strain : Math.sin(this.time * 1.6) * 0.012 + (this.readyAmt > 0.5 ? Math.sin(this.time * 40) * 0.01 : 0);
    this.strainC.scale.x = 1 + (strain > 0 ? Math.sin(this.time * 9) * 0.035 * strain + 0.03 * strain : 0);
    if (!this.lidFlying) {
      this.lidC.y = strain > 0.2 ? -Math.abs(Math.sin(this.time * 18)) * 5 * strain : 0;
      this.lidC.rotation = strain > 0.2 ? Math.sin(this.time * 30) * 0.06 * strain : 0;
    }
    this.lipG.clear();
    if (r > 0.88 && !fever) {
      // ink creeping over the lip and running down the outside
      for (let i = 0; i < 2; i++) {
        const x = i ? 13 : -13;
        const y = -90 + ((this.time * 40 + i * 20) % 44);
        this.lipG.ellipse(x, -90, 8, 6).fill(C.lime).stroke({ width: 3, color: C.ink });
        this.lipG.moveTo(x, -88).lineTo(x, y).stroke({ width: 5, color: C.lime, cap: 'round' });
        this.lipG.ellipse(x, y + 2, 5, 6).fill(C.lime);
      }
    }
    if (fever) this.eyes.setMood('happy', 0.2); else if (r >= 0.5) this.eyes.setMood('worried', 0.2);
    this.glowG.alpha = fever ? 0.8 + 0.2 * Math.sin(this.time * 12) : this.readyAmt * (0.55 + 0.35 * Math.sin(this.time * 8));
    this.drawMark(st, ready);
    this.drawChip(ready);
    if (this.geyserT > 0) {
      this.geyserT -= dt;
      this.d.particles.emit('sparks', CX, CY - 40, { count: 5, color: this.d.rnd() < 0.5 ? C.lime : C.white, angle: -Math.PI / 2, spread: 0.6, speed: 2.4, size: 1.4 });
    }
    this.syncStack();
  }

  private drawLiquid(level: number, hot: boolean, r: number): void {
    const g = this.liquidG;
    g.clear();
    if (level < 0.02) return;
    const top = LIQ_BOTTOM - level * LIQ_H;
    const amp = 1.2 + 4 * r;
    g.moveTo(-60, 6);
    for (let x = -60; x <= 60; x += 6) g.lineTo(x, top + Math.sin(this.time * 4 + x * 0.09) * amp);
    g.lineTo(60, 6).closePath().fill(hot ? 0xe3ff6a : C.lime);
    g.moveTo(-60, top + Math.sin(this.time * 4 - 60 * 0.09) * amp);
    for (let x = -54; x <= 60; x += 6) g.lineTo(x, top + Math.sin(this.time * 4 + x * 0.09) * amp);
    g.stroke({ width: 3, color: 0xf6ffc0, alpha: 0.9 });
    if (hot) {
      // fuel burning: bright bands rising through the ink
      for (let i = 0; i < 5; i++) {
        const y = LIQ_BOTTOM - ((this.time * 60 + i * 18) % (LIQ_H + 8));
        if (y > top) g.moveTo(-50, y).lineTo(50, y - 6).stroke({ width: 4, color: 0xffffff, alpha: 0.5 });
      }
    }
    // bubbles
    const rate = 0.03 + 0.25 * r;
    if (this.d.rnd() < rate) this.bubbles.push({ x: (this.d.rnd() - 0.5) * 70, y: LIQ_BOTTOM - 3, vy: 25 + this.d.rnd() * 40 * (1 + r), r: 2 + this.d.rnd() * 3 });
    for (const b of this.bubbles) {
      b.y -= b.vy * 0.016;
      if (b.y > top) g.circle(b.x, b.y, b.r).stroke({ width: 2, color: 0xffffff, alpha: 0.75 });
    }
    this.bubbles = this.bubbles.filter((b) => b.y > top - 2 && this.bubbles.length < 40);
  }

  /** The bright line on the glass: fill to here and he is ready. */
  private drawMark(st: Stats, ready: boolean): void {
    const key = `${st.cost}|${st.inkMax}|${ready}`;
    const pulse = ready ? 0.7 + 0.3 * Math.sin(this.time * 10) : 1;
    if (key !== this.markKey) {
      this.markKey = key;
      this.markG.clear();
      const y = LIQ_BOTTOM - (st.cost / st.inkMax) * LIQ_H;
      this.markG.moveTo(-BODY_HALF + 4, y).lineTo(BODY_HALF - 4, y).stroke({ width: 7, color: C.ink, cap: 'round' });
      this.markG.moveTo(-BODY_HALF + 4, y).lineTo(BODY_HALF - 4, y).stroke({ width: 3, color: ready ? 0xffffff : C.white, cap: 'round', alpha: 1 });
      // little ticks like a measuring glass
      for (const dx of [-30, -10, 10, 30]) this.markG.moveTo(dx, y).lineTo(dx, y - 6).stroke({ width: 3, color: C.white });
    }
    this.markG.alpha = pulse;
  }

  /** The key cap that appears when he is ready: press it. */
  private drawChip(ready: boolean): void {
    const key = this.d.hooks.stampKey();
    if (key !== this.chipKey) {
      this.chipKey = key;
      this.chipC.removeChildren().forEach((c) => c.destroy());
      const link = new Graphics().moveTo(-30, 10).lineTo(-12, 24).stroke({ width: 6, color: C.ink, cap: 'round' }).moveTo(-30, 10).lineTo(-12, 24).stroke({ width: 2.5, color: C.lime, cap: 'round' });
      this.chipC.addChild(link, chip(key, 30, C.lime));
    }
    this.chipC.alpha = this.readyAmt;
    this.chipC.visible = this.readyAmt > 0.02;
    this.chipC.scale.set(0.6 + 0.4 * this.readyAmt + 0.06 * Math.sin(this.time * 9));
    this.chipC.y = CY - 64 + Math.sin(this.time * 6) * 3;
  }

  // ------------------------------------------------------------------ pages: the stack of sheets
  private syncStack(): void {
    const s = this.s;
    if (this.pagesShown < 0) { this.pagesShown = s.pages; this.drawStack(); return; }
    if (this.time < this.spillingUntil) return; // the loss animation updates the stack itself
    if (s.pages > this.pagesShown) {
      // a sheet slides in under the board
      const dy = 20 * this.pagesShown;
      const g = this.sheetShape(dy, PAPER[this.pagesShown % 2]!);
      g.x = -520;
      g.alpha = 0.2;
      this.stackC.addChild(g);
      this.pagesShown = s.pages;
      tween(g, { x: 0, alpha: 1 }, 520, ease.outCubic, { onComplete: () => { g.destroy(); this.drawStack(); } });
    }
  }

  private sheetShape(dy: number, color: number): Graphics {
    const g = new Graphics();
    g.poly([CX, CY - HH + dy, CX + HW, CY + dy, CX, CY + HH + dy, CX - HW, CY + dy]).fill(color).stroke({ width: 7, color: C.ink, join: 'round' });
    return g;
  }

  private drawStack(): void {
    const n = Math.min(7, this.pagesShown);
    const key = `${n}`;
    if (key === this.stackKey) return;
    this.stackKey = key;
    this.stackC.removeChildren().forEach((c) => c.destroy());
    // an ink shadow under the lowest sheet, then the sheets from the bottom up (the board is the top sheet)
    const shadow = this.sheetShape(20 * Math.max(1, n) + 10, C.ink);
    this.stackC.addChild(shadow);
    for (let k = n - 1; k >= 1; k--) this.stackC.addChild(this.sheetShape(20 * k, PAPER[k % 2]!));
  }
}
