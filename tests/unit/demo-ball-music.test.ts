import { describe, expect, it } from 'vitest';
import { buildDemoMusic, partsFor } from '../../src/protos/2026-10-29-demo-ball/music.ts';

describe('the demo game music', () => {
  const m = buildDemoMusic();
  it('is a hook loop with every part, and two stingers in the same key', () => {
    expect(m.loop.form).toBe('loop');
    for (const inst of ['pad', 'bass', 'drums', 'arp', 'lead', 'harmony']) expect(m.loop.tracks.some((t) => t.inst === inst)).toBe(true);
    expect(m.loop.hookBars.length).toBeGreaterThanOrEqual(2);
    for (const st of [m.powerup, m.lose]) {
      expect(st.form).toBe('oneshot');
      expect(st.bars.length).toBeLessThanOrEqual(4);
      expect(st.root).toBe(m.loop.root);
      expect(st.scale).toBe(m.loop.scale);
    }
  });
  it('is deterministic', () => {
    expect(buildDemoMusic()).toEqual(m);
  });
  it('brings parts in with pressure and earns the hook with the surge', () => {
    expect(partsFor(1, false)).toEqual(['pad', 'bass']);
    expect(partsFor(2, false)).toContain('drums');
    expect(partsFor(3, false)).toContain('arp');
    expect(partsFor(3, false)).not.toContain('lead');
    expect(partsFor(1, true)).toEqual(expect.arrayContaining(['lead', 'harmony']));
    expect(partsFor(4, true).length).toBeGreaterThan(partsFor(1, true).length);
  });
});
