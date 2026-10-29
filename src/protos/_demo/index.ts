import { Container, Graphics, Text } from 'pixi.js';
import { defineSound, play } from '../../audio/index.ts';
import { glyph, stickGlyph } from '../../core/glyphs.ts';
import type { Prototype, PrototypeModule, SimEvent, View } from '../../core/types.ts';
import {
  Eyes, flash, hitStop, numberPop, Particles, punch, shake, SquashStretch, Trail, lerpColor, tweens, ease,
} from '../../juice/index.ts';
import { degenerateCornerBot, greedyBot } from './bots.ts';
import { ARENA, BALL_R, DemoSim } from './sim.ts';

const COOL = 0x4cc9f0;
const HOT = 0xff5d73;

function createPrototype(): Prototype {
  const sim = new DemoSim();
  let particles: Particles;
  let ss: SquashStretch;
  let trail: Trail;
  let eyes: Eyes;
  let ballBody: Container;
  let ballGfx: Graphics;
  let arena: Graphics;
  let pickupGfx: Graphics;
  let heatBar: Graphics;
  let scoreText: Text;
  let world: Container;
  let clock = 0;
  let shock: Graphics;
  let flashOverlay: Graphics;
  const ring = { r: 0, a: 0, x: 0, y: 0 };

  const proto: Prototype = {
    meta: sim.meta,
    init: (ctx) => sim.init(ctx),
    step: (dt, input) => sim.step(dt, input),
    events: () => sim.drain(),
    telemetry: () => sim.telemetry(),
    getState: () => ({
      x: sim.x, y: sim.y, vx: sim.vx, vy: sim.vy, heat: sim.heat, score: sim.score, dashCd: sim.dashCd,
      pickups: sim.pickups.map((p) => ({ x: p.x, y: p.y })),
    }),

    mount(view: View) {
      world = view.world as Container;
      const ui = view.ui as Container;
      // failure is layered: sub boom + glassy crunch + descending buzz (default 'fail')
      defineSound('boom', { wave: 'sine', freq: 110, slide: -1.6, attack: 0.001, sustain: 0.08, decay: 0.45, punch: 0.4, transient: 0.5, lowpass: 600, volume: 0.7 });
      defineSound('crunch', [
        { wave: 'noise', freq: 900, slide: -0.6, attack: 0.001, sustain: 0.03, decay: 0.22, crush: 4, highpass: 400, transient: 0.6, volume: 0.55 },
        { wave: 'noise', freq: 1200, slide: -0.5, attack: 0.001, sustain: 0.03, decay: 0.2, crush: 3, highpass: 500, transient: 0.6, volume: 0.55 },
      ]);
      defineSound('chime', { wave: 'sine', freq: 1568, attack: 0.002, sustain: 0.05, decay: 0.35, vibratoDepth: 0.01, vibratoSpeed: 10, volume: 0.3 });
      defineSound('beat', { wave: 'sine', freq: 90, slide: -1.2, attack: 0.002, sustain: 0.03, decay: 0.12, volume: 0.5 });

      arena = new Graphics();
      world.addChild(arena);
      pickupGfx = new Graphics();
      world.addChild(pickupGfx);
      trail = new Trail(world, { color: 0xffd166, width: 22, alpha: 0.45 });

      ballBody = new Container();
      ballGfx = new Graphics().circle(0, 0, BALL_R).fill(0xffd166).stroke({ width: 4, color: 0xc98a1a });
      eyes = new Eyes({ size: 7, gap: 18 });
      eyes.container.position.set(0, -4);
      ballBody.addChild(ballGfx, eyes.container);
      world.addChild(ballBody);
      ss = new SquashStretch(ballBody);

      particles = new Particles(world);
      view.onFrame((dt) => {
        particles.update(dt);
        eyes.update(dt);
      });

      shock = new Graphics();
      world.addChild(shock);
      flashOverlay = new Graphics().rect(0, 0, 1280, 800).fill(0xffffff);
      flashOverlay.alpha = 0;
      ui.addChild(flashOverlay);
      heatBar = new Graphics();
      ui.addChild(heatBar);
      const label = new Text({ text: 'HEAT', style: { fontFamily: 'system-ui, sans-serif', fontWeight: '800', fontSize: 26, fill: 0xf4f1ea } });
      label.position.set(WIDTH_PAD, 8);
      ui.addChild(label);
      scoreText = new Text({ text: 'Sparks 0', style: { fontFamily: 'system-ui, sans-serif', fontWeight: '800', fontSize: 30, fill: 0x06d6a0 } });
      scoreText.anchor.set(1, 0);
      scoreText.position.set(1280 - WIDTH_PAD, 6);
      ui.addChild(scoreText);
      const hint = new Text({ text: '', style: { fontFamily: 'system-ui, sans-serif', fontWeight: '600', fontSize: 26, fill: 0x8f8fb8 } });
      hint.anchor.set(0.5, 1);
      hint.position.set(640, 796);
      ui.addChild(hint);
      // labels follow the device the player is actually using
      view.onFrame(() => {
        const t = `${stickGlyph('left')}: push    ${glyph('a')}: dash`;
        if (hint.text !== t) hint.text = t;
      });
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
      const edge = lerpColor(COOL, HOT, heat);
      arena.clear();
      arena.roundRect(ARENA.left, ARENA.top, ARENA.right - ARENA.left, ARENA.bottom - ARENA.top, 28)
        .fill(lerpColor(0x1b1b3a, 0x3a1b2a, heat * 0.8))
        .stroke({ width: 6, color: edge });

      pickupGfx.clear();
      for (const p of sim.pickups) {
        const pulse = 1 + Math.sin(clock * 8 + p.age * 3) * 0.12;
        pickupGfx.circle(p.x, p.y, 26 * pulse).fill({ color: 0x06d6a0, alpha: 0.25 });
        pickupGfx.circle(p.x, p.y, 14 * pulse).fill(0x06d6a0);
      }

      shock.clear();
      if (ring.a > 0.01) shock.circle(ring.x, ring.y, ring.r).stroke({ width: 10 * ring.a + 2, color: 0xff5d73, alpha: ring.a });

      heatBar.clear();
      heatBar.roundRect(120, 12, 700, 24, 12).fill(0x22224a);
      heatBar.roundRect(120, 12, Math.max(10, 700 * heat), 24, 12).fill(edge);
      scoreText.text = `Sparks ${sim.score}`;
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
          // equal whole-tone steps (2 semitones per combo) up to an octave and a bit, so every step is audible;
          // past the cap the pitch stays put and a high chime layer says "maxed"
          const steps = Math.min(combo - 1, 7);
          play('pickup', { pitch: Math.pow(2, (steps * 2) / 12), volume: 0.8 });
          if (combo > 8) play('chime', { pitch: Math.pow(2, (((combo - 9) % 4) * 2) / 12), volume: 0.8 });
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
        case 'fail': {
          const fx = e.x ?? 640;
          const fy = e.y ?? 400;
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
          ring.x = fx; ring.y = fy; ring.r = 20; ring.a = 1;
          tweens.to(ring, { r: 520, a: 0 }, 650, ease.outCubic);
          // matter: the ball bursts into pieces, sparks and dust
          particles.emit('debris', fx, fy, { count: 40, color: 0xffd166, size: 1.6, speed: 1.4 });
          particles.emit('debris', fx, fy, { count: 24, color: 0xff5d73, size: 1.3, speed: 1.1 });
          particles.emit('sparks', fx, fy, { count: 32, color: 0xfff3b0, speed: 1.3 });
          particles.emit('puff', fx, fy, { count: 14, color: 0xdadaf5, size: 1.6 });
          numberPop(world, 'CRUNCH!', fx, fy - 70, { color: 0xff5d73, size: 56, rise: 90, ms: 900 });
          // the ball itself: squashed flat, shocked eyes, then it pops back in on recover
          eyes.setMood('frown', 1.6);
          ss.pop(0.65, 'y');
          ballBody.rotation = 0;
          tweens.to(ballBody, { alpha: 0.25 }, 120, ease.linear);
          trail.clear();
          break;
        }
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

const WIDTH_PAD = 40;

const mod: PrototypeModule = {
  createPrototype,
  bots: [greedyBot(), degenerateCornerBot()],
};
export { createPrototype };
export const bots = mod.bots;
