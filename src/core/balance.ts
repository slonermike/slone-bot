import type { BalanceSpec } from './types.ts';

/** Balance values: defaults from the spec, then saved values, then URL overrides. Pure apart from localStorage (try/catch). */
export function defaultsOf(spec: readonly BalanceSpec[] | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of spec ?? []) out[s.id] = s.default;
  return out;
}

/** Snap a value to the spec's step and clamp it to its range. */
export function clampValue(s: BalanceSpec, v: number): number {
  const snapped = Math.round((v - s.min) / s.step) * s.step + s.min;
  const clamped = Math.min(s.max, Math.max(s.min, snapped));
  return Math.round(clamped * 1000) / 1000;
}

/** Merge override maps over the defaults, ignoring unknown ids and non-numbers. */
export function mergeBalance(spec: readonly BalanceSpec[] | undefined, ...overrides: (Record<string, number> | undefined)[]): Record<string, number> {
  const out = defaultsOf(spec);
  for (const o of overrides) {
    if (!o) continue;
    for (const s of spec ?? []) {
      const v = o[s.id];
      if (typeof v === 'number' && Number.isFinite(v)) out[s.id] = clampValue(s, v);
    }
  }
  return out;
}

/** `?balance=heatRamp:0.3,lives:5` */
export function parseBalanceParam(text: string | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  for (const part of (text ?? '').split(',')) {
    const [k, v] = part.split(':');
    const n = Number(v);
    if (k && Number.isFinite(n)) out[k.trim()] = n;
  }
  return out;
}

const key = (slug: string) => `mgb.balance.v1.${slug}`;

export function loadBalance(slug: string): Record<string, number> {
  try {
    const raw = localStorage.getItem(key(slug));
    return raw ? (JSON.parse(raw) as Record<string, number>) : {};
  } catch {
    return {};
  }
}

export function saveBalance(slug: string, values: Record<string, number>): void {
  try {
    localStorage.setItem(key(slug), JSON.stringify(values));
  } catch {
    /* values still work for this session */
  }
}

export function clearBalance(slug: string): void {
  try {
    localStorage.removeItem(key(slug));
  } catch {
    /* ignore */
  }
}

export function formatValue(s: BalanceSpec, v: number): string {
  const decimals = s.step < 1 ? String(s.step).split('.')[1]?.length ?? 1 : 0;
  return `${v.toFixed(decimals)}${s.unit ?? ''}`;
}

/** Plain text Slone can paste into chat: the game, and each value with its default. */
export function balanceToText(slug: string, spec: readonly BalanceSpec[], values: Record<string, number>): string {
  const lines = spec.map((s) => `  ${s.id}: ${values[s.id]}   (default ${s.default}, ${s.label})`);
  return `BALANCE for ${slug}\n${lines.join('\n')}`;
}
