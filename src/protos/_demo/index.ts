// TEST FIXTURE, NOT A TEMPLATE. This prototype exists so the smoke test has something rich to exercise, and as the
// first card on the site. Its look (navy ground, amber ball, rainbow confetti, glow) is deliberately not a house style.
// Nightly agents: do not read or copy this. docs/tech/SCAFFOLD_API.md is the whole contract.
import { Container, Graphics, Text } from 'pixi.js';
import { defineSound, play } from '../../audio/index.ts';
import { music } from '../../audio/music.ts';
import { glyph, stickGlyph } from '../../core/glyphs.ts';
import type { Prototype, PrototypeModule, SimEvent, View } from '../../core/types.ts';
import {
  Eyes, flash, hitStop, numberPop, Particles, punch, shake, SquashStretch, Trail, lerpColor, tweens, ease,
} from '../../juice/index.ts';
import { degenerateCornerBot, greedyBot } from './bots.ts';
import { BALANCE, BALL_R, DemoSim, FIELD, HAZARD_R, LAYER_NAMES } from './sim.ts';
import { vfx } from '../../juice/index.ts';
import { buildDemoMusic, partsFor } from './music.ts';

const COOL = 0x4cc9f0;
const HOT = 0xff5d73;
const FONT = 'system-ui, sans-serif';
const PAD = 40;

/** HSL (degrees, 0..1, 0..1) to 0xRRGGBB. Drives the rainbow surge colors. */
function hsl(h: number, s = 0.85, l = 0.6): number {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return (Math.round(f(0) * 255) << 16) | (Math.round(f(8) * 255) << 8) | Math.round(f(4) * 255);
}

const SMASH_WORDS = ['SMASH!', 'CRUSH!', 'BOOM!', 'ZAP!', 'POW!', 'SPLAT!'];
const PENTATONIC = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];

