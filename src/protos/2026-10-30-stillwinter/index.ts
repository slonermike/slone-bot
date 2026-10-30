// Stillwinter: render, juice and audio. The sim (sim.ts) is pure; everything here reacts to its events.
import { Container, Graphics, Sprite, Text, Texture } from 'pixi.js';
import { glyph, getDevice } from '../../core/index.ts';
import { play, defineSound } from '../../audio/index.ts';
import { music } from '../../audio/music.ts';
import { tween, ease, shake, hitStop, flash, punch, Particles, numberPop, chaseDt, vfxRange, Trail } from '../../juice/index.ts';
import type { Prototype, SimEvent, View, Ctx, InputState } from '../../core/types.ts';
import { createSim, BALANCE, SPIRE, KINDS, N, ENEMY, ENEMY_BLURB, pathAt, type Kind, type EnemyKind, type Sim, type Spire, type Enemy } from './sim.ts';
import { bots } from './bots.ts';
import { composeMusic, partsFor, type MusicSet } from './music.ts';

export { bots };

// ---------------------------------------------------------------- look: arctic / stars and spikes / dithered / faux isometric
const C = { ice: 0xeaf4fb, frost: 0x9cc7e6, mid: 0x5e8fb5, deep: 0x3a5370, slate: 0x243447, night: 0x131d2a, orange: 0xff8a2b, glow: 0xffc27a };
const TW = 112;
const TH = 56;
const OX = 640;
const OY = 214;
const sx = (gx: number, gy: number): number => OX + ((gx - gy) * TW) / 2;
const sy = (gx: number, gy: number): number => OY + ((gx + gy) * TH) / 2;
const css = (c: number): string => `#${c.toString(16).padStart(6, '0')}`;
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const FONT = 'system-ui, "Segoe UI", Roboto, sans-serif';

function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): Texture {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const g = cv.getContext('2d')!;
  draw(g);
  return Texture.from(cv);
}

/** A two-colour Bayer-dithered diamond (an isometric tile). */
function ditherDiamond(w: number, h: number, a: number, b: number, level: number, block = 3): Texture {
  return canvasTexture(w, h, (g) => {
    for (let y = 0; y < h; y += block) {
      for (let x = 0; x < w; x += block) {
        const cx = (x + block / 2 - w / 2) / (w / 2);
        const cy = (y + block / 2 - h / 2) / (h / 2);
        if (Math.abs(cx) + Math.abs(cy) > 1) continue;
        const t = (BAYER[((y / block) & 3) * 4 + ((x / block) & 3)] + 0.5) / 16;
        g.fillStyle = css(t < level ? b : a);
        g.fillRect(x, y, block, block);
      }
    }
  });
}

function backdrop(): Texture {
  const W = 1400;
  const H = 900;
  return canvasTexture(W, H, (g) => {
    const block = 4;
    const top = [0x0a1018, 0x131d2a];
    const bot = [0x1c2e42, 0x2f4a66];
    for (let y = 0; y < H; y += block) {
      for (let x = 0; x < W; x += block) {
        const t = y / H;
        const th = (BAYER[((y / block) & 3) * 4 + ((x / block) & 3)] + 0.5) / 16;
        // aurora: a soft diagonal band of the mid-blue
        const band = Math.sin((x + y * 0.7) / 210) * 0.5 + 0.5;
        const aur = Math.max(0, 1 - Math.abs(y / H - (0.28 + 0.12 * Math.sin(x / 260))) * 5) * band * 0.55;
        const base = t < 0.55 ? (th < t / 0.55 ? top[1] : top[0]) : th < (t - 0.55) / 0.45 ? bot[1] : bot[0];
        g.fillStyle = css(th < aur ? C.deep : base);
        g.fillRect(x, y, block, block);
      }
    }
    // pixel stars and spikes
    let seed = 7;
    const rnd = (): number => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    for (let i = 0; i < 90; i++) {
      const x = Math.floor(rnd() * (W / 4)) * 4;
      const y = Math.floor(rnd() * (H * 0.55 / 4)) * 4;
      const big = rnd() < 0.2;
      g.fillStyle = css(big ? C.ice : C.frost);
      g.fillRect(x, y, 4, 4);
      if (big) { g.fillRect(x - 4, y, 4, 4); g.fillRect(x + 4, y, 4, 4); g.fillRect(x, y - 4, 4, 4); g.fillRect(x, y + 4, 4, 4); }
    }
  });
}

