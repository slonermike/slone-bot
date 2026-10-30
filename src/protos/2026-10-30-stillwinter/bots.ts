import { deltaToStick } from './sim.ts';
import type { Bot, BotInput, ButtonName } from '../../core/types.ts';

const KIND_ORDER = ['spike', 'crystal', 'hourglass', 'mender', 'prism'];
const n = (o: Record<string, unknown>, k: string): number => Number(o[k] ?? 0);

/** Walk the cursor toward (tx,ty) one cell at a time; returns the stick vector, or null when there. */
function toward(o: Record<string, unknown>): { x: number; y: number } | null {
  const dx = Math.sign(n(o, 'tx') - n(o, 'cx'));
  const dy = Math.sign(n(o, 'ty') - n(o, 'cy'));
  if (!dx && !dy) return null;
  return deltaToStick(dx, dy);
}

/** Follows the sim's plan: build attackers on the best cells, make time by shattering fuel, Cold Snap when full. */
function planBot(name: string, filter?: (o: Record<string, unknown>) => Record<string, unknown>): Bot {
  let pulse = 0;
  return {
    name,
    reset() { pulse = 0; },
    act(raw) {
      const o = filter ? filter(raw) : raw;
      pulse++;
      const act = n(o, 'act');
      if (act === 3 && n(o, 'spires') < 3) return {};
      if (act === 4) return pulse % 20 < 2 ? { hold: ['a'] } : {};
      const sel = n(o, 'sel');
      const want = n(o, 'kind');
      if (act === 1 && sel !== want) {
        // cycle the selector (RB); release between presses so each is an edge
        return { hold: pulse % 2 ? (['rb'] as ButtonName[]) : [] };
      }
      const stick = act === 0 || act === 3 ? null : toward(o);
      if (stick) return { left: stick };
      const hold: ButtonName[] = [];
      if (pulse % 2) {
        if (act === 1) hold.push('a');
        if (act === 2) hold.push('x');
        if (act === 3) hold.push('y');
      }
      return { hold } as BotInput;
    },
  };
}

/** Degenerate probe: burn time by placing and shattering the cheapest thing forever, never defending. */
function shatterSpam(): Bot {
  let pulse = 0;
  return {
    name: 'degenerate-shatter-spam',
    reset() { pulse = 0; },
    act(o) {
      pulse++;
      const spires = n(o, 'spires');
      const hold: ButtonName[] = [];
      if (pulse % 4 === 0) hold.push(spires > 0 ? 'x' : 'a');
      return { hold };
    },
  };
}

/** Plays for crystal chains: banks time in a cluster, keeps turrets apart, uses Cold Snap. Should beat greedy if chains are the real game. */
const chainFilter = (o: Record<string, unknown>): Record<string, unknown> => ({
  ...o, act: o.act === 3 || o.act === 4 ? o.act : o.c_act, tx: o.c_act === 0 || o.act === 3 ? o.tx : o.c_tx, ty: o.c_act === 0 || o.act === 3 ? o.ty : o.c_ty, kind: o.c_act === 1 ? o.c_kind : o.kind,
});
export const bots: Bot[] = [planBot('greedy'), shatterSpam(), planBot('chain-cluster', chainFilter)];
export { KIND_ORDER };
