import { Container, Graphics, Sprite, Text, type Application, type Texture } from 'pixi.js';
import { defineSound, play } from '../../audio/index.ts';
import { music } from '../../audio/music.ts';
import { glyph, stickGlyph } from '../../core/glyphs.ts';
import type { Prototype, PrototypeModule, SimEvent, View } from '../../core/types.ts';
import { flash, hitStop, numberPop, punch, shake, SquashStretch, Trail, lerpColor, tweens, ease, vfx } from '../../juice/index.ts';
import { degenerateHolderBot, greedyBot } from './bots.ts';
import { buildUnjamMusic, partsFor } from './music.ts';
import { Shards } from './shards.ts';
import { BALANCE, BASKET_X, BOT_R, CH, KIND_R, LAYER_NAMES, UNLOCK_AT, UnjamSim, WALL_HALF } from './sim.ts';

// Look: sunset / hard polygons / flat fills (see the brief). Every color in the game comes from these five.
const PAL = {
  sil: 0x1a0d2e, // dark silhouette
  violet: 0x6a2c91,
  magenta: 0xe83f7a,
  orange: 0xff8a3d,
  gold: 0xffd36e,
};
const mix = (a: number, b: number, t: number) => lerpColor(a, b, t);
const FLOOR = mix(PAL.sil, PAL.violet, 0.3);
const KIND_COLOR = [PAL.gold, PAL.orange, mix(PAL.violet, PAL.gold, 0.55)];
const FONT = '"Arial Black", Impact, "Helvetica Neue", system-ui, sans-serif';
const PAD = 40;
const POP_WORDS = ['POP!', 'SHLOOP!', 'UNCLOG!', 'WHOOSH!', 'BLORP!'];
const SKY = [0.22, 0.3, 0.4, 0.52, 0.66, 0.82, 1];

/** Palette cycle for the flush: flat color changes, no gradients. */
function cycle(t: number): number {
  const c = [PAL.gold, PAL.orange, PAL.magenta, PAL.violet];
  return c[Math.floor(t * 8) % c.length]!;
}

function ngon(cx: number, cy: number, r: number, n: number, rot = 0): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * Math.PI * 2;
    out.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  return out;
}
function chamfer(x: number, y: number, w: number, h: number, c: number): number[] {
  return [x + c, y, x + w - c, y, x + w, y + c, x + w, y + h - c, x + w - c, y + h, x + c, y + h, x, y + h - c, x, y + c];
}
function slab(x: number, y: number, w: number, h: number, skew = 14): number[] {
  return [x + skew, y, x + w + skew, y, x + w, y + h, x, y + h];
}
function ringPoly(g: Graphics, x: number, y: number, r: number, thick: number, sides: number, rot: number, color: number, alpha: number): void {
  if (r <= thick) return;
  g.poly(ngon(x, y, r, sides, rot)).fill({ color, alpha });
  g.poly(ngon(x, y, r - thick, sides, rot)).cut();
}

