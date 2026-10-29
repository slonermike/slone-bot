import { idleBot, randomBot } from './builtin.ts';
import { runSim } from './run.ts';
import type { RunOptions, RunResult } from './run.ts';
import type { Bot, Prototype } from '../core/types.ts';

export interface SuiteResult {
  runs: RunResult[];
  flags: string[];
  summary: string[];
}

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}
function variance(xs: number[]): number {
  const m = mean(xs);
  return mean(xs.map((x) => (x - m) ** 2));
}

/**
 * Run the required bot set (idle, random, plus the prototype's own, such as "greedy" and
 * "degenerate-*") across seeds and derive flags. Judges "alive and not exploitable", never "fun".
 */
export function runSuite(create: () => Prototype, extraBots: Bot[], opts: RunOptions & { seeds?: number[] } = {}): SuiteResult {
  const seeds = opts.seeds ?? [1, 2, 3];
  const bots: Bot[] = [idleBot(), randomBot(), ...extraBots];
  const runs: RunResult[] = [];
  for (const bot of bots) {
    for (const seed of seeds) {
      runs.push(runSim(create, bot, { ...opts, seed }));
    }
  }
  const byBot = (name: string) => runs.filter((r) => r.telemetry.bot === name);
  const score = (name: string) => mean(byBot(name).map((r) => r.telemetry.metrics.scoreOrProgress ?? 0));
  const flags: string[] = [];

  for (const r of runs) {
    for (const e of r.telemetry.errors) {
      if (!e.startsWith('wall-clock cap')) flags.push(`${r.telemetry.bot} seed ${r.telemetry.seed}: ${e.split('\n')[0]}`);
    }
  }
  const idle = byBot('idle');
  if (idle.length && idle.every((r) => Object.values(r.telemetry.feel.eventsFired).reduce((a, b) => a + b, 0) === 0)) {
    flags.push('idle bot: nothing happened (no sim events). Pressure must push on an idle player.');
  }
  const greedy = byBot('greedy');
  if (greedy.length) {
    if (score('greedy') <= score('idle')) flags.push('greedy bot scored no better than idle: the main verb may not matter.');
    const g = score('greedy');
    for (const bot of bots.filter((b) => b.name.startsWith('degenerate'))) {
      if (g > 0 && score(bot.name) >= 0.8 * g) flags.push(`${bot.name} reaches ${Math.round((score(bot.name) / g) * 100)}% of greedy: possible dominant strategy.`);
    }
  } else if (extraBots.length === 0) {
    flags.push('no prototype-specific greedy bot supplied (required for every prototype).');
  }

  const summary: string[] = [];
  for (const bot of bots) {
    const rs = byBot(bot.name);
    const sc = rs.map((r) => r.telemetry.metrics.scoreOrProgress ?? 0);
    const outcomes = [...new Set(rs.map((r) => r.telemetry.outcome))].join('/');
    const deaths = mean(rs.map((r) => r.telemetry.metrics.deaths ?? 0));
    summary.push(
      `${bot.name.padEnd(22)} outcome=${outcomes} score avg ${mean(sc).toFixed(1)} var ${variance(sc).toFixed(1)} deaths ${deaths.toFixed(1)} sim ${mean(rs.map((r) => r.telemetry.simSeconds)).toFixed(0)}s wall ${mean(rs.map((r) => r.telemetry.wallMs)).toFixed(0)}ms`,
    );
  }
  const gv = greedy.length ? variance(greedy.map((r) => r.telemetry.metrics.scoreOrProgress ?? 0)) : 0;
  for (const r of greedy) r.telemetry.metrics.variance = gv;
  return { runs, flags, summary };
}
