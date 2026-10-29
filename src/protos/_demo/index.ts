import { Container, Graphics, Text } from 'pixi.js';
import { defineSound, play } from '../../audio/index.ts';
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

      heatBar = new Graphics();
      ui.addChild(heatBar);
      const label = new Text({ text: 'HEAT', style: { fontFamily: 'system-ui, sans-serif', fontWeight: '800', fontSize: 26, fill: 0xf4f1ea } });
      label.position.set(WIDTH_PAD, 8);
      ui.addChild(label);
      scoreText = new Text({ text: 'Sparks 0', style: { fontFamily: 'system-ui, sans-serif', fontWeight: '800', fontSize: 30, fill: 0x06d6a0 } });
      scoreText.anchor.set(1, 0);
      scoreText.position.set(1280 - WIDTH_PAD, 6);
      ui.addChild(scoreText);
      const hint = new Text({ text: 'Left stick: push    A: dash', style: { fontFamily: 'system-ui, sans-serif', fontWeight: '600', fontSize: 26, fill: 0x8f8fb8 } });
      hint.anchor.set(0.5, 1);
      hint.position.set(640, 796);
      ui.addChild(hint);
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
          play('pickup', { pitch: 1 + (combo - 1) * 0.12, volume: 0.8 });
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
        case 'fail':
          play('fail');
          particles.emit('debris', e.x ?? 0, e.y ?? 0, { count: 24, color: 0xff5d73, size: 1.4 });
          shake(0.8);
          eyes.setMood('frown', 1.5);
          flash(ballBody, 0xff5d73, 220);
          hitStop(6);
          trail.clear();
          break;
        case 'recover':
          play('recover');
          particles.emit('puff', e.x ?? 0, e.y ?? 0, { count: 12, color: 0x9cffd8 });
          eyes.setMood('happy', 1.5);
          punch(ballBody, 0.3);
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
