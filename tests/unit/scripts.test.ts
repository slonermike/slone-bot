import { describe, expect, it } from 'vitest';
import * as secrets from '../../scripts/check-secrets.mjs';
import * as night from '../../scripts/night-state.mjs';

const { scanText } = secrets as any;
const { gate, parseAtoms, parseLedgerPairs, pickAtoms, parseState, formatState } = night as any;

// Fake credentials are assembled at runtime so this file never trips the repo's own secret scan.
const fake = {
  aws: 'AK' + 'IA' + 'ABCDEFGHIJKLMNOP',
  gh: 'gh' + 'p_' + 'a'.repeat(36),
  key: '-----BEGIN ' + 'RSA PRIVATE KEY-----',
  cred: 'api_key = "' + 'x'.repeat(24) + '"',
  url: 'https://user:' + 'hunter22' + '@example.com/x',
};

describe('check-secrets', () => {
  it('flags obvious secret patterns', () => {
    for (const [k, v] of Object.entries(fake)) expect(scanText(`x ${v} y`).length, k).toBeGreaterThan(0);
  });
  it('flags personal emails but allows noreply addresses', () => {
    expect(scanText('contact me at someone' + '@gmail.com').length).toBe(1);
    expect(scanText('Co-Authored-By: Claude <noreply' + '@anthropic.com>').length).toBe(0);
  });
  it('passes normal code and docs', () => {
    expect(scanText('const token = nextToken(); // not a secret\nconsole.log("hello")')).toEqual([]);
  });
});

describe('night-state', () => {
  it('gates at 3:00 and 3:30', () => {
    expect(gate(179)).toBe('OK');
    expect(gate(180)).toBe('WRAP-UP');
    expect(gate(210)).toBe('PENCILS-DOWN');
  });
  it('round-trips the state file', () => {
    const s = { night: 'n', started: '2030-01-01T00:00:00.000Z', phase: 'core', branch: 'proto/n', brief: 'b.md', lastGoodBuild: 'abc', notes: ['one', 'two'] };
    expect(parseState(formatState(s).replace(/```/g, ''))).toMatchObject(s);
  });
  it('picks two atoms, avoiding ledger pairings', () => {
    const lib = '- `v-a`: x\n- `v-b`: y\n- `p-c`: z\n- `p-d`: w\n';
    const atoms = parseAtoms(lib);
    expect(atoms).toEqual(['v-a', 'v-b', 'p-c', 'p-d']);
    const ledger = '2030-01-01 | s | systemic | atoms: v-a, p-c | theme: x | wildcard: none | verdict: pending';
    const pairs = parseLedgerPairs(ledger);
    expect(pairs).toEqual([['v-a', 'p-c']]);
    for (let seed = 0; seed < 50; seed++) {
      const p = pickAtoms(atoms, pairs, seed);
      expect(p[0]).not.toBe(p[1]);
      expect([...p].sort().join()).not.toBe('p-c,v-a');
    }
  });
});
