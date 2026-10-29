import { Container, Graphics, Sprite, Text, type Application, type Texture } from 'pixi.js';
import { defineSound, play } from '../../audio/index.ts';
import { music } from '../../audio/music.ts';
import { glyph, stickGlyph } from '../../core/glyphs.ts';
import type { Prototype, PrototypeModule, SimEvent, View } from '../../core/types.ts';
import {
  Eyes, flash, hitStop, numberPop, Particles, punch, shake, SquashStretch, Trail, lerpColor, tweens, ease, vfx,
} from '../../juice/index.ts';
import { degenerateHolderBot, greedyBot } from './bots.ts';
import { buildUnjamMusic, partsFor } from './music.ts';
import { BALANCE, BASKET_X, BOT_R, CH, KIND_R, LAYER_NAMES, UNLOCK_AT, UnjamSim, WALL_HALF } from './sim.ts';

const FONT = 'system-ui, sans-serif';
const PAD = 40;
const KIND_COLOR = [0x4cc9f0, 0xffd166, 0xc79bff];
const POP_WORDS = ['POP!', 'SHLOOP!', 'UNCLOG!', 'WHOOSH!', 'BLORP!'];

function hsl(h: number, s = 0.85, l = 0.6): number {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return (Math.round(f(0) * 255) << 16) | (Math.round(f(8) * 255) << 8) | Math.round(f(4) * 255);
}

