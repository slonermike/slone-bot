import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { runSim } from '../../src/bots/index.ts';
import { validateTelemetry } from '../../src/bots/telemetry.ts';
import { bots, createPrototype } from '../fixtures/minimal-proto.ts';

const ROOT = path.resolve(__dirname, '../..');
const fixture = fs.readFileSync(path.join(ROOT, 'tests/fixtures/minimal-proto.ts'), 'utf8');
const doc = fs.readFileSync(path.join(ROOT, 'docs/tech/SCAFFOLD_API.md'), 'utf8');

describe('the documented minimal prototype', () => {
  it('is valid: the greedy bot scores, idle does not, telemetry validates', () => {
    const greedy = runSim(createPrototype, bots[0]!, { seed: 1, maxSimSeconds: 20 });
    const idle = runSim(createPrototype, { name: 'idle', reset() {}, act: () => ({}) }, { seed: 1, maxSimSeconds: 20 });
    expect(validateTelemetry(greedy.telemetry)).toEqual([]);
    expect(greedy.telemetry.metrics.reached).toBeGreaterThan(3);
    expect(idle.telemetry.metrics.reached).toBe(0);
    expect(greedy.telemetry.balance?.speed).toBe(420);
  });

  it('is embedded verbatim in SCAFFOLD_API.md so the docs cannot drift from working code', () => {
    // inside a prototype folder the imports are one level shallower than in tests/fixtures
    const asDocumented = fixture.replaceAll("'../../src/", "'../../");
    expect(doc).toContain(asDocumented.trim());
  });
});
