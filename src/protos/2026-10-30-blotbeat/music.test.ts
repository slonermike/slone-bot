import { describe, expect, it } from 'vitest';
import { partsFor } from './music.ts';

describe('partsFor', () => {
  it('starts bare and adds layers by set', () => {
    expect(partsFor(0, 0, false)).toEqual(['pad', 'bass']);
    expect(partsFor(1, 0, false)).toContain('drums');
    expect(partsFor(2, 0, false)).toContain('arp');
  });
  it('ink adds tension layers even in the first set', () => {
    expect(partsFor(0, 2, false)).toContain('arp');
    expect(partsFor(0, 3, false)).toContain('riff');
  });
  it('holds the hook back for the fever only', () => {
    expect(partsFor(3, 3, false)).not.toContain('lead');
    expect(partsFor(3, 0, true)).toContain('lead');
    expect(partsFor(0, 0, true)).not.toContain('harmony');
  });
  it('calm is just pad and bass', () => {
    expect(partsFor(3, 3, true, true)).toEqual(['pad', 'bass']);
  });
});
