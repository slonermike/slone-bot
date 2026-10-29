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

describe('look roll', () => {
  it('is deterministic per seed, varied across seeds, and never the demo look', async () => {
    const { pickLook, DEMO_LOOK, PALETTES, SHAPES, RENDERINGS } = await import('../../scripts/looks.mjs');
    expect(pickLook([], 5)).toEqual(pickLook([], 5));
    const seen = new Set<string>();
    for (let seed = 1; seed <= 60; seed++) {
      const l = pickLook([], seed);
      seen.add(`${l.palette}/${l.shapes}/${l.rendering}`);
      expect(l.palette in PALETTES && l.shapes in SHAPES && l.rendering in RENDERINGS).toBe(true);
      const like = (['palette', 'shapes', 'rendering'] as const).filter((d) => l[d] === (DEMO_LOOK as any)[d]).length;
      expect(like).toBeLessThan(2);
    }
    expect(seen.size).toBeGreaterThan(40);
  });

  it('avoids the palette, shapes and rendering of the last three nights', async () => {
    const { pickLook, parseLedgerLooks } = await import('../../scripts/looks.mjs');
    const ledger = [
      '2030-01-01 | a | systemic | atoms: v-a, p-c | theme: x | wildcard: none | look: paper/thin lines/flat fills | verdict: pending',
      '2030-01-02 | b | systemic | atoms: v-a, p-d | theme: x | wildcard: none | look: candy/rounded cards/soft gradients | verdict: pending',
      '2030-01-03 | c | systemic | atoms: v-b, p-c | theme: x | wildcard: none | look: earth/pixel blocks/dithered | verdict: pending',
    ].join('\n');
    const hist = parseLedgerLooks(ledger);
    expect(hist).toHaveLength(3);
    expect(hist[0]).toEqual({ palette: 'paper', shapes: 'thin lines', rendering: 'flat fills' });
    for (let seed = 1; seed <= 80; seed++) {
      const l = pickLook(hist, seed);
      for (const h of hist) {
        expect(l.palette).not.toBe(h.palette);
        expect(l.shapes).not.toBe(h.shapes);
        expect(l.rendering).not.toBe(h.rendering);
      }
    }
  });
});

describe('build-site index', () => {
  it('leaves smoke-test fixtures (slugs starting _) out of index.json unless --fixtures is passed', async () => {
    const fs2 = await import('node:fs');
    const os2 = await import('node:os');
    const path2 = await import('node:path');
    const { execFileSync } = await import('node:child_process');
    const out = fs2.mkdtempSync(path2.join(os2.tmpdir(), 'site-'));
    const manifest = (slug: string) => ({ slug, title: slug, date: '2030-01-01', question: 'q', targetFeeling: 'f', mode: 'systemic', tags: [], theme: 't', wildcard: null, juiceLayers: [], metrics: [], assets: [], buildStatus: 'ok', feedbackStatus: 'needs-feedback', sizeKB: 1, thumbnail: '' });
    for (const slug of ['_old-fixture', '2030-01-01-real']) {
      fs2.mkdirSync(path2.join(out, 'p', slug), { recursive: true });
      fs2.writeFileSync(path2.join(out, 'p', slug, 'prototype.json'), JSON.stringify(manifest(slug)));
    }
    const root = path2.resolve(__dirname, '../..');
    const slugs = (extra: string[]) => {
      execFileSync('node', ['scripts/build-site.mjs', '--out', out, '--no-launcher', '--protos', 'none', ...extra], { cwd: root, stdio: 'pipe' });
      return JSON.parse(fs2.readFileSync(path2.join(out, 'index.json'), 'utf8')).prototypes.map((p: any) => p.slug).sort();
    };
    expect(slugs([])).toEqual(['2030-01-01-real']);
    expect(slugs(['--fixtures'])).toEqual(['2030-01-01-real', '_old-fixture']);
  });
});