function fmtTime(s: number): string {
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

type Mood = 'neutral' | 'happy' | 'worried' | 'frown';

function createPrototype(): Prototype {
  const sim = new UnjamSim();
  let tune: ReturnType<typeof buildUnjamMusic>;
  let particles: Shards;
  let ss: SquashStretch;
  let trail: Trail;
  let botBody: Container;
  let botGfx: Graphics;
  let faceGfx: Graphics;
  let botGlow: Graphics;
  let aura: Graphics;
  let backdrop: Graphics;
  let pipe: Graphics;
  let gateGfx: Graphics;
  let blobGfx: Graphics;
  let blobLayer: Container;
  const blobTex: Texture[][] = [];
  const blobSprites: Sprite[] = [];
  let shock: Graphics;
  let chargeGfx: Graphics;
  let flashOverlay: Graphics;
  let hud: Graphics;
  let scoreText: Text;
  let scoreLabel: Text;
  let comboText: Text;
  let multText: Text;
  let prompt: Text;
  let hint: Text;
  let unlockText: Text;
  let pressureLabel: Text;
  let world: Container;
  let choice: Container;
  let choiceG: Graphics;
  let choiceTitle: Text;
  let choiceHint: Text;
  const cardText: Text[] = [];
  let result: Container;
  let resultStats: Text;
  let resultPrompt: Text;
  let clock = 0;
  let dispMeter = 0;
  let dispBurst = 10;
  let comboPunch = 0;
  let tickT = 0;
  let flushTick = 0;
  let flushNote = 0;
  let chargeTick = 0;
  // the bot's visor face: a mood the events set, which fades back to neutral
  const eyes = {
    mood: 'neutral' as Mood,
    t: 0,
    lx: 0,
    ly: 0,
    setMood(m: Mood, seconds: number) { this.mood = m; this.t = seconds; },
    lookAt(dx: number, dy: number) {
      const d = Math.hypot(dx, dy) || 1;
      this.lx = (dx / d) * Math.min(1, d / 200);
      this.ly = (dy / d) * Math.min(1, d / 200);
    },
    update(dt: number) { if (this.t > 0 && (this.t -= dt) <= 0) this.mood = 'neutral'; },
  };
  interface Ring { r: number; a: number; x: number; y: number; color: number; rot: number }
  const rings: Ring[] = [];
  const addRing = (x: number, y: number, color: number, max = 400, ms = 600, delay = 0) => {
    const ring: Ring = { r: 16, a: 0, x, y, color, rot: vfx() * 3 };
    rings.push(ring);
    tweens.to(ring, { a: 1 }, 1, ease.linear, { delay });
    tweens.to(ring, { r: max }, ms, ease.outCubic, { delay });
    tweens.to(ring, { a: 0 }, ms * 0.8, ease.linear, { delay: delay + ms * 0.2, onComplete: () => { const i = rings.indexOf(ring); if (i >= 0) rings.splice(i, 1); } });
  };
  const later = (ms: number, fn: () => void) => {
    const o = { v: 0 };
    tweens.to(o, { v: 1 }, ms, ease.linear, { onComplete: fn });
  };
  const arpeggio = (notes: number[], gap: number, base = 1, volume = 0.7, wave = 'chime') => {
    notes.forEach((n, i) => later(i * gap, () => play(wave, { pitch: base * Math.pow(2, n / 12), volume })));
  };
  const txt = (size: number, fill: number, extra: Record<string, unknown> = {}) =>
    new Text({ text: '', style: { fontFamily: FONT, fontWeight: '900', fontSize: size, fill, ...extra } });

  const proto: Prototype = {
    meta: sim.meta,
    balance: BALANCE,
    init: (ctx) => sim.init(ctx),
    dispose() { music.stop(); },
    step: (dt, input) => sim.step(dt, input),
    events: () => sim.drain(),
    telemetry: () => sim.telemetry(),
    getState: () => ({
      x: sim.x, y: sim.y, charge: sim.charge, popCd: sim.popCd,
      stuck: sim.blobs.filter((b) => b.stuck).map((b) => ({ x: b.x, y: b.y, grip: b.grip })),
      gates: sim.gates.map((g) => ({ x: g.x, cy: g.cy, gap: g.gap, active: g.active })),
      ready: sim.ready, surging: sim.surging, choosing: sim.choosing, sel: sim.sel,
      offerGaps: sim.offers.map((o) => o.gap),
    }),

    mount(view: View) {
      world = view.world as Container;
      const ui = view.ui as Container;
      tune = buildUnjamMusic();

      defineSound('pop', { wave: 'sine', freq: 180, slide: -2.2, attack: 0.001, sustain: 0.05, decay: 0.3, punch: 0.5, transient: 0.5, lowpass: 900, volume: 0.8 });
      defineSound('whoosh', { wave: 'noise', freq: 600, slide: 1.2, attack: 0.03, sustain: 0.08, decay: 0.35, lowpass: 2400, highpass: 300, volume: 0.45 });
      defineSound('creak', { wave: 'square', freq: 150, duty: 0.3, slide: -0.5, deltaSlide: 0.4, attack: 0.01, sustain: 0.12, decay: 0.2, vibratoDepth: 0.05, vibratoSpeed: 28, lowpass: 900, volume: 0.35 });
      defineSound('tick', { wave: 'triangle', freq: 440, attack: 0.001, sustain: 0.01, decay: 0.05, volume: 0.28 });
      defineSound('blip', [
        { wave: 'sine', freq: 660, attack: 0.001, sustain: 0.02, decay: 0.12, transient: 0.2, volume: 0.35 },
        { wave: 'sine', freq: 700, attack: 0.001, sustain: 0.02, decay: 0.12, transient: 0.2, volume: 0.35 },
        { wave: 'sine', freq: 620, attack: 0.001, sustain: 0.02, decay: 0.12, transient: 0.2, volume: 0.35 },
      ]);
      defineSound('boom', { wave: 'sine', freq: 110, slide: -1.6, attack: 0.001, sustain: 0.08, decay: 0.45, punch: 0.4, transient: 0.5, lowpass: 600, volume: 0.7 });
      defineSound('crunch', [
        { wave: 'noise', freq: 900, slide: -0.6, attack: 0.001, sustain: 0.03, decay: 0.22, crush: 4, highpass: 400, transient: 0.6, volume: 0.55 },
        { wave: 'noise', freq: 1200, slide: -0.5, attack: 0.001, sustain: 0.03, decay: 0.2, crush: 3, highpass: 500, transient: 0.6, volume: 0.55 },
      ]);
      defineSound('chime', { wave: 'sine', freq: 1568, attack: 0.002, sustain: 0.05, decay: 0.35, vibratoDepth: 0.01, vibratoSpeed: 10, volume: 0.3 });
      defineSound('beat', { wave: 'sine', freq: 90, slide: -1.2, attack: 0.002, sustain: 0.03, decay: 0.12, volume: 0.5 });
      defineSound('layer', { wave: 'saw', freq: 160, slide: 1.2, attack: 0.004, sustain: 0.18, decay: 0.4, lowpass: 1800, vibratoDepth: 0.03, vibratoSpeed: 12, volume: 0.5 });
      defineSound('clank', { wave: 'square', freq: 320, slide: -1.5, attack: 0.001, sustain: 0.03, decay: 0.2, crush: 5, transient: 0.6, lowpass: 1500, volume: 0.5 });

      backdrop = new Graphics();
      pipe = new Graphics();
      world.addChild(backdrop, pipe);
      blobGfx = new Graphics();
      gateGfx = new Graphics();
      blobLayer = new Container();
      world.addChild(blobGfx, blobLayer, gateGfx);
      // one baked texture per blob kind and mood (calm, wedged): sprites are far cheaper than redrawing 150 polygons every frame.
      // Kinds differ by silhouette: diamond (plain), hexagon (fat), triangle (sticky). A faceted inner shard gives each a flat highlight.
      const sides = [4, 6, 3];
      for (let k = 0; k < 3; k++) {
        const r = KIND_R[k]! + 2;
        blobTex[k] = [false, true].map((stuck) => {
          const col = stuck ? PAL.magenta : KIND_COLOR[k]!;
          const g = new Graphics();
          const rot = k === 2 ? 0 : Math.PI / 4;
          const pts = ngon(0, 0, r, sides[k]!, rot);
          g.poly(pts).fill(col);
          // flat shading: the lower facets are a darker tone of the same fill, the core is a lighter shard
          const lower: number[] = [0, 0];
          for (let i = 0; i < pts.length; i += 2) if (pts[i + 1]! > 0.01) lower.push(pts[i]!, pts[i + 1]!);
          if (lower.length >= 6) g.poly(lower).fill(mix(col, PAL.sil, 0.3));
          g.poly(ngon(0, 0, r * 0.38, sides[k]!, rot)).fill(stuck ? PAL.gold : mix(col, PAL.gold, 0.6));
          if (stuck) g.poly([-r * 0.5, -r * 0.1, -r * 0.1, -r * 0.35, -r * 0.1, -r * 0.05]).fill(PAL.sil).poly([r * 0.5, -r * 0.1, r * 0.1, -r * 0.35, r * 0.1, -r * 0.05]).fill(PAL.sil);
          const holder = new Container();
          holder.addChild(g);
          const t = (view.app as Application).renderer.generateTexture({ target: holder, resolution: 2, frame: g.getLocalBounds().rectangle });
          g.destroy();
          return t;
        });
      }

      trail = new Trail(world, { color: PAL.orange, width: 20, alpha: 0.45 });
      shock = new Graphics();
      chargeGfx = new Graphics();
      aura = new Graphics();
      world.addChild(shock, chargeGfx, aura);
      botBody = new Container();
      botGfx = new Graphics();
      // the drone: hexagonal magenta body, a gold cup on a dark handle (the plunger), a visor drawn each frame
      botGfx.poly([-8, -BOT_R - 20, 8, -BOT_R - 20, 8, -BOT_R + 2, -8, -BOT_R + 2]).fill(PAL.sil);
      botGfx.poly([-20, -BOT_R - 28, 20, -BOT_R - 28, 12, -BOT_R - 14, -12, -BOT_R - 14]).fill(PAL.gold);
      botGfx.poly(ngon(0, 0, BOT_R + 4, 6, Math.PI / 6)).fill(PAL.magenta);
      botGfx.poly([-BOT_R - 4, 0, -BOT_R * 0.5, -BOT_R - 1, BOT_R * 0.5, -BOT_R - 1, 0, 2]).fill(mix(PAL.magenta, PAL.gold, 0.3));
      faceGfx = new Graphics();
      botGlow = new Graphics().poly(ngon(0, 0, BOT_R + 4, 6, Math.PI / 6)).fill(PAL.gold);
      botGlow.alpha = 0;
      botBody.addChild(botGfx, faceGfx, botGlow);
      world.addChild(botBody);
      ss = new SquashStretch(botBody);

      particles = new Shards(world);
      view.onFrame((dt) => {
        particles.update(dt);
        eyes.update(dt);
        if (sim.charging) {
          chargeTick -= dt;
          if (chargeTick <= 0) {
            chargeTick = 0.075;
            const step = Math.round(sim.charge * 9);
            play('tick', { pitch: Math.pow(2, step / 12), volume: 0.35 + 0.4 * sim.charge });
          }
        }
        if (sim.surging) {
          particles.emit('confetti', botBody.x, botBody.y, { count: 2, size: 0.9, color: cycle(clock * 3 + vfx()), angle: sim.heading + Math.PI, spread: 1.2 });
          particles.emit('sparks', botBody.x, botBody.y, { count: 1, color: cycle(clock * 3 + 2), speed: 0.7 });
          flushTick -= dt;
          if (flushTick <= 0) {
            flushTick = 0.16;
            const PENT = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];
            play('chime', { pitch: 0.7 * Math.pow(2, PENT[flushNote % PENT.length]! / 12), volume: 0.2 });
            flushNote++;
          }
        }
        // drifting shards along the current so the flow direction is readable
        tickT -= dt;
        if (tickT <= 0 && !sim.over) {
          tickT = sim.surging ? 0.03 : 0.22;
          particles.emit('dust', CH.left + 10, CH.top + 20 + vfx() * (CH.bottom - CH.top - 40), { count: 1, color: PAL.violet, size: 0.8, angle: 0, spread: 0.2, speed: sim.surging ? 2.4 : 0.9 });
        }
      });

      flashOverlay = new Graphics().rect(0, 0, 1280, 800).fill(PAL.gold);
      flashOverlay.alpha = 0;
      ui.addChild(flashOverlay);

      hud = new Graphics();
      ui.addChild(hud);
      pressureLabel = txt(30, PAL.gold);
      pressureLabel.text = 'PRESSURE';
      pressureLabel.position.set(PAD + 8, 10);
      scoreLabel = txt(24, PAL.orange);
      scoreLabel.text = 'SCORE';
      scoreLabel.anchor.set(1, 0);
      scoreLabel.position.set(1250, 6);
      scoreText = txt(66, PAL.gold, { stroke: { color: PAL.sil, width: 10 } });
      scoreText.anchor.set(1, 0);
      scoreText.position.set(1250, 26);
      const meterLabel = txt(28, PAL.gold);
      meterLabel.text = 'FLUSH';
      meterLabel.position.set(PAD + 8, 740);
      prompt = txt(64, PAL.gold, { stroke: { color: PAL.sil, width: 10 } });
      prompt.anchor.set(0.5);
      prompt.position.set(760, 690);
      prompt.visible = false;
      comboText = txt(60, PAL.gold, { stroke: { color: PAL.sil, width: 10 } });
      comboText.anchor.set(1, 0.5);
      comboText.position.set(1250, 640);
      multText = txt(26, PAL.sil);
      multText.anchor.set(1, 0);
      multText.position.set(1236, 128);
      unlockText = txt(24, PAL.gold);
      unlockText.position.set(PAD, 662);
      hint = txt(26, PAL.gold);
      hint.anchor.set(1, 1);
      hint.position.set(1250, 790);
      ui.addChild(pressureLabel, scoreLabel, scoreText, meterLabel, prompt, comboText, multText, unlockText, hint);
      view.onFrame(() => {
        const parts = [`${stickGlyph('left')}: fly`, `${glyph('a')}: hold, release to pop`];
        if (sim.pullUnlocked) parts.push(`${glyph('x')}: pull`);
        const t = sim.surging ? `${stickGlyph('left')}: steer` : parts.join('    ');
        if (hint.text !== t) hint.text = t;
        const pr = `PRESS ${glyph('y').toUpperCase()}`;
        if (prompt.text !== pr) prompt.text = pr;
        const p = `${glyph('a').toUpperCase()} to go again`;
        if (resultPrompt && resultPrompt.text !== p) resultPrompt.text = p;
        const u = sim.pullUnlocked ? '' : `Deliver ${UNLOCK_AT} to unlock a new move  (${Math.min(UNLOCK_AT, sim.delivered)}/${UNLOCK_AT})`;
        if (unlockText.text !== u) unlockText.text = u;
        if (choiceHint) {
          const c = `${stickGlyph('left')}: pick    ${glyph('a')}: confirm`;
          if (choiceHint.text !== c) choiceHint.text = c;
        }
      });

      // the curator step: two generated gate layouts to choose between
      choice = new Container();
      choice.visible = false;
      choiceG = new Graphics();
      choice.addChild(choiceG);
      choiceTitle = txt(46, PAL.gold, { stroke: { color: PAL.sil, width: 10 } });
      choiceTitle.anchor.set(0.5);
      choiceTitle.position.set(640, 90);
      choiceHint = txt(30, PAL.gold);
      choiceHint.anchor.set(0.5);
      choiceHint.position.set(640, 705);
      choice.addChild(choiceTitle, choiceHint);
      for (let i = 0; i < 2; i++) {
        const t = txt(36, PAL.gold, { align: 'center' });
        t.anchor.set(0.5);
        t.position.set(i === 0 ? 330 : 950, 560);
        choice.addChild(t);
        cardText.push(t);
      }
      ui.addChild(choice);

      result = new Container();
      result.visible = false;
      const rg = new Graphics();
      rg.rect(0, 0, 1280, 800).fill({ color: PAL.sil, alpha: 0.82 });
      rg.poly(slab(120, 190, 1040, 130, 40)).fill(PAL.magenta);
      result.addChild(rg);
      const title = txt(88, PAL.gold, { stroke: { color: PAL.sil, width: 10 } });
      title.text = 'THE PIPE BURST';
      title.anchor.set(0.5);
      title.position.set(660, 255);
      resultStats = txt(36, PAL.gold, { align: 'center' });
      resultStats.anchor.set(0.5);
      resultStats.position.set(640, 410);
      resultPrompt = txt(44, PAL.orange);
      resultPrompt.anchor.set(0.5);
      resultPrompt.position.set(640, 540);
      result.addChild(title, resultStats, resultPrompt);
      ui.addChild(result);
    },

    render(alpha) {
      if (!botBody) return;
      clock += 1 / 60;
      const x = sim.px + (sim.x - sim.px) * alpha;
      const y = sim.py + (sim.y - sim.py) * alpha;
      botBody.position.set(x, y);
      ss.update(1 / 60, sim.vx, sim.vy);
      eyes.lookAt(sim.vx || 1, sim.vy);
      trail.push(x, y);
      trail.draw();
      const surging = sim.surging;
      const burstN = Math.min(1, sim.burst / 100);
      const edge = surging ? cycle(clock * 4) : mix(PAL.gold, PAL.magenta, burstN);
      trail.color = surging ? cycle(clock * 5 + 1) : PAL.orange;
      trail.width = surging ? 34 : 20;
      botGlow.alpha = surging ? (Math.floor(clock * 14) % 2 ? 0.6 : 0.2) : 0;

      // the visor face: two angular slits whose tilt shows the mood
      faceGfx.clear();
      faceGfx.poly([-17, -8, 17, -8, 13, 8, -13, 8]).fill(PAL.sil);
      const tilt = eyes.mood === 'happy' ? -5 : eyes.mood === 'frown' ? 5 : eyes.mood === 'worried' ? 3 : 0;
      const open = eyes.mood === 'worried' ? 8 : 6;
      for (const s of [-1, 1]) {
        const ex = s * 7 + eyes.lx * 3;
        const ey = eyes.ly * 2;
        faceGfx.poly([ex - 4, ey - open / 2 + tilt * s * -0.4, ex + 4, ey - open / 2 - tilt * s * -0.4, ex + 4, ey + open / 2, ex - 4, ey + open / 2]).fill(PAL.gold);
      }

      // backdrop: flat sky bands that deepen with pressure, a faceted sun, angular skyline and aqueduct legs
      backdrop.clear();
      const base = [PAL.sil, PAL.violet, PAL.magenta, PAL.orange];
      for (let i = 0; i < SKY.length; i++) {
        const top = i === 0 ? 0 : SKY[i - 1]! * 640;
        const f = SKY[i]!;
        let c = f < 0.5 ? mix(PAL.sil, PAL.violet, f * 2) : mix(PAL.violet, PAL.magenta, (f - 0.5) * 1.6);
        if (f > 0.8) c = mix(PAL.magenta, PAL.orange, (f - 0.8) * 5);
        c = mix(c, PAL.sil, burstN * 0.45);
        if (surging) c = mix(c, base[(i + Math.floor(clock * 6)) % 4]!, 0.5);
        backdrop.rect(0, top, 1280, f * 640 - top + 1).fill(c);
      }
      const sunC = surging ? cycle(clock * 3) : mix(PAL.gold, PAL.magenta, burstN * 0.8);
      const sunR = 130 + burstN * 40 + Math.sin(clock * 2) * 3;
      backdrop.poly(ngon(330, 600, sunR, 8, Math.PI / 8)).fill(sunC);
      for (let i = 0; i < 4; i++) backdrop.rect(330 - sunR, 560 + i * 18, sunR * 2, 5 + i * 2).fill(mix(PAL.magenta, PAL.orange, 0.5));
      backdrop.rect(0, 640, 1280, 160).fill(PAL.sil);
      backdrop.poly([0, 640, 90, 600, 200, 640]).fill(mix(PAL.sil, PAL.violet, 0.2));
      backdrop.poly([760, 640, 900, 575, 1010, 640]).fill(mix(PAL.sil, PAL.violet, 0.2));
      backdrop.poly([1000, 640, 1130, 590, 1280, 640]).fill(mix(PAL.sil, PAL.violet, 0.2));
      for (let i = 0; i < 9; i++) backdrop.poly([80 + i * 150, CH.bottom + 14, 120 + i * 150, CH.bottom + 14, 134 + i * 150, 640, 66 + i * 150, 640]).fill(mix(PAL.sil, PAL.violet, 0.12));

      // the pipe: a dark chamfered slab with a flat floor, rim bars that shift from gold to magenta with pressure
      pipe.clear();
      pipe.poly(chamfer(CH.left - 14, CH.top - 18, CH.right - CH.left + 28, CH.bottom - CH.top + 36, 22)).fill(PAL.sil);
      pipe.poly(chamfer(CH.left - 2, CH.top - 4, CH.right - CH.left + 4, CH.bottom - CH.top + 8, 14)).fill(surging ? mix(FLOOR, cycle(clock * 2), 0.25) : mix(FLOOR, PAL.magenta, burstN * 0.3));
      pipe.rect(CH.left + 6, CH.top - 14, CH.right - CH.left - 12, 8).fill(edge);
      pipe.rect(CH.left + 6, CH.bottom + 6, CH.right - CH.left - 12, 8).fill(edge);
      // basket: a notched slab at the right
      pipe.poly([BASKET_X, CH.top - 4, CH.right - 2, CH.top - 4, CH.right - 2, CH.bottom + 4, BASKET_X, CH.bottom + 4, BASKET_X + 36, (CH.top + CH.bottom) / 2]).fill(mix(PAL.violet, PAL.gold, 0.4));
      // source: a stack of faceted slots at the left
      for (let i = 0; i < 3; i++) pipe.poly(slab(CH.left + 2, CH.top + 30 + i * 80, 40, 56, 14)).fill(mix(FLOOR, PAL.gold, 0.22));
      // flow chevrons as flat triangles
      for (let i = 0; i < 14; i++) {
        const cx = ((i * 90 + clock * (surging ? 380 : 120)) % 1200) + 50;
        pipe.poly([cx, CH.top + 8, cx + 14, CH.top + 16, cx, CH.top + 24]).fill(mix(FLOOR, PAL.violet, 0.6));
        pipe.poly([cx, CH.bottom - 24, cx + 14, CH.bottom - 16, cx, CH.bottom - 8]).fill(mix(FLOOR, PAL.violet, 0.6));
      }

      // gates: magenta slabs with gold arrowhead tips pointing into the gap; they slide away during the flush
      gateGfx.clear();
      for (const g of sim.gates) {
        if (!g.active) continue;
        const o = ease.inOut(g.open);
        const topEnd = g.cy - g.gap / 2 - o * 150;
        const botStart = g.cy + g.gap / 2 + o * 150;
        const a = 1 - o * 0.7;
        if (topEnd - (CH.top - 14) > 2) {
          gateGfx.poly([g.x - WALL_HALF, CH.top - 14, g.x + WALL_HALF, CH.top - 14, g.x + WALL_HALF, topEnd, g.x, topEnd + 16, g.x - WALL_HALF, topEnd]).fill({ color: PAL.magenta, alpha: a });
          gateGfx.poly([g.x - 5, topEnd - 34, g.x + 5, topEnd - 34, g.x, topEnd + 8]).fill({ color: PAL.sil, alpha: a * 0.7 });
        }
        if (CH.bottom + 14 - botStart > 2) {
          gateGfx.poly([g.x - WALL_HALF, botStart, g.x, botStart - 16, g.x + WALL_HALF, botStart, g.x + WALL_HALF, CH.bottom + 14, g.x - WALL_HALF, CH.bottom + 14]).fill({ color: PAL.magenta, alpha: a });
          gateGfx.poly([g.x - 5, botStart + 34, g.x + 5, botStart + 34, g.x, botStart - 8]).fill({ color: PAL.sil, alpha: a * 0.7 });
        }
        gateGfx.poly(ngon(g.x, topEnd + 4, 9, 3, -Math.PI / 2)).fill({ color: PAL.gold, alpha: a });
        gateGfx.poly(ngon(g.x, botStart - 4, 9, 3, Math.PI / 2)).fill({ color: PAL.gold, alpha: a });
      }

      // blobs: pooled sprites, tumbling shards; wedged ones turn magenta, shudder and sit in a spiky halo
      blobGfx.clear();
      const bl = sim.blobs;
      for (let i = 0; i < bl.length; i++) {
        const b = bl[i]!;
        let sp = blobSprites[i];
        if (!sp) {
          sp = new Sprite();
          sp.anchor.set(0.5);
          blobLayer.addChild(sp);
          blobSprites[i] = sp;
        }
        sp.visible = true;
        const tex = blobTex[b.kind]![b.stuck ? 1 : 0]!;
        if (sp.texture !== tex) sp.texture = tex;
        let bx = b.x;
        let by = b.y;
        let sx = 1 + Math.min(0.25, Math.abs(b.vx) / 1400);
        if (b.stuck) {
          const wob = Math.min(1, b.strain / 3);
          bx += Math.sin(clock * 55 + b.id) * (1 + 2.5 * wob);
          by += Math.cos(clock * 47 + b.id) * (1 + 2.5 * wob);
          sx = 1;
          const spin = clock * 3 + b.id;
          blobGfx.poly(ngon(bx, by, b.r + 11 + 4 * Math.sin(clock * 9 + b.id), 8, spin)).fill({ color: PAL.magenta, alpha: 0.45 });
        }
        sp.position.set(bx, by);
        sp.rotation = b.stuck ? 0 : (b.x + b.id * 17) * 0.022;
        sp.scale.set(sx, 1 / sx);
      }
      for (let i = bl.length; i < blobSprites.length; i++) blobSprites[i]!.visible = false;

      // charge preview: a hexagonal ring showing the pop radius, and chunky wedges that light up as you hold
      chargeGfx.clear();
      if (sim.charging && !surging) {
        const p = (0.3 + 0.7 * sim.charge) * sim.bal('popPower');
        const R = 90 + 190 * p;
        const full = sim.charge >= 1;
        const col = full ? cycle(clock * 8) : mix(PAL.gold, PAL.orange, sim.charge);
        ringPoly(chargeGfx, x, y, R, 4 + 4 * sim.charge, 6, clock * 0.4, col, 0.35 + 0.4 * sim.charge);
        const lit = Math.round(sim.charge * 12);
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
          const rr = BOT_R + 18;
          chargeGfx.poly(ngon(x + Math.cos(a) * rr, y + Math.sin(a) * rr, 6, 3, a)).fill({ color: i < lit ? col : PAL.sil, alpha: i < lit ? 1 : 0.5 });
        }
      }
      if (sim.pullOn) {
        for (let i = 0; i < 3; i++) {
          const t = (clock * 1.6 + i / 3) % 1;
          ringPoly(chargeGfx, x, y, 300 * (1 - t), 5, 6, clock, PAL.gold, 0.6 * t);
        }
      }
      aura.clear();
      if (surging) {
        for (let i = 0; i < 6; i++) {
          const a = clock * 7 + (i * Math.PI) / 3;
          aura.poly(ngon(x + Math.cos(a) * (BOT_R + 40), y + Math.sin(a) * (BOT_R + 40), 11, 3, a)).fill(cycle(clock * 4 + i));
        }
        ringPoly(aura, x, y, 84 + Math.sin(clock * 10) * 5, 6, 6, clock * 2, cycle(clock * 5), 0.8);
      }

      shock.clear();
      for (const ring of rings) if (ring.a > 0.01) ringPoly(shock, ring.x, ring.y, ring.r, 10 * ring.a + 3, 6, ring.rot, ring.color, ring.a);

      // HUD: chunky slanted panels and segmented gauges
      dispMeter += ((surging ? Math.min(1, sim.surge / sim.flushSecs) : sim.meter) - dispMeter) * 0.2;
      dispBurst += (sim.burst - dispBurst) * 0.25;
      hud.clear();
      hud.poly(slab(PAD - 8, 6, 760, 48, 18)).fill({ color: PAL.sil, alpha: 0.92 });
      const SEG = 20;
      const pb = Math.min(1, dispBurst / 100);
      for (let i = 0; i < SEG; i++) {
        const on = i < Math.round(pb * SEG);
        hud.poly(slab(250 + i * 21, 14, 15, 32, 7)).fill(on ? mix(PAL.gold, PAL.magenta, i / SEG) : mix(PAL.sil, PAL.violet, 0.5));
      }
      for (let i = 0; i < 4; i++) hud.poly(ngon(700 + i * 30, 30, 11, 3, -Math.PI / 2)).fill(i < sim.layer ? mix(PAL.gold, PAL.magenta, i / 3) : mix(PAL.sil, PAL.violet, 0.5));
      for (let i = 0; i < sim.maxLives; i++) hud.poly(ngon(842 + i * 32, 30, 12, 4, 0)).fill(i < sim.lives ? PAL.orange : mix(PAL.sil, PAL.violet, 0.5));
      hud.poly(slab(PAD - 8, 736, 560, 48, 18)).fill({ color: PAL.sil, alpha: 0.92 });
      const FSEG = 16;
      const lit = Math.round(dispMeter * FSEG);
      for (let i = 0; i < FSEG; i++) {
        const on = i < lit;
        const fc = surging || sim.ready ? cycle(clock * 4 + i * 0.1) : mix(PAL.violet, PAL.gold, i / FSEG);
        hud.poly(slab(180 + i * 23, 744, 17, 32, 7)).fill(on ? fc : mix(PAL.sil, PAL.violet, 0.5));
      }
      if (sim.ready && Math.floor(clock * 6) % 2 === 0) hud.poly(slab(PAD - 14, 730, 572, 60, 20)).fill({ color: PAL.gold, alpha: 0.3 });
      hud.poly(slab(1030, 8, 240, 112, 20)).fill({ color: PAL.sil, alpha: 0.92 });
      if (sim.mult > 1) hud.poly(slab(1000, 122, 270, 38, 14)).fill(PAL.orange);
      prompt.visible = sim.ready && !sim.over && !sim.choosing;
      if (prompt.visible) {
        prompt.scale.set(1 + 0.1 * Math.sin(clock * 11));
        prompt.tint = cycle(clock * 5);
      }
      scoreText.text = `${Math.round(sim.score)}`;
      comboPunch *= 0.85;
      comboText.text = sim.combo >= 3 ? `FLOW x${sim.combo}` : '';
      comboText.scale.set(1 + comboPunch);
      comboText.tint = sim.combo >= 20 ? PAL.orange : PAL.gold;
      const m = sim.mult > 1 ? `GATE BONUS x${sim.mult.toFixed(2)}` : '';
      if (multText.text !== m) multText.text = m;

      // the curator step
      choice.visible = sim.choosing;
      if (sim.choosing) {
        choiceG.clear();
        choiceG.rect(0, 0, 1280, 800).fill({ color: PAL.sil, alpha: 0.82 });
        choiceTitle.text = `WAVE ${sim.waves + 1}: PICK THE NEXT PROBLEM`;
        sim.offers.forEach((o, i) => {
          const cx = i === 0 ? 330 : 950;
          const on = sim.sel === i;
          const w = 400;
          const k = on ? 1.04 : 0.96;
          choiceG.poly(chamfer(cx - (w / 2) * k, 170 - (on ? 8 : 0), w * k, 360 * k, 28)).fill(on ? PAL.violet : mix(PAL.sil, PAL.violet, 0.35));
          if (on) choiceG.poly(chamfer(cx - (w / 2) * k - 10, 160, w * k + 20, 10, 5)).fill(cycle(clock * 4));
          const py = 350 + (o.cy - 400) * 0.35;
          const pw = 320;
          choiceG.poly(chamfer(cx - pw / 2, 230, pw, 240, 14)).fill(PAL.sil);
          choiceG.poly([cx - 14, 230, cx + 14, 230, cx + 14, py - o.gap * 0.4, cx, py - o.gap * 0.4 + 12, cx - 14, py - o.gap * 0.4]).fill(PAL.magenta);
          choiceG.poly([cx - 14, py + o.gap * 0.4, cx, py + o.gap * 0.4 - 12, cx + 14, py + o.gap * 0.4, cx + 14, 470, cx - 14, 470]).fill(PAL.magenta);
          for (let j = 0; j < 5; j++) choiceG.poly(ngon(cx - 120 + j * 22 - ((clock * 40 + i * 9) % 22), 350 + Math.sin(j * 2 + i) * 40, 10, 4, Math.PI / 4)).fill(PAL.gold);
          const word = o.gap < 76 ? 'TIGHT' : o.gap < 88 ? 'SNUG' : o.gap < 102 ? 'ROOMY' : 'WIDE';
          cardText[i]!.text = `${word}\nscore x${o.mult.toFixed(2)}`;
          cardText[i]!.tint = on ? PAL.gold : mix(PAL.gold, PAL.violet, 0.5);
        });
        const frac = Math.max(0, sim.choiceT / 9);
        choiceG.poly(slab(440, 640, 400, 14, 8)).fill(mix(PAL.sil, PAL.violet, 0.5));
        choiceG.poly(slab(440, 640, 400 * frac, 14, 8)).fill(PAL.orange);
      }

      result.visible = sim.over && sim.overT > 0.9;
      if (result.visible) {
        result.alpha = Math.min(1, (sim.overT - 0.9) * 3);
        const s = `Score ${Math.round(sim.score)}     Delivered ${sim.delivered}     Survived ${fmtTime(sim.runTime)}     Best flow x${sim.maxCombo}`;
        if (resultStats.text !== s) resultStats.text = s;
      }
    },

    onEvent(e: SimEvent) {
      const m = e.magnitude ?? 0.5;
      const ex = e.x ?? 640;
      const ey = e.y ?? 400;
      switch (e.type) {
        case 'run-start':
          music.play(tune.loop, partsFor(1, false));
          break;
        case 'charge-start':
          chargeTick = 0;
          ss.pop(0.25, 'y');
          eyes.setMood('worried', 0.6);
          break;
        case 'pop': {
          const p = Number(e.data?.power ?? 0.5);
          const freed = Number(e.data?.freed ?? 0);
          play('pop', { pitch: 1.5 - p * 0.6, volume: 0.45 + 0.5 * p });
          play('whoosh', { pitch: 0.7 + p * 0.5, volume: 0.3 + 0.4 * p });
          addRing(ex, ey, freed > 0 ? PAL.gold : PAL.violet, Number(e.data?.radius ?? 200), 380 + 200 * p);
          particles.emit('puff', ex, ey, { count: 6 + Math.round(p * 10), color: PAL.violet });
          shake(0.12 + 0.35 * p);
          ss.pop(0.2 + 0.5 * p, 'x');
          punch(botBody, 0.15 + 0.2 * p);
          if (p > 0.9) hitStop(2);
          eyes.setMood(freed > 0 ? 'happy' : 'neutral', 0.8);
          if (freed === 0 && p > 0.5) numberPop(world, 'no budge', ex, ey - 50, { color: PAL.violet, size: 28, ms: 600 });
          break;
        }
        case 'unjam': {
          const n = Number(e.data?.count ?? 1);
          const fwd = !!e.data?.forward;
          const word = fwd ? POP_WORDS[Math.floor(vfx() * POP_WORDS.length)]! : 'BACKFIRE!';
          play('boom', { pitch: 1.4, volume: 0.6 + 0.3 * m });
          play('blip', { pitch: fwd ? 1.2 : 0.6, volume: 0.8 });
          arpeggio(fwd ? [0, 4, 7, 12] : [0, -3, -7], 45, 0.9, 0.5);
          particles.emit('sparks', ex, ey, { count: 12 + n * 6, color: fwd ? PAL.gold : PAL.magenta, speed: 1.3, angle: fwd ? 0 : Math.PI, spread: 1.4 });
          particles.emit('debris', ex, ey, { count: 8 + n * 3, color: PAL.orange, speed: 1.0 });
          numberPop(world, n > 1 ? `${word} x${n}` : word, ex, ey - 46, { color: fwd ? PAL.gold : PAL.magenta, size: 36 + Math.min(n, 5) * 5, rise: 60, ms: 800 });
          shake(0.25 + 0.1 * Math.min(n, 5));
          hitStop(2 + Math.min(n, 3));
          flash(botBody, PAL.gold, 120);
          eyes.setMood(fwd ? 'happy' : 'frown', 1.4);
          break;
        }
        case 'wedge': {
          const n = Number(e.data?.count ?? 2);
          play('creak', { pitch: 0.8 + 0.1 * n, volume: 0.7, pan: (ex - 640) / 700 });
          play('clank', { pitch: 0.7, volume: 0.45 });
          addRing(ex, ey, PAL.magenta, 90, 400);
          particles.emit('dust', ex, ey, { count: 8, color: PAL.magenta, size: 1.2 });
          shake(0.12 + 0.05 * n);
          numberPop(world, 'STUCK!', ex, ey - 56, { color: PAL.magenta, size: 34, rise: 30, ms: 700 });
          break;
        }
        case 'deliver': {
          const steps = Number(e.data?.steps ?? 0);
          const combo = Number(e.data?.combo ?? 1);
          play('pickup', { pitch: Math.pow(2, (steps * 2) / 12), volume: 0.35, variation: 0.03 });
          if (combo > 21 && combo % 3 === 0) play('chime', { pitch: Math.pow(2, (((combo - 21) % 8) * 2) / 12), volume: 0.4 });
          particles.emit('sparks', BASKET_X + 10, ey, { count: 4, color: KIND_COLOR[Number(e.data?.kind ?? 0)]!, speed: 0.8, angle: 0, spread: 1.6 });
          comboPunch = Math.min(0.5, comboPunch + 0.12);
          break;
        }
        case 'flood': {
          const combo = Number(e.data?.combo ?? 10);
          play('layer', { pitch: 1.5 + Math.min(1, combo / 60), volume: 0.7 });
          arpeggio([0, 4, 7, 12, 16], 50, 0.9, 0.7);
          numberPop(world, `FLOOD x${combo}`, 1000, 330, { color: PAL.gold, size: 64, rise: 60, ms: 1100 });
          addRing(BASKET_X + 40, 400, PAL.orange, 360, 600);
          particles.emit('confetti', BASKET_X + 40, 400, { count: 36, speed: 1.4 });
          shake(0.3);
          hitStop(2);
          flashOverlay.tint = PAL.orange;
          flashOverlay.alpha = 0.2;
          tweens.to(flashOverlay, { alpha: 0 }, 300, ease.outQuad);
          break;
        }
        case 'combo-drop':
          play('beat', { pitch: 0.6, volume: 0.35 });
          break;
        case 'pressure': {
          const level = Number(e.data?.level ?? 1);
          play('pressureUp', { pitch: 0.8 + level * 0.25 });
          eyes.setMood('worried', 1.5);
          shake(0.15 * level);
          break;
        }
        case 'heartbeat':
          play('beat', { pitch: 0.9 + m * 0.5, volume: 0.35 + 0.4 * m });
          break;
        case 'layer': {
          const level = Number(e.data?.level ?? 2);
          music.setParts(partsFor(level, sim.surging));
          play('layer', { pitch: Math.pow(2, ((level - 2) * 3) / 12), volume: 0.9 });
          play('boom', { pitch: 1.6, volume: 0.5 });
          numberPop(world, `${LAYER_NAMES[level - 1] ?? 'PRESSURE'}!`, 640, 170, { color: PAL.gold, size: 60, rise: 40, ms: 1400 });
          shake(0.35 + 0.05 * level);
          flashOverlay.tint = PAL.orange;
          flashOverlay.alpha = 0.3;
          tweens.to(flashOverlay, { alpha: 0 }, 400, ease.outQuad);
          break;
        }
        case 'wave-break':
          play('layer', { pitch: 1.3, volume: 0.6 });
          music.setParts(partsFor(sim.layer, false), 0.3);
          break;
        case 'wave-hover':
          play('ui-move', { volume: 0.7 });
          break;
        case 'wave-pick': {
          const mult = Number(e.data?.mult ?? 1);
          music.stinger(tune.secret, { duck: 0.5 });
          play('clank', { pitch: 1, volume: 0.9 });
          play('click', { volume: 0.8 });
          numberPop(world, mult > 1 ? `GATES RESET  x${mult.toFixed(2)}` : 'GATES RESET', 640, 200, { color: PAL.gold, size: 52, rise: 40, ms: 1200 });
          shake(0.4);
          break;
        }
        case 'unlock':
          music.stinger(tune.secret, { duck: 0.4 });
          play('layer', { pitch: 2, volume: 0.8 });
          arpeggio([0, 7, 12, 19], 70, 1, 0.7);
          numberPop(world, `NEW MOVE: PULL  (hold ${glyph('x')})`, 640, 260, { color: PAL.gold, size: 46, rise: 40, ms: 1800 });
          flashOverlay.tint = PAL.gold;
          flashOverlay.alpha = 0.35;
          tweens.to(flashOverlay, { alpha: 0 }, 400, ease.outQuad);
          break;
        case 'pull-tick':
          play('whoosh', { pitch: 0.6, volume: 0.18 });
          particles.emit('dust', ex, ey, { count: 2, color: PAL.gold, size: 0.9 });
          break;
        case 'flush-ready':
          music.stinger(tune.powerup);
          play('layer', { pitch: 2, volume: 0.8 });
          numberPop(world, 'FLUSH READY!', 640, 220, { color: PAL.gold, size: 78, rise: 30, ms: 1600 });
          flashOverlay.tint = PAL.gold;
          flashOverlay.alpha = 0.4;
          tweens.to(flashOverlay, { alpha: 0 }, 450, ease.outQuad);
          shake(0.3);
          addRing(ex, ey, PAL.gold, 380, 700);
          particles.emit('confetti', ex, ey, { count: 40, speed: 1.3 });
          eyes.setMood('happy', 2);
          break;
        case 'flush-beacon':
          play('chime', { pitch: Math.pow(2, 7 / 12), volume: 0.3 });
          punch(botBody, 0.12);
          break;
        case 'flush-start':
          music.setParts(partsFor(sim.layer, true), 0.15);
          flushTick = 0;
          flushNote = 0;
          play('layer', { pitch: 2.4, volume: 1 });
          play('boom', { pitch: 1.5, volume: 0.8 });
          play('whoosh', { pitch: 0.5, volume: 0.9 });
          arpeggio([0, 7, 12, 16, 19, 24], 55, 0.9, 0.8);
          numberPop(world, 'FLUSH!', 640, 160, { color: PAL.gold, size: 110, rise: 60, ms: 1400 });
          shake(0.85);
          hitStop(5);
          world.scale.set(1.05);
          tweens.to(world, { 'scale.x': 1, 'scale.y': 1 }, 600, ease.outElastic);
          flashOverlay.tint = PAL.gold;
          flashOverlay.alpha = 0.7;
          tweens.to(flashOverlay, { alpha: 0 }, 400, ease.outQuad);
          for (let i = 0; i < 3; i++) addRing(ex, ey, [PAL.gold, PAL.orange, PAL.magenta][i]!, 640, 700, i * 110);
          particles.emit('confetti', ex, ey, { count: 64, speed: 1.6, size: 1.2 });
          eyes.setMood('happy', 8);
          break;
        case 'flush-end': {
          music.setParts(partsFor(sim.layer, false), 0.5);
          play('boom', { pitch: 0.9, volume: 0.7 });
          play('clank', { pitch: 0.8, volume: 0.9 });
          arpeggio([19, 12, 7, 0], 80, 0.7, 0.6);
          numberPop(world, `FLUSH OVER  ${Number(e.data?.carried ?? 0)} carried`, 640, 160, { color: PAL.gold, size: 48, rise: 40, ms: 1500 });
          shake(0.45);
          eyes.setMood('neutral', 0.1);
          trail.clear();
          break;
        }
        case 'burst': {
          const lives = Number(e.data?.lives ?? 0);
          play('boom', { volume: 1 });
          play('crunch', { volume: 0.9 });
          play('fail', { pitch: 0.8 });
          play('whoosh', { pitch: 0.4, volume: 0.9 });
          shake(1);
          hitStop(9);
          world.scale.set(1.07);
          tweens.to(world, { 'scale.x': 1, 'scale.y': 1 }, 520, ease.outElastic);
          flashOverlay.tint = PAL.gold;
          flashOverlay.alpha = 0.75;
          tweens.to(flashOverlay, { alpha: 0 }, 350, ease.outQuad);
          tweens.to(flashOverlay, { tint: PAL.magenta }, 200, ease.linear);
          for (let i = 0; i < 3; i++) addRing(640, 400, [PAL.magenta, PAL.gold, PAL.orange][i]!, 760, 700, i * 90);
          for (let k = 0; k < 6; k++) {
            const px = 120 + k * 200;
            particles.emit('debris', px, 400, { count: 18, color: k % 2 ? PAL.orange : PAL.gold, size: 1.6, speed: 1.4 });
            particles.emit('puff', px, 400, { count: 6, color: PAL.violet, size: 1.8 });
          }
          particles.emit('sparks', 640, 400, { count: 40, color: PAL.gold, speed: 1.4 });
          numberPop(world, lives > 0 ? 'BURST!' : 'LAST PIPE GONE', 640, 330, { color: PAL.magenta, size: 78, rise: 90, ms: 1000 });
          if (lives > 0) numberPop(world, `${lives} ${lives === 1 ? 'burst' : 'bursts'} left`, 640, 460, { color: PAL.gold, size: 32, rise: 30, ms: 1200 });
          eyes.setMood('frown', 1.6);
          ss.pop(0.65, 'y');
          trail.clear();
          break;
        }
        case 'gameover':
          music.stinger(tune.lose, { duck: 0.2 });
          music.release(2.5);
          play('boom', { pitch: 0.6, volume: 1 });
          play('fail', { pitch: 0.55 });
          shake(1);
          hitStop(14);
          world.scale.set(1.1);
          tweens.to(world, { 'scale.x': 1, 'scale.y': 1 }, 900, ease.outElastic);
          particles.emit('debris', 640, 400, { count: 60, color: PAL.magenta, size: 1.8, speed: 1.6 });
          break;
        case 'recover':
          play('recover');
          play('chime', { volume: 0.6 });
          numberPop(world, 'breathe...', 640, 200, { color: PAL.gold, size: 40, rise: 30, ms: 1400 });
          eyes.setMood('happy', 1.5);
          botBody.alpha = 0.4;
          tweens.to(botBody, { alpha: 1 }, 600, ease.outQuad);
          break;
        case 'restart':
          music.setParts(partsFor(1, false), 0.25);
          play('chime', { volume: 0.8 });
          play('recover');
          numberPop(world, 'GO!', 640, 200, { color: PAL.gold, size: 64, rise: 50, ms: 800 });
          particles.emit('puff', 640, 400, { count: 14, color: PAL.orange });
          trail.clear();
          break;
      }
    },
  };
  return proto;
}

const mod: PrototypeModule = {
  createPrototype,
  bots: [greedyBot(), degenerateHolderBot()],
};
export { createPrototype };
export const bots = mod.bots;
