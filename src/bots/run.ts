import { expandBotInput, blankInput } from '../core/input-state.ts';
import { DT } from '../core/loop.ts';
import { Rng } from '../core/rng.ts';
import type { Bot, BotInput, ButtonName, Ctx, Observation, Prototype, SimEvent } from '../core/types.ts';
import { emptyTelemetry } from './telemetry.ts';
import type { Telemetry } from './telemetry.ts';

export interface RunOptions {
  seed?: number;
  night?: string;
  /** Stop after this many sim seconds (outcome "timeout"). Default 120. */
  maxSimSeconds?: number;
  /** Stop after this much wall time. Default 20000. */
  maxWallMs?: number;
  /** Fixed steps per tick (timescale). Never changes DT. Default 20. */
  stepsPerTick?: number;
  params?: Record<string, string>;
}

export interface RunResult {
  telemetry: Telemetry;
  /** Run-length-encoded bot inputs: [tick, input] whenever the input changed. Replayable. */
  inputLog: [number, BotInput][];
  /** Compact state snapshots every 5 sim seconds, for debugging and replays. */
  samples: { t: number; telemetry: Record<string, number> }[];
}

export function makeCtx(seed: number, params: Record<string, string> = {}): { ctx: Ctx; tick: () => void } {
  let steps = 0;
  const ctx: Ctx = {
    seed,
    dt: DT,
    rng: new Rng(seed),
    vfxRng: new Rng(seed ^ 0xa5a5a5a5),
    time: {
      get steps() { return steps; },
      get seconds() { return steps * DT; },
    },
    params,
  };
  return { ctx, tick: () => { steps++; } };
}

function observe(p: Prototype): Observation {
  const s = p.getState?.();
  if (s && typeof s === 'object') return s as Observation;
  return p.telemetry();
}

function inputEq(a: BotInput, b: BotInput): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Run a prototype's sim headlessly with a bot: no rendering, no DOM, no audio.
 * Steps are always the fixed DT; "timescale" is just how many run per tick.
 * A sim emitting event type "complete" ends the run as completed; "gameover" as failed.
 */
export function runSim(create: () => Prototype, bot: Bot, opts: RunOptions = {}): RunResult {
  const seed = opts.seed ?? 1;
  const maxSteps = Math.floor((opts.maxSimSeconds ?? 120) / DT);
  const maxWall = opts.maxWallMs ?? 20000;
  const perTick = opts.stepsPerTick ?? 20;
  const started = Date.now();
  const proto = create();
  const { ctx, tick } = makeCtx(seed, opts.params);
  const errors: string[] = [];
  const eventsFired: Record<string, number> = {};
  const inputLog: [number, BotInput][] = [];
  const samples: RunResult['samples'] = [];
  let outcome: Telemetry['outcome'] = 'timeout';
  let held = new Set<ButtonName>();
  let nextHeld = new Set<ButtonName>();
  let last: BotInput | null = null;
  let steps = 0;

  try {
    proto.init(ctx);
    bot.reset(seed);
    outer: while (steps < maxSteps) {
      if (Date.now() - started > maxWall) {
        errors.push(`wall-clock cap ${maxWall}ms hit at sim ${(steps * DT).toFixed(1)}s`);
        break;
      }
      for (let i = 0; i < perTick && steps < maxSteps; i++) {
        const botIn = bot.act(observe(proto), steps);
        if (!last || !inputEq(last, botIn)) {
          inputLog.push([steps, botIn]);
          last = botIn;
        }
        nextHeld = new Set();
        const input = expandBotInput(botIn, held, nextHeld);
        [held, nextHeld] = [nextHeld, held];
        proto.step(DT, input);
        tick();
        steps++;
        for (const e of proto.events() as SimEvent[]) {
          eventsFired[e.type] = (eventsFired[e.type] ?? 0) + 1;
          if (e.type === 'complete') outcome = 'completed';
          if (e.type === 'gameover') outcome = 'failed';
        }
        if (outcome !== 'timeout') break outer;
        if (steps % 300 === 0) samples.push({ t: steps * DT, telemetry: { ...proto.telemetry() } });
      }
      const bad = findNonFinite(proto.telemetry());
      if (bad) {
        errors.push(`non-finite telemetry value: ${bad}`);
        outcome = 'crash';
        break;
      }
    }
  } catch (e) {
    outcome = 'crash';
    errors.push(e instanceof Error ? `${e.message}\n${(e.stack ?? '').split('\n').slice(1, 4).join('\n')}` : String(e));
  } finally {
    try { proto.dispose?.(); } catch { /* ignore */ }
  }

  const wallMs = Date.now() - started;
  const simSeconds = steps * DT;
  let metrics: Record<string, number> = {};
  try { metrics = { ...proto.telemetry() }; } catch { /* crashed prototype */ }
  const t = emptyTelemetry({
    night: opts.night ?? proto.meta?.slug ?? 'unknown',
    seed,
    bot: bot.name,
    mode: proto.meta?.mode ?? 'systemic',
    simSeconds: round(simSeconds),
    wallMs,
    timescale: perTick,
    outcome,
    errors,
  });
  for (const [k, v] of Object.entries(metrics)) t.metrics[k] = Number.isFinite(v) ? v : 0;
  if (!('runLength' in metrics)) t.metrics.runLength = round(simSeconds);
  t.feel.eventsFired = eventsFired;
  return { telemetry: t, inputLog, samples };
}

/** Re-run a recorded input log at 1 step per tick; returns final telemetry metrics for comparison. */
export function replay(create: () => Prototype, seed: number, inputLog: [number, BotInput][], steps: number, params?: Record<string, string>): Record<string, number> {
  const proto = create();
  const { ctx, tick } = makeCtx(seed, params);
  proto.init(ctx);
  let idx = 0;
  let cur: BotInput = {};
  let held = new Set<ButtonName>();
  for (let s = 0; s < steps; s++) {
    while (idx < inputLog.length && inputLog[idx]![0] <= s) cur = inputLog[idx++]![1];
    const next = new Set<ButtonName>();
    const input = expandBotInput(cur, held, next);
    held = next;
    proto.step(DT, input);
    tick();
    proto.events();
  }
  const m = { ...proto.telemetry() };
  proto.dispose?.();
  return m;
}

function findNonFinite(m: Record<string, number>): string | null {
  for (const [k, v] of Object.entries(m)) if (typeof v !== 'number' || !Number.isFinite(v)) return k;
  return null;
}

const round = (n: number) => Math.round(n * 100) / 100;

export { blankInput };