function fmtTime(s: number): string {
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

function createPrototype(): Prototype {
  const sim = new DemoSim();
  let tune: ReturnType<typeof buildDemoMusic>;
  let particles: Particles;
  let ss: SquashStretch;
  let trail: Trail;
  let eyes: Eyes;
  let ballBody: Container;
  let arena: Graphics;
  let pickupGfx: Graphics;
  let hazardGfx: Graphics;
  let heatBar: Graphics;
  let pips: Graphics;
  let scoreText: Text;
  let world: Container;
  let shock: Graphics;
  let flashOverlay: Graphics;
  let meterBar: Graphics;
  let prompt: Text;
  let aura: Graphics;
  let ballGlow: Graphics;
  let ballGfxRef: Graphics;
  let dispMeter = 0;
  let surgeTick = 0;
  let surgeNote = 0;
  let result: Container;
  let resultStats: Text;
  let resultPrompt: Text;
  let clock = 0;
  interface Ring { r: number; a: number; x: number; y: number; color: number }
  const rings: Ring[] = [];
  const addRing = (x: number, y: number, color: number, max = 500, ms = 650, delay = 0) => {
    const ring: Ring = { r: 20, a: 0, x, y, color };
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
  /** A dying drifter: it spins up, swells, and fades while the burst particles fly. */
  const deathStar = (x: number, y: number, color: number) => {
    const g = new Graphics().star(0, 0, 8, HAZARD_R + 6, HAZARD_R - 6, 0).fill(color).stroke({ width: 3, color: 0xffffff });
    g.position.set(x, y);
    world.addChild(g);
    tweens.to(g, { 'scale.x': 3.4, 'scale.y': 3.4, rotation: 5, alpha: 0 }, 520, ease.outCubic, { onComplete: () => g.destroy() });
  };

  const proto: Prototype = {
    meta: sim.meta,
    balance: BALANCE,
    init: (ctx) => sim.init(ctx),
    dispose() {
      music.stop();
    },
    step: (dt, input) => sim.step(dt, input),
    events: () => sim.drain(),
    telemetry: () => sim.telemetry(),
    getState: () => ({
      x: sim.x, y: sim.y, vx: sim.vx, vy: sim.vy, heat: sim.heat, score: sim.score, dashCd: sim.dashCd,
      pickups: sim.pickups.map((p) => ({ x: p.x, y: p.y })),
      hazards: sim.hazards.map((h) => ({ x: h.x, y: h.y, active: h.warn <= 0 })),
      surgeReady: sim.ready,
      surging: sim.surging,
    }),

    mount(view: View) {
      world = view.world as Container;
      const ui = view.ui as Container;
      tune = buildDemoMusic();
      // failure is layered: sub boom + glassy crunch + descending buzz (default 'fail')
      defineSound('boom', { wave: 'sine', freq: 110, slide: -1.6, attack: 0.001, sustain: 0.08, decay: 0.45, punch: 0.4, transient: 0.5, lowpass: 600, volume: 0.7 });
      defineSound('crunch', [
        { wave: 'noise', freq: 900, slide: -0.6, attack: 0.001, sustain: 0.03, decay: 0.22, crush: 4, highpass: 400, transient: 0.6, volume: 0.55 },
        { wave: 'noise', freq: 1200, slide: -0.5, attack: 0.001, sustain: 0.03, decay: 0.2, crush: 3, highpass: 500, transient: 0.6, volume: 0.55 },
      ]);
      defineSound('chime', { wave: 'sine', freq: 1568, attack: 0.002, sustain: 0.05, decay: 0.35, vibratoDepth: 0.01, vibratoSpeed: 10, volume: 0.3 });
      defineSound('beat', { wave: 'sine', freq: 90, slide: -1.2, attack: 0.002, sustain: 0.03, decay: 0.12, volume: 0.5 });
      defineSound('warn', { wave: 'square', freq: 240, duty: 0.3, slide: 0.5, attack: 0.002, sustain: 0.05, decay: 0.12, volume: 0.3 });
      defineSound('layer', { wave: 'saw', freq: 160, slide: 1.2, attack: 0.004, sustain: 0.18, decay: 0.4, lowpass: 1800, vibratoDepth: 0.03, vibratoSpeed: 12, volume: 0.5 });

      arena = new Graphics();
      world.addChild(arena);
      pickupGfx = new Graphics();
      world.addChild(pickupGfx);
      hazardGfx = new Graphics();
      world.addChild(hazardGfx);
      trail = new Trail(world, { color: 0xffd166, width: 22, alpha: 0.45 });

      aura = new Graphics();
      world.addChild(aura);
      ballBody = new Container();
      const ballGfx = new Graphics().circle(0, 0, BALL_R).fill(0xffd166).stroke({ width: 4, color: 0xc98a1a });
      ballGfxRef = ballGfx;
      ballGlow = new Graphics().circle(0, 0, BALL_R).fill(0xffffff);
      ballGlow.alpha = 0;
      eyes = new Eyes({ size: 7, gap: 18 });
      eyes.container.position.set(0, -4);
      ballBody.addChild(ballGfx, ballGlow, eyes.container);
      world.addChild(ballBody);
      ss = new SquashStretch(ballBody);

      particles = new Particles(world);
      view.onFrame((dt) => {
        particles.update(dt);
        eyes.update(dt);
        if (sim.surging) {
          // lots of particles falling off the ball, in changing colors, while the surge lasts
          const c = hsl(clock * 400 + vfx() * 60);
          particles.emit('confetti', ballBody.x, ballBody.y, { count: 2, size: 0.9, color: c, angle: sim.heading + Math.PI, spread: 1.2 });
          particles.emit('sparks', ballBody.x, ballBody.y, { count: 1, color: hsl(clock * 400 + 180), speed: 0.7 });
          // a rolling pentatonic run: the sound of a state you chose to enter
          surgeTick -= dt;
          if (surgeTick <= 0) {
            surgeTick = 0.16;
            play('chime', { pitch: 0.7 * Math.pow(2, PENTATONIC[surgeNote % PENTATONIC.length]! / 12), volume: 0.2 });
            surgeNote++;
          }
        }
      });

      shock = new Graphics();
      world.addChild(shock);
      flashOverlay = new Graphics().rect(0, 0, 1280, 800).fill(0xffffff);
      flashOverlay.alpha = 0;
      ui.addChild(flashOverlay);

      heatBar = new Graphics();
      pips = new Graphics();
      ui.addChild(heatBar, pips);
      const label = new Text({ text: 'HEAT', style: { fontFamily: FONT, fontWeight: '800', fontSize: 26, fill: 0xf4f1ea } });
      label.position.set(PAD, 8);
      ui.addChild(label);
      meterBar = new Graphics();
      ui.addChild(meterBar);
      const meterLabel = new Text({ text: 'SURGE', style: { fontFamily: FONT, fontWeight: '800', fontSize: 20, fill: 0x8f8fb8 } });
      meterLabel.position.set(408, 768);
      ui.addChild(meterLabel);
      prompt = new Text({ text: '', style: { fontFamily: FONT, fontWeight: '900', fontSize: 58, fill: 0xfff3b0, stroke: { color: 0x101020, width: 8 } } });
      prompt.anchor.set(0.5);
      prompt.position.set(640, 680);
      prompt.visible = false;
      ui.addChild(prompt);
      scoreText = new Text({ text: 'Sparks 0', style: { fontFamily: FONT, fontWeight: '800', fontSize: 30, fill: 0x06d6a0 } });
      scoreText.anchor.set(1, 0);
      scoreText.position.set(1280 - PAD, 6);
      ui.addChild(scoreText);
      const hint = new Text({ text: '', style: { fontFamily: FONT, fontWeight: '600', fontSize: 26, fill: 0x8f8fb8 } });
      hint.anchor.set(1, 1);
      hint.position.set(1240, 796);
      ui.addChild(hint);
      // labels follow the device the player is actually using
      view.onFrame(() => {
        const t = sim.surging ? `${stickGlyph('left')}: steer` : `${stickGlyph('left')}: push    ${glyph('a')}: dash    ${glyph('x')}: surge`;
        if (hint.text !== t) hint.text = t;
        const pr = `PRESS ${glyph('x').toUpperCase()}`;
        if (prompt && prompt.text !== pr) prompt.text = pr;
        const p = `${glyph('a').toUpperCase()} to go again`;
        if (resultPrompt && resultPrompt.text !== p) resultPrompt.text = p;
      });

      // hard-failure result screen
      result = new Container();
      result.visible = false;
      result.addChild(new Graphics().rect(0, 0, 1280, 800).fill({ color: 0x07070d, alpha: 0.78 }));
      const title = new Text({ text: 'RUN OVER', style: { fontFamily: FONT, fontWeight: '900', fontSize: 96, fill: 0xff5d73, stroke: { color: 0x101020, width: 8 } } });
      title.anchor.set(0.5);
      title.position.set(640, 270);
      resultStats = new Text({ text: '', style: { fontFamily: FONT, fontWeight: '700', fontSize: 40, fill: 0xf4f1ea, align: 'center' } });
      resultStats.anchor.set(0.5);
      resultStats.position.set(640, 410);
      resultPrompt = new Text({ text: '', style: { fontFamily: FONT, fontWeight: '800', fontSize: 40, fill: 0xffd166 } });
      resultPrompt.anchor.set(0.5);
      resultPrompt.position.set(640, 540);
      result.addChild(title, resultStats, resultPrompt);
      ui.addChild(result);
    },

    render(alpha) {
      if (!ballBody) return;
      clock += 1 / 60;
      const x = sim.px + (sim.x - sim.px) * alpha;
      const y = sim.py + (sim.y - sim.py) * alpha;
      ballBody.position.set(x, y);
      ss.update(1 / 60, sim.vx, sim.vy);
      eyes.lookAt(sim.vx, sim.vy);
      trail.push(x, y);
      trail.draw();

      const heat = Math.min(1, sim.heat / 100);
      const surging = sim.surging;
      const edge = surging ? hsl(clock * 300) : lerpColor(COOL, HOT, heat);
      const a = sim.arena;
      trail.color = surging ? hsl(clock * 500 + 90) : 0xffd166;
      trail.width = surging ? 36 : 22;
      trail.alpha = surging ? 0.7 : 0.45;
      ballGlow.alpha = surging ? 0.55 + 0.25 * Math.sin(clock * 12) : 0;
      if (surging) ballGlow.tint = hsl(clock * 600);
      aura.clear();
      if (surging) {
        for (let i = 0; i < 3; i++) {
          aura.circle(x, y, BALL_R + 14 + i * 16 + Math.sin(clock * 10 + i) * 5).stroke({ width: 5 - i, color: hsl(clock * 360 + i * 70), alpha: 0.55 - i * 0.12 });
        }
        for (let i = 0; i < 8; i++) {
          const an = clock * 7 + (i * Math.PI) / 4;
          aura.circle(x + Math.cos(an) * (BALL_R + 36), y + Math.sin(an) * (BALL_R + 36), 5).fill({ color: hsl(i * 45 + clock * 300), alpha: 0.9 });
        }
      }
      arena.clear();
      // the closing walls (layer 4) show as a darker ring around the live arena
      arena.roundRect(FIELD.left, FIELD.top, FIELD.right - FIELD.left, FIELD.bottom - FIELD.top, 28).fill(0x2a1220);
      arena.roundRect(a.left, a.top, a.right - a.left, a.bottom - a.top, 28)
        .fill(surging ? lerpColor(0x1b1b3a, hsl(clock * 200, 0.5, 0.18), 0.8) : lerpColor(0x1b1b3a, 0x3a1b2a, heat * 0.8))
        .stroke({ width: 6, color: edge });

      pickupGfx.clear();
      for (const p of sim.pickups) {
        const pulse = 1 + Math.sin(clock * 8 + p.age * 3) * 0.12;
        const left = sim.layer >= 3 ? Math.max(0, 1 - p.age / 7) : 1;
        const blink = sim.layer >= 3 && left < 0.3 && Math.floor(clock * 10) % 2 === 0;
        pickupGfx.circle(p.x, p.y, 26 * pulse).fill({ color: 0x06d6a0, alpha: blink ? 0.08 : 0.25 });
        pickupGfx.circle(p.x, p.y, 14 * pulse).fill({ color: blink ? 0xb8ffe9 : 0x06d6a0 });
        if (sim.layer >= 3) {
          // start a fresh sub-path at the arc's first point, or Pixi draws a line from the previous shape
          pickupGfx.moveTo(p.x, p.y - 34).arc(p.x, p.y, 34, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * left).stroke({ width: 4, color: left < 0.3 ? 0xff5d73 : 0xb8ffe9, alpha: 0.9 });
        }
      }

      hazardGfx.clear();
      for (const h of sim.hazards) {
        if (h.warn > 0) {
          // telegraph: a pulsing ring that tightens until the drifter goes live
          const t = 1 - h.warn;
          hazardGfx.circle(h.x, h.y, HAZARD_R + 40 * (1 - t)).stroke({ width: 4, color: 0xff5d73, alpha: 0.3 + 0.5 * t });
          hazardGfx.circle(h.x, h.y, 6 + 8 * t).fill({ color: 0xff5d73, alpha: 0.6 });
        } else {
          hazardGfx.star(h.x, h.y, 8, HAZARD_R + 6, HAZARD_R - 6, clock * 3 + h.age).fill(0xff5d73).stroke({ width: 3, color: 0xffb3be });
          hazardGfx.circle(h.x, h.y, 9).fill(0x3a0f1c);
        }
      }

      shock.clear();
      for (const ring of rings) if (ring.a > 0.01) shock.circle(ring.x, ring.y, ring.r).stroke({ width: 10 * ring.a + 2, color: ring.color, alpha: ring.a });

      // surge meter: fills with combos, pulses gold when full, drains as the surge runs out
      const target = surging ? Math.min(1, sim.surge / sim.surgeSecs) : sim.meter;
      dispMeter += (target - dispMeter) * 0.2;
      meterBar.clear();
      meterBar.roundRect(40, 768, 360, 22, 11).fill(0x22224a);
      if (dispMeter > 0.01) {
        const fillColor = surging || sim.ready ? hsl(clock * 360) : lerpColor(0x4cc9f0, 0xffd166, dispMeter);
        meterBar.roundRect(40, 768, Math.max(14, 360 * dispMeter), 22, 11).fill(fillColor);
      }
      if (sim.ready) {
        const glow = 0.5 + 0.5 * Math.sin(clock * 12);
        meterBar.roundRect(36, 764, 368, 30, 14).stroke({ width: 4, color: 0xfff3b0, alpha: 0.4 + 0.5 * glow });
      }
      prompt.visible = sim.ready && !sim.over;
      if (prompt.visible) {
        const k = 1 + 0.1 * Math.sin(clock * 11);
        prompt.scale.set(k);
        prompt.tint = hsl(clock * 300, 0.6, 0.85);
      }

      heatBar.clear();
      heatBar.roundRect(120, 12, 600, 24, 12).fill(0x22224a);
      heatBar.roundRect(120, 12, Math.max(10, 600 * heat), 24, 12).fill(edge);

      // pressure layers (lit as they switch on) and lives
      pips.clear();
      for (let i = 0; i < 4; i++) {
        const on = i < sim.layer;
        pips.roundRect(750 + i * 26, 14, 20, 20, 5).fill(on ? lerpColor(0xffd166, 0xff5d73, i / 3) : 0x22224a);
      }
      for (let i = 0; i < sim.maxLives; i++) {
        const alive = i < sim.lives;
        pips.circle(900 + i * 34, 24, 11).fill(alive ? 0xff5d73 : 0x22224a).stroke({ width: 3, color: alive ? 0xffb3be : 0x34345c });
      }
      scoreText.text = `Sparks ${sim.score}`;

      result.visible = sim.over && sim.overT > 0.9;
      if (result.visible) {
        result.alpha = Math.min(1, (sim.overT - 0.9) * 3);
        const s = `Sparks ${sim.score}     Survived ${fmtTime(sim.runTime)}     Best ${fmtTime(sim.bestSurvival)}`;
        if (resultStats.text !== s) resultStats.text = s;
      }
    },

    onEvent(e: SimEvent) {
      const m = e.magnitude ?? 0.5;
      switch (e.type) {
        case 'hit': {
          play('hit', { pitch: 0.8 + 0.5 * m, volume: 0.4 + 0.6 * m });
          particles.emit('puff', e.x ?? 0, e.y ?? 0, { count: 4 + Math.round(m * 8), color: 0xdadaf5 });
          if (m > 0.35) particles.emit('debris', e.x ?? 0, e.y ?? 0, { count: Math.round(m * 10), color: 0xc98a1a });
          shake(0.1 + 0.5 * m);
          ss.pop(0.15 + 0.45 * m, e.data?.axis === 0 ? 'x' : 'y');
          if (m > 0.55) { flash(ballBody, 0xffffff, 100); }
          if (m > 0.8) hitStop(3);
          break;
        }
        case 'pickup': {
          const combo = Number(e.data?.combo ?? 1);
          // the rising pitch now tracks the surge meter: equal whole-tone steps up to an octave and a bit,
          // so you hear how close the surge is (and the ready fanfare says "now")
          const steps = Math.min(7, Math.round(Number(e.data?.meter ?? 0) * 7));
          play('pickup', { pitch: Math.pow(2, (steps * 2) / 12), volume: 0.8 });
          particles.emit('sparks', e.x ?? 0, e.y ?? 0, { count: 12 + combo * 3, color: 0xfff3b0 });
          if (combo >= 3) particles.emit('confetti', e.x ?? 0, e.y ?? 0);
          numberPop(world, combo > 1 ? `+1  x${combo}` : '+1', e.x ?? 0, (e.y ?? 0) - 30, { color: 0xfff3b0 });
          eyes.setMood('happy', 1.2);
          flash(ballBody, 0xfff3b0, 120);
          punch(ballBody, 0.18);
          hitStop(2);
          break;
        }
        case 'dash':
          play('dash', { volume: 0.8 });
          particles.emit('dust', e.x ?? 0, e.y ?? 0, { count: 6, angle: Math.atan2(-(Number(e.data?.dy ?? 0)), -(Number(e.data?.dx ?? 0))), spread: 0.8 });
          shake(0.08);
          break;
        case 'pressure': {
          const level = Number(e.data?.level ?? 1);
          play('pressureUp', { pitch: 0.8 + level * 0.25 });
          eyes.setMood('worried', 1.5);
          shake(0.15 * level);
          tweens.to(ballBody, { alpha: 0.7 }, 80, ease.linear, { onComplete: () => tweens.to(ballBody, { alpha: 1 }, 120) });
          break;
        }
        case 'heartbeat':
          play('beat', { pitch: 0.9 + m * 0.5, volume: 0.35 + 0.4 * m });
          break;
        case 'layer': {
          // a new pressure source arrives: rising sting, a banner, a screen pulse
          const level = Number(e.data?.level ?? 2);
          // the music follows the pressure: each layer adds a part
          music.setParts(partsFor(level, sim.surging));
          play('layer', { pitch: Math.pow(2, ((level - 2) * 3) / 12), volume: 0.9 });
          play('boom', { pitch: 1.6, volume: 0.5 });
          numberPop(world, `${LAYER_NAMES[level - 1] ?? 'PRESSURE'}!`, 640, 150, { color: 0xffd166, size: 60, rise: 40, ms: 1400 });
          shake(0.35 + 0.05 * level);
          flashOverlay.tint = 0xffd166;
          flashOverlay.alpha = 0.3;
          tweens.to(flashOverlay, { alpha: 0 }, 400, ease.outQuad);
          eyes.setMood('worried', 2);
          break;
        }
        case 'hazard-warn':
          play('warn', { pitch: 0.9 + (e.x ?? 0) / 1600, volume: 0.7, pan: ((e.x ?? 640) - 640) / 700 });
          particles.emit('dust', e.x ?? 0, e.y ?? 0, { count: 8, color: 0xff5d73, size: 1.4 });
          break;
        case 'hazard-hit':
          play('hit', { pitch: 0.55, volume: 1 });
          play('crunch', { volume: 0.55 });
          particles.emit('sparks', e.x ?? 0, e.y ?? 0, { count: 22, color: 0xff8fa0, speed: 1.2 });
          particles.emit('debris', e.x ?? 0, e.y ?? 0, { count: 12, color: 0xff5d73 });
          numberPop(world, 'OUCH +HEAT', e.x ?? 0, (e.y ?? 0) - 40, { color: 0xff8fa0, size: 34 });
          shake(0.5);
          hitStop(4);
          flash(ballBody, 0xff5d73, 180);
          ss.pop(0.4, 'x');
          eyes.setMood('frown', 1.2);
          break;
        case 'expire':
          play('beat', { pitch: 1.7, volume: 0.45 });
          particles.emit('puff', e.x ?? 0, e.y ?? 0, { count: 8, color: 0x6c7a8a });
          numberPop(world, 'faded', e.x ?? 0, (e.y ?? 0) - 24, { color: 0x9a9ac4, size: 26, ms: 600 });
          break;
        case 'fail': {
          const fx = e.x ?? 640;
          const fy = e.y ?? 400;
          const lives = Number(e.data?.lives ?? 0);
          // sound: layered boom + crunch + the descending buzz
          play('boom', { volume: 1 });
          play('crunch', { volume: 0.9 });
          play('fail', { pitch: 0.8 });
          // motion: big shake, long freeze, a zoom punch on the whole world
          shake(1);
          hitStop(9);
          world.scale.set(1.07);
          tweens.to(world, { 'scale.x': 1, 'scale.y': 1 }, 520, ease.outElastic);
          // light: white-then-red flash across the screen, ball flash, expanding shockwave ring
          flashOverlay.tint = 0xffffff;
          flashOverlay.alpha = 0.75;
          tweens.to(flashOverlay, { alpha: 0 }, 350, ease.outQuad);
          tweens.to(flashOverlay, { tint: 0xff3b5c }, 200, ease.linear);
          flash(ballBody, 0xff5d73, 260);
          addRing(fx, fy, 0xff5d73, 520, 650);
          // matter: the ball bursts into pieces, sparks and dust
          particles.emit('debris', fx, fy, { count: 40, color: 0xffd166, size: 1.6, speed: 1.4 });
          particles.emit('debris', fx, fy, { count: 24, color: 0xff5d73, size: 1.3, speed: 1.1 });
          particles.emit('sparks', fx, fy, { count: 32, color: 0xfff3b0, speed: 1.3 });
          particles.emit('puff', fx, fy, { count: 14, color: 0xdadaf5, size: 1.6 });
          numberPop(world, lives > 0 ? 'CRUNCH!' : 'LAST ONE GONE', fx, fy - 70, { color: 0xff5d73, size: 56, rise: 90, ms: 900 });
          if (lives > 0) numberPop(world, `${lives} ${lives === 1 ? 'life' : 'lives'} left`, fx, fy + 90, { color: 0xffd1d8, size: 32, rise: 30, ms: 1100 });
          // the ball itself: squashed flat, shocked eyes
          eyes.setMood('frown', 1.6);
          ss.pop(0.65, 'y');
          tweens.to(ballBody, { alpha: 0.25 }, 120, ease.linear);
          trail.clear();
          break;
        }
        case 'run-start':
          music.play(tune.loop, partsFor(1, false));
          break;
        case 'surge-ready': {
          // the meter is full: announce it loudly, and keep reminding the player until they spend it
          music.stinger(tune.powerup);
          play('layer', { pitch: 2, volume: 0.8 });
          numberPop(world, 'SURGE READY!', 640, 220, { color: 0xfff3b0, size: 78, rise: 30, ms: 1600 });
          flashOverlay.tint = 0xfff3b0;
          flashOverlay.alpha = 0.45;
          tweens.to(flashOverlay, { alpha: 0 }, 450, ease.outQuad);
          shake(0.3);
          addRing(e.x ?? 640, e.y ?? 400, 0xfff3b0, 380, 700);
          addRing(e.x ?? 640, e.y ?? 400, 0xffffff, 300, 700, 120);
          particles.emit('confetti', e.x ?? 0, e.y ?? 0, { count: 40, speed: 1.3 });
          punch(ballBody, 0.4);
          eyes.setMood('happy', 2);
          break;
        }
        case 'surge-beacon':
          play('chime', { pitch: Math.pow(2, 7 / 12), volume: 0.35 });
          particles.emit('sparks', e.x ?? 0, e.y ?? 0, { count: 8, color: 0xfff3b0, speed: 0.7 });
          punch(ballBody, 0.12);
          break;
        case 'surge-start': {
          music.setParts(partsFor(sim.layer, true), 0.15); // the hook comes in: you earned the tune
          surgeTick = 0;
          surgeNote = 0;
          play('layer', { pitch: 2.4, volume: 1 });
          play('boom', { pitch: 1.5, volume: 0.8 });
          arpeggio([0, 7, 12, 16, 19, 24], 55, 0.9, 0.8);
          numberPop(world, 'SURGE!', 640, 300, { color: 0xffffff, size: 110, rise: 60, ms: 1400 });
          shake(0.85);
          hitStop(5);
          world.scale.set(1.06);
          tweens.to(world, { 'scale.x': 1, 'scale.y': 1 }, 600, ease.outElastic);
          flashOverlay.tint = 0xffffff;
          flashOverlay.alpha = 0.7;
          tweens.to(flashOverlay, { alpha: 0 }, 400, ease.outQuad);
          for (let i = 0; i < 3; i++) addRing(e.x ?? 640, e.y ?? 400, hsl(i * 120), 640, 700, i * 110);
          particles.emit('confetti', e.x ?? 0, e.y ?? 0, { count: 64, speed: 1.6, size: 1.2 });
          particles.emit('sparks', e.x ?? 0, e.y ?? 0, { count: 40, speed: 1.4, color: 0xffffff });
          eyes.setMood('happy', 8);
          break;
        }
        case 'surge-kill': {
          const streak = Number(e.data?.streak ?? 1);
          const x = e.x ?? 0;
          const y = e.y ?? 0;
          // pitch climbs in equal whole tones with the kill streak (capped), so a streak sounds like momentum
          const steps = Math.min(streak - 1, 7);
          play('boom', { pitch: 1.2, volume: 0.9 });
          play('crunch', { volume: 0.85 });
          play('chime', { pitch: 0.6 * Math.pow(2, (steps * 2) / 12), volume: 0.9 });
          if (streak > 8) play('chime', { pitch: 1.2 * Math.pow(2, (((streak - 9) % 4) * 2) / 12), volume: 0.7 });
          deathStar(x, y, hsl(vfx() * 360));
          particles.emit('confetti', x, y, { count: 36, speed: 1.5, size: 1.1 });
          particles.emit('sparks', x, y, { count: 36, speed: 1.4, color: 0xffffff });
          particles.emit('debris', x, y, { count: 16, color: 0xff5d73, size: 1.3 });
          addRing(x, y, hsl(vfx() * 360), 340, 500);
          numberPop(world, `${SMASH_WORDS[Math.floor(vfx() * SMASH_WORDS.length)]} x${streak}`, x, y - 40, { color: hsl(vfx() * 360, 0.9, 0.7), size: 44 + Math.min(streak, 10) * 3, rise: 80, ms: 800 });
          shake(0.6);
          hitStop(4);
          flashOverlay.tint = hsl(vfx() * 360);
          flashOverlay.alpha = 0.3;
          tweens.to(flashOverlay, { alpha: 0 }, 220, ease.outQuad);
          punch(ballBody, 0.25);
          break;
        }
        case 'surge-end': {
          music.setParts(partsFor(sim.layer, false), 0.5);
          play('boom', { pitch: 0.9, volume: 0.7 });
          arpeggio([19, 12, 7, 0], 80, 0.7, 0.6);
          const kills = Number(e.data?.kills ?? 0);
          numberPop(world, kills > 0 ? `SURGE OVER  ${kills} smashed` : 'SURGE OVER', 640, 300, { color: 0xffd166, size: 52, rise: 40, ms: 1500 });
          particles.emit('puff', e.x ?? 0, e.y ?? 0, { count: 16, color: 0xdadaf5, size: 1.4 });
          eyes.setMood('neutral', 0.1);
          trail.clear();
          break;
        }
        case 'gameover':
          // the hard end: the biggest event in the game gets the biggest effects
          music.stinger(tune.lose, { duck: 0.2 });
          music.release(2.5);
          play('boom', { pitch: 0.6, volume: 1 });
          play('fail', { pitch: 0.55 });
          shake(1);
          hitStop(14);
          world.scale.set(1.12);
          tweens.to(world, { 'scale.x': 1, 'scale.y': 1 }, 900, ease.outElastic);
          particles.emit('debris', 640, 400, { count: 60, color: 0xffd166, size: 1.8, speed: 1.6 });
          particles.emit('confetti', 640, 400, { count: 40, speed: 1.2 });
          break;
        case 'restart':
          music.setParts(partsFor(1, false), 0.25); // the heat resets, so the music thins back out
          play('chime', { volume: 0.8 });
          play('recover');
          particles.emit('puff', e.x ?? 640, e.y ?? 400, { count: 14, color: 0x9cffd8 });
          ballBody.alpha = 0.3;
          tweens.to(ballBody, { alpha: 1 }, 380, ease.outQuad);
          numberPop(world, 'GO!', 640, 330, { color: 0x9cffd8, size: 64, rise: 50, ms: 800 });
          trail.clear();
          break;
        case 'recover':
          play('recover');
          particles.emit('puff', e.x ?? 0, e.y ?? 0, { count: 12, color: 0x9cffd8 });
          eyes.setMood('happy', 1.5);
          ballBody.alpha = 0.3;
          tweens.to(ballBody, { alpha: 1 }, 380, ease.outQuad);
          play('chime', { volume: 0.6 });
          break;
      }
    },
  };
  return proto;
}

const mod: PrototypeModule = {
  createPrototype,
  bots: [greedyBot(), degenerateCornerBot()],
};
export { createPrototype };
export const bots = mod.bots;
