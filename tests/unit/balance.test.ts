import { describe, expect, it } from 'vitest';
import { balanceToText, clampValue, defaultsOf, formatValue, mergeBalance, parseBalanceParam } from '../../src/core/balance.ts';
import type { BalanceSpec } from '../../src/core/types.ts';

// a sample spec, independent of any game
const BALANCE: BalanceSpec[] = [
  { id: 'heatRamp', label: 'Heat ramp (faster each second)', min: 0, max: 0.6, step: 0.02, default: 0.2 },
  { id: 'surgeSeconds', label: 'Surge length', min: 2, max: 10, step: 0.5, default: 5, unit: 's' },
  { id: 'lives', label: 'Lives (next run)', min: 1, max: 6, step: 1, default: 3 },
];

describe('balance helpers', () => {
  it('defaults, clamping, step snapping, and unknown ids', () => {
    const spec = BALANCE;
    expect(defaultsOf(spec).lives).toBe(3);
    const heat = spec.find((s) => s.id === 'heatRamp')!;
    expect(clampValue(heat, 9)).toBe(0.6);
    expect(clampValue(heat, -1)).toBe(0);
    expect(clampValue(heat, 0.31)).toBe(0.32);
    const merged = mergeBalance(spec, { lives: 5, nope: 3, heatRamp: Number.NaN });
    expect(merged.lives).toBe(5);
    expect(merged.heatRamp).toBe(0.2);
    expect('nope' in merged).toBe(false);
  });
  it('parses the URL override and formats values', () => {
    expect(parseBalanceParam('lives:5, heatRamp:0.3,bad,x:y')).toEqual({ lives: 5, heatRamp: 0.3 });
    const s = BALANCE.find((b) => b.id === 'surgeSeconds')!;
    expect(formatValue(s, 5)).toBe('5.0s');
    expect(balanceToText('fixture', BALANCE, defaultsOf(BALANCE))).toMatch(/BALANCE for fixture[\s\S]*lives: 3/);
  });
});
