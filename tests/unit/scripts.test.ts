import { describe, expect, it } from 'vitest';
import * as secrets from '../../scripts/check-secrets.mjs';
import * as night from '../../scripts/night-state.mjs';

const { scanText } = secrets as any;
const { gate, countRounds, doneBlockers, parseAtoms, parseLedgerPairs, pickAtoms, parseState, formatState } = night as any;

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
  it('gates at 1:15 and 1:30', () => {
    expect(gate(74)).toBe('OK');
    expect(gate(75)).toBe('WRAP-UP');
    expect(gate(90)).toBe('PENCILS-DOWN');
  });
  it('counts rounds and step-backs, and blocks finishing early without them', () => {
    const notes = ['0:10 phase=brief', '0:20 round 1: played | boring start | added a ramp', '0:35 round 2: a | b | c', '0:50 stepback 1: arc is flat | cut X'];
    expect(countRounds(notes)).toEqual({ rounds: 2, stepbacks: 1 });
    expect(doneBlockers(20, [])).toEqual(['only 0:20 elapsed (need 1:00)', '0 of 3 rounds logged', 'no step-back logged']);
    expect(doneBlockers(70, notes)).toEqual(['2 of 3 rounds logged']);
    expect(doneBlockers(70, [...notes, '1:00 round 3: x | y | z'])).toEqual([]);
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

describe('host version guard', () => {
  it('fails a host change that keeps the version, passes a bump or a test/doc-only change', async () => {
    const { hostVersionProblem, isNewer } = await import('../../scripts/check-host-version.mjs');
    expect(isNewer('0.2.3', '0.2.2')).toBe(true);
    expect(isNewer('0.10.0', '0.9.9')).toBe(true);
    expect(isNewer('0.2.2', '0.2.2')).toBe(false);
    expect(hostVersionProblem(['host/main.cjs'], '0.2.2', '0.2.2')).toMatch(/bump/);
    expect(hostVersionProblem(['host/main.cjs', 'host/package.json'], '0.2.2', '0.2.3')).toBeNull();
    expect(hostVersionProblem(['host/README.md', 'host/test/config.test.cjs'], '0.2.2', '0.2.2')).toBeNull();
    expect(hostVersionProblem(['src/core/shell.ts'], '0.2.2', '0.2.2')).toBeNull();
  });
});

describe('run key', () => {
  it('keys a run by its start stamp, so two runs on one day differ; falls back to the date', async () => {
    const fs = await import('node:fs');
    const os = await import('node:os');
    const path = await import('node:path');
    const { runKey } = await import('../../scripts/run-key.mjs');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'runkey-'));
    const a = path.join(dir, 'a.md');
    const b = path.join(dir, 'b.md');
    fs.writeFileSync(a, '```\nnight: x\nstarted: 2030-01-01T03:00:00.000Z\n```\n');
    fs.writeFileSync(b, '```\nnight: y\nstarted: 2030-01-01T09:30:12.000Z\n```\n');
    expect(runKey(a)).toBe('2030-01-01T03:00:00');
    expect(runKey(b)).toBe('2030-01-01T09:30:12');
    expect(runKey(path.join(dir, 'missing.md'), new Date('2030-01-02T05:00:00Z'))).toBe('2030-01-02');
  });
});

describe('genre roll', () => {
  it('needs 3 to 5 distinct genres, is deterministic, and every option can win', async () => {
    const { pickGenre } = await import('../../scripts/night-state.mjs');
    expect(() => pickGenre(['a', 'b'], [], 1)).toThrow(/3 to 5/);
    expect(() => pickGenre(['a', 'A ', 'b'], [], 1)).toThrow(/3 to 5/); // duplicates collapse
    expect(() => pickGenre(['a', 'b', 'c', 'd', 'e', 'f'], [], 1)).toThrow(/3 to 5/);
    const opts = ['Tower Defense', 'rhythm game', 'Roguelike', 'puzzle platformer'];
    const a = pickGenre(opts, [], 7);
    expect(pickGenre(opts, [], 7)).toEqual(a);
    expect(a.options).toContain(a.genre);
    const seen = new Set<string>();
    for (let seed = 1; seed <= 60; seed++) seen.add(pickGenre(opts, [], seed).genre);
    expect(seen.size).toBe(4); // so the agent cannot steer toward a favorite
  });

  it('skips genres used in the last three nights, unless every option was', async () => {
    const { pickGenre, parseLedgerGenres } = await import('../../scripts/night-state.mjs');
    const ledger = [
      '2030-01-01 | a | systemic | atoms: v-a, p-c | theme: x | wildcard: none | genre: Tower Defense | look: a/b/c | verdict: pending',
      '2030-01-02 | b | systemic | atoms: v-a, p-d | theme: x | wildcard: none | genre: roguelike | look: a/b/c | verdict: pending',
    ].join('\n');
    const recent = parseLedgerGenres(ledger);
    expect(recent).toEqual(['tower defense', 'roguelike']);
    for (let seed = 1; seed <= 40; seed++) {
      const r = pickGenre(['tower defense', 'roguelike', 'rhythm game', 'card battler'], recent, seed);
      expect(['rhythm game', 'card battler']).toContain(r.genre);
      expect(r.repeated).toBe(false);
    }
    expect(pickGenre(['tower defense', 'roguelike', 'x'], ['x', 'tower defense', 'roguelike'], 3).repeated).toBe(true);
  });
});
