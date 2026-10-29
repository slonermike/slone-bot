import { describe, expect, it } from 'vitest';
import { parseAttribution } from '../../src/core/attribution.ts';
import { blankInput, Coyote, expandBotInput, InputBuffer, shapeStick } from '../../src/core/input-state.ts';
import { DT, FixedStepper } from '../../src/core/loop.ts';
import { validateManifest } from '../../src/core/manifest.ts';
import { Rng } from '../../src/core/rng.ts';
import { __setTrackSink, track } from '../../src/core/track.ts';
import { ease, chase, lerpColor } from '../../src/juice/ease.ts';
import { Trauma } from '../../src/juice/shake.ts';
import { JuiceDial } from '../../src/juice/dial.ts';
import { peakOf, renderSfx, rmsOf } from '../../src/audio/sfxr.ts';
import { DEFAULT_SOUNDS } from '../../src/audio/sounds.ts';
import type { ButtonName } from '../../src/core/types.ts';

describe('Rng', () => {
  it('is deterministic per seed and differs across seeds', () => {
    const a = new Rng(7), b = new Rng(7), c = new Rng(8);
    const sa = Array.from({ length: 5 }, () => a.next());
    expect(sa).toEqual(Array.from({ length: 5 }, () => b.next()));
    expect(sa).not.toEqual(Array.from({ length: 5 }, () => c.next()));
  });
  it('range/int stay in bounds', () => {
    const r = new Rng(1);
    for (let i = 0; i < 1000; i++) {
      const v = r.int(3, 6);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(6);
      const f = r.range(-1, 1);
      expect(f).toBeGreaterThanOrEqual(-1);
      expect(f).toBeLessThan(1);
    }
  });
});

describe('FixedStepper', () => {
  it('runs whole fixed steps and interpolates the remainder', () => {
    const s = new FixedStepper();
    const r = s.advance(DT * 2.5);
    expect(r.steps).toBe(2);
    expect(r.alpha).toBeCloseTo(0.5, 5);
  });
  it('clamps a hitch instead of spiraling', () => {
    expect(new FixedStepper().advance(5).steps).toBeLessThanOrEqual(5);
  });
  it('hit-stop skips steps without changing dt', () => {
    const s = new FixedStepper();
    s.hitStop(3);
    const r = s.advance(DT * 5);
    expect(r.frozen).toBe(3);
    expect(r.steps).toBe(2);
    expect(s.dt).toBe(DT);
  });
  it('timescale runs more fixed steps, never bigger ones', () => {
    const s = new FixedStepper();
    s.timescale = 4;
    expect(s.advance(DT).steps).toBe(4);
    expect(s.dt).toBe(DT);
  });
});

describe('input helpers', () => {
  it('shapeStick applies dead zone and clamps to the unit circle', () => {
    expect(shapeStick(0.1, 0.05)).toEqual({ x: 0, y: 0 });
    const v = shapeStick(1, 1);
    expect(Math.hypot(v.x, v.y)).toBeLessThanOrEqual(1.0001);
    expect(shapeStick(0.6, 0, { deadzone: 0.2 }).x).toBeCloseTo(0.5, 5);
  });
  it('expandBotInput derives press and release edges', () => {
    const held = new Set<ButtonName>();
    let next = new Set<ButtonName>();
    let s = expandBotInput({ hold: ['a'] }, held, next);
    expect(s.buttons.a.pressed).toBe(true);
    s = expandBotInput({ hold: ['a'] }, next, (next = new Set()));
    expect(s.buttons.a.pressed).toBe(false);
    expect(s.buttons.a.down).toBe(true);
    const prev = new Set<ButtonName>(['a']);
    s = expandBotInput({}, prev, new Set());
    expect(s.buttons.a.released).toBe(true);
    expect(blankInput().buttons.start.down).toBe(false);
  });
  it('InputBuffer and Coyote work in sim steps', () => {
    const b = new InputBuffer(3);
    b.press();
    b.step(); b.step();
    expect(b.consume()).toBe(true);
    expect(b.consume()).toBe(false);
    b.press();
    for (let i = 0; i < 4; i++) b.step();
    expect(b.consume()).toBe(false);
    const c = new Coyote(2);
    c.ground();
    c.step();
    expect(c.active).toBe(true);
    c.step();
    expect(c.active).toBe(false);
  });
});