function fmtTime(s: number): string {
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

function createPrototype(): Prototype {
  const sim = new UnjamSim();
  let tune: ReturnType<typeof buildUnjamMusic>;
  let particles: Particles;
  let ss: SquashStretch;
  let trail: Trail;
  let eyes: Eyes;
  let botBody: Container;
  let botGfx: Graphics;
  let botGlow: Graphics;
  let aura: Graphics;
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
  interface Ring { r: number; a: number; x: number; y: number; color: number }
  const rings: Ring[] = [];
  const addRing = (x: number, y: number, color: number, max = 400, ms = 600, delay = 0) => {
    const ring: Ring = { r: 16, a: 0, x, y, color };
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

      pipe = new Graphics();
      world.addChild(pipe);
      blobGfx = new Graphics();
      gateGfx = new Graphics();
      blobLayer = new Container();
      world.addChild(blobLayer, blobGfx, gateGfx);
      // one baked texture per blob kind and mood (calm, wedged): sprites are far cheaper than redrawing 150 vector blobs every frame
      for (let k = 0; k < 3; k++) {
        const r = KIND_R[k]!;
        blobTex[k] = [false, true].map((stuck) => {
          const col = stuck ? lerpColor(KIND_COLOR[k]!, 0xff5d73, 0.6) : KIND_COLOR[k]!;
          const g = new Graphics();
          g.circle(0, 0, r).fill(col).stroke({ width: 3, color: lerpColor(col, 0x000000, 0.35) });
          if (k === 2) g.circle(0, 0, r * 0.55).stroke({ width: 2, color: 0xffffff, alpha: 0.5 });
          const er = r * 0.2 * (stuck ? 1.5 : 1.1);
          const look = stuck ? 0 : 1.5;
          g.circle(-r * 0.32, -r * 0.12, er).fill(0xffffff);
          g.circle(r * 0.32, -r * 0.12, er).fill(0xffffff);
          g.circle(-r * 0.32 + look, -r * 0.12, er * 0.5).fill(0x101020);
          g.circle(r * 0.32 + look, -r * 0.12, er * 0.5).fill(0x101020);
          if (stuck) g.moveTo(-r * 0.3, r * 0.4).lineTo(r * 0.3, r * 0.4).stroke({ width: 2, color: 0x101020 });
          const holder = new Container();
          holder.addChild(g);
          const t = (view.app as Application).renderer.generateTexture({ target: holder, resolution: 2, frame: g.getLocalBounds().rectangle });
          g.destroy();
          return t;
        });
      }
      trail = new Trail(world, { color: 0xffb347, width: 20, alpha: 0.4 });
      shock = new Graphics();
      chargeGfx = new Graphics();
      aura = new Graphics();
      world.addChild(shock, chargeGfx, aura);
      botBody = new Container();
      botGfx = new Graphics().circle(0, 0, BOT_R).fill(0xff9f45).stroke({ width: 4, color: 0xb35f12 });
      botGfx.rect(-8, -BOT_R - 12, 16, 12).fill(0x8a5a2b); // the plunger handle
      botGlow = new Graphics().circle(0, 0, BOT_R).fill(0xffffff);
      botGlow.alpha = 0;
      eyes = new Eyes({ size: 6, gap: 15 });
      eyes.container.position.set(0, -2);
      botBody.addChild(botGfx, botGlow, eyes.container);
      world.addChild(botBody);
      ss = new SquashStretch(botBody);

      particles = new Particles(world);
      view.onFrame((dt) => {
        particles.update(dt);
        eyes.update(dt);
        // the charge hum: a rising tick, one semitone-ish step per tick, so you hear the pop gathering
        if (sim.charging) {
          chargeTick -= dt;
          if (chargeTick <= 0) {
            chargeTick = 0.075;
            const step = Math.round(sim.charge * 9);
            play('tick', { pitch: Math.pow(2, step / 12), volume: 0.35 + 0.4 * sim.charge });
          }
        }
        if (sim.surging) {
          const c = hsl(clock * 400 + vfx() * 60);
          particles.emit('confetti', botBody.x, botBody.y, { count: 2, size: 0.9, color: c, angle: sim.heading + Math.PI, spread: 1.2 });
          particles.emit('sparks', botBody.x, botBody.y, { count: 1, color: hsl(clock * 400 + 180), speed: 0.7 });
          flushTick -= dt;
          if (flushTick <= 0) {
            flushTick = 0.16;
            const PENT = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];
            play('chime', { pitch: 0.7 * Math.pow(2, PENT[flushNote % PENT.length]! / 12), volume: 0.2 });
            flushNote++;
          }
        }
        // sloshing water bubbles drift along the pipe so a moving current is readable
        tickT -= dt;
        if (tickT <= 0 && !sim.over) {
          tickT = sim.surging ? 0.03 : 0.22;
          particles.emit('dust', CH.left + 10, CH.top + 20 + vfx() * (CH.bottom - CH.top - 40), { count: 1, color: 0x7fd8ff, size: 0.8, angle: 0, spread: 0.2, speed: sim.surging ? 2.4 : 0.9 });
        }
      });

      flashOverlay = new Graphics().rect(0, 0, 1280, 800).fill(0xffffff);
      flashOverlay.alpha = 0;
      ui.addChild(flashOverlay);

      hud = new Graphics();
      ui.addChild(hud);
      pressureLabel = new Text({ text: 'PRESSURE', style: { fontFamily: FONT, fontWeight: '800', fontSize: 26, fill: 0xf4f1ea } });
      pressureLabel.position.set(PAD, 8);
      ui.addChild(pressureLabel);
      const meterLabel = new Text({ text: 'FLUSH', style: { fontFamily: FONT, fontWeight: '800', fontSize: 22, fill: 0x8f8fb8 } });
      meterLabel.position.set(408, 756);
      ui.addChild(meterLabel);
      prompt = new Text({ text: '', style: { fontFamily: FONT, fontWeight: '900', fontSize: 58, fill: 0xfff3b0, stroke: { color: 0x101020, width: 8 } } });
      prompt.anchor.set(0.5);
      prompt.position.set(640, 650);
      prompt.visible = false;
      ui.addChild(prompt);
      scoreText = new Text({ text: 'Score 0', style: { fontFamily: FONT, fontWeight: '800', fontSize: 32, fill: 0x06d6a0 } });
      scoreText.anchor.set(1, 0);
      scoreText.position.set(1280 - PAD, 6);
      ui.addChild(scoreText);
      comboText = new Text({ text: '', style: { fontFamily: FONT, fontWeight: '900', fontSize: 44, fill: 0xfff3b0, stroke: { color: 0x101020, width: 6 } } });
      comboText.anchor.set(1, 0.5);
      comboText.position.set(1240, 200);
      ui.addChild(comboText);
      multText = new Text({ text: '', style: { fontFamily: FONT, fontWeight: '800', fontSize: 26, fill: 0xffd166 } });
      multText.anchor.set(1, 0);
      multText.position.set(1240, 44);
      ui.addChild(multText);
      unlockText = new Text({ text: '', style: { fontFamily: FONT, fontWeight: '700', fontSize: 24, fill: 0x8f8fb8 } });
      unlockText.position.set(PAD, 590);
      ui.addChild(unlockText);
      hint = new Text({ text: '', style: { fontFamily: FONT, fontWeight: '600', fontSize: 26, fill: 0x8f8fb8 } });
      hint.anchor.set(1, 1);
      hint.position.set(1240, 796);
      ui.addChild(hint);
      view.onFrame(() => {
        const parts = [`${stickGlyph('left')}: fly`, `${glyph('a')}: hold, release to pop`];
        if (sim.pullUnlocked) parts.push(`${glyph('x')}: pull`);
        const t = sim.surging ? `${stickGlyph('left')}: steer` : parts.join('    ');
        if (hint.text !== t) hint.text = t;
        const pr = `PRESS ${glyph('y').toUpperCase()}`;
        if (prompt.text !== pr) prompt.text = pr;
        const p = `${glyph('a').toUpperCase()} to go again`;
        if (resultPrompt && resultPrompt.text !== p) resultPrompt.text = p;
        const u = sim.pullUnlocked ? '' : `Deliver ${UNLOCK_AT} blobs to unlock a new move  (${Math.min(UNLOCK_AT, sim.delivered)}/${UNLOCK_AT})`;
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
      choiceTitle = new Text({ text: '', style: { fontFamily: FONT, fontWeight: '900', fontSize: 46, fill: 0xf4f1ea, stroke: { color: 0x101020, width: 6 } } });
      choiceTitle.anchor.set(0.5);
      choiceTitle.position.set(640, 90);
      choiceHint = new Text({ text: '', style: { fontFamily: FONT, fontWeight: '700', fontSize: 28, fill: 0xffd166 } });
      choiceHint.anchor.set(0.5);
      choiceHint.position.set(640, 700);
      choice.addChild(choiceTitle, choiceHint);
      for (let i = 0; i < 2; i++) {
        const t = new Text({ text: '', style: { fontFamily: FONT, fontWeight: '800', fontSize: 34, fill: 0xf4f1ea, align: 'center' } });
        t.anchor.set(0.5);
        t.position.set(i === 0 ? 330 : 950, 560);
        choice.addChild(t);
        cardText.push(t);
      }
      ui.addChild(choice);

      result = new Container();
      result.visible = false;
      result.addChild(new Graphics().rect(0, 0, 1280, 800).fill({ color: 0x07070d, alpha: 0.78 }));
      const title = new Text({ text: 'THE PIPE BURST', style: { fontFamily: FONT, fontWeight: '900', fontSize: 92, fill: 0xff5d73, stroke: { color: 0x101020, width: 8 } } });
      title.anchor.set(0.5);
      title.position.set(640, 270);
      resultStats = new Text({ text: '', style: { fontFamily: FONT, fontWeight: '700', fontSize: 38, fill: 0xf4f1ea, align: 'center' } });
      resultStats.anchor.set(0.5);
      resultStats.position.set(640, 410);
      resultPrompt = new Text({ text: '', style: { fontFamily: FONT, fontWeight: '800', fontSize: 40, fill: 0xffd166 } });
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
      const edge = surging ? hsl(clock * 300) : lerpColor(0x4cc9f0, 0xff5d73, burstN);
      trail.color = surging ? hsl(clock * 500 + 90) : 0xffb347;
      trail.width = surging ? 34 : 20;
      botGlow.alpha = surging ? 0.55 + 0.25 * Math.sin(clock * 12) : 0;
      if (surging) botGlow.tint = hsl(clock * 600);

      // the pipe
      pipe.clear();
      pipe.rect(0, 0, 1280, 800).fill(0x0e1822);
      pipe.roundRect(CH.left - 10, CH.top - 14, CH.right - CH.left + 20, CH.bottom - CH.top + 28, 18).fill(surging ? lerpColor(0x15293a, hsl(clock * 200, 0.5, 0.2), 0.8) : lerpColor(0x15293a, 0x3a1b2a, burstN * 0.7)).stroke({ width: 6, color: edge });
      // basket
      pipe.roundRect(BASKET_X, CH.top - 6, CH.right - BASKET_X + 6, CH.bottom - CH.top + 12, 14).fill({ color: 0x06d6a0, alpha: 0.22 }).stroke({ width: 4, color: 0x06d6a0 });
      pipe.roundRect(CH.left - 10, CH.top + 30, 56, CH.bottom - CH.top - 60, 10).fill({ color: 0x4cc9f0, alpha: 0.18 });
      // flow chevrons
      for (let i = 0; i < 14; i++) {
        const cx = ((i * 90 + clock * (surging ? 380 : 120)) % 1200) + 50;
        pipe.moveTo(cx, CH.top + 8).lineTo(cx + 12, CH.top + 16).lineTo(cx, CH.top + 24).stroke({ width: 3, color: 0x2a4a63, alpha: 0.7 });
        pipe.moveTo(cx, CH.bottom - 24).lineTo(cx + 12, CH.bottom - 16).lineTo(cx, CH.bottom - 8).stroke({ width: 3, color: 0x2a4a63, alpha: 0.7 });
      }

      // gates: hazard-striped walls that slide away during the flush
      gateGfx.clear();
      for (const g of sim.gates) {
        if (!g.active) continue;
        const o = ease.inOut(g.open);
        const topEnd = g.cy - g.gap / 2 - o * 150;
        const botStart = g.cy + g.gap / 2 + o * 150;
        const alphaG = 1 - o * 0.7;
        for (const [y0, y1] of [[CH.top - 12, topEnd], [botStart, CH.bottom + 12]] as const) {
          if (y1 - y0 < 2) continue;
          gateGfx.rect(g.x - WALL_HALF, y0, WALL_HALF * 2, y1 - y0).fill({ color: 0x5b6b7c, alpha: alphaG }).stroke({ width: 3, color: 0xaebdcc, alpha: alphaG });
          for (let yy = y0 + 6; yy < y1 - 6; yy += 22) gateGfx.rect(g.x - WALL_HALF + 3, yy, WALL_HALF * 2 - 6, 8).fill({ color: 0xffd166, alpha: 0.55 * alphaG });
        }
        gateGfx.circle(g.x, g.cy - g.gap / 2 - o * 150, 7).fill({ color: 0xffd166, alpha: alphaG });
        gateGfx.circle(g.x, g.cy + g.gap / 2 + o * 150, 7).fill({ color: 0xffd166, alpha: alphaG });
      }

      // blobs: pooled sprites, stretched by speed, wobbling and red when wedged
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
          blobGfx.circle(bx, by, b.r + 9 + 4 * Math.sin(clock * 9 + b.id)).stroke({ width: 3, color: 0xff5d73, alpha: 0.7 });
        }
        sp.position.set(bx, by);
        sp.scale.set(sx, 1 / sx);
      }
      for (let i = bl.length; i < blobSprites.length; i++) blobSprites[i]!.visible = false;

      // charge preview: a ring that shows the pop radius and fills as you hold
      chargeGfx.clear();
      if (sim.charging && !surging) {
        const p = (0.3 + 0.7 * sim.charge) * (sim.bal('popPower'));
        const R = 90 + 190 * p;
        const full = sim.charge >= 1;
        const col = full ? hsl(clock * 700, 0.9, 0.7) : lerpColor(0xffd166, 0xff9f45, sim.charge);
        chargeGfx.circle(x, y, R).stroke({ width: 3 + 3 * sim.charge, color: col, alpha: 0.35 + 0.4 * sim.charge });
        chargeGfx.circle(x, y, BOT_R + 8 + sim.charge * 8).fill({ color: col, alpha: 0.18 + 0.2 * sim.charge });
        chargeGfx.moveTo(x + BOT_R + 14, y).arc(x, y, BOT_R + 14, 0, Math.PI * 2 * sim.charge).stroke({ width: 6, color: col });
      }
      if (sim.pullOn) {
        for (let i = 0; i < 3; i++) {
          const t = (clock * 1.6 + i / 3) % 1;
          chargeGfx.circle(x, y, 300 * (1 - t)).stroke({ width: 3, color: 0x9cffd8, alpha: 0.5 * t });
        }
      }
      aura.clear();
      if (surging) {
        for (let i = 0; i < 3; i++) aura.circle(x, y, 80 + i * 14 + Math.sin(clock * 10 + i) * 5).stroke({ width: 5 - i, color: hsl(clock * 360 + i * 70), alpha: 0.5 - i * 0.12 });
      }

      shock.clear();
      for (const ring of rings) if (ring.a > 0.01) shock.circle(ring.x, ring.y, ring.r).stroke({ width: 10 * ring.a + 2, color: ring.color, alpha: ring.a });

      // HUD
      dispMeter += ((surging ? Math.min(1, sim.surge / sim.flushSecs) : sim.meter) - dispMeter) * 0.2;
      dispBurst += (sim.burst - dispBurst) * 0.25;
      hud.clear();
      const pb = Math.min(1, dispBurst / 100);
      hud.roundRect(190, 12, 520, 24, 12).fill(0x22224a);
      hud.roundRect(190, 12, Math.max(10, 520 * pb), 24, 12).fill(edge);
      for (const t of [0.5, 0.75]) hud.rect(190 + 520 * t - 1, 12, 2, 24).fill({ color: 0xffffff, alpha: 0.35 });
      hud.roundRect(40, 756, 360, 22, 11).fill(0x22224a);
      if (dispMeter > 0.01) hud.roundRect(40, 756, Math.max(14, 360 * dispMeter), 22, 11).fill(surging || sim.ready ? hsl(clock * 360) : lerpColor(0x4cc9f0, 0xffd166, dispMeter));
      if (sim.ready) hud.roundRect(36, 752, 368, 30, 14).stroke({ width: 4, color: 0xfff3b0, alpha: 0.4 + 0.5 * (0.5 + 0.5 * Math.sin(clock * 12)) });
      for (let i = 0; i < 4; i++) hud.roundRect(740 + i * 26, 14, 20, 20, 5).fill(i < sim.layer ? lerpColor(0xffd166, 0xff5d73, i / 3) : 0x22224a);
      for (let i = 0; i < sim.maxLives; i++) {
        const alive = i < sim.lives;
        hud.circle(880 + i * 34, 24, 11).fill(alive ? 0x4cc9f0 : 0x22224a).stroke({ width: 3, color: alive ? 0xb8ecff : 0x34345c });
      }
      prompt.visible = sim.ready && !sim.over && !sim.choosing;
      if (prompt.visible) {
        prompt.scale.set(1 + 0.1 * Math.sin(clock * 11));
        prompt.tint = hsl(clock * 300, 0.6, 0.85);
      }
      scoreText.text = `Score ${Math.round(sim.score)}`;
      comboPunch *= 0.85;
      comboText.text = sim.combo >= 3 ? `FLOW x${sim.combo}` : '';
      comboText.scale.set(1 + comboPunch);
      comboText.tint = lerpColor(0xffffff, 0xffd166, Math.min(1, sim.combo / 30));
      const m = sim.mult > 1 ? `gate bonus x${sim.mult.toFixed(2)}` : '';
      if (multText.text !== m) multText.text = m;

      // the curator step
      choice.visible = sim.choosing;
      if (sim.choosing) {
        choiceG.clear();
        choiceG.rect(0, 0, 1280, 800).fill({ color: 0x07070d, alpha: 0.72 });
        choiceTitle.text = `WAVE ${sim.waves + 1}: PICK THE NEXT PROBLEM`;
        sim.offers.forEach((o, i) => {
          const cx = i === 0 ? 330 : 950;
          const on = sim.sel === i;
          const w = 400;
          const h = 360;
          const k = on ? 1.03 : 0.97;
          choiceG.roundRect(cx - (w / 2) * k, 170 - (on ? 6 : 0), w * k, h * k, 22).fill({ color: on ? 0x1f3350 : 0x141a2b, alpha: 0.96 }).stroke({ width: on ? 7 : 3, color: on ? hsl(clock * 200, 0.7, 0.7) : 0x34345c });
          // mini pipe with the layout's gate
          const py = 350 + (o.cy - 400) * 0.35;
          const pw = 320;
          choiceG.roundRect(cx - pw / 2, 230, pw, 240, 10).fill(0x15293a);
          choiceG.rect(cx - 12, 230, 24, py - o.gap * 0.4 - 230).fill(0x7a8a9c);
          choiceG.rect(cx - 12, py + o.gap * 0.4, 24, 470 - (py + o.gap * 0.4)).fill(0x7a8a9c);
          for (let j = 0; j < 5; j++) choiceG.circle(cx - 120 + j * 22 - ((clock * 40 + i * 9) % 22), 350 + Math.sin(j * 2 + i) * 40, 9).fill({ color: 0x4cc9f0, alpha: 0.9 });
          const word = o.gap < 76 ? 'TIGHT' : o.gap < 88 ? 'SNUG' : o.gap < 102 ? 'ROOMY' : 'WIDE';
          cardText[i]!.text = `${word}\nscore x${o.mult.toFixed(2)}`;
          cardText[i]!.tint = on ? 0xffffff : 0xb8b8d8;
        });
        const frac = Math.max(0, sim.choiceT / 9);
        choiceG.roundRect(440, 640, 400, 12, 6).fill(0x22224a);
        choiceG.roundRect(440, 640, 400 * frac, 12, 6).fill(0xffd166);
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
          addRing(ex, ey, freed > 0 ? 0xfff3b0 : 0x7fd8ff, Number(e.data?.radius ?? 200), 380 + 200 * p);
          particles.emit('puff', ex, ey, { count: 6 + Math.round(p * 10), color: 0xdaf3ff });
          shake(0.12 + 0.35 * p);
          ss.pop(0.2 + 0.5 * p, 'x');
          punch(botBody, 0.15 + 0.2 * p);
          if (p > 0.9) hitStop(2);
          eyes.setMood(freed > 0 ? 'happy' : 'neutral', 0.8);
          if (freed === 0 && p > 0.5) numberPop(world, 'no budge', ex, ey - 50, { color: 0x9a9ac4, size: 26, ms: 600 });
          break;
        }
        case 'unjam': {
          const n = Number(e.data?.count ?? 1);
          const fwd = !!e.data?.forward;
          const word = fwd ? POP_WORDS[Math.floor(vfx() * POP_WORDS.length)]! : 'BACKFIRE!';
          // the release: the best sound in the game. a low thump, a gurgle slide up, a sparkle
          play('boom', { pitch: 1.4, volume: 0.6 + 0.3 * m });
          play('blip', { pitch: fwd ? 1.2 : 0.6, volume: 0.8 });
          arpeggio(fwd ? [0, 4, 7, 12] : [0, -3, -7], 45, 0.9, 0.5);
          particles.emit('sparks', ex, ey, { count: 12 + n * 6, color: fwd ? 0xfff3b0 : 0xff8fa0, speed: 1.3, angle: fwd ? 0 : Math.PI, spread: 1.4 });
          particles.emit('debris', ex, ey, { count: 8 + n * 3, color: 0x7fd8ff, speed: 1.0 });
          numberPop(world, n > 1 ? `${word} x${n}` : word, ex, ey - 46, { color: fwd ? 0xffffff : 0xff8fa0, size: 36 + Math.min(n, 5) * 5, rise: 60, ms: 800 });
          shake(0.25 + 0.1 * Math.min(n, 5));
          hitStop(2 + Math.min(n, 3));
          flash(botBody, 0xfff3b0, 120);
          eyes.setMood(fwd ? 'happy' : 'frown', 1.4);
          break;
        }
        case 'wedge': {
          const n = Number(e.data?.count ?? 2);
          play('creak', { pitch: 0.8 + 0.1 * n, volume: 0.7, pan: (ex - 640) / 700 });
          play('clank', { pitch: 0.7, volume: 0.45 });
          addRing(ex, ey, 0xff5d73, 90, 400);
          particles.emit('dust', ex, ey, { count: 8, color: 0xff8fa0, size: 1.2 });
          shake(0.12 + 0.05 * n);
          numberPop(world, 'STUCK!', ex, ey - 56, { color: 0xff5d73, size: 32, rise: 30, ms: 700 });
          break;
        }
        case 'deliver': {
          const steps = Number(e.data?.steps ?? 0);
          const combo = Number(e.data?.combo ?? 1);
          // the delivery ticks climb the meter: equal whole tones up to an octave and a bit, then a chime layer says "maxed"
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
          numberPop(world, `FLOOD x${combo}`, 1080, 300, { color: 0xfff3b0, size: 64, rise: 60, ms: 1100 });
          addRing(BASKET_X + 40, 400, 0x06d6a0, 360, 600);
          particles.emit('confetti', BASKET_X + 40, 400, { count: 36, speed: 1.4 });
          shake(0.3);
          hitStop(2);
          flashOverlay.tint = 0x9cffd8;
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
          numberPop(world, `${LAYER_NAMES[level - 1] ?? 'PRESSURE'}!`, 640, 170, { color: 0xffd166, size: 60, rise: 40, ms: 1400 });
          shake(0.35 + 0.05 * level);
          flashOverlay.tint = 0xffd166;
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
          numberPop(world, mult > 1 ? `GATES RESET  x${mult.toFixed(2)}` : 'GATES RESET', 640, 200, { color: 0xffd166, size: 52, rise: 40, ms: 1200 });
          shake(0.4);
          break;
        }
        case 'unlock':
          music.stinger(tune.secret, { duck: 0.4 });
          play('layer', { pitch: 2, volume: 0.8 });
          arpeggio([0, 7, 12, 19], 70, 1, 0.7);
          numberPop(world, `NEW MOVE: PULL  (hold ${glyph('x')})`, 640, 260, { color: 0x9cffd8, size: 46, rise: 40, ms: 1800 });
          flashOverlay.tint = 0x9cffd8;
          flashOverlay.alpha = 0.35;
          tweens.to(flashOverlay, { alpha: 0 }, 400, ease.outQuad);
          break;
        case 'pull-tick':
          play('whoosh', { pitch: 0.6, volume: 0.18 });
          particles.emit('dust', ex, ey, { count: 2, color: 0x9cffd8, size: 0.9 });
          break;
        case 'flush-ready':
          music.stinger(tune.powerup);
          play('layer', { pitch: 2, volume: 0.8 });
          numberPop(world, 'FLUSH READY!', 640, 220, { color: 0xfff3b0, size: 78, rise: 30, ms: 1600 });
          flashOverlay.tint = 0xfff3b0;
          flashOverlay.alpha = 0.4;
          tweens.to(flashOverlay, { alpha: 0 }, 450, ease.outQuad);
          shake(0.3);
          addRing(ex, ey, 0xfff3b0, 380, 700);
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
          numberPop(world, 'FLUSH!', 640, 160, { color: 0xffffff, size: 110, rise: 60, ms: 1400 });
          shake(0.85);
          hitStop(5);
          world.scale.set(1.05);
          tweens.to(world, { 'scale.x': 1, 'scale.y': 1 }, 600, ease.outElastic);
          flashOverlay.tint = 0xffffff;
          flashOverlay.alpha = 0.7;
          tweens.to(flashOverlay, { alpha: 0 }, 400, ease.outQuad);
          for (let i = 0; i < 3; i++) addRing(ex, ey, hsl(i * 120), 640, 700, i * 110);
          particles.emit('confetti', ex, ey, { count: 64, speed: 1.6, size: 1.2 });
          eyes.setMood('happy', 8);
          break;
        case 'flush-end': {
          music.setParts(partsFor(sim.layer, false), 0.5);
          play('boom', { pitch: 0.9, volume: 0.7 });
          play('clank', { pitch: 0.8, volume: 0.9 });
          arpeggio([19, 12, 7, 0], 80, 0.7, 0.6);
          numberPop(world, `FLUSH OVER  ${Number(e.data?.carried ?? 0)} carried`, 640, 160, { color: 0xffd166, size: 48, rise: 40, ms: 1500 });
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
          flashOverlay.tint = 0xffffff;
          flashOverlay.alpha = 0.75;
          tweens.to(flashOverlay, { alpha: 0 }, 350, ease.outQuad);
          tweens.to(flashOverlay, { tint: 0xff3b5c }, 200, ease.linear);
          for (let i = 0; i < 3; i++) addRing(640, 400, i === 1 ? 0xffffff : 0xff5d73, 760, 700, i * 90);
          for (let k = 0; k < 6; k++) {
            const px = 120 + k * 200;
            particles.emit('debris', px, 400, { count: 18, color: 0x4cc9f0, size: 1.6, speed: 1.4 });
            particles.emit('puff', px, 400, { count: 6, color: 0xdaf3ff, size: 1.8 });
          }
          particles.emit('sparks', 640, 400, { count: 40, color: 0xfff3b0, speed: 1.4 });
          numberPop(world, lives > 0 ? 'BURST!' : 'LAST PIPE GONE', 640, 330, { color: 0xff5d73, size: 78, rise: 90, ms: 1000 });
          if (lives > 0) numberPop(world, `${lives} ${lives === 1 ? 'burst' : 'bursts'} left`, 640, 460, { color: 0xffd1d8, size: 32, rise: 30, ms: 1200 });
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
          particles.emit('debris', 640, 400, { count: 60, color: 0x4cc9f0, size: 1.8, speed: 1.6 });
          break;
        case 'recover':
          play('recover');
          play('chime', { volume: 0.6 });
          numberPop(world, 'breathe...', 640, 200, { color: 0x9cffd8, size: 40, rise: 30, ms: 1400 });
          eyes.setMood('happy', 1.5);
          botBody.alpha = 0.4;
          tweens.to(botBody, { alpha: 1 }, 600, ease.outQuad);
          break;
        case 'restart':
          music.setParts(partsFor(1, false), 0.25);
          play('chime', { volume: 0.8 });
          play('recover');
          numberPop(world, 'GO!', 640, 200, { color: 0x9cffd8, size: 64, rise: 50, ms: 800 });
          particles.emit('puff', 640, 400, { count: 14, color: 0x9cffd8 });
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
