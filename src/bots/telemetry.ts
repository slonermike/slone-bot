import type { TelemetryOutcome } from '../core/types.ts';

export interface Telemetry {
  night: string;
  seed: number;
  bot: string;
  mode: 'content' | 'systemic';
  simSeconds: number;
  wallMs: number;
  timescale: number;
  outcome: TelemetryOutcome;
  metrics: Record<string, number>;
  perf: { avgFrameMs: number; p95FrameMs: number; fps: number; particleMax: number; effectsOn: boolean };
  feel: {
    inputToVisualMs: number;
    inputToAudioMs: number;
    eventsFired: Record<string, number>;
    shakePeak: number;
    hitStopFrames: number;
  };
  errors: string[];
}

/** Metrics every run carries (0 when the prototype does not report them). */
export const STANDARD_METRICS = [
  'runLength', 'deaths', 'firstPressureSimSec', 'restartDelaySimSec', 'mainVerbCount',
  'decisionsPerMinute', 'idleSurvivalSec', 'scoreOrProgress', 'variance',
] as const;

export function emptyTelemetry(partial: Partial<Telemetry> = {}): Telemetry {
  const metrics: Record<string, number> = {};
  for (const k of STANDARD_METRICS) metrics[k] = 0;
  return {
    night: 'unknown',
    seed: 0,
    bot: 'none',
    mode: 'systemic',
    simSeconds: 0,
    wallMs: 0,
    timescale: 1,
    outcome: 'timeout',
    metrics,
    perf: { avgFrameMs: 0, p95FrameMs: 0, fps: 0, particleMax: 0, effectsOn: false },
    feel: { inputToVisualMs: 0, inputToAudioMs: 0, eventsFired: {}, shakePeak: 0, hitStopFrames: 0 },
    errors: [],
    ...partial,
  };
}

const OUTCOMES = ['completed', 'failed', 'timeout', 'crash'];

/** Returns problems; empty means the object matches the schema in docs/tech/04. */
export function validateTelemetry(t: unknown): string[] {
  const errs: string[] = [];
  if (typeof t !== 'object' || t === null) return ['telemetry must be an object'];
  const o = t as Record<string, any>;
  const num = (path: string, v: unknown) => {
    if (typeof v !== 'number' || !Number.isFinite(v)) errs.push(`${path}: finite number required`);
  };
  if (typeof o.night !== 'string') errs.push('night: string');
  num('seed', o.seed);
  if (typeof o.bot !== 'string') errs.push('bot: string');
  if (o.mode !== 'content' && o.mode !== 'systemic') errs.push('mode: content|systemic');
  num('simSeconds', o.simSeconds);
  num('wallMs', o.wallMs);
  num('timescale', o.timescale);
  if (!OUTCOMES.includes(o.outcome)) errs.push(`outcome: one of ${OUTCOMES.join('|')}`);
  if (typeof o.metrics !== 'object' || o.metrics === null) errs.push('metrics: object');
  else {
    for (const k of STANDARD_METRICS) num(`metrics.${k}`, o.metrics[k]);
    for (const [k, v] of Object.entries(o.metrics)) num(`metrics.${k}`, v);
  }
  if (typeof o.perf !== 'object' || o.perf === null) errs.push('perf: object');
  else {
    for (const k of ['avgFrameMs', 'p95FrameMs', 'fps', 'particleMax']) num(`perf.${k}`, o.perf[k]);
    if (typeof o.perf.effectsOn !== 'boolean') errs.push('perf.effectsOn: boolean');
  }
  if (typeof o.feel !== 'object' || o.feel === null) errs.push('feel: object');
  else {
    for (const k of ['inputToVisualMs', 'inputToAudioMs', 'shakePeak', 'hitStopFrames']) num(`feel.${k}`, o.feel[k]);
    if (typeof o.feel.eventsFired !== 'object' || o.feel.eventsFired === null) errs.push('feel.eventsFired: object');
  }
  if (!Array.isArray(o.errors)) errs.push('errors: array');
  return errs;
}
