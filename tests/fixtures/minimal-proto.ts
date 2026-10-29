// The smallest valid prototype: every required piece, no style. A grey square, a ring to touch, nothing else.
// Copy the SHAPE of this (contract, event flow, bots, balance), never a look: pick your own palette, shapes and feel.
import { Graphics } from 'pixi.js';
import { play } from '../../src/audio/index.ts';
import { steerToward } from '../../src/bots/index.ts';
import type { Bot, Ctx, InputState, Prototype, SimEvent, View } from '../../src/core/types.ts';

const R = 24; // the square's half-size
const GOAL_R = 34;

export function createPrototype(): Prototype {
  let ctx!: Ctx;
  let x = 640, y = 400, px = 640, py = 400; // position now and one step ago (for render interpolation)
  let gx = 900, gy = 300; // the ring
  let reached = 0;
  let out: SimEvent[] = [];
  let body: Graphics;
  let goal: Graphics;

  return {
    meta: { slug: 'minimal', title: 'Minimal', question: 'Does the contract work?', targetFeeling: 'neutral', mode: 'systemic' },
    balance: [{ id: 'speed', label: 'Move speed', min: 200, max: 700, step: 20, default: 420 }],

    // sim: pure, no Pixi, no audio, no Math.random (use ctx.rng); the bots run exactly this
    init(c: Ctx) { ctx = c; },
    step(dt: number, input: InputState) {
      px = x; py = y;
      const speed = ctx.balance.speed ?? 420;
      x = Math.max(R, Math.min(1280 - R, x + input.left.x * speed * dt));
      y = Math.max(R, Math.min(800 - R, y + input.left.y * speed * dt));
      if (Math.hypot(gx - x, gy - y) < R + GOAL_R) {
        reached++;
        out.push({ type: 'reach', magnitude: 0.6, x: gx, y: gy }); // juice and audio react to events, not to sim state
        gx = ctx.rng.range(100, 1180);
        gy = ctx.rng.range(100, 700);
      }
    },
    events() { const e = out; out = []; return e; },

    // render: build display objects in mount, draw from sim state in render, react to events in onEvent
    mount(view: View) {
      body = new Graphics().rect(-R, -R, 2 * R, 2 * R).fill(0x888888);
      goal = new Graphics().circle(0, 0, GOAL_R).stroke({ width: 4, color: 0xaaaaaa });
      (view.world as import('pixi.js').Container).addChild(goal, body);
    },
    render(alpha: number) {
      body.position.set(px + (x - px) * alpha, py + (y - py) * alpha);
      goal.position.set(gx, gy);
    },
    onEvent(e: SimEvent) { if (e.type === 'reach') play('pickup'); },

    // what the bots and telemetry can see: small, numeric
    telemetry: () => ({ reached }),
    getState: () => ({ x, y, gx, gy }),
  };
}

// at least a greedy bot and a degenerate-strategy probe (idle and random are built in)
const num = (o: Record<string, unknown>, k: string) => Number(o[k] ?? 0);
export const bots: Bot[] = [
  { name: 'greedy', reset() {}, act: (o) => ({ left: steerToward(num(o, 'x'), num(o, 'y'), num(o, 'gx'), num(o, 'gy')) }) },
  { name: 'degenerate-corner', reset() {}, act: () => ({ left: { x: -1, y: -1 } }) },
];