function star(g: Graphics, n: number, rOut: number, rIn: number, rot = 0, cx = 0, cy = 0): Graphics {
  const pts: number[] = [];
  for (let i = 0; i < n * 2; i++) {
    const a = rot + (i * Math.PI) / n - Math.PI / 2;
    const r = i % 2 === 0 ? rOut : rIn;
    pts.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  return g.poly(pts);
}

function diamondPts(cx: number, cy: number, w: number, h: number): number[] {
  return [cx, cy - h / 2, cx + w / 2, cy, cx, cy + h / 2, cx - w / 2, cy];
}

/** Draws a spire of `kind` standing with its base centre at (0,0). */
function drawSpire(g: Graphics, kind: Kind): Graphics {
  g.clear();
  for (const c of g.removeChildren()) c.destroy();
  const line = { width: 2, color: C.slate, join: 'round' as const };
  if (kind === 'spike') {
    g.poly([0, -78, -19, 0, 0, 11]).fill(0xdcebf7).stroke(line);
    g.poly([0, -78, 0, 11, 19, 0]).fill(C.frost).stroke(line);
    g.poly([0, -78, 19, 0, 0, -11, -19, 0]).fill({ color: C.ice, alpha: 0 });
    g.poly([17, -26, 12, 3, 24, 5]).fill(C.ice).stroke(line);
    g.poly([17, -26, 24, 5, 30, 0]).fill(C.mid).stroke(line);
    for (let i = 0; i < 4; i++) g.moveTo(3, -14 - i * 12).lineTo(14 - i * 3, -8 - i * 12).stroke({ width: 2, color: C.mid });
  } else if (kind === 'crystal') {
    const shard = (x: number, h: number, w: number): void => {
      g.poly([x, -h, x - w, -h * 0.55, x - w, 2, x, 9]).fill(0xdcebf7).stroke(line);
      g.poly([x, -h, x, 9, x + w, 2, x + w, -h * 0.55]).fill(C.frost).stroke(line);
    };
    shard(-14, 40, 9);
    shard(13, 32, 9);
    shard(0, 56, 11);
  } else if (kind === 'lantern') {
    g.poly([-6, 4, 0, 10, 6, 4, 4, -10, -4, -10]).fill(C.deep).stroke(line);
    g.poly([0, -70, -19, -40, 0, -12]).fill(0xdcebf7).stroke(line);
    g.poly([0, -70, 0, -12, 19, -40]).fill(C.frost).stroke(line);
    g.poly(diamondPts(0, -41, 15, 26)).fill(C.orange).stroke({ width: 2, color: C.glow });
    star(g, 4, 31, 5, 0).fill({ color: C.glow, alpha: 0.0 });
  } else if (kind === 'chime') {
    g.rect(-3, -34, 6, 38).fill(C.deep).stroke(line);
        const st = new Graphics();
    star(st, 8, 30, 12, Math.PI / 8).fill(C.ice).stroke(line);
    st.position.set(0, -44);
    g.addChild(st);
    g.circle(0, -44, 6).fill(C.frost).stroke({ width: 2, color: C.slate });
  } else {
    g.poly([-10, 0, 8, 9, 22, 0, 4, -88]).fill(C.frost).stroke(line);
    g.poly([-10, 0, 8, 9, 8, -60, 4, -88]).fill(0xdcebf7).stroke(line);
    g.poly([4, -88, 4, -100, -2, -92, 10, -92]).fill(C.ice).stroke({ width: 2, color: C.slate });
    for (let i = 0; i < 3; i++) g.moveTo(10, -10 - i * 22).lineTo(18, -14 - i * 22).stroke({ width: 2, color: C.mid });
  }
  return g;
}

function drawEnemy(g: Graphics, kind: EnemyKind): Graphics {
  g.clear();
  const line = { width: 2, color: C.slate, join: 'round' as const };
  if (kind === 'drift') {
    star(g, 8, 19, 9).fill(0xc9ddec).stroke(line);
    g.circle(0, 0, 5).fill(C.ice);
  } else if (kind === 'ram') {
    star(g, 6, 28, 15).fill(C.mid).stroke(line);
    star(g, 6, 14, 7, Math.PI / 6).fill(C.deep);
  } else if (kind === 'glider') {
    star(g, 4, 23, 5).fill(C.ice).stroke(line);
  } else if (kind === 'wisp') {
    star(g, 12, 15, 9).fill(C.ice).stroke(line);
    g.circle(0, 0, 4).fill(C.frost);
  } else {
    star(g, 14, 62, 36).fill(C.deep).stroke({ width: 3, color: C.ice, join: 'round' });
    star(g, 14, 30, 20, Math.PI / 14).fill(C.slate);
    g.circle(0, 0, 14).fill(C.orange).stroke({ width: 3, color: C.glow });
  }
  return g;
}

const UNLOCK_BLURB: Record<Kind, string> = {
  spike: 'shoots while time flows',
  crystal: 'brittle: it cracks every neighbour. Chains pay out more time',
  lantern: 'shatter it for two and a half times the time',
  chime: 'rings out damage all around it',
  prism: 'its beam pierces everything in a line',
};
const eyeY: Record<EnemyKind, number> = { drift: -2, ram: -2, glider: 0, wisp: -1, thaw: -4 };

interface SpireView { c: Container; body: Graphics; q: Graphics; cracks: Graphics; lastHp: number; kind: Kind; drop: number }
interface EnemyView { c: Container; body: Graphics; eyes: Graphics; bar: Graphics; shadow: Graphics; shell: Graphics; trail: Trail | null; kind: EnemyKind; lastHit: number }

// ---------------------------------------------------------------- sound
let soundsDefined = false;
export const SOUND_NAMES = ['sw-place', 'sw-place-thud', 'sw-deny', 'sw-select', 'sw-move', 'sw-glass', 'sw-crunch', 'sw-thaw', 'sw-crack', 'sw-tick', 'sw-tock', 'sw-freeze', 'sw-shot', 'sw-pulse', 'sw-kill', 'sw-ice', 'sw-eaten', 'sw-heart', 'sw-heart-low', 'sw-unlock', 'sw-snap-ready', 'sw-snap', 'sw-dawn-step', 'sw-boss', 'sw-spawn', 'sw-warn', 'sw-front', 'sw-melt', 'sw-wind', 'sw-solid', 'sw-gift'];
export function defineSounds(): void {
  if (soundsDefined) return;
  soundsDefined = true;
  defineSound('sw-place', { wave: 'triangle', freq: 440, slide: 1.1, attack: 0.002, sustain: 0.02, decay: 0.13, transient: 0.3, volume: 0.45 });
  defineSound('sw-place-thud', { wave: 'sine', freq: 150, slide: -1.2, attack: 0.001, sustain: 0.02, decay: 0.12, volume: 0.4 });
  defineSound('sw-deny', { wave: 'square', freq: 150, slide: -0.4, sustain: 0.03, decay: 0.09, lowpass: 900, volume: 0.28 });
  defineSound('sw-select', { wave: 'sine', freq: 880, sustain: 0.01, decay: 0.08, volume: 0.28 });
  defineSound('sw-move', [
    { wave: 'sine', freq: 1180, sustain: 0.004, decay: 0.03, volume: 0.1 },
    { wave: 'sine', freq: 1320, sustain: 0.004, decay: 0.03, volume: 0.1 },
  ]);
  defineSound('sw-glass', [
    { wave: 'noise', freq: 3200, highpass: 2200, slide: -0.4, attack: 0.001, sustain: 0.04, decay: 0.34, crush: 6, volume: 0.45 },
    { wave: 'noise', freq: 2600, highpass: 1800, slide: -0.6, attack: 0.001, sustain: 0.05, decay: 0.3, crush: 5, volume: 0.45 },
  ]);
  defineSound('sw-crunch', { wave: 'noise', freq: 420, lowpass: 1500, slide: -1, attack: 0.001, sustain: 0.04, decay: 0.26, transient: 0.5, volume: 0.6 });
  defineSound('sw-thaw', { wave: 'saw', freq: 170, slide: 1.5, attack: 0.02, sustain: 0.1, decay: 0.45, lowpass: 2600, volume: 0.32 });
  defineSound('sw-crack', { wave: 'square', freq: 1900, slide: -2.2, sustain: 0.01, decay: 0.06, volume: 0.22 });
  defineSound('sw-tick', { wave: 'square', freq: 1500, sustain: 0.004, decay: 0.03, highpass: 800, volume: 0.16 });
  defineSound('sw-tock', { wave: 'square', freq: 960, sustain: 0.004, decay: 0.035, highpass: 600, volume: 0.16 });
  defineSound('sw-freeze', { wave: 'sine', freq: 640, slide: -1.3, sustain: 0.06, decay: 0.45, lowpass: 1500, volume: 0.35 });
  defineSound('sw-shot', { wave: 'triangle', freq: 1700, slide: -3.2, sustain: 0.01, decay: 0.07, volume: 0.16 });
  defineSound('sw-pulse', { wave: 'sine', freq: 520, slide: 0.6, sustain: 0.06, decay: 0.4, volume: 0.3 });
  defineSound('sw-kill', { wave: 'noise', freq: 1000, highpass: 700, slide: -1.6, sustain: 0.02, decay: 0.2, transient: 0.3, volume: 0.4 });
  defineSound('sw-ice', { wave: 'sine', freq: 1046, sustain: 0.01, decay: 0.13, volume: 0.22 });
  defineSound('sw-eaten', { wave: 'noise', freq: 260, lowpass: 800, slide: -0.8, sustain: 0.08, decay: 0.3, volume: 0.5 });
  defineSound('sw-heart', { wave: 'noise', freq: 100, lowpass: 650, slide: -0.9, attack: 0.001, sustain: 0.1, decay: 0.8, transient: 0.7, volume: 0.85 });
  defineSound('sw-heart-low', { wave: 'sine', freq: 120, slide: -0.5, sustain: 0.2, decay: 1.0, volume: 0.55 });
  defineSound('sw-unlock', { wave: 'triangle', freq: 660, slide: 0.35, sustain: 0.1, decay: 0.5, vibratoDepth: 0.02, vibratoSpeed: 14, volume: 0.4 });
  defineSound('sw-snap-ready', { wave: 'sine', freq: 990, slide: 0.5, sustain: 0.15, decay: 0.5, vibratoDepth: 0.03, vibratoSpeed: 10, volume: 0.4 });
  defineSound('sw-snap', { wave: 'saw', freq: 120, slide: 1.8, attack: 0.01, sustain: 0.2, decay: 0.7, lowpass: 3000, transient: 0.5, volume: 0.6 });
  defineSound('sw-dawn-step', { wave: 'sine', freq: 1568, sustain: 0.02, decay: 0.5, volume: 0.2 });
  defineSound('sw-boss', { wave: 'saw', freq: 62, slide: -0.1, attack: 0.05, sustain: 0.5, decay: 1.0, lowpass: 420, volume: 0.6 });
  defineSound('sw-spawn', { wave: 'noise', freq: 2200, highpass: 1600, sustain: 0.02, decay: 0.12, volume: 0.1 });
  defineSound('sw-warn', [
    { wave: 'sine', freq: 196, slide: 0.4, attack: 0.02, sustain: 0.18, decay: 0.5, lowpass: 900, volume: 0.5 },
    { wave: 'sine', freq: 220, slide: 0.4, attack: 0.02, sustain: 0.18, decay: 0.5, lowpass: 900, volume: 0.5 },
  ]);
  defineSound('sw-front', { wave: 'noise', freq: 700, lowpass: 2200, slide: 0.9, attack: 0.05, sustain: 0.25, decay: 0.7, volume: 0.5 });
  defineSound('sw-melt', { wave: 'noise', freq: 1500, highpass: 900, slide: -1.2, sustain: 0.05, decay: 0.25, volume: 0.3 });
  defineSound('sw-wind', { wave: 'noise', freq: 500, lowpass: 700, highpass: 120, slide: 0.5, attack: 0.9, sustain: 0.6, decay: 1.4, volume: 0.12 });
  defineSound('sw-solid', [
    { wave: 'triangle', freq: 330, slide: 0.5, sustain: 0.02, decay: 0.18, transient: 0.3, volume: 0.4 },
    { wave: 'triangle', freq: 392, slide: 0.5, sustain: 0.02, decay: 0.18, transient: 0.3, volume: 0.4 },
  ]);
  defineSound('sw-gift', { wave: 'sine', freq: 700, slide: 0.8, sustain: 0.05, decay: 0.3, volume: 0.3 });
}
const wholeTone = (i: number, cap = 6): number => Math.pow(2, (Math.min(i, cap) * 2) / 12);

export function createPrototype(): Prototype {
  let ctx!: Ctx;
  let sim!: Sim;
  let view!: View;
  let mset: MusicSet | null = null;

  // render objects
  let things!: Container;
  let fxLayer!: Container;
  let particles!: Particles;
  const spireViews = new Map<number, SpireView>();
  const enemyViews = new Map<number, EnemyView>();
  let cursorG!: Graphics;
  let chainG!: Graphics;
  let ghost!: Graphics;
  let rangeG!: Graphics;
  let beacon!: Container;
  let beaconCore!: Graphics;
  let heartsC!: Container;
  let dim!: Graphics;
  let rim!: Graphics;
  let twinkle: { g: Graphics; ph: number }[] = [];
  let snow: { g: Graphics; x: number; y: number; v: number; d: number }[] = [];
  let sunG!: Graphics;
  let faultC!: Container;
  let etaG!: Graphics;
  let markG!: Graphics;
  interface Flyer { txt: Text; trail: Trail; t: number; dur: number; x0: number; y0: number; amount: number; size: number }
  let flyers: Flyer[] = [];
  let pendingFly = 0;
  let thawFlash = 0;
  let arrivals = 0;
  let arrivalT = 0;
  let uiLayer!: Container;
  let chainText!: Text;
  let snapIdx = 0;
  let trailLayer!: Container;
  let decals: { g: Graphics; age: number }[] = [];
  let decalC!: Container;
  let glowG!: Graphics;
  let windT = 6;
  let frontG!: Graphics;
  let faultTex!: Texture;

  // hud
  let iceText!: Text;
  let thawText!: Text;
  let nightText!: Text;
  let thawBar!: Graphics;
  let dawnBar!: Graphics;
  let hintText!: Text;
  let bannerText!: Text;
  let bannerSub!: Text;
  let snapG!: Graphics;
  let snapText!: Text;
  let trayG!: Container;
  let bumpers: { side: 'lb' | 'rb'; pill: Graphics; label: Text; shown: string }[] = [];
  let trayPlates: { plate: Graphics; icon: Graphics; cost: Text; kind: Kind }[] = [];
  let endC!: Container;
  let endTitle!: Text;
  let endSub!: Text;
  let overlayEnd!: Graphics;

  let curX = 640;
  let curY = 400;
  let curSig = '';
  let ghostSig = '';
  let streak = 0;
  let streakT = 0;
  let timeAcc = 0;
  let dimNow = 0;
  let rimNow = 0;
  let lastPartsKey = '';
  let hintAlpha = 1;
  let snapPulse = 0;
  let unlockedSeen = 1;
  let sunrise = 0;

  const timeNow = (): number => timeAcc;

  function spireView(sp: Spire): SpireView {
    let v = spireViews.get(sp.id);
    if (!v) {
      const c = new Container();
      const shadow = new Graphics().ellipse(0, 4, 24, 11).fill({ color: C.night, alpha: 0.4 });
      const body = new Graphics();
      drawSpire(body, sp.kind);
      const cracks = new Graphics();
      const q = new Graphics();
      q.poly(diamondPts(0, 0, TW * 0.8, TH * 0.8)).stroke({ width: 3, color: C.frost });
      q.poly(diamondPts(0, 0, TW * 0.55, TH * 0.55)).stroke({ width: 2, color: C.ice, alpha: 0.7 });
      c.addChild(shadow, q, body, cracks);
      c.position.set(sx(sp.gx, sp.gy), sy(sp.gx, sp.gy));
      c.zIndex = sp.gx + sp.gy;
      things.addChild(c);
      v = { c, body, q, cracks, lastHp: sp.hp, kind: sp.kind, drop: 9 };
      spireViews.set(sp.id, v);
    }
    return v;
  }

  function enemyView(e: Enemy): EnemyView {
    let v = enemyViews.get(e.id);
    if (!v) {
      const c = new Container();
      const shadow = new Graphics().ellipse(0, 6, e.kind === 'thaw' ? 44 : e.kind === 'ram' ? 24 : 15, e.kind === 'thaw' ? 20 : 8).fill({ color: C.night, alpha: 0.38 });
      const body = new Graphics();
      drawEnemy(body, e.kind);
      const eyes = new Graphics();
      const bar = new Graphics();
      const spin = new Container();
      spin.addChild(body);
      // the frost shell: enemies are encased while time is stopped
      const shell = new Graphics();
      const R = e.kind === 'thaw' ? 74 : e.kind === 'ram' ? 34 : e.kind === 'wisp' ? 22 : 26;
      shell.poly([0, -R * 1.25, R * 0.8, -R * 0.35, R * 0.55, R * 0.7, -R * 0.55, R * 0.7, -R * 0.8, -R * 0.35]).fill({ color: C.frost, alpha: 0.35 }).stroke({ width: 3, color: C.ice, alpha: 0.9, join: 'round' });
      shell.poly([0, -R * 1.25, R * 0.25, -R * 0.4, -R * 0.35, -R * 0.2]).fill({ color: C.ice, alpha: 0.5 });
      shell.alpha = 0;
      c.addChild(shadow, spin, eyes, shell, bar);
      things.addChild(c);
      const trail = e.kind === 'glider' || e.kind === 'wisp' || e.kind === 'thaw' ? new Trail(trailLayer, { color: e.kind === 'thaw' ? C.deep : C.ice, width: e.kind === 'thaw' ? 26 : e.kind === 'glider' ? 9 : 6, length: e.kind === 'glider' ? 12 : 16, alpha: 0.55 }) : null;
      v = { c, body, eyes, bar, shadow, shell, trail, kind: e.kind, lastHit: 0 };
      (v as unknown as { spin: Container }).spin = spin;
      enemyViews.set(e.id, v);
    }
    return v;
  }

  function ring(x: number, y: number, color: number, r: number, ms = 480, w = 4): void {
    const g = new Graphics().ellipse(0, 0, r, r * 0.5).stroke({ width: w, color });
    g.position.set(x, y);
    g.scale.set(0.2);
    fxLayer.addChild(g);
    tween(g, { 'scale.x': 1, 'scale.y': 1, alpha: 0 }, ms, ease.outCubic, { onComplete: () => g.destroy() });
  }

  /** A crack mark left on the ice where something broke; fades slowly so the board keeps a little history. */
  function scorch(gx: number, gy: number, size: number): void {
    if (decals.length > 36) decals.shift()?.g.destroy();
    const g = new Graphics();
    const n = 6 + Math.floor(vfxRange(0, 4));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + vfxRange(-0.3, 0.3);
      const r = size * vfxRange(0.5, 1);
      g.moveTo(0, 0).lineTo(Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5 * 0.5).lineTo(Math.cos(a + 0.2) * r, Math.sin(a + 0.2) * r * 0.5).stroke({ width: 2, color: C.deep, alpha: 0.75 });
    }
    g.position.set(sx(gx, gy), sy(gx, gy));
    decalC.addChild(g);
    decals.push({ g, age: 0 });
  }

  function flashDiamond(x: number, y: number, color: number, size: number, ms = 220): void {
    const g = new Graphics().poly(diamondPts(0, 0, size, size / 2)).fill(color);
    g.position.set(x, y);
    fxLayer.addChild(g);
    tween(g, { alpha: 0, scale: 1.6 }, ms, ease.outQuad, { onComplete: () => g.destroy() });
  }

  /** Time released by a break flies up to the clock: the cause and the effect stay connected. */
  function flyToClock(wx: number, wy: number, amount: number, wait = 0): void {
    if (amount < 0.01 || !uiLayer) return;
    const size = Math.round(Math.min(54, 22 + amount * 7));
    const txt = new Text({ text: `+${amount >= 1 ? amount.toFixed(1) : amount.toFixed(2).replace(/0$/, '')}`, style: { fontFamily: FONT, fontSize: size, fill: C.orange, fontWeight: 'bold', stroke: { color: C.night, width: 5 } } });
    txt.anchor.set(0.5);
    txt.alpha = 0;
    const trail = new Trail(uiLayer, { color: C.orange, width: Math.max(5, size / 4), length: 12, alpha: 0.6 });
    uiLayer.addChild(txt);
    pendingFly += amount;
    flyers.push({ txt, trail, t: -wait, dur: 0.75, x0: wx, y0: wy, amount, size });
  }

  function banner(text: string, color = C.ice, size = 46, sub = ''): void {
    bannerSub.text = sub;
    bannerSub.alpha = 0;
    if (sub) {
      tween(bannerSub, { alpha: 1 }, 300, ease.outQuad, { delay: 120 });
      tween(bannerSub, { alpha: 0 }, 500, ease.inQuad, { delay: 2300 });
    }
    bannerText.text = text;
    bannerText.style.fill = color;
    bannerText.style.fontSize = size;
    bannerText.alpha = 0;
    bannerText.scale.set(0.7);
    tween(bannerText, { alpha: 1, scale: 1 }, 260, ease.outBack);
    tween(bannerText, { alpha: 0 }, 500, ease.inQuad, { delay: 1700 });
  }

  function setBeaconHearts(): void {
    heartsC.removeChildren();
    const n = sim.s.maxHearts;
    for (let i = 0; i < n; i++) {
      const g = new Graphics();
      const alive = i < sim.s.hearts;
      g.poly(diamondPts(0, 0, 14, 20));
      if (alive) g.fill(C.orange).stroke({ width: 2, color: C.glow });
      else g.fill({ color: C.slate, alpha: 0.6 }).stroke({ width: 2, color: C.deep });
      g.position.set((i - (n - 1) / 2) * 20, -Math.abs(i - (n - 1) / 2) * 3);
      heartsC.addChild(g);
    }
  }

  function trayLayout(): void {
    trayPlates.forEach((p, i) => p.plate.parent && p.plate.parent.position.set(640 + (i - 2) * 96, 744));
  }

  function fmtHint(): string {
    const t = sim.telemetry();
    const s = sim.s;
    const f = s.dawn / s.dawnLen;
    if (t.shatters === 0) return `${glyph('x')}  break a spire: time only moves when something breaks`;
    if (t.solid <= 1 && s.thaw < 5) return `last solid spire: place more while time runs`;
    if (t.shatters < 4 && f < 0.1) return s.spires.some((p) => p.queued) && s.thaw <= 0 ? `${glyph('x')}  break a solid spire: queued ones set when the clock starts` : `${glyph('a')}  place a spire    ${glyph('b')}  next spire${getDevice() === 'gamepad' ? `    ${glyph('rt')}  to the lead enemy` : ''}`;
    if (s.snap >= 25 && !s.snapReady && t.snaps === 0 && f < 0.6) return 'chains fill the COLD SNAP meter';
    return '';
  }

  return {
    meta: {
      slug: '2026-10-30-stillwinter',
      title: 'Stillwinter',
      question: 'Does tower defense feel fresh when the world is frozen and the only way to move time is to break your own defenses?',
      targetFeeling: 'tense, crafty stewardship: a held breath, then a thrilling release',
      mode: 'content',
    },
    balance: BALANCE,

    init(c: Ctx) {
      ctx = c;
      sim = createSim(c);
      sim.init();
    },
    step(dt: number, input: InputState) {
      sim.step(dt, input);
    },
    events: () => sim.events(),

    mount(v: View) {
      view = v;
      defineSounds();
      const world = v.world as Container;
      world.sortableChildren = false;
      const bg = new Sprite(backdrop());
      bg.position.set(-60, -50);
      world.addChild(bg);
      // the dawn glow: a warm horizon that grows with every thawed second
      glowG = new Graphics();
      for (let i = 0; i < 7; i++) glowG.ellipse(640, 490, 760 - i * 90, 280 - i * 34).fill({ color: i < 3 ? C.orange : C.glow, alpha: 0.05 });
      glowG.alpha = 0;
      world.addChild(glowG);

      // twinkling big stars (stars and spikes)
      for (let i = 0; i < 16; i++) {
        const g = new Graphics();
        star(g, 4, 9 + (i % 3) * 3, 1.6).fill(i % 2 ? C.ice : C.frost);
        g.position.set(40 + ((i * 197) % 1200), 30 + ((i * 89) % 330));
        world.addChild(g);
        twinkle.push({ g, ph: i * 0.7 });
      }

      // slab sides under the board
      const corner = (gx: number, gy: number): [number, number] => [sx(gx, gy), sy(gx, gy)];
      const T = corner(-0.5, -0.5);
      const R = corner(N - 0.5, -0.5);
      const B = corner(N - 0.5, N - 0.5);
      const L = corner(-0.5, N - 0.5);
      const slab = new Graphics();
      const depth = 30;
      slab.poly([L[0], L[1], B[0], B[1], B[0], B[1] + depth, L[0], L[1] + depth]).fill(C.deep).stroke({ width: 2, color: C.slate });
      slab.poly([B[0], B[1], R[0], R[1], R[0], R[1] + depth, B[0], B[1] + depth]).fill(C.slate).stroke({ width: 2, color: C.night });
      for (let i = 0; i < 18; i++) {
        const t = (i + 0.5) / 18;
        const x1 = L[0] + (B[0] - L[0]) * t;
        const y1 = L[1] + (B[1] - L[1]) * t;
        slab.moveTo(x1, y1 + 5).lineTo(x1, y1 + depth - 5 - (i % 3) * 5).stroke({ width: 2, color: C.mid, alpha: 0.5 });
        const x2 = B[0] + (R[0] - B[0]) * t;
        const y2 = B[1] + (R[1] - B[1]) * t;
        slab.moveTo(x2, y2 + 5).lineTo(x2, y2 + depth - 6 - (i % 4) * 4).stroke({ width: 2, color: C.deep, alpha: 0.6 });
      }
      world.addChild(slab);

      // tiles
      const tA = ditherDiamond(TW, TH, C.ice, C.frost, 0.22);
      const tB = ditherDiamond(TW, TH, C.ice, C.frost, 0.42);
      const tPath = ditherDiamond(TW, TH, C.deep, C.slate, 0.5);
      const tPath2 = ditherDiamond(TW, TH, C.deep, C.mid, 0.3);
      const board = new Container();
      for (let gy = 0; gy < N; gy++) {
        for (let gx = 0; gx < N; gx++) {
          const onPath = sim.path.cells.has(gy * N + gx);
          const t = new Sprite(onPath ? ((gx + gy) & 1 ? tPath : tPath2) : (gx + gy) & 1 ? tA : tB);
          t.anchor.set(0.5);
          t.position.set(sx(gx, gy), sy(gx, gy));
          board.addChild(t);
        }
      }
      world.addChild(board);
      faultTex = ditherDiamond(TW, TH, C.ice, C.orange, 0.5);
      faultC = new Container();
      frontG = new Graphics();
      decalC = new Container();
      trailLayer = new Container();
      etaG = new Graphics();
      world.addChild(faultC, frontG, decalC, etaG);

      chainG = new Graphics();
      rangeG = new Graphics();
      ghost = new Graphics();
      cursorG = new Graphics();
      world.addChild(chainG, rangeG);

      things = new Container();
      things.sortableChildren = true;
      world.addChild(things, trailLayer);

      // beacon
      beacon = new Container();
      const [bx, by] = sim.path.beacon;
      beacon.position.set(sx(bx, by), sy(bx, by));
      beacon.zIndex = bx + by + 0.2;
      const bs = new Graphics();
      bs.ellipse(0, 4, 34, 15).fill({ color: C.night, alpha: 0.4 });
      bs.poly([-26, 4, 0, 18, 26, 4, 22, -20, -22, -20]).fill(C.deep).stroke({ width: 2, color: C.slate });
      bs.poly([0, -120, -22, -20, 0, -4]).fill(0xdcebf7).stroke({ width: 2, color: C.slate });
      bs.poly([0, -120, 0, -4, 22, -20]).fill(C.frost).stroke({ width: 2, color: C.slate });
      beaconCore = new Graphics();
      beaconCore.poly(diamondPts(0, -62, 22, 40)).fill(C.orange).stroke({ width: 2, color: C.glow });
      beacon.addChild(bs, beaconCore);
      heartsC = new Container();
      heartsC.position.set(0, -140);
      beacon.addChild(heartsC);
      things.addChild(beacon);
      setBeaconHearts();

      cursorG.zIndex = 500;
      ghost.zIndex = 499;
      things.addChild(ghost, cursorG);

      fxLayer = new Container();
      world.addChild(fxLayer);
      particles = new Particles(world);
      v.onFrame((dt) => particles.update(dt));

      // snow
      const snowC = new Container();
      world.addChild(snowC);
      for (let i = 0; i < 70; i++) {
        const g = new Graphics().rect(0, 0, i % 5 === 0 ? 4 : 3, i % 5 === 0 ? 4 : 3).fill(i % 3 ? C.ice : C.frost);
        const o = { g, x: (i * 53) % 1280, y: (i * 97) % 800, v: 14 + (i % 7) * 5, d: (i % 5) - 2 };
        g.position.set(o.x, o.y);
        g.alpha = 0.55;
        snowC.addChild(g);
        snow.push(o);
      }

      // sun for the win
      sunG = new Graphics();
      sunG.alpha = 0;
      sunG.position.set(640, 150);
      world.addChild(sunG);

      // ---- UI (does not shake)
      const ui = v.ui as Container;
      uiLayer = ui;
      markG = new Graphics();
      world.addChild(markG);
      dim = new Graphics().rect(0, 0, 1280, 800).fill(C.night);
      dim.alpha = 0;
      rim = new Graphics();
      rim.rect(4, 4, 1272, 792).stroke({ width: 8, color: C.orange });
      rim.alpha = 0;
      ui.addChild(dim, rim);

      const mk = (size: number, fill: number, weight: 'bold' | 'normal' = 'bold'): Text =>
        new Text({ text: '', style: { fontFamily: FONT, fontSize: size, fill, fontWeight: weight, letterSpacing: 1 } });

      // ice
      const iceIcon = new Graphics();
      drawSpire(iceIcon, 'crystal');
      iceIcon.scale.set(0.5);
      iceIcon.position.set(48, 70);
      iceText = mk(40, C.ice);
      iceText.position.set(78, 28);
      ui.addChild(iceIcon, iceText);

      // dawn bar
      dawnBar = new Graphics();
      ui.addChild(dawnBar);
      thawBar = new Graphics();
      ui.addChild(thawBar);
      thawText = mk(24, C.orange);
      nightText = mk(24, C.frost);
      nightText.position.set(952, 14);
      ui.addChild(nightText);
      thawText.anchor.set(0.5, 0);
      thawText.position.set(640, 64);
      ui.addChild(thawText);

      // hint + banner
      hintText = mk(26, C.frost, 'normal');
      hintText.anchor.set(0.5, 1);
      hintText.position.set(640, 708);
      ui.addChild(hintText);
      bannerText = mk(46, C.ice);
      bannerText.anchor.set(0.5);
      bannerText.position.set(640, 118);
      bannerText.alpha = 0;
      bannerSub = mk(28, C.frost, 'normal');
      bannerSub.anchor.set(0.5);
      bannerSub.position.set(640, 168);
      bannerSub.alpha = 0;
      chainText = mk(72, C.orange);
      chainText.anchor.set(0.5);
      chainText.position.set(640, 660);
      chainText.alpha = 0;
      ui.addChild(bannerText, bannerSub, chainText);

      // spire tray
      trayG = new Container();
      ui.addChild(trayG);
      KINDS.forEach((k) => {
        const slot = new Container();
        const plate = new Graphics();
        const icon = new Graphics();
        drawSpire(icon, k);
        icon.scale.set(0.36);
        icon.position.set(0, 12);
        const cost = mk(22, C.frost);
        cost.anchor.set(0.5);
        cost.position.set(0, 28);
        slot.addChild(plate, icon, cost);
        trayG.addChild(slot);
        trayPlates.push({ plate, icon, cost, kind: k });
      });
      trayLayout();
      // cold snap meter
      snapG = new Graphics();
      snapG.position.set(1170, 705);
      snapText = mk(24, C.orange);
      snapText.anchor.set(1, 0.5);
      snapText.position.set(1118, 705);
      ui.addChild(snapG, snapText);

      // end screens
      endC = new Container();
      overlayEnd = new Graphics().rect(0, 0, 1280, 800).fill(C.night);
      endTitle = mk(78, C.ice);
      endTitle.anchor.set(0.5);
      endTitle.position.set(640, 330);
      endSub = mk(32, C.ice, 'normal');
      endSub.anchor.set(0.5);
      endSub.position.set(640, 440);
      endSub.style.align = 'center';
      endSub.style.lineHeight = 48;
      endC.addChild(overlayEnd, endTitle, endSub);
      endC.visible = false;
      ui.addChild(endC);

      // music
      try { mset = composeMusic(); } catch { mset = null; }
    },

    render(alpha: number) {
      const s = sim.s;
      const dt = Math.min(0.05, view.frame.dt || 1 / 60);
      timeAcc += dt;
      streakT -= dt;
      if (streakT <= 0) streak = 0;
      const flowing = s.thaw > 0 && s.phase === 'play';
      const flowK = Math.min(1, s.thaw / 0.35);

      // --- flying time numbers
      for (let i = flyers.length - 1; i >= 0; i--) {
        const f = flyers[i];
        f.t += dt;
        if (f.t < 0) continue;
        const p = Math.min(1, f.t / f.dur);
        const e = p * p * (3 - 2 * p);
        const ex = 640;
        const ey = 62;
        const cx = (f.x0 + ex) / 2 + (f.x0 < 640 ? -90 : 90);
        const cy = Math.min(f.y0, ey) - 110;
        const x = (1 - e) * (1 - e) * f.x0 + 2 * (1 - e) * e * cx + e * e * ex;
        const y = (1 - e) * (1 - e) * f.y0 + 2 * (1 - e) * e * cy + e * e * ey;
        f.txt.position.set(x, y);
        f.txt.alpha = Math.min(1, p * 6);
        f.txt.scale.set(1.25 - 0.55 * e);
        f.trail.push(x, y);
        f.trail.draw();
        if (p >= 1) {
          pendingFly = Math.max(0, pendingFly - f.amount);
          arrivals = arrivalT > 0 ? Math.min(12, arrivals + 1) : 0;
          arrivalT = 0.5;
          play('sw-ice', { pitch: wholeTone(arrivals), volume: 0.5 + Math.min(0.4, f.amount / 6) });
          punch(thawText, Math.min(0.5, 0.12 + f.amount / 10));
          thawFlash = 1;
          f.trail.gfx.destroy();
          f.txt.destroy();
          flyers.splice(i, 1);
        }
      }
      arrivalT = Math.max(0, arrivalT - dt);
      thawFlash = Math.max(0, thawFlash - dt * 3);
      const shownThaw = Math.max(0, s.thaw - pendingFly);

      // --- spires
      const live = new Set<number>();
      for (const sp of s.spires) {
        live.add(sp.id);
        const v = spireView(sp);
        const wob = sp.crack >= 0 ? Math.sin(timeNow() * 90) * 2.5 : 0;
        v.c.position.set(sx(sp.gx, sp.gy) + wob, sy(sp.gx, sp.gy));
        if (sp.hp < v.lastHp - 0.01 || (sp.hp < SPIRE[sp.kind].hp && v.cracks.children.length === 0 && v.lastHp !== sp.hp)) {
          v.lastHp = sp.hp;
        }
        const frac = sp.hp / SPIRE[sp.kind].hp;
        const lvl = frac < 0.34 ? 3 : frac < 0.67 ? 2 : frac < 1 ? 1 : 0;
        if ((v.cracks as unknown as { lvl?: number }).lvl !== lvl) {
          (v.cracks as unknown as { lvl?: number }).lvl = lvl;
          v.cracks.clear();
          for (let i = 0; i < lvl; i++) {
            v.cracks.moveTo(-8 + i * 7, -48 + i * 10).lineTo(-2 + i * 5, -30 + i * 10).lineTo(-9 + i * 8, -18 + i * 6).stroke({ width: 2.5, color: C.slate });
          }
        }
        v.drop += dt;
        const dk = Math.min(1, v.drop / 0.34);
        const fall = 1 - ease.outBounce(dk);
        v.body.y = -46 * fall;
        const sq = dk < 1 ? 1 + 0.25 * fall : 1;
        v.body.scale.set(1 / sq + (sp.kind === 'lantern' && flowing ? 0.03 * Math.sin(timeNow() * 6) : 0), sq);
        const qp = 0.5 + 0.5 * Math.sin(timeNow() * 5 + sp.id);
        v.body.alpha = sp.queued ? 0.32 + 0.14 * qp : 1;
        v.cracks.alpha = v.body.alpha;
        v.q.visible = sp.queued;
        v.q.alpha = 0.5 + 0.4 * qp;
        v.body.tint = sp.crack >= 0 ? (Math.floor(timeNow() * 30) % 2 ? C.orange : C.glow) : 0xffffff;
      }
      for (const [id, v] of spireViews) if (!live.has(id)) { v.c.destroy({ children: true }); spireViews.delete(id); }

      // --- enemies
      const seen = new Set<number>();
      for (const e of s.enemies) {
        seen.add(e.id);
        const v = enemyView(e) as EnemyView & { spin: Container };
        const x = e.px + (e.x - e.px) * alpha;
        const y = e.py + (e.y - e.py) * alpha;
        const lift = (e.kind === 'wisp' ? 38 : 20) + (flowing ? Math.sin(timeNow() * 5 + e.id) * 4 : 0);
        v.c.position.set(sx(x, y), sy(x, y));
        v.c.zIndex = x + y + 0.1;
        v.spin.position.set(0, -lift);
        v.shell.position.set(0, -lift + 4);
        v.shell.alpha = chaseDt(v.shell.alpha, flowing ? 0 : 0.95, 0.12, dt);
        v.shell.visible = v.shell.alpha > 0.02;
        if (v.trail) {
          if (flowing) v.trail.push(sx(x, y), sy(x, y) - lift);
          v.trail.draw();
        }
        v.shadow.scale.set(1 - (lift - 20) / 200);
        if (flowing) v.spin.rotation += dt * (e.kind === 'glider' ? 9 : e.kind === 'ram' ? 1.5 : e.kind === 'thaw' ? 0.6 : 2.4) * flowK;
        else v.spin.rotation += Math.sin(timeNow() * 40 + e.id) * 0.002; // a frozen shiver
        // eyes: wide and worried while frozen in place, pupils always on the beacon, a squint when hit
        v.eyes.clear();
        const ey = -lift + eyeY[e.kind];
        const bxs = sx(sim.path.beacon[0], sim.path.beacon[1]) - v.c.x;
        const bys = sy(sim.path.beacon[0], sim.path.beacon[1]) - v.c.y;
        const bl = Math.hypot(bxs, bys) || 1;
        const px = (bxs / bl) * 1.6;
        const py = (bys / bl) * 1.2;
        const sc = e.kind === 'thaw' ? 2.2 : e.kind === 'ram' ? 1.3 : 1;
        if (e.hit > 0) {
          v.eyes.moveTo(-8 * sc, ey - 2).lineTo(-3 * sc, ey + 1).moveTo(8 * sc, ey - 2).lineTo(3 * sc, ey + 1).stroke({ width: 2.5, color: C.night });
        } else {
          const r = (flowing ? 3.4 : 4.4) * sc;
          v.eyes.ellipse(-5 * sc, ey, r, r * 1.15).fill(C.ice).stroke({ width: 1.5, color: C.night });
          v.eyes.ellipse(5 * sc, ey, r, r * 1.15).fill(C.ice).stroke({ width: 1.5, color: C.night });
          v.eyes.circle(-5 * sc + px, ey + py, 1.8 * sc).fill(C.night);
          v.eyes.circle(5 * sc + px, ey + py, 1.8 * sc).fill(C.night);
        }
        // health pips only when hurt
        v.bar.clear();
        if (e.hp < e.maxHp) {
          const w = e.kind === 'thaw' ? 90 : 34;
          v.bar.rect(-w / 2, -lift - (e.kind === 'thaw' ? 78 : 32), w, 5).fill({ color: C.night, alpha: 0.7 });
          v.bar.rect(-w / 2, -lift - (e.kind === 'thaw' ? 78 : 32), (w * e.hp) / e.maxHp, 5).fill(C.ice);
        }
        v.c.tint = e.hit > 0 ? 0xffffff : 0xffffff;
      }
      for (const [id, v] of enemyViews) if (!seen.has(id)) { v.trail?.gfx.destroy(); v.c.destroy({ children: true }); enemyViews.delete(id); }

      // --- cursor, ghost, previews
      const tx = sx(s.cx, s.cy);
      const ty = sy(s.cx, s.cy);
      curX = chaseDt(curX, tx, 0.4, dt);
      curY = chaseDt(curY, ty, 0.4, dt);
      const onSpire = s.spires.find((p) => p.gx === s.cx && p.gy === s.cy);
      const valid = sim.canPlace(s.cx, s.cy) && s.ice >= SPIRE[s.sel].cost;
      const sig = `${s.cx},${s.cy},${onSpire ? 1 : 0},${valid ? 1 : 0}`;
      cursorG.clear();
      const pulse = 0.5 + 0.5 * Math.sin(timeNow() * 6);
      const col = onSpire ? C.orange : valid ? C.ice : C.mid;
      const w = TW * 0.5 + pulse * 3;
      const h = TH * 0.5 + pulse * 1.5;
      cursorG.poly(diamondPts(0, 0, w * 2, h * 2)).stroke({ width: 4, color: col, join: 'round' });
      cursorG.poly(diamondPts(0, 0, w * 2 - 14, h * 2 - 7)).fill({ color: col, alpha: 0.12 });
      cursorG.position.set(curX, curY);
      cursorG.zIndex = 500;
      if (s.phase !== 'play') cursorG.visible = false;
      else cursorG.visible = true;
      if (sig !== curSig || ghostSig !== `${s.sel}${onSpire ? 'x' : ''}`) {
        curSig = sig;
        ghostSig = `${s.sel}${onSpire ? 'x' : ''}`;
        chainG.clear();
        rangeG.clear();
        ghost.clear();
        if (onSpire) {
          for (const [cx, cy] of sim.chainPreview(s.cx, s.cy)) {
            chainG.poly(diamondPts(sx(cx, cy), sy(cx, cy), TW * 0.9, TH * 0.9)).fill({ color: C.orange, alpha: 0.28 }).stroke({ width: 3, color: C.orange });
          }
          const r = SPIRE[onSpire.kind].blast;
          rangeG.ellipse(sx(s.cx, s.cy), sy(s.cx, s.cy), r * TW * 0.5 * 1.0, r * TH * 0.5 * 1.0).stroke({ width: 3, color: C.orange, alpha: 0.5 });
        } else if (sim.canPlace(s.cx, s.cy)) {
          const r = SPIRE[s.sel].range;
          if (r > 0) rangeG.ellipse(sx(s.cx, s.cy), sy(s.cx, s.cy), r * TW * 0.5, r * TH * 0.5).stroke({ width: 3, color: C.frost, alpha: 0.55 });
          drawSpire(ghost, s.sel);
          ghost.alpha = valid ? 0.45 : 0.2;
          ghost.position.set(sx(s.cx, s.cy), sy(s.cx, s.cy));
          ghost.zIndex = s.cx + s.cy + 0.05;
        }
      }

      for (const d of decals) { d.age += dt; d.g.alpha = d.age < 4 ? 1 : Math.max(0, 1 - (d.age - 4) / 26); }
      while (decals.length && decals[0].age > 30) decals.shift()!.g.destroy();
      // --- fault lines pulse; warm front telegraph
      faultC.children.forEach((c, i) => { c.alpha = 0.55 + 0.3 * Math.sin(timeNow() * 3 + i); });
      frontG.clear();
      if (s.front && s.phase === 'play') {
        const fr = s.front;
        const urgency = 1 - fr.t / fr.total;
        const pulse2 = 0.5 + 0.5 * Math.sin(timeNow() * (4 + urgency * 14));
        for (let i = 0; i < N; i++) {
          const cx = fr.axis === 0 ? i : fr.idx;
          const cy = fr.axis === 0 ? fr.idx : i;
          frontG.poly(diamondPts(sx(cx, cy), sy(cx, cy), TW * 0.96, TH * 0.96)).fill({ color: C.orange, alpha: 0.12 + 0.1 * urgency + 0.1 * pulse2 }).stroke({ width: 2 + urgency * 2, color: C.orange, alpha: 0.5 + 0.3 * pulse2 });
        }
      }

      // --- while frozen, show where each walker will be after one more shatter's worth of time
      etaG.clear();
      if (!flowing && s.phase === 'play') {
        const dtT = (ctx.balance?.thawPerShatter ?? 3) * (ctx.balance?.enemySpeed ?? 1);
        let n = 0;
        for (const e of s.enemies) {
          if (e.flier || n++ > 8) continue;
          const to = Math.min(sim.path.len, e.s + ENEMY[e.kind].speed * dtT);
          const [gx, gy] = pathAt(sim.path, to);
          const [fx, fy] = pathAt(sim.path, e.s);
          etaG.moveTo(sx(fx, fy), sy(fx, fy)).lineTo(sx(gx, gy), sy(gx, gy)).stroke({ width: 3, color: C.orange, alpha: 0.35 });
          etaG.poly(diamondPts(sx(gx, gy), sy(gx, gy), 30, 16)).stroke({ width: 3, color: C.orange, alpha: 0.5 + 0.3 * Math.sin(timeNow() * 5) });
        }
      }
      // --- before the first break: bobbing arrows over every spire you can break
      markG.clear();
      if (s.phase === 'play' && sim.telemetry().shatters === 0) {
        for (const sp of s.spires) {
          if (sp.queued) continue;
          const bob = Math.sin(timeNow() * 5) * 6;
          const mx = sx(sp.gx, sp.gy);
          const my = sy(sp.gx, sp.gy) - 108 + bob;
          markG.poly([mx - 13, my - 16, mx + 13, my - 16, mx, my + 6]).fill(C.orange).stroke({ width: 3, color: C.glow, join: 'round' });
        }
      }
      // --- danger: the closer the lead enemy gets, the harder the beacon's hearts throb
      let lead = 99;
      for (const e of s.enemies) lead = Math.min(lead, e.flier ? Math.hypot(sim.path.beacon[0] - e.x, sim.path.beacon[1] - e.y) : sim.path.len - e.s);
      const danger = s.phase === 'play' ? Math.max(0, 1 - lead / 6) : 0;
      heartsC.scale.set(1 + danger * 0.16 * Math.abs(Math.sin(timeNow() * (6 + danger * 8))));
      // --- beacon breath
      const bp = 0.5 + 0.5 * Math.sin(timeNow() * (flowing ? 5 : 1.6));
      beaconCore.scale.set(0.92 + bp * 0.12);
      beaconCore.alpha = s.phase === 'over' ? 0.15 : 0.75 + bp * 0.25;

      glowG.alpha = s.phase === 'won' ? 1 : Math.min(1, (s.dawn / s.dawnLen) * 1.1);
      windT -= dt;
      if (windT <= 0 && !flowing && s.phase === 'play') { windT = vfxRange(7, 13); play('sw-wind', { pan: vfxRange(-0.5, 0.5), volume: 0.5 }); }
      // --- ambience: frozen is cool and dim, flowing is warm-rimmed and alive
      for (const t of twinkle) { t.g.alpha = (0.35 + 0.65 * (0.5 + 0.5 * Math.sin(timeNow() * (flowing ? 3.2 : 0.9) + t.ph))) * (1 - 0.7 * Math.min(1, s.dawn / s.dawnLen)); t.g.rotation = Math.sin(timeNow() * 0.4 + t.ph) * 0.2; }
      const fall = flowing ? 3.2 : 0.55;
      for (const o of snow) {
        o.y += o.v * dt * fall;
        o.x += o.d * dt * fall * 3;
        if (o.y > 810) { o.y = -10; o.x = (o.x * 7 + 131) % 1280; }
        if (o.x < -10) o.x = 1290;
        if (o.x > 1290) o.x = -10;
        o.g.position.set(o.x, o.y);
      }
      const dimTarget = s.phase === 'play' ? (flowing ? 0 : 0.22) : 0;
      dimNow = chaseDt(dimNow, dimTarget, 0.03, dt);
      dim.alpha = dimNow;
      rimNow = chaseDt(rimNow, flowing ? flowK * (0.35 + 0.25 * Math.sin(timeNow() * 8)) : 0, 0.02, dt);
      rim.alpha = rimNow;

      // --- HUD
      iceText.text = `${Math.floor(s.ice)}`;
      const f = s.dawn / s.dawnLen;
      dawnBar.clear();
      const bx = 390;
      const bw = 500;
      dawnBar.roundRect(bx, 30, bw, 16, 8).fill({ color: C.night, alpha: 0.85 }).stroke({ width: 2, color: C.deep });
      if (f > 0) dawnBar.roundRect(bx + 2, 32, Math.max(12, (bw - 4) * Math.min(1, f)), 12, 6).fill(s.endless ? C.frost : C.orange);
      for (const k of KINDS) {
        const u = SPIRE[k].unlock;
        if (u > 0) dawnBar.poly(diamondPts(bx + bw * u, 38, 10, 16)).fill(f >= u ? C.ice : C.deep).stroke({ width: 2, color: C.slate });
      }
      star(dawnBar, 8, 17, 8, 0, bx + bw + 24, 38).fill(f >= 1 ? C.glow : C.orange);
      nightText.text = s.endless ? `POLAR NIGHT  ${Math.floor(s.polar / 60)}:${String(Math.floor(s.polar % 60)).padStart(2, '0')}` : '';
      thawBar.clear();
      thawBar.roundRect(540, 58, 200, 10, 5).fill({ color: C.night, alpha: 0.7 });
      if (shownThaw > 0) thawBar.roundRect(540, 58, Math.max(10, 200 * Math.min(1, shownThaw / 12)), 10, 5).fill(shownThaw > 12 || thawFlash > 0.5 ? C.glow : C.orange);
      thawText.text = s.phase !== 'play' ? '' : s.thaw > 0 ? `TIME  ${shownThaw.toFixed(1)}` : 'FROZEN';
      thawText.style.fill = s.thaw > 0 ? C.orange : C.frost;
      thawText.position.set(640, 70);

      // tray
      trayPlates.forEach((p, i) => {
        const open = s.unlockedSet.has(p.kind);
        const sel = s.sel === p.kind;
        p.plate.clear();
        p.plate.roundRect(-44, -32, 88, 76, 12).fill({ color: C.night, alpha: 0.82 }).stroke({ width: sel ? 4 : 2, color: sel ? C.ice : C.deep });
        p.icon.alpha = open ? 1 : 0.18;
        p.icon.tint = open ? 0xffffff : 0x5e8fb5;
        p.cost.text = open ? `${SPIRE[p.kind].cost}` : `${Math.round(SPIRE[p.kind].unlock * 100)}%`;
        p.cost.style.fill = !open ? C.deep : s.ice >= SPIRE[p.kind].cost ? C.ice : C.mid;
        (p.plate.parent as Container).position.set(640 + (i - 2) * 96, sel ? 732 : 744);
      });
      if (!bumpers.length) {
        // LB / RB mark the ends of the tray so it reads as something the bumpers cycle
        for (const side of ['lb', 'rb'] as const) {
          const pill = new Graphics();
          const label = new Text({ text: '', style: { fontFamily: FONT, fontSize: 24, fill: C.ice, fontWeight: 'bold' } });
          label.anchor.set(0.5);
          const cx = side === 'lb' ? 640 - 2 * 96 - 78 : 640 + 2 * 96 + 78;
          pill.position.set(cx, 744);
          label.position.set(cx, 744);
          trayG.addChild(pill, label);
          bumpers.push({ side, pill, label, shown: '' });
        }
      }
      for (const b of bumpers) {
        const txt = glyph(b.side);
        if (txt !== b.shown) {
          b.shown = txt;
          b.label.text = txt;
          const w = Math.max(54, b.label.width + 26);
          b.pill.clear().roundRect(-w / 2, -20, w, 40, 14).fill({ color: C.night, alpha: 0.85 }).stroke({ width: 3, color: C.frost });
        }
        b.label.alpha = b.pill.alpha = s.unlockedSet.size > 1 ? 1 : 0.55;
      }

      // cold snap meter
      snapG.clear();
      snapG.circle(0, 0, 34).fill({ color: C.night, alpha: 0.85 }).stroke({ width: 3, color: C.deep });
      if (s.snap > 0) {
        const a0 = -Math.PI / 2;
        snapG.moveTo(0, -30).arc(0, 0, 30, a0, a0 + (Math.PI * 2 * s.snap) / 100).lineTo(0, 0).fill({ color: C.orange, alpha: 0.9 });
        snapG.circle(0, 0, 18).fill(C.night);
      }
      snapPulse += dt;
      star(snapG, 6, s.snapReady ? 22 + Math.sin(snapPulse * 14) * 3 : 15, 7).fill(s.snapReady ? C.glow : C.frost);
      snapText.text = s.snapReady && s.phase === 'play' ? `${glyph('y')}  COLD SNAP` : '';
      if (s.snapReady) snapText.alpha = 0.6 + 0.4 * Math.sin(snapPulse * 10);

      // hint
      const hint = s.phase === 'play' ? fmtHint() : '';
      hintText.text = hint;
      hintAlpha = chaseDt(hintAlpha, hint ? 1 : 0, 0.05, dt);
      hintText.alpha = hintAlpha;

      // sunrise after winning
      if (s.phase === 'won') {
        sunrise = Math.min(1, sunrise + dt * 0.35);
        sunG.clear();
        sunG.circle(0, 0, 90 * (0.4 + sunrise * 0.6)).fill({ color: C.glow, alpha: 0.9 });
        star(sunG, 16, 190 * sunrise, 100 * sunrise).fill({ color: C.orange, alpha: 0.5 });
        sunG.alpha = sunrise;
      }

      // music follows the game: frozen is a pad, flowing wakes the band, the hook rides the snap and the last stretch
      if (mset) {
        const parts = partsFor({ dawn: f, flowing: s.thaw > 0, snapping: s.snapReady, over: s.phase !== 'play' });
        const key = parts.join(',');
        if (key !== lastPartsKey) { lastPartsKey = key; music.setParts(parts, 0.5); }
      }

      // end screens
      const wasEnd = endC.visible;
      endC.visible = s.phase !== 'play';
      if (endC.visible && !wasEnd) overlayEnd.alpha = 0;
      if (endC.visible) {
        overlayEnd.alpha = Math.min(0.62, overlayEnd.alpha + dt * 0.8);
      }
    },

    onEvent(e: SimEvent) {
      const s = sim.s;
      const x = e.x ?? 0;
      const y = e.y ?? 0;
      const X = sx(x, y);
      const Y = sy(x, y);
      const m = e.magnitude ?? 0.5;
      const data = e.data ?? {};
      const pan = Math.max(-0.7, Math.min(0.7, (X - 640) / 700));
      switch (e.type) {
        case 'run-start': {
          sunrise = 0;
          sunG.alpha = 0;
          endC.visible = false;
          for (const f of flyers) { f.trail.gfx.destroy(); f.txt.destroy(); }
          flyers = [];
          pendingFly = 0;
          faultC.removeChildren();
          for (const d of decals) d.g.destroy();
          decals = [];
      flyers = [];
      pendingFly = 0;
      bumpers = [];
          beacon.alpha = 1;
          setBeaconHearts();
          lastPartsKey = '';
          unlockedSeen = 1;
          if (mset) music.play(mset.loop, partsFor({ dawn: 0, flowing: false, snapping: false, over: false }));
          break;
        }
        case 'solidify': {
          const sp = s.spires.find((p) => p.gx === x && p.gy === y);
          if (sp) spireView(sp).drop = 0.17;
          ring(X, Y, C.ice, 60, 360, 3);
          particles.emit('sparks', X, Y - 20, { count: 8, color: C.ice, speed: 0.8, size: 0.7 });
          play('sw-solid', { pan, variation: 0.06 });
          break;
        }
        case 'cursor':
          play('sw-move', { volume: 0.5, pan });
          break;
        case 'select': {
          play('sw-select', { pitch: 1 + KINDS.indexOf(data.kind as Kind) * 0.12, pan });
          break;
        }
        case 'deny':
          play('sw-deny', { pan });
          punch(cursorG, 0.12);
          if (data.why === 'queued') numberPop(view.world as Container, 'queued', X, Y - 60, { color: C.frost, size: 24, rise: 20, ms: 700 });
          if (data.why === 'ice') { punch(iceText, 0.35); iceText.tint = C.orange; tween(iceText, { tint: 0xffffff }, 600, ease.outQuad); }
          break;
        case 'place': {
          const sp = s.spires.find((p) => p.gx === x && p.gy === y);
          if (sp) {
            const v = spireView(sp);
            v.drop = 0;
          }
          play('sw-place', { pitch: 1 + KINDS.indexOf(data.kind as Kind) * 0.1, variation: 0.04, pan });
          play('sw-place-thud', { pan });
          particles.emit('dust', X, Y + 6, { count: 8, color: C.frost, speed: 0.8, size: 0.9 });
          ring(X, Y, C.frost, 36, 300, 3);
          numberPop(view.world as Container, `-${SPIRE[data.kind as Kind].cost}`, X, Y - 60, { color: C.frost, size: 26, rise: 28, ms: 600 });
          break;
        }
        case 'crack':
          play('sw-crack', { pitch: 1 + (Number(data.depth) || 1) * 0.12, volume: 0.7, pan });
          {
            particles.emit('sparks', X, Y - 24, { count: 6, color: C.orange, speed: 0.8, size: 0.7 });
          }
          break;
        case 'shatter': {
          const depth = Number(data.depth) || 0;
          const kind = data.kind as Kind;
          const eaten = data.reason === 'eaten';
          const melted = data.reason === 'melt';
          const snapped = data.reason === 'snap';
          const big = Math.min(1, m);
          hitStop(snapped ? 2 : 3 + Math.min(4, depth));
          shake(Math.min(0.75, (snapped ? 0.25 : 0.3) + depth * 0.07 + big * 0.2));
          particles.emit('debris', X, Y - 30, { count: 22 + depth * 4, color: C.ice, speed: 1.2 + big * 0.5, size: 1.1 });
          particles.emit('debris', X, Y - 30, { count: 10, color: C.frost, speed: 1.0, size: 1.4 });
          particles.emit('sparks', X, Y - 34, { count: 14 + depth * 3, color: C.orange, speed: 1.4, size: 0.9 });
          ring(X, Y, C.orange, 140 + depth * 18 + (kind === 'lantern' ? 60 : 0), 520, 5);
          ring(X, Y, C.ice, 90, 360, 3);
          scorch(x, y, 30 + depth * 4 + (kind === 'lantern' ? 14 : 0));
          flashDiamond(X, Y - 20, C.ice, 160 + depth * 20, 240);
          flyToClock(X, Y - 50, Number(data.thaw), 0.05);
          play('sw-glass', { pitch: 1 + (kind === 'chime' ? 0.2 : 0), pan, volume: 0.7 + big * 0.3 });
          if (melted) { play('sw-melt', { pan }); numberPop(view.world as Container, 'melted', X, Y - 40, { color: C.glow, size: 24, rise: 24, ms: 700 }); }
          if (eaten) { play('sw-eaten', { pan }); numberPop(view.world as Container, 'eaten', X, Y - 40, { color: C.frost, size: 24, rise: 24, ms: 700 }); }
          play('sw-crunch', { pitch: 0.9 + big * 0.2, variation: 0.06, pan, volume: 0.6 + big * 0.4 });
          // time returning: a whoosh that climbs in equal whole tones with the chain, capped at an octave
          play('sw-thaw', { pitch: wholeTone(depth), pan, volume: eaten || melted ? 0.5 : 0.8 });
          if (snapped) snapIdx++; else snapIdx = 0;
          if (depth >= 1 || snapped) {
            const n = snapped ? snapIdx : depth + 1;
            chainText.text = snapped ? `COLD SNAP x${n}` : `CHAIN x${n}`;
            chainText.style.fontSize = 54 + Math.min(40, n * 6);
            chainText.alpha = 1;
            chainText.scale.set(1.4);
            tween(chainText, { scale: 1 }, 180, ease.outBack);
            tween(chainText, { alpha: 0 }, 500, ease.inQuad, { delay: 650 });
            if (snapped) play('sw-ice', { pitch: wholeTone(n - 1), volume: 0.8 });
          }
          if (data.fault) {
            numberPop(view.world as Container, 'x2', X, Y - 120, { color: C.glow, size: 40, rise: 40, ms: 900 });
            ring(X, Y, C.glow, 200, 650, 6);
            particles.emit('confetti', X, Y - 40, { count: 20, color: C.glow, speed: 1.4, size: 1 });
            play('sw-unlock', { pitch: 1.5, volume: 0.6, pan });
          }
          if (data.wasFrozen) punch(view.world as Container, 0.02);
          break;
        }
        case 'thaw-on':
          play('sw-pulse', { pitch: 1.2, volume: 0.7 });
          break;
        case 'thaw-off':
          play('sw-freeze');
          ring(640, 420, C.ice, 520, 700, 6);
          particles.emit('dust', 640, 420, { count: 16, color: C.ice, speed: 1.5, size: 1.1 });
          break;
        case 'tick':
          play(m > 0.5 ? 'sw-tock' : 'sw-tick', { pitch: 1 + 0.5 * (1 - Math.min(1, s.thaw / 3)), volume: 0.8 + 0.4 * (1 - Math.min(1, s.thaw / 3)), variation: 0.02 });
          break;
        case 'spawn':
          play('sw-spawn', { pan });
          if (data.kind !== 'thaw') particles.emit('puff', X, Y - 10, { count: 6, color: C.frost, speed: 0.6, size: 0.8 });
          break;
        case 'boss':
          banner('THE THAW', C.glow, 64);
          shake(0.5);
          play('sw-boss');
          if (mset) music.stinger(mset.boss, { duck: 0.5 });
          break;
        case 'shot': {
          const tX = sx(Number(data.tx), Number(data.ty));
          const tY = sy(Number(data.tx), Number(data.ty));
          const g = new Graphics();
          const prism = data.kind === 'prism';
          g.moveTo(X, Y - 54).lineTo(tX, tY - 20).stroke({ width: prism ? 6 : 3, color: prism ? C.glow : C.ice, cap: 'round' });
          fxLayer.addChild(g);
          tween(g, { alpha: 0 }, prism ? 220 : 130, ease.outQuad, { onComplete: () => g.destroy() });
          particles.emit('sparks', tX, tY - 20, { count: 3, color: C.ice, speed: 0.6, size: 0.6 });
          play('sw-shot', { pitch: prism ? 0.7 : 1, variation: 0.08, pan, volume: 0.8 });
          break;
        }
        case 'pulse':
          ring(X, Y - 10, C.frost, Number(data.r) * TW * 0.5, 460, 4);
          play('sw-pulse', { pan, volume: 0.6 });
          break;
        case 'hit':
          particles.emit('sparks', X, Y - 24, { count: 4, color: C.ice, speed: 0.6, size: 0.6 });
          play('hit', { pitch: 1.6, volume: 0.25, variation: 0.1, pan });
          break;
        case 'kill': {
          const kind = data.kind as EnemyKind;
          const bigK = kind === 'thaw' ? 1 : kind === 'ram' ? 0.6 : 0.3;
          streak = Math.min(12, streak + 1);
          streakT = 1.6;
          hitStop(kind === 'thaw' ? 8 : kind === 'ram' ? 4 : 2);
          shake(0.1 + bigK * 0.45);
          particles.emit('debris', X, Y - 28, { count: 12 + Math.round(bigK * 24), color: C.ice, speed: 1.2, size: 1.0 });
          particles.emit('debris', X, Y - 28, { count: 6, color: C.mid, speed: 0.9, size: 1.1 });
          if (data.blast) particles.emit('sparks', X, Y - 28, { count: 12, color: C.orange, speed: 1.6, size: 0.9 });
          numberPop(view.world as Container, `+${ENEMY[kind].ice}`, X, Y - 56, { color: C.ice, size: 26, rise: 30, ms: 650 });
          flyToClock(X, Y - 70, Number(data.thaw), vfxRange(0, 0.15));
          play('sw-kill', { pitch: 0.8 + bigK * 0.4, variation: 0.08, pan, volume: 0.6 + bigK * 0.4 });
          // the ice ping climbs in whole tones while kills chain, then falls back
          play('sw-ice', { pitch: wholeTone(streak - 1), pan });
          if (kind === 'thaw') banner('THE THAW BREAKS', C.glow, 54);
          break;
        }
        case 'heart-lost': {
          shake(0.95);
          hitStop(10);
          punch(view.world as Container, 0.06);
          particles.emit('debris', X, Y - 80, { count: 40, color: C.orange, speed: 2.2, size: 1.4 });
          particles.emit('sparks', X, Y - 80, { count: 30, color: C.glow, speed: 2.4, size: 1.1 });
          ring(X, Y, C.orange, 420, 800, 8);
          ring(X, Y, C.ice, 280, 600, 5);
          flashDiamond(X, Y - 30, C.orange, 380, 420);
          flash(beacon, C.orange, 260);
          flyToClock(X, Y - 90, Number(data.thaw), 0.1);
          setBeaconHearts();
          play('sw-heart');
          play('sw-heart-low');
          if (s.hearts > 0) banner('THE LIGHT FLICKERS', C.orange, 40);
          streak = 0;
          break;
        }
        case 'unlock': {
          const k = data.kind as Kind;
          unlockedSeen++;
          banner(`NEW: ${SPIRE[k].label}`, C.ice, 52, UNLOCK_BLURB[k]);
          const tp = trayPlates.find((p) => p.kind === k);
          if (tp) { punch(tp.plate.parent as Container, 0.35); flash(tp.icon, C.ice, 260); }
          play('sw-unlock');
          if (mset) music.stinger(mset.unlock, { duck: 0.55 });
          shake(0.2);
          particles.emit('confetti', 640, 640, { count: 24, color: C.ice, speed: 1.0, size: 1.0 });
          break;
        }
        case 'snap-ready':
          banner(`${glyph('y')}: COLD SNAP`, C.orange, 52);
          play('sw-snap-ready');
          if (mset) music.stinger(mset.snap, { duck: 0.5 });
          punch(snapG, 0.5);
          break;
        case 'snap':
          banner('COLD SNAP', C.glow, 68);
          play('sw-snap');
          shake(0.8);
          hitStop(8);
          punch(view.world as Container, 0.05);
          flashDiamond(640, 420, C.ice, 1100, 500);
          ring(640, 420, C.orange, 560, 800, 9);
          break;
        case 'faults': {
          faultC.removeChildren();
          for (const k of s.faults) {
            const sp = new Sprite(faultTex);
            sp.anchor.set(0.5);
            const gx = k % N;
            const gy = Math.floor(k / N);
            sp.position.set(sx(gx, gy), sy(gx, gy));
            faultC.addChild(sp);
            particles.emit('sparks', sx(gx, gy), sy(gx, gy), { count: 10, color: C.orange, speed: 0.8, size: 0.8 });
            ring(sx(gx, gy), sy(gx, gy), C.orange, 70, 600, 3);
          }
          banner('FAULT LINES', C.orange, 46, 'shatter a spire on them for double time');
          play('sw-unlock', { pitch: 0.75 });
          break;
        }
        case 'front-warn':
          banner('WARM FRONT', C.orange, 46, 'it melts every spire in its line: shatter them first, or let it');
          play('sw-warn');
          shake(0.12);
          break;
        case 'front-hit': {
          const axis = Number(data.axis);
          const idx = Number(data.idx);
          for (let i = 0; i < N; i++) {
            const cx = axis === 0 ? i : idx;
            const cy = axis === 0 ? idx : i;
            const g = new Graphics().poly(diamondPts(0, 0, TW, TH)).fill(C.orange);
            g.position.set(sx(cx, cy), sy(cx, cy));
            g.alpha = 0;
            fxLayer.addChild(g);
            tween(g, { alpha: 0.7 }, 90, ease.outQuad, {
              delay: i * 55,
              onComplete: () => {
                particles.emit('puff', sx(cx, cy), sy(cx, cy) - 10, { count: 5, color: C.glow, speed: 0.7, size: 1 });
                tween(g, { alpha: 0 }, 400, ease.inQuad, { onComplete: () => g.destroy() });
              },
            });
          }
          shake(0.35);
          play('sw-front');
          break;
        }
        case 'melt':
          particles.emit('puff', X, Y - 30, { count: 8, color: C.glow, speed: 0.7, size: 1.1 });
          play('sw-melt', { pan, variation: 0.1 });
          break;
        case 'new-enemy':
          banner(ENEMY_BLURB[data.kind as EnemyKind], C.ice, 44);
          break;
        case 'dawn-step':
          play('sw-dawn-step', { pitch: wholeTone(Number(data.step) - 1) });
          break;
        case 'endless':
          banner('POLAR NIGHT', C.frost, 64, 'no dawn this time: hold the beacon as long as you can');
          endC.visible = false;
          tween(sunG, { alpha: 0 }, 900, ease.outQuad);
          sunrise = 0;
          shake(0.3);
          ring(640, 420, C.frost, 560, 800, 8);
          if (mset) music.play(mset.loop, partsFor({ dawn: 1, flowing: true, snapping: false, over: false }));
          lastPartsKey = '';
          break;
        case 'ice-gift':
          banner('the beacon lends you ice', C.frost, 32);
          play('sw-gift');
          break;
        case 'gameover': {
          endTitle.text = data.reason === 'stuck' ? 'NOTHING LEFT TO BREAK' : 'THE BEACON WENT DARK';
          endTitle.style.fill = C.frost;
          endTitle.style.fontSize = 64;
          { const tl = sim.telemetry(); const pn = s.endless ? `held ${Math.floor(s.polar / 60)}:${String(Math.floor(s.polar % 60)).padStart(2, '0')} into the Polar Night` : `${Math.round(Number(data.dawn) * 100)}% of the way to dawn`; endSub.text = `${pn}  ·  ${tl.kills} kills  ·  best chain ${tl.maxChain}\n${glyph('a')}: try again`; }
          overlayEnd.clear().rect(0, 0, 1280, 800).fill(C.night);
          shake(0.9);
          particles.emit('debris', X, Y - 90, { count: 60, color: C.ice, speed: 2.4, size: 1.5 });
          if (mset) { music.release(1.2); music.stinger(mset.lose, { duck: 0.9 }); }
          play('sw-heart-low', { volume: 1 });
          tween(beacon, { alpha: 0.55 }, 900, ease.outQuad);
          break;
        }
        case 'complete': {
          endTitle.text = 'DAWN';
          endTitle.style.fill = C.glow;
          endTitle.style.fontSize = 96;
          { const tl = sim.telemetry(); endSub.text = `${sim.s.hearts} of ${sim.s.maxHearts} hearts left  ·  ${tl.kills} kills  ·  best chain ${tl.maxChain}  ·  ${tl.shatters} shatters\n${glyph('y')}: keep going into the Polar Night      ${glyph('a')}: again`; }
          overlayEnd.clear().rect(0, 0, 1280, 800).fill(0x3d2210);
          shake(0.5);
          particles.emit('confetti', 640, 300, { count: 60, color: C.glow, speed: 1.6, size: 1.4 });
          particles.emit('sparks', 640, 300, { count: 60, color: C.orange, speed: 2, size: 1.2 });
          if (mset) { music.release(1.0); music.stinger(mset.win, { duck: 0.9 }); }
          play('sw-unlock', { pitch: 1.5, volume: 1 });
          break;
        }
        default:
          break;
      }
      void ctx;
    },

    telemetry: () => sim.telemetry(),
    getState: () => sim.observe(),
    dispose() {
      music.stop();
      spireViews.clear();
      enemyViews.clear();
      trayPlates = [];
      decals = [];
      twinkle = [];
      snow = [];
    },
  };
}