describe('juice math', () => {
  it('ease curves hit 0 and 1 at the ends', () => {
    for (const [name, fn] of Object.entries(ease)) {
      expect(fn(0), name).toBeCloseTo(0, 5);
      expect(fn(1), name).toBeCloseTo(1, 5);
    }
    expect(ease.outBack(0.8)).toBeGreaterThan(1);
  });
  it('chase closes a fraction of the distance', () => {
    expect(chase(0, 100, 0.25)).toBe(25);
    expect(lerpColor(0x000000, 0xffffff, 0.5)).toBe(0x808080);
  });
  it('trauma decays and the felt shake is trauma squared with capped amplitude', () => {
    const t = new Trauma();
    t.add(5);
    expect(t.value).toBe(1);
    let max = 0;
    for (let i = 0; i < 200; i++) { const s = t.sample(i / 60); max = Math.max(max, Math.abs(s.x), Math.abs(s.y)); }
    expect(max).toBeLessThanOrEqual(t.maxOffset + 1e-6);
    t.update(10);
    expect(t.value).toBe(0);
    expect(t.sample(1)).toEqual({ x: 0, y: 0, rot: 0 });
  });
  it('the juice dial scales by layer and intensity', () => {
    const d = new JuiceDial();
    expect(d.scale('shake', 1)).toBe(1);
    d.set('shake', false);
    expect(d.scale('shake', 1)).toBe(0);
    d.setIntensity(0.5);
    expect(d.scale('flash', 1)).toBe(0.5);
    d.applyParams({ juice: 'off' });
    expect(d.activeLayers()).toHaveLength(0);
  });
});

describe('audio synthesis', () => {
  it('every default sound is audible, not clipping, and finite', () => {
    for (const [name, def] of Object.entries(DEFAULT_SOUNDS)) {
      for (const p of Array.isArray(def) ? def : [def]) {
        const s = renderSfx(p);
        expect(s.length, name).toBeGreaterThan(100);
        expect(peakOf(s), `${name} peak`).toBeLessThanOrEqual(0.99);
        expect(rmsOf(s), `${name} rms`).toBeGreaterThan(0.01);
        expect(s.every(Number.isFinite), name).toBe(true);
      }
    }
  });
  it('is deterministic', () => {
    const p = DEFAULT_SOUNDS.hit;
    const one = Array.isArray(p) ? p[0]! : p!;
    expect(Array.from(renderSfx(one))).toEqual(Array.from(renderSfx(one)));
  });
});

describe('manifest and attribution', () => {
  const good = {
    slug: '2026-10-30-name', title: 'Name', date: '2026-10-30', question: 'q', targetFeeling: 'f', mode: 'systemic', tags: [], theme: 't',
    wildcard: null, juiceLayers: [], metrics: [], assets: [], buildStatus: 'ok', feedbackStatus: 'needs-feedback', sizeKB: 1, thumbnail: 'thumb.png',
  };
  it('accepts a valid manifest', () => expect(validateManifest(good)).toEqual([]));
  it('allows an optional preview and rejects a non-string one', () => {
    expect(validateManifest({ ...good, preview: 'preview.gif' })).toEqual([]);
    expect(validateManifest({ ...good, preview: 3 }).join()).toMatch(/preview/);
  });
  it('rejects bad fields and disallowed asset licenses', () => {
    expect(validateManifest({ ...good, mode: 'x' }).join()).toMatch(/mode/);
    expect(validateManifest({ ...good, date: 'yesterday' }).join()).toMatch(/date/);
    expect(validateManifest({ ...good, slug: 'Bad Slug' }).join()).toMatch(/slug/);
    const asset = { file: 'x.wav', source: 'https://x', license: 'CC-BY-NC', date: '2026-10-30' };
    expect(validateManifest({ ...good, assets: [asset] }).join()).toMatch(/allowlist/);
    expect(validateManifest({ ...good, assets: [{ ...asset, license: 'CC0' }] })).toEqual([]);
  });
  it('parses ATTRIBUTION.md tables', () => {
    const s = parseAttribution('# T\nintro\n\n## Deps\n| A | B |\n|---|---|\n| 1 | 2 |\n');
    expect(s[1]!.heading).toBe('Deps');
    expect(s[1]!.table).toEqual({ head: ['A', 'B'], rows: [['1', '2']] });
  });
});

describe('track', () => {
  it('is a no-op by default and forwards only to a test sink', () => {
    expect(() => track('x', { a: 1 })).not.toThrow();
    const calls: string[] = [];
    __setTrackSink((e) => calls.push(e));
    track('hello');
    __setTrackSink(null);
    expect(calls).toEqual(['hello']);
  });
});

describe('glyphs', () => {
  it('labels follow the device', async () => {
    const g = await import('../../src/core/glyphs.ts');
    expect(g.glyph('a', 'gamepad')).toBe('A');
    expect(g.glyph('a', 'keyboard')).toBe('Space');
    expect(g.glyph('start', 'keyboard')).toBe('Esc');
    expect(g.stickGlyph('left', 'gamepad')).toBe('Left stick');
    expect(g.stickGlyph('left', 'keyboard')).toMatch(/WASD/);
  });
  it('notifies on change only, and maps Escape to start, Enter to A, Backspace to B', async () => {
    const g = await import('../../src/core/glyphs.ts');
    const seen: string[] = [];
    const off = g.onDeviceChange((d) => seen.push(d));
    g.setDevice('gamepad');
    g.setDevice('gamepad');
    g.setDevice('keyboard');
    off();
    expect(seen).toEqual(['gamepad', 'keyboard']);
    expect(g.KEY_BUTTONS.Escape).toBe('start');
    expect(g.KEY_BUTTONS.Enter).toBe('a');
    expect(g.KEY_BUTTONS.Backspace).toBe('b');
  });
});
