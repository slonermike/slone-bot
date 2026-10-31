import type { Bot } from '../../core/types.ts';
import { PR } from './sim.ts';

const n = (o: Record<string, unknown>, k: string) => Number(o[k] ?? 0);
// obs: x,y, cur (body index), tx,ty (target centre), cx,cy (current centre), cr, grounded, vx, vy
let jumpPhase = 0;
export const bots: Bot[] = [
  {
    name: 'greedy',
    reset() { jumpPhase = 0; },
    act(o, tick) {
      const x = n(o, 'x'), y = n(o, 'y'), cx = n(o, 'cx'), cy = n(o, 'cy'), tx = n(o, 'tx'), ty = n(o, 'ty');
      const grounded = n(o, 'grounded') > 0;
      // angle of target from current centre; angle of me
      const want = Math.atan2(ty - cy, tx - cx), me = Math.atan2(y - cy, x - cx);
      let diff = want - me; while (diff > Math.PI) diff -= 2 * Math.PI; while (diff < -Math.PI) diff += 2 * Math.PI;
      if (grounded) {
        const aligned = Math.abs(diff) < 0.06;
        // run in the direction that reduces diff: tangent is (-sin, cos) of angle
        const dir = Math.sign(diff);
        const t = { x: -Math.sin(me) * dir, y: Math.cos(me) * dir };
        const hold = aligned && tick % 2 === 0 ? (['a'] as const) : [];
        return { left: aligned ? { x: 0, y: 0 } : t, hold: hold as never };
      }
      // in the air: steer toward the target, hold A to rise high
      const dx = tx - x, dy = ty - y, d = Math.hypot(dx, dy) || 1;
      return { left: { x: dx / d, y: dy / d }, hold: ['a'] };
    },
  },
  { name: 'degenerate-spin', reset() {}, act: (_o, tick) => ({ left: { x: 1, y: 0 }, hold: tick % 90 === 0 ? ['a'] : [] }) },
];
void PR;
