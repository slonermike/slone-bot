// Blot Beat: render + juice + audio around the pure sim in sim.ts.
import { Container, Graphics, Rectangle, Sprite } from 'pixi.js';
import type { Application } from 'pixi.js';
import { getDevice, glyph, onDeviceChange } from '../../core/index.ts';
import type { Ctx, InputState, Prototype, SimEvent, View } from '../../core/types.ts';
import { play } from '../../audio/index.ts';
import { music } from '../../audio/music.ts';
import { Eyes, Particles, SquashStretch, chase, ease, flash, numberPop, punch, shake, tween } from '../../juice/index.ts';
import { BALANCE, SETS, STICKERS, createSim } from './sim.ts';
import type { Note } from './sim.ts';
import { CX, CY, HH, HW, LANE_BUTTON, LANE_DIR, RING_RX, RING_RY, lanePoint, laneRing, laneStart } from './geometry.ts';
import { C, FONT, chip, drop, hintPlate, label, sheet, sticker, stickerIcon } from './ui.ts';
import { defineBlotSounds, pitchFor } from './sounds.ts';
import { SET_DEFS, backingFor, partsFor, stingerFor } from './music.ts';
import { LANE_KIND, LANE_LABEL } from './chart.ts';
import { syncStep } from './sync.ts';
export { bots } from './bots.ts';

const PHASE = { play: 0, pick: 1, won: 2, lost: 3 } as const;
/** What strikes each lane: the face button on a pad, the arrow key on a keyboard (up, right, down, left match the lanes). */
const ARROWS = ['\u2191', '\u2192', '\u2193', '\u2190'];
const laneGlyph = (lane: number) => (getDevice() === 'keyboard' ? ARROWS[lane]! : glyph(LANE_BUTTON[lane]!));
const hintFor = (set: number): Parameters<typeof hintPlate>[0] => [
  ['Every note is part of the song. Play it:', { key: laneGlyph(2) }, 'kick', { key: laneGlyph(0) }, 'snare', { key: laneGlyph(1) }, 'melody'],
  [{ key: laneGlyph(3) }, 'bass joins. Long notes: press, then hold to the tail'],
  ['Six-eight: the beat sways in threes. Hold the bass'],
  ['Finale: the whole band. Play it all'],
][set]!;

interface NoteView { g: Graphics; ribbon: Graphics | null; fading: boolean; }
interface Splat { g: Graphics; }

export function createPrototype(): Prototype {
  const sim = createSim();
  const s = sim.state;
  let view!: View;
  let world!: Container;
  let ui!: Container;
  let particles: Particles;
  let ctx!: Ctx;

  // scene
  let boardC!: Container;
  let noteC!: Container;
  let splatC!: Container;
  let fxC!: Container;
  let linkG!: Graphics;
  let dangerG!: Graphics;
  let feverG!: Graphics;
  let latticeFever!: Graphics;
  let wellC!: Container;
  let wellFill!: Graphics;
  let wellSS!: SquashStretch;
  let eyes!: Eyes;
  const targets: Container[] = [];
  const targetLabels: ReturnType<typeof label>[] = [];
  const noteViews = new Map<number, NoteView>();
  let splats: Splat[] = [];

  // hud
  let pageIcons: Graphics[] = [];
  let setText!: ReturnType<typeof label>;
  let infoText!: ReturnType<typeof label>;
  let railG!: Graphics;
  let scoreText!: ReturnType<typeof label>;
  let comboText!: ReturnType<typeof label>;
  let multBadge!: Container;
  let multText!: ReturnType<typeof label>;
  let dropsC!: Container;
  let dropGs: Graphics[] = [];
  let dropsMax = -1;
  let stampC!: Container;
  let stampKey = '';
  let railFever!: Graphics;
  let stickerRow!: Container;
  let hintC: Container | null = null;
  let bannerC: Container | null = null;
  let overlay: Container | null = null;
  let overlayKind = '';
  let overlayBuilt = false;
  let unsubDevice: (() => void) | null = null;

  // render state
  let pulse = 0;
  let wellLevel = 0;
  let time = 0;
  let seenFirstBlot = false;
  let seenStampReady = false;
  let lastPages = -1;
  let introFor = -1;
  let musicSet = -1;
  const syncState = { bigFrames: 0 };
  let clockBase = NaN;
  let virtualClock = false;
  let pagesKey = '';
  let railKey = -1;
  let scoreShown = -1;
  let frameNo = 0;
  let geyserT = 0;
  let seenDrip = false;
  const streaks: Graphics[] = [];
  let lastStickers = 0;
  let sigPoints: number[] = [];
  const lastLabels = { s: '' };

  /** Run `fn` after `ms` on the juice clock (a tween on a dummy target, so it never collides with tweens on real objects). */
  const later = (ms: number, fn: () => void) => tween({ v: 0 }, { v: 1 }, ms, ease.linear, { onComplete: fn });
  /** The sound of the song's own instrument, at the song's own pitch: hitting a note completes the music. */
  function playKind(kind: string, midi: number, volume: number, pan: number): void {
    if (kind === 'kick') play('kick', { volume, pan, variation: 0 });
    else if (kind === 'snare') { play('snare', { volume, pan, variation: 0.02 }); play('snareBody', { volume: volume * 0.8, pan, variation: 0.02 }); }
    else if (kind === 'bass') play('bassHit', { volume, pan, pitch: pitchFor(midi, 45), variation: 0 });
    else {
      const v = SET_DEFS[s.set]!.spec.feel?.leadVoice;
      play(v === 'square' ? 'leadSquare' : v === 'flute' ? 'leadFlute' : 'leadPluck', { volume, pan, pitch: pitchFor(midi, 69), variation: 0 });
    }
  }
  /** A pitch from the set's own key for free taps (the toy): pentatonic on the song's tonic. */
  function freeMidi(kind: string): number {
    const d = SET_DEFS[s.set]!.spec;
    const minor = d.mode === 'minor' || d.mode === 'dorian' || d.mode === 'phrygian';
    const deg = (minor ? [0, 3, 5, 7, 10] : [0, 2, 4, 7, 9])[ctx.vfxRng.int(0, 4)]!;
    return (d.root ?? 50) + (kind === 'bass' ? -12 : 24) + deg;
  }

  /** A feedback pill: text on a small ink-outlined badge that pops, rises and fades (feedback is part of the sticker UI, not loose text). */
  function badgePop(text: string, x: number, y: number, fill: number, color: number, size = 22, ms = 560, rise = 34): void {
    const c = new Container();
    const t = label(text, size, color, { weight: '900' });
    const w = t.width + 28;
    const h = size * 1.7;
    const g = new Graphics();
    g.roundRect(-w / 2 + 2, -h / 2 + 4, w, h, h / 2).fill(C.ink);
    g.roundRect(-w / 2, -h / 2, w, h, h / 2).fill(fill).stroke({ width: 4, color: C.ink, join: 'round' });
    c.addChild(g, t);
    c.position.set(x, y);
    c.scale.set(0.4);
    world.addChild(c);
    tween(c, { scale: 1 }, 130, ease.outBack);
    // one tween owns the destroy; the fade finishes before it so nothing touches a destroyed badge
    tween(c, { y: y - rise }, ms, ease.outCubic, { onComplete: () => c.destroy() });
    later(ms * 0.5, () => { if (!c.destroyed) tween(c, { alpha: 0 }, ms * 0.4, ease.linear); });
  }
  const D = () => LANE_DIR;
  const FRAME_DT = 1 / 60;

  // ---------------------------------------------------------------- helpers
  function ringPulse(x: number, y: number, rx: number, color: number, ms = 380, width = 5, ry = rx / 2): void {
    const g = new Graphics().ellipse(0, 0, rx, ry).stroke({ width: width + 6, color: C.ink }).ellipse(0, 0, rx, ry).stroke({ width, color });
    g.position.set(x, y);
    g.scale.set(0.3);
    fxC.addChild(g);
    tween(g, { scale: 1, alpha: 0 }, ms, ease.outCubic, { onComplete: () => g.destroy() });
  }

  function spark(x: number, y: number, lane: number, color: number, count: number, speed = 1): void {
    const d = D()[lane]!;
    particles.emit('sparks', x, y, { count, color, speed, angle: Math.atan2(-d.y, -d.x), spread: Math.PI * 0.9, size: 1.1 });
  }

  function banner(text: string, fill: number, ink: number, ms = 1300, y = 196, sub?: string): void {
    bannerC?.destroy();
    if (text.startsWith('FEVER') || text.startsWith('PAGE')) { hintC?.destroy(); hintC = null; }
    const c = new Container();
    const w = Math.max(280, text.length * 30 + 70, sub ? sub.length * 12.5 + 70 : 0);
    const bg = sticker(w, sub ? 100 : 76, fill, 18);
    c.addChild(bg);
    const t = label(text, 40, ink, { weight: '900' });
    t.y = sub ? -14 : 0;
    c.addChild(t);
    if (sub) { const st = label(sub, 22, ink); st.y = 22; c.addChild(st); }
    c.position.set(CX, y);
    c.rotation = -0.04;
    c.scale.set(0.2);
    ui.addChild(c);
    bannerC = c;
    tween(c, { scale: 1 }, 260, ease.outBack);
    later(ms, () => { tween(c, { alpha: 0 }, 260, ease.inQuad, { onComplete: () => { c.destroy(); if (bannerC === c) bannerC = null; } }); });
  }

  function showHint(parts: Parameters<typeof hintPlate>[0], ms = 4200): void {
    hintC?.destroy();
    const h = hintPlate(parts, 24);
    h.position.set(CX, 146);
    h.alpha = 0;
    ui.addChild(h);
    hintC = h;
    tween(h, { alpha: 1 }, 250, ease.outCubic);
    later(ms, () => { tween(h, { alpha: 0 }, 400, ease.inQuad, { onComplete: () => { h.destroy(); if (hintC === h) hintC = null; } }); });
  }

  function syncMusic(): void {
    music.setParts(partsFor(s.set, s.inkBand, s.feverT > 0, s.phase !== 'play'), 0.5);
  }

  function addSplat(x: number, y: number): void {
    const g = new Graphics();
    const n = 5 + Math.floor(ctx.vfxRng.next() * 3);
    for (let i = 0; i < n; i++) {
      const a = ctx.vfxRng.next() * Math.PI * 2;
      const r = 6 + ctx.vfxRng.next() * 22;
      const px = Math.cos(a) * r * (i ? 1 : 0.2);
      const py = Math.sin(a) * r * 0.5 * (i ? 1 : 0.2);
      const rad = 7 + ctx.vfxRng.next() * 15 * (i ? 0.7 : 1.2);
      g.ellipse(px, py, rad, rad * 0.55).fill(C.lime).stroke({ width: 5, color: C.ink, join: 'round' });
    }
    // second pass without strokes so the blob reads as one shape
    for (let i = 0; i < n; i++) g.ellipse(Math.cos(i * 2) * 4, Math.sin(i * 2) * 2, 12, 7).fill(C.lime);
    g.position.set(x + (ctx.vfxRng.next() - 0.5) * 70, y + (ctx.vfxRng.next() - 0.5) * 30);
    g.rotation = (ctx.vfxRng.next() - 0.5) * 0.4;
    g.scale.set(0.1);
    splatC.addChild(g);
    tween(g, { scale: 1 }, 320, ease.outBack);
    splats.push({ g });
  }

  function flyDrop(fromX: number, fromY: number, delay = 0, color: number = C.lime, then?: () => void): void {
    const g = drop(new Graphics(), 30).fill(color).stroke({ width: 4, color: C.ink, join: 'round' });
    g.position.set(fromX, fromY);
    g.alpha = 0;
    fxC.addChild(g);
    tween(g, { alpha: 1 }, 80, ease.linear, { delay });
    tween(g, { x: CX, y: CY - 14, scale: 0.4 }, 420, ease.inQuad, {
      delay,
      onComplete: () => { g.destroy(); then?.(); },
    });
  }

  function suckSplats(keep: number): void {
    while (splats.length > keep) {
      const sp = splats.shift()!;
      const g = sp.g;
      tween(g, { x: CX, y: CY, scale: 0.1, alpha: 0.4 }, 360 + ctx.vfxRng.next() * 160, ease.inQuad, { onComplete: () => g.destroy() });
    }
  }

  function burstSplats(): void {
    for (const sp of splats) {
      const g = sp.g;
      const dx = g.x - CX;
      const dy = g.y - CY;
      tween(g, { x: g.x + dx * 1.4, y: g.y + dy * 1.2, scale: 1.6, alpha: 0 }, 700, ease.outCubic, { onComplete: () => g.destroy() });
    }
    splats = [];
  }

  function clearViews(): void {
    for (const v of noteViews.values()) { v.g.destroy(); v.ribbon?.destroy(); }
    noteViews.clear();
    for (const sp of splats) sp.g.destroy();
    splats = [];
    overlay?.destroy(); overlay = null; overlayBuilt = false;
    hintC?.destroy(); hintC = null;
    bannerC?.destroy(); bannerC = null;
    wellLevel = 0;
    introFor = -1;
    musicSet = -1;
    geyserT = 0;
    lastPages = -1;
    lastStickers = 0;
  }

  // ---------------------------------------------------------------- scene
  function buildScene(): void {
    const bg = new Graphics();
    (view.app as Application).renderer.background.color = C.bg; // the desk colour is the clear colour: one fewer full-screen layer
    for (const [rx, ry] of [[640, 320], [860, 430], [1120, 560]] as const) bg.ellipse(CX, CY + 30, rx, ry).stroke({ width: 1.5, color: C.line, alpha: 0.28 });
    world.addChild(bg);

    feverG = new Graphics();
    feverG.rect(-300, -300, 1880, 1400).fill({ color: C.lime, alpha: 0.1 });
    feverG.alpha = 0;
    world.addChild(feverG);

    boardC = new Container();
    boardC.pivot.set(CX, CY);
    boardC.position.set(CX, CY);
    world.addChild(boardC);

    const N = { x: CX, y: CY - HH };
    const E = { x: CX + HW, y: CY };
    const S = { x: CX, y: CY + HH };
    const W = { x: CX - HW, y: CY };
    const slab = new Graphics();
    slab.poly([W.x, W.y, S.x, S.y, E.x, E.y, E.x, E.y + 30, S.x, S.y + 30, W.x, W.y + 30]).fill(C.ink).stroke({ width: 8, color: C.ink, join: 'round' });
    slab.moveTo(W.x, W.y + 12).lineTo(S.x, S.y + 12).lineTo(E.x, E.y + 12).stroke({ width: 1.5, color: C.line, alpha: 0.5 });
    const board = new Graphics();
    board.poly([N.x, N.y, E.x, E.y, S.x, S.y, W.x, W.y]).fill(C.board).stroke({ width: 10, color: C.ink, join: 'round' });
    const lattice = new Graphics();
    const P = (u: number, v: number) => ({ x: W.x + u * HW + v * HW, y: W.y - u * HH + v * HH });
    for (let k = 1; k < 8; k++) {
      const a = P(k / 8, 0); const b = P(k / 8, 1);
      lattice.moveTo(a.x, a.y).lineTo(b.x, b.y);
      const c = P(0, k / 8); const d = P(1, k / 8);
      lattice.moveTo(c.x, c.y).lineTo(d.x, d.y);
    }
    lattice.stroke({ width: 1.5, color: C.line, alpha: 0.45 });
    latticeFever = new Graphics();
    for (let k = 1; k < 8; k++) {
      const a = P(k / 8, 0); const b = P(k / 8, 1);
      latticeFever.moveTo(a.x, a.y).lineTo(b.x, b.y);
      const c = P(0, k / 8); const d = P(1, k / 8);
      latticeFever.moveTo(c.x, c.y).lineTo(d.x, d.y);
    }
    latticeFever.stroke({ width: 2, color: C.lime, alpha: 0.8 });
    latticeFever.alpha = 0;
    const inner = new Graphics();
    inner.poly([N.x, N.y + 14, E.x - 26, E.y, S.x, S.y - 14, W.x + 26, W.y]).stroke({ width: 1.5, color: C.tint, alpha: 0.5 });
    const lanes = new Graphics();
    for (let l = 0; l < 4; l++) {
      const a = laneStart(l); const b = laneRing(l);
      lanes.moveTo(a.x, a.y).lineTo(b.x, b.y);
    }
    lanes.stroke({ width: 7, color: C.ink });
    for (let l = 0; l < 4; l++) {
      const a = laneStart(l); const b = laneRing(l);
      lanes.moveTo(a.x, a.y).lineTo(b.x, b.y);
    }
    lanes.stroke({ width: 2, color: C.tint, alpha: 0.9 });
    const ring = new Graphics().ellipse(CX, CY, RING_RX, RING_RY).stroke({ width: 8, color: C.ink }).ellipse(CX, CY, RING_RX, RING_RY).stroke({ width: 2, color: C.tint, alpha: 0.8 });
    // the static board is baked into one sprite: a few dozen draw calls become one (the slow part of a software GL frame)
    const statics = new Container();
    statics.addChild(slab, board, lattice, inner, lanes, ring);
    const crop = new Rectangle(100, 150, 1080, 600);
    const tex = (view.app as Application).renderer.generateTexture({ target: statics, frame: crop, resolution: 2, antialias: true });
    const baked = new Sprite(tex);
    baked.position.set(crop.x, crop.y);
    statics.destroy({ children: true });
    boardC.addChild(baked, latticeFever);
    for (let l = 0; l < 4; l++) {
      const a = laneStart(l); const b = laneRing(l);
      const st = new Graphics();
      st.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ width: 12, color: C.ink, cap: 'round' });
      st.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ width: 5, color: C.white, cap: 'round' });
      st.alpha = 0;
      boardC.addChild(st);
      streaks.push(st);
    }

    for (let l = 0; l < 4; l++) {
      const c = new Container();
      const p = laneRing(l);
      c.position.set(p.x, p.y);
      const g = new Graphics().ellipse(0, 0, 40, 24).fill(C.bg).stroke({ width: 7, color: C.ink }).ellipse(0, 0, 40, 24).stroke({ width: 2, color: C.white, alpha: 0.9 });
      const t = label(laneGlyph(l), 22, C.tint, { weight: '900' });
      c.addChild(g, t);
      boardC.addChild(c);
      targets.push(c);
      targetLabels.push(t);
      const lb = label(LANE_LABEL[l]!, 20, C.tint, { stroke: C.ink, sw: 5, weight: '900' });
      const dir = LANE_DIR[l]!;
      lb.position.set(p.x + dir.x * 104, p.y + dir.y * 46);
      boardC.addChild(lb);
    }

    splatC = new Container();
    noteC = new Container();
    linkG = new Graphics();
    boardC.addChild(splatC, linkG, noteC);

    // the inkwell: a bottle with eyes at the middle of the board; its fill is the ink you carry
    wellC = new Container();
    wellC.position.set(CX, CY + 22);
    wellC.scale.set(0.8);
    const shadow = new Graphics().ellipse(0, 4, 54, 17).fill({ color: C.ink, alpha: 0.8 });
    const inner2 = new Container();
    const body = new Graphics();
    body.roundRect(-40, -62, 80, 66, 20).fill(C.tint).stroke({ width: 8, color: C.ink, join: 'round' });
    body.roundRect(-16, -86, 32, 28, 6).fill(C.tint).stroke({ width: 8, color: C.ink, join: 'round' });
    body.roundRect(-20, -98, 40, 18, 6).fill(C.white).stroke({ width: 7, color: C.ink, join: 'round' });
    body.moveTo(-28, -50).lineTo(-28, -22).stroke({ width: 3, color: C.white, alpha: 0.7, cap: 'round' });
    wellFill = new Graphics();
    wellFill.roundRect(-33, -56, 66, 56, 10).fill(C.lime).moveTo(-33, -56).lineTo(33, -56).stroke({ width: 4, color: C.ink });
    wellFill.position.set(0, 0);
    const quill = new Graphics();
    quill.moveTo(10, -98).quadraticCurveTo(46, -150, 62, -176).stroke({ width: 10, color: C.ink, cap: 'round' });
    quill.moveTo(10, -98).quadraticCurveTo(46, -150, 62, -176).stroke({ width: 4, color: C.white, cap: 'round' });
    inner2.addChild(quill, body, wellFill);
    eyes = new Eyes({ size: 9, color: C.white, pupil: C.ink });
    eyes.container.position.set(0, -36);
    inner2.addChild(eyes.container);
    wellC.addChild(shadow, inner2);
    wellSS = new SquashStretch(inner2);
    boardC.addChild(wellC);

    fxC = new Container();
    world.addChild(fxC);
    particles = new Particles(world, { confettiColors: [C.white, C.tint, C.lime, C.line] });
    view.onFrame((dt) => { particles.update(dt); eyes.update(dt); wellSS.update(dt, 0, 0); frame(dt); });

    dangerG = new Graphics();
    dangerG.rect(8, 8, 1264, 784).stroke({ width: 14, color: C.lime });
    dangerG.alpha = 0;
    ui.addChild(dangerG);
  }

  function buildHud(): void {
    // pages (top left)
    const pl = label('PAGES', 20, C.tint, { anchor: [0, 0.5] });
    pl.position.set(40, 30);
    ui.addChild(pl);
    pageIcons = [];
    for (let i = 0; i < 6; i++) {
      const g = new Graphics();
      g.position.set(58 + i * 46, 78);
      g.visible = false;
      ui.addChild(g);
      pageIcons.push(g);
    }
    // set badge (top centre) with a progress rail
    const sb = sticker(400, 76, C.tint, 16);
    sb.position.set(CX, 48);
    ui.addChild(sb);
    setText = label('', 28, C.ink, { weight: '900' });
    setText.position.set(CX, 36);
    infoText = label('', 20, C.board, { weight: '800' });
    infoText.position.set(CX, 62);
    ui.addChild(infoText);
    ui.addChild(setText);
    railG = new Graphics();
    ui.addChild(railG);
    // score (top right)
    const sc = sticker(300, 64, C.board, 16);
    sc.position.set(1100, 46);
    ui.addChild(sc);
    scoreText = label('0', 40, C.white, { anchor: [1, 0.5] });
    scoreText.position.set(1236, 46);
    ui.addChild(scoreText);
    const scl = label('SCORE', 20, C.tint, { anchor: [0, 0.5] });
    scl.position.set(968, 46);
    ui.addChild(scl);
    comboText = label('', 22, C.tint, { anchor: [1, 0.5] });
    comboText.position.set(1150, 112);
    ui.addChild(comboText);
    multBadge = new Container();
    const mb = sticker(78, 56, C.white, 16);
    multText = label('x1', 32, C.ink, { weight: '900' });
    multBadge.addChild(mb, multText);
    multBadge.position.set(1208, 112);
    ui.addChild(multBadge);
    // ink drops + stamp prompt (bottom): the currency sits beside where it is spent
    dropsC = new Container();
    ui.addChild(dropsC);
    stampC = new Container();
    stampC.position.set(900, 740);
    ui.addChild(stampC);
    railFever = new Graphics();
    ui.addChild(railFever);
    stickerRow = new Container();
    stickerRow.position.set(46, 740);
    ui.addChild(stickerRow);
  }

  function rebuildDrops(): void {
    dropsMax = sim.stats().inkMax;
    dropsC.removeChildren().forEach((c) => c.destroy());
    dropGs = [];
    const gap = Math.min(34, 460 / dropsMax);
    const x0 = 430 - ((dropsMax - 1) * gap) / 2 + 40;
    const lab = label('INK', 20, C.tint, { anchor: [1, 0.5] });
    lab.position.set(x0 - 30, 742);
    dropsC.addChild(lab);
    for (let i = 0; i < dropsMax; i++) {
      const g = new Graphics();
      g.position.set(x0 + i * gap, 742);
      dropsC.addChild(g);
      dropGs.push(g);
    }
  }

  let dropsKey = '';
  function updateDrops(): void {
    if (dropsMax !== sim.stats().inkMax) { rebuildDrops(); dropsKey = ''; }
    const full = Math.floor(s.ink);
    const cost = sim.stats().cost;
    const ready = s.ink >= cost;
    const part = Math.round((s.ink - full) * 4);
    const key = `${full}|${part}|${cost}|${ready}`;
    if (key === dropsKey) return; // Graphics rebuilds are costly: only redraw when something changed
    dropsKey = key;
    dropGs.forEach((g, i) => {
      g.clear();
      const filled = i < full;
      drop(g, 36).fill(filled ? C.lime : C.board).stroke({ width: 7, color: C.ink, join: 'round' });
      drop(g, 36).stroke({ width: 2, color: filled ? C.white : i < cost ? C.white : C.line, alpha: filled || i < cost ? 1 : 0.8, join: 'round' });
      if (i === full && part > 0) drop(g, 36).fill({ color: C.lime, alpha: part * 0.18 });
    });
  }

  function updateStamp(): void {
    const st = sim.stats();
    const fever = s.feverT > 0;
    const locked = !fever && s.setT < s.stampLock;
    const ready = !fever && !locked && s.ink >= st.cost && s.phase === 'play';
    const key = `${fever ? 'f' : locked ? 'l' : ready ? 'r' : 'n'}|${glyph('rb')}|${st.cost}|${Math.round(bal('feverMult') * 10)}`;
    if (key !== stampKey) {
      stampKey = key;
      stampC.removeChildren().forEach((c) => c.destroy());
      let plate: Container;
      if (fever) plate = hintPlate([`FEVER x${bal('feverMult')}`], 26, C.lime);
      else if (locked) plate = hintPlate(['Ink drying...'], 22, C.board);
      else plate = hintPlate([{ key: glyph('rb') }, ready ? 'STAMP!' : `STAMP at ${st.cost}`], 24, ready ? C.lime : C.board);
      if (fever) { const t = plate.children[plate.children.length - 1] as ReturnType<typeof label>; t.style.fill = C.ink; }
      if (ready) { const t = plate.children[plate.children.length - 1] as ReturnType<typeof label>; t.style.fill = C.ink; }
      stampC.addChild(plate);
    }
    stampC.scale.set(ready ? 1 + 0.06 * Math.sin(time * 9) : 1);
    railFever.clear();
    if (fever) {
      const w = 200 * (s.feverT / s.feverMax);
      railFever.roundRect(800, 774, 200, 10, 5).fill(C.ink).roundRect(800, 774, Math.max(2, w), 10, 5).fill(C.lime);
    }
  }

  const bal = (id: string) => ctx.balance[id] ?? BALANCE.find((b) => b.id === id)!.default;

  function updateHud(): void {
    // pages
    const maxP = Math.min(6, s.pagesMax);
    const pk = `${maxP}|${s.pages}`;
    if (pk !== pagesKey) {
      pagesKey = pk;
      pageIcons.forEach((g, i) => {
        g.visible = i < maxP;
        if (!g.visible) return;
        g.clear();
        sheet(g, 30, 40, i < s.pages ? C.white : C.bg, i < s.pages);
        g.alpha = i >= s.pages ? 0.55 : 1;
      });
    }
    if (lastPages >= 0 && s.pages < lastPages) {
      const g = pageIcons[s.pages];
      if (g) { g.rotation = 0.5; g.y = 78; tween(g, { rotation: 0, y: 78 }, 500, ease.outBounce); }
    }
    lastPages = s.pages;
    const cfg = s.cfg;
    const t = `SET ${s.set + 1}/${SETS.length}  ${cfg.name.toUpperCase()}`;
    if (t !== lastLabels.s) { lastLabels.s = t; setText.text = t; infoText.text = cfg.info.toUpperCase(); }
    // rail
    const total = s.endT + 4 * s.beatDur;
    const prog = Math.max(0, Math.min(1, (s.setT + 4 * s.beatDur) / total));
    const rk = Math.round(prog * 300);
    if (rk !== railKey) { railKey = rk; drawRail(prog); }
  }

  function drawRail(prog: number): void {
    railG.clear();
    railG.moveTo(CX - 150, 96).lineTo(CX + 150, 96).stroke({ width: 8, color: C.ink, cap: 'round' });
    railG.moveTo(CX - 150, 96).lineTo(CX + 150, 96).stroke({ width: 2, color: C.line });
    railG.moveTo(CX - 150, 96).lineTo(CX - 150 + 300 * prog, 96).stroke({ width: 4, color: C.white, cap: 'round' });
    railG.circle(CX - 150 + 300 * prog, 96, 7).fill(C.white).stroke({ width: 4, color: C.ink });
  }

  function updateScore(): void {
    // text is rasterised on every change, so the count-up refreshes every third frame (and exactly on arrival)
    const shown = Math.round(s.displayScore);
    if (shown !== scoreShown && (frameNo % 3 === 0 || s.displayScore === s.score)) { scoreShown = shown; scoreText.text = shown.toLocaleString('en-US'); }
    comboText.text = s.combo > 1 ? `COMBO ${s.combo}` : '';
    multText.text = `x${s.mult}`;
    multBadge.alpha = 1;
  }

  function updateStickersRow(): void {
    if (lastStickers === s.stickers.length) return;
    lastStickers = s.stickers.length;
    stickerRow.removeChildren().forEach((c) => c.destroy());
    s.stickers.forEach((id, i) => {
      const c = new Container();
      c.addChild(sticker(60, 52, C.white, 12));
      const ic = stickerIcon(id);
      ic.scale.set(0.5);
      c.addChild(ic);
      c.position.set(i * 66, 0);
      c.rotation = (i % 2 ? 1 : -1) * 0.07;
      stickerRow.addChild(c);
      c.scale.set(0.2);
      tween(c, { scale: 1 }, 300, ease.outBack);
    });
  }

  // ---------------------------------------------------------------- notes
  function makeNoteView(n: Note): NoteView {
    const g = new Graphics();
    if (n.pair) {
      // doubles wear a second outline and a solid core so they read as "two at once"
      g.poly([0, -34, 58, 0, 0, 34, -58, 0]).fill(C.ink);
      g.poly([0, -28, 50, 0, 0, 28, -50, 0]).stroke({ width: 3, color: C.white });
      g.poly([0, -20, 34, 0, 0, 20, -34, 0]).fill(C.white).stroke({ width: 8, color: C.ink, join: 'round' });
      g.poly([0, -8, 14, 0, 0, 8, -14, 0]).fill(C.line);
    } else {
      g.poly([0, -25, 42, 0, 0, 25, -42, 0]).fill(n.len > 0 ? C.tint : C.white).stroke({ width: 9, color: C.ink, join: 'round' });
      g.poly([0, -11, 19, 0, 0, 11, -19, 0]).stroke({ width: 2.5, color: C.line });
    }
    noteC.addChild(g);
    let ribbon: Graphics | null = null;
    if (n.len > 0) { ribbon = new Graphics(); noteC.addChildAt(ribbon, 0); }
    return { g, ribbon, fading: false };
  }

  function drawNotes(tNow: number): void {
    const ap = bal('approach');
    linkG.clear();
    for (const n of s.notes) {
      const v0 = noteViews.get(n.id);
      const alive = n.state === 'live' || n.state === 'holding';
      if (!v0) {
        if (!alive) continue;
        if (n.t - tNow > ap + 0.05 || n.t - tNow < -0.4) continue;
      }
      const v = v0 ?? makeNoteView(n);
      if (!v0) noteViews.set(n.id, v);
      if (!alive && !v.fading) {
        if (n.state === 'hit' || n.state === 'cleared') {
          v.g.destroy(); v.ribbon?.destroy(); noteViews.delete(n.id);
          continue;
        }
        v.fading = true; // missed or dropped: it drifts on and fades
        tween(v.g, { alpha: 0, scale: 0.3 }, 420, ease.inQuad, { onComplete: () => { v.g.destroy(); v.ribbon?.destroy(); noteViews.delete(n.id); } });
        if (v.ribbon) tween(v.ribbon, { alpha: 0 }, 300, ease.linear);
      }
      const holding = n.state === 'holding';
      const p = holding ? 1 : 1 - (n.t - tNow) / ap;
      const pos = lanePoint(n.lane, p);
      v.g.position.set(pos.x, pos.y);
      if (!v.fading) {
        const sc = 0.6 + 0.55 * Math.min(1, Math.max(0, p));
        v.g.scale.set(sc * (holding ? 1 + 0.08 * Math.sin(time * 30) : 1));
        v.g.alpha = Math.min(1, p / 0.08 + 0.1);
      }
      if (v.ribbon && !v.fading) {
        const pt = Math.max(0, 1 - (n.t + n.len - tNow) / ap);
        const a = lanePoint(n.lane, pt);
        v.ribbon.clear();
        const wdt = 26 * (0.45 + 0.7 * Math.min(1, (p + pt) / 2));
        v.ribbon.moveTo(a.x, a.y).lineTo(pos.x, pos.y).stroke({ width: wdt + 12, color: C.ink, cap: 'round' });
        v.ribbon.moveTo(a.x, a.y).lineTo(pos.x, pos.y).stroke({ width: wdt, color: holding ? C.white : C.tint, cap: 'round' });
        v.ribbon.moveTo(a.x, a.y).lineTo(pos.x, pos.y).stroke({ width: 3, color: C.line });
        v.ribbon.alpha = holding ? 0.8 + 0.2 * Math.sin(time * 30) : 1;
      }
    }
  }

  // ---------------------------------------------------------------- per frame
  function frame(dt: number): void {
    time += dt;
    pulse = chase(pulse, 0, 0.12);
    boardC.scale.set(1 + 0.014 * pulse);
    // well fill follows the ink; the level only moves toward it, so a blot arriving makes it rise
    const target = Math.min(1, s.ink / Math.max(1, sim.stats().inkMax));
    wellLevel = chase(wellLevel, target, target < wellLevel ? 0.12 : 0.2);
    wellFill.visible = wellLevel > 0.01;
    wellFill.scale.set(1 + 0.02 * Math.sin(time * 6) * s.inkBand, Math.max(0.05, wellLevel));
    const danger = s.phase === 'play' && s.ink >= sim.stats().inkMax - 1.01 && s.ink > 0;
    dangerG.alpha = danger ? 0.25 + 0.25 * Math.sin(time * 10) : chase(dangerG.alpha, 0, 0.2);
    dangerG.visible = dangerG.alpha > 0.02;
    feverG.alpha = chase(feverG.alpha, s.feverT > 0 ? 0.5 + 0.5 * Math.sin(time * 12) * 0.4 : 0, 0.2);
    feverG.visible = feverG.alpha > 0.02;
    latticeFever.visible = latticeFever.alpha > 0.02;
    latticeFever.alpha = chase(latticeFever.alpha, s.feverT > 0 ? 0.7 + 0.3 * Math.sin(time * 10) : 0, 0.25);
    wellC.rotation = danger ? Math.sin(time * 30) * 0.03 : Math.sin(time * 1.6) * 0.012;
    if (s.inkBand >= 2) eyes.setMood('worried', 0.2); else if (s.feverT > 0) eyes.setMood('happy', 0.2);
    for (let l = 0; l < 4; l++) {
      const t = targetLabels[l]!;
      const g = laneGlyph(l);
      if (t.text !== g) t.text = g;
      const down = s.laneDown[l];
      const base = laneRing(l).y;
      targets[l]!.y = chase(targets[l]!.y, base + (down ? 5 : 0), 0.4);
    }
    for (const st of streaks) st.alpha = chase(st.alpha, 0, 0.2);
    if (geyserT > 0) {
      geyserT -= dt;
      particles.emit('sparks', CX, CY - 40, { count: 5, color: ctx.vfxRng.next() < 0.5 ? C.lime : C.white, angle: -Math.PI / 2, spread: 0.7, speed: 2.4, size: 1.4 });
    }
    // holds shower sparks
    for (let l = 0; l < 4; l++) {
      if (s.laneHold[l]! >= 0 && ctx.vfxRng.next() < 0.5) {
        const p = laneRing(l);
        spark(p.x, p.y, l, C.white, 1, 0.7);
      }
    }
  }

  function bannerIntro(set: number): void {
    const cfg = SETS[set]!;
    banner(`SET ${set + 1}: ${cfg.name.toUpperCase()}`, C.white, C.ink, 2200, 196);
    showHint(hintFor(set), 5200);
  }

  // ---------------------------------------------------------------- overlays
  /** Best score on this device (a per-viewer convenience: wrapped so private windows and blocked storage still work). */
  function bestScore(update?: number): number {
    try {
      const key = 'mgb.blotbeat.best';
      const prev = Number(localStorage.getItem(key) ?? 0) || 0;
      if (update !== undefined && update > prev) { localStorage.setItem(key, String(Math.round(update))); return Math.round(update); }
      return prev;
    } catch { return Math.round(update ?? 0); }
  }

  function buildPick(): void {
    overlay?.destroy();
    const o = new Container();
    const dim = new Graphics().rect(0, 0, 1280, 800).fill({ color: C.ink, alpha: 0.78 });
    o.addChild(dim);
    const title = sticker(560, 84, C.white, 18);
    title.position.set(CX, 92);
    const tt = label(`SET ${s.set + 1} DONE`, 40, C.ink, { weight: '900' });
    tt.position.set(CX, 82);
    const ts = label('Pick a sticker to keep for the rest of the run', 22, C.board);
    ts.position.set(CX, 116);
    o.addChild(title, tt, ts);
    const cards: Container[] = [];
    s.options.forEach((id, i) => {
      const def = STICKERS.find((x) => x.id === id)!;
      const c = new Container();
      c.addChild(sticker(272, 330, C.tint, 22));
      const circle = new Graphics().circle(0, -92, 62).fill(C.white).stroke({ width: 7, color: C.ink });
      const ini = stickerIcon(id);
      ini.y = -92;
      ini.scale.set(1.15);
      const nm = label(def.name, 30, C.ink, { weight: '900' });
      nm.y = 4;
      const tx = label(def.text, 22, C.board, { weight: '700', align: 'center' });
      tx.style.wordWrap = true;
      tx.style.wordWrapWidth = 220;
      tx.y = 72;
      c.addChild(circle, ini, nm, tx);
      c.position.set(CX + (i - (s.options.length - 1) / 2) * 316, 400);
      c.rotation = (i - 1) * 0.04;
      c.scale.set(0.1);
      o.addChild(c);
      cards.push(c);
    });
    // bumper glyphs at the ends of the cyclable row, laid out horizontally
    const lb = chip(glyph('lb'), 24);
    lb.position.set(CX - 1.5 * 316 - 6, 400);
    const rb = chip(glyph('rb'), 24);
    rb.position.set(CX + 1.5 * 316 + 6, 400);
    o.addChild(lb, rb);
    const hint = hintPlate([{ key: glyph('a') }, 'Stick it on', { key: glyph('lb') }, { key: glyph('rb') }, 'Choose'], 24);
    hint.position.set(CX, 690);
    o.addChild(hint);
    if (s.lastTidy) {
      const tp = sticker(520, 56, C.white, 16);
      const tl = label(s.lastTidy === 'page' ? 'TIDY SET! Three blots or fewer: a page is back' : 'TIDY SET! Three blots or fewer: bonus 2,500', 24, C.ink, { weight: '900' });
      const tc = new Container();
      tc.addChild(tp, tl);
      tc.position.set(CX, 168);
      tc.rotation = 0.02;
      tc.scale.set(0.2);
      o.addChild(tc);
      tween(tc, { scale: 1 }, 320, ease.outBack, { delay: 250 });
    }
    o.name = 'pick';
    (o as Container & { cards: Container[] }).cards = cards;
    ui.addChild(o);
    overlay = o;
    overlayKind = 'pick';
  }

  function updatePick(): void {
    if (!overlay || overlayKind !== 'pick') return;
    const cards = (overlay as Container & { cards: Container[] }).cards;
    cards.forEach((c, i) => {
      const on = i === s.cursor;
      const want = on ? 1.1 : 0.94;
      c.scale.set(chase(c.scale.x, want, 0.25));
      c.alpha = on ? 1 : 0.75;
      c.y = chase(c.y, on ? 384 : 404, 0.25);
    });
  }

  function buildEnd(win: boolean): void {
    overlay?.destroy();
    const o = new Container();
    const dim = new Graphics().rect(0, 0, 1280, 800).fill({ color: C.ink, alpha: win ? 0.7 : 0.82 });
    o.addChild(dim);
    const b = sticker(win ? 520 : 640, 110, win ? C.white : C.lime, 20);
    b.position.set(CX, 110);
    const title = label(win ? 'SIGNED!' : 'OUT OF PAGES', 62, C.ink, { weight: '900' });
    title.position.set(CX, 104);
    const sub = label(win ? 'You finished all four sets. This one is a win.' : 'Too much ink: the last page spilled. This run is over.', 24, C.tint);
    sub.position.set(CX, 188);
    o.addChild(b, title, sub);
    b.scale.set(0.1); title.scale.set(0.1);
    tween(b, { scale: 1 }, 400, ease.outBack);
    tween(title, { scale: 1 }, 400, ease.outBack);
    const plate = sticker(560, 352, C.board, 22);
    plate.position.set(CX, 420);
    o.addChild(plate);
    const prevBest = bestScore();
    const best = bestScore(s.score);
    const isNew = s.score > prevBest;
    const rows = ['Score', 'Accuracy', 'Best combo', 'Stamps', 'Pages left', isNew ? 'Best run: NEW!' : 'Best run'];
    const vals: ReturnType<typeof label>[] = [];
    rows.forEach((r, i) => {
      const l = label(r, 28, C.tint, { anchor: [0, 0.5] });
      l.position.set(CX - 240, 288 + i * 52);
      const v = label('', 32, C.white, { anchor: [1, 0.5] });
      v.position.set(CX + 240, 288 + i * 52);
      o.addChild(l, v);
      vals.push(v);
    });
    (o as Container & { vals: typeof vals; best: number }).vals = vals;
    (o as Container & { best: number }).best = best;
    if (win) {
      const sg = new Graphics();
      sg.position.set(CX, 662);
      o.addChild(sg);
      (o as Container & { sig: Graphics }).sig = sg;
      sigPoints = [];
      for (let i = 0; i <= 90; i++) {
        const u = i / 90;
        sigPoints.push(-170 + u * 340, Math.sin(u * 22) * (14 + 16 * Math.sin(u * 3.1)) * (1 - u * 0.4) + (u > 0.8 ? -(u - 0.8) * 60 : 0));
      }
    }
    const cards = hintPlate([{ key: glyph('a') }, 'Play again', { key: 'Start' }, 'Menu'], 26);
    cards.position.set(CX, 740);
    cards.alpha = 0;
    o.addChild(cards);
    (o as Container & { cards: Container }).cards = cards;
    ui.addChild(o);
    overlay = o;
    overlayKind = win ? 'won' : 'lost';
    overlayBuilt = true;
  }

  function updateEnd(): void {
    if (!overlay || (overlayKind !== 'won' && overlayKind !== 'lost')) return;
    const o = overlay as Container & { vals: ReturnType<typeof label>[]; sig?: Graphics; cards: Container; best: number };
    const t0 = overlayKind === 'won' ? 1.4 : 0.9;
    const k = (i: number) => Math.max(0, Math.min(1, (s.endT2 - t0 - i * 0.35) / 0.9));
    const acc = s.notesTotal ? s.hits / s.notesTotal : 0;
    o.vals[0]!.text = Math.round(s.score * k(0)).toLocaleString('en-US');
    o.vals[1]!.text = `${Math.round(acc * 100 * k(1))}%`;
    o.vals[2]!.text = String(Math.round(s.maxCombo * k(2)));
    o.vals[3]!.text = String(Math.round(s.stamps * k(3)));
    o.vals[4]!.text = String(Math.round(Math.max(0, s.pages) * k(4)));
    o.vals[5]!.text = Math.round((o as unknown as { best: number }).best * k(5)).toLocaleString('en-US');
    if (o.sig) {
      const n = Math.floor(sigPoints.length / 2 * Math.max(0, Math.min(1, (s.endT2 - 0.8) / 1.6)));
      o.sig.clear();
      if (n > 1) {
        o.sig.moveTo(sigPoints[0]!, sigPoints[1]!);
        for (let i = 1; i < n; i++) o.sig.lineTo(sigPoints[i * 2]!, sigPoints[i * 2 + 1]!);
        o.sig.stroke({ width: 10, color: C.ink, join: 'round', cap: 'round' });
        o.sig.moveTo(sigPoints[0]!, sigPoints[1]!);
        for (let i = 1; i < n; i++) o.sig.lineTo(sigPoints[i * 2]!, sigPoints[i * 2 + 1]!);
        o.sig.stroke({ width: 4, color: C.white, join: 'round', cap: 'round' });
      }
    }
    o.cards.alpha = s.endT2 > 3 ? 1 : 0;
  }

  // ---------------------------------------------------------------- events
  function laneHit(e: SimEvent, grade: string, auto: boolean): void {
    const lane = Number(e.data?.lane ?? 0);
    const x = e.x ?? CX;
    const y = e.y ?? CY;
    const d = D()[lane]!;
    const m = e.magnitude ?? 0.5;
    const col = grade === 'perfect' ? C.white : C.tint;
    const delay = auto ? 120 + Number(e.data?.order ?? 0) * 28 : 0;
    const fire = () => {
      playKind(String(e.data?.kind ?? LANE_KIND[lane]), Number(e.data?.midi ?? 60), (auto ? 0.55 : grade === 'perfect' ? 0.9 : grade === 'good' ? 0.75 : 0.6), d.x * 0.35);
      spark(x, y, lane, col, grade === 'perfect' ? 14 : 8, 1 + m);
      ringPulse(x, y, 60 + m * 40, col, 340, grade === 'perfect' ? 5 : 3);
      punch(targets[lane]!, 0.3 + m * 0.2);
      streaks[lane]!.alpha = grade === 'perfect' ? 0.9 : 0.55;
      const g = targets[lane]!.children[0] as Graphics;
      flash(g as unknown as Container, 0xffffff, 120);
      const early = Number(e.data?.early ?? 0);
      const tag = grade === 'perfect' ? '' : early > 0.03 ? ' (early)' : early < -0.03 ? ' (late)' : '';
      if (!auto) badgePop(grade.toUpperCase() + tag, x + d.x * 96, y + d.y * 70 - 6, grade === 'perfect' ? C.white : grade === 'good' ? C.tint : C.line, grade === 'ok' ? C.white : C.ink, grade === 'perfect' ? 24 : 20);
    };
    if (delay > 0) tween({ v: 0 }, { v: 1 }, delay, ease.linear, { onComplete: fire }); else fire();
    wellSS.pop(0.1 + 0.1 * m, 'y');
    if (grade === 'perfect') eyes.setMood('happy', 0.4);
    shake(grade === 'perfect' ? 0.07 : 0.03);
  }

  function onEvent(e: SimEvent): void {
    const dd = e.data ?? {};
    switch (e.type) {
      case 'set-start': break; // the intro runs from render() so it also covers the very first set
      case 'beat': {
        pulse = Math.max(pulse, Number(e.magnitude ?? 0.4));
        if (dd.countIn) {
          play(Number(dd.beat) % Number(dd.bar) === 0 ? 'tickHi' : 'tickLo');
          numberPop(world, String(Number(dd.beat) + Number(dd.bar) + 1), CX, CY - 150, { size: 72, color: C.white, stroke: C.ink, ms: Math.max(300, s.beatDur * 900), rise: 10, font: FONT });
        }
        else if (s.inkBand >= 3) play('warn', { volume: 0.6 });
        wellSS.pop(0.08, 'y');
        {
          const down = Number(dd.beat) % Number(dd.bar) === 0;
          const br = new Graphics().ellipse(0, 0, RING_RX, RING_RY).stroke({ width: down ? 4 : 2, color: down ? C.white : C.tint, alpha: down ? 0.7 : 0.45 });
          br.position.set(CX, CY);
          br.scale.set(1.7);
          boardC.addChildAt(br, boardC.getChildIndex(splatC));
          tween(br, { scale: 1, alpha: 0 }, Math.max(200, s.beatDur * 900), ease.outCubic, { onComplete: () => br.destroy() });
        }
        break;
      }
      case 'hit': laneHit(e, String(dd.grade), Boolean(dd.auto)); break;
      case 'hold-start': {
        laneHit(e, String(dd.grade), false);
        play('holdHum', { pitch: pitchFor(Number(dd.midi ?? 60), 69), volume: 0.7, variation: 0, pan: D()[Number(dd.lane)]!.x * 0.3 });
        break;
      }
      case 'hold-done': {
        const lane = Number(dd.lane);
        play('holdDone', { pan: D()[lane]!.x * 0.3 });
        particles.emit('confetti', e.x ?? CX, e.y ?? CY, { count: 12, speed: 0.8 });
        ringPulse(e.x ?? CX, e.y ?? CY, 90, C.white, 400, 5);
        badgePop('HELD', (e.x ?? CX) + D()[lane]!.x * 96, (e.y ?? CY) + D()[lane]!.y * 70, C.white, C.ink, 22);
        shake(0.08);
        break;
      }
      case 'hold-drop': play('holdDrop'); badgePop('DROPPED', e.x ?? CX, (e.y ?? CY) - 20, C.board, C.white, 20); break;
      case 'free-tap': {
        const lane = Number(dd.lane);
        playKind(LANE_KIND[lane]!, freeMidi(LANE_KIND[lane]!), 0.3, D()[lane]!.x * 0.3);
        punch(targets[lane]!, 0.2);
        ringPulse(e.x ?? CX, e.y ?? CY, 46, C.line, 260, 3);
        wellSS.pop(0.06, 'y');
        break;
      }
      case 'stray': {
        play('stray');
        shake(0.12);
        punch(targets[Number(dd.lane)]!, -0.2);
        badgePop('STRAY', e.x ?? CX, (e.y ?? CY) - 28, C.board, C.white, 20);
        eyes.setMood('frown', 0.4);
        break;
      }
      case 'miss': {
        const lane = Number(dd.lane);
        const free = Boolean(dd.free);
        play('splat', { volume: free ? 0.3 : 0.7, pan: D()[lane]!.x * 0.3, pitch: 1 - 0.05 * s.inkBand });
        shake(0.14 + 0.05 * s.inkBand);
        eyes.setMood('frown', 0.6);
        wellSS.pop(0.2, 'x');
        particles.emit('puff', e.x ?? CX, e.y ?? CY, { count: 8, color: C.lime, speed: 0.8 });
        break;
      }
      case 'blot': {
        const x = e.x ?? CX; const y = e.y ?? CY;
        addSplat(x, y);
        particles.emit('debris', x, y, { count: 12, color: C.lime, speed: 1.1, size: 0.9 });
        flyDrop(x, y, 260, C.lime, () => { play('glug', { pitch: 1 + 0.06 * Math.floor(s.ink) }); wellSS.pop(0.25, 'y'); punch(wellC, 0.12); });
        if (!seenFirstBlot) {
          seenFirstBlot = true;
          showHint([`A miss drops a blot. At ${sim.stats().cost} blots,`, { key: glyph('rb') }, 'STAMP it into a fever'], 5200);
        }
        break;
      }
      case 'drip': {
        flyDrop(CX + (Number(dd.lane) - 1.5) * 40, 150, 0, C.lime, () => { play('glug', { pitch: 1.5 }); wellSS.pop(0.2, 'y'); });
        play('warn', { pitch: 1.6 });
        if (!seenDrip) { seenDrip = true; showHint(['The well is leaking now. Do not sit on a full well:', { key: glyph('rb') }, 'STAMP'], 5200); }
        break;
      }
      case 'ink-band': syncMusic(); break;
      case 'combo-up': {
        const mult = Number(dd.mult);
        play('comboUp', { pitch: 2 ** (((mult - 2) * 2) / 12), volume: 0.8 });
        punch(multBadge, 0.5);
        flash(multBadge, 0xffffff, 160);
        numberPop(world, `x${mult}`, CX, CY - 150, { size: 54, color: C.white, stroke: C.ink, ms: 700, rise: 40, font: FONT });
        break;
      }
      case 'combo-break': badgePop('combo lost', CX, CY + 140, C.board, C.tint, 22, 700, 16); break;
      case 'dry': play('dry'); break;
      case 'siphon': {
        play('glug', { pitch: 1.3 });
        particles.emit('sparks', e.x ?? CX, e.y ?? CY, { count: 14, color: C.lime, speed: 1.4 });
        badgePop('SIPHON', e.x ?? CX, (e.y ?? CY) - 44, C.lime, C.ink, 22, 700);
        break;
      }
      case 'stamp': {
        const m = e.magnitude ?? 0.7;
        play('stampBoom'); play('stampCrack'); play('stampRise');
        shake(0.55 + 0.4 * m);
        // no hit-stop in a rhythm game: freezing the sim would slide every note off the music
        const pad = new Container();
        const pg = sticker(230, 130, C.lime, 28, C.ink);
        const pt = label('STAMP!', 46, C.ink, { weight: '900' });
        pad.addChild(pg, pt);
        pad.position.set(CX, CY - 520);
        pad.scale.set(1.8);
        pad.rotation = -0.12;
        fxC.addChild(pad);
        tween(pad, { y: CY - 40, scale: 1, rotation: 0.03 }, 130, ease.inQuad, {
          onComplete: () => {
            ringPulse(CX, CY, 380, C.lime, 600, 12);
            ringPulse(CX, CY, 560, C.white, 800, 5);
            ringPulse(CX, CY, 250, C.lime, 480, 8);
            flash(boardC, 0xffffff, 160, 0.3);
            particles.emit('confetti', CX, CY, { count: 48, speed: 1.8 });
            particles.emit('sparks', CX, CY, { count: 40, color: C.lime, speed: 2 });
            tween(pad, { alpha: 0, y: CY - 60 }, 600, ease.outCubic, { delay: 350, onComplete: () => pad.destroy() });
          },
        });
        suckSplats(0);
        wellSS.pop(0.5, 'y');
        eyes.setMood('happy', 1.4);
        banner(`FEVER x${bal('feverMult')}`, C.lime, C.ink, 1100, 196, 'Misses cost half. Everything on the board is hit.');
        syncMusic();
        break;
      }
      case 'fever-end': play('feverEnd'); syncMusic(); ringPulse(CX, CY, 140, C.tint, 400, 4); break;
      case 'spill': {
        play('spill'); play('spillDrop');
        shake(1);
        flash(boardC, C.lime, 300, 0.4);
        burstSplats();
        particles.emit('debris', CX, CY, { count: 60, color: C.lime, speed: 2.4, size: 1.3 });
        particles.emit('puff', CX, CY, { count: 20, color: C.lime, speed: 1.6, size: 1.6 });
        const flood = new Graphics().poly([0, -HH, HW, 0, 0, HH, -HW, 0]).fill({ color: C.lime, alpha: 0.55 }).stroke({ width: 10, color: C.ink, join: 'round' });
        flood.position.set(CX, CY);
        flood.scale.set(0.1);
        fxC.addChild(flood);
        tween(flood, { scale: 1.02 }, 380, ease.outCubic);
        tween(flood, { alpha: 0 }, 700, ease.inQuad, { delay: 380, onComplete: () => flood.destroy() });
        wellSS.pop(0.6, 'x');
        eyes.setMood('frown', 2);
        const left = Number(dd.pages);
        banner('PAGE RUINED', C.lime, C.ink, 1700, 196, left > 0 ? `${left} ${left === 1 ? 'page' : 'pages'} left. The ink is cleared.` : 'No pages left.');
        syncMusic();
        break;
      }
      case 'tidy': {
        play('holdDone', { pitch: 1.5 });
        particles.emit('confetti', CX, CY - 30, { count: 36, speed: 1.6 });
        break;
      }
      case 'set-end': {
        play('stick');
        particles.emit('confetti', CX, CY - 50, { count: 40, speed: 1.4 });
        break;
      }
      case 'pick-open': {
        music.setParts(partsFor(s.set, 0, false, true), 0.5);
        music.stinger(stingerFor('pick', s.set), { duck: 0.4 });
        buildPick();
        play('stick');
        break;
      }
      case 'cursor': play('cardMove'); break;
      case 'sticker': {
        play('stick', { pitch: 1.2 });
        overlay?.destroy(); overlay = null;
        particles.emit('confetti', CX, 400, { count: 36, speed: 1.4 });
        break;
      }
      case 'win': {
        music.setParts(['pad', 'bass'], 0.3);
        music.stinger(stingerFor('win', s.set), { duck: 0.3 });
        play('stampBoom'); shake(0.7);
        for (let i = 0; i < 4; i++) tween({ v: 0 }, { v: 1 }, i * 260, ease.linear, { onComplete: () => particles.emit('confetti', CX + (i - 1.5) * 220, CY - 60, { count: 50, speed: 2 }) });
        eyes.setMood('happy', 4);
        wellSS.pop(0.7, 'y');
        geyserT = 1.8;
        tween(wellC, { scale: 1.3 }, 380, ease.outBack, { onComplete: () => tween(wellC, { scale: 0.8 }, 700, ease.outElastic) });
        ringPulse(CX, CY, 520, C.white, 900, 6);
        ringPulse(CX, CY, 360, C.lime, 700, 10);
        tween({ v: 0 }, { v: 1 }, 700, ease.linear, { onComplete: () => { if (s.phase === 'won') buildEnd(true); } });
        break;
      }
      case 'gameover': {
        music.release(1.2);
        music.stinger(stingerFor('lose', s.set), { duck: 0.3 });
        break;
      }
      case 'again': {
        clearViews();
        break;
      }
      default: break;
    }
  }

  return {
    meta: {
      slug: '2026-10-30-blotbeat',
      title: 'Blot Beat',
      question: 'Does a rhythm game where every miss becomes spendable ink make mistakes feel like fuel, while keeping real tension about how much ink to carry?',
      targetFeeling: 'cheeky, flowing controlled mess: the relief of a big stamp after nearly overflowing',
      mode: 'content',
    },
    balance: BALANCE,
    init(c: Ctx) { ctx = c; defineBlotSounds(); sim.init(c); },
    step(dt: number, input: InputState) { sim.step(dt, input); },
    events: () => sim.drain(),
    mount(v: View) {
      view = v;
      world = v.world as Container;
      ui = v.ui as Container;
      void (v.app as Application);
      buildScene();
      buildHud();
      unsubDevice = onDeviceChange(() => { stampKey = ''; });
    },
    render(alpha: number) {
      const tNow = (s.phase === 'play' ? s.setT - (1 - alpha) * FRAME_DT : s.setT) - bal('offset') / 1000;
      if (introFor !== s.set && s.phase === 'play') {
        introFor = s.set;
        bannerIntro(s.set);
      }
      sim.setKeyboard(getDevice() === 'keyboard');
      // captures step virtual time much faster than the wall clock the audio runs on; locking to the audio there would drag the sim back
      const wallMs = performance.now();
      if (Number.isNaN(clockBase)) clockBase = wallMs - view.frame.time * 1000;
      else if (Math.abs(wallMs - (view.frame.time * 1000 + clockBase)) > 400) virtualClock = true;
      if (s.phase === 'play') {
        // the music starts on the song's first beat (the count-in is silent ticks), and from then on the game's clock follows the audio playhead
        if (musicSet !== s.set && s.setT >= -0.14) {
          musicSet = s.set;
          syncState.bigFrames = 0;
          music.play(backingFor(s.set), partsFor(s.set, s.inkBand, s.feverT > 0));
        }
        const el = music.elapsed;
        if (el !== null && !virtualClock && musicSet === s.set && s.setT > 0.3 && !music.state.paused && music.state.songId === backingFor(s.set).id) {
          const act = syncStep(el - s.setT, syncState);
          if (act.resync) sim.resync(el); // after a pause or a hitch: jump to where the music is
          else if (act.nudge !== 0) sim.nudge(act.nudge);
        }
      }
      drawNotes(tNow);
      updateHud();
      frameNo++;
      updateScore();
      updateDrops();
      updateStamp();
      updateStickersRow();
      if (s.phase === 'pick') updatePick();
      if (s.phase === 'lost' && !overlayBuilt && s.endT2 > 1.6) buildEnd(false);
      updateEnd();
      if (s.ink >= sim.stats().cost && !seenStampReady && seenFirstBlot) {
        seenStampReady = true;
        if (s.feverT <= 0) showHint([{ key: glyph('rb') }, 'STAMP now, or carry more ink for a longer fever'], 4200);
      }
    },
    onEvent,
    telemetry: () => ({
      score: Math.round(s.score), hits: s.hits, perfects: s.perfects, misses: s.misses, strays: s.strays, stamps: s.stamps,
      spills: s.spills, blots: s.blots, maxCombo: s.maxCombo, setReached: s.set + 1,
      accuracy: s.notesTotal ? s.hits / s.notesTotal : 0, pagesLeft: s.pages, notesTotal: s.notesTotal, feverScore: Math.round(s.feverScore),
      drips: s.drips, tidySets: s.tidySets, scoreOrProgress: Math.round(s.score) + s.set * 1000,
    }),
    getState() {
      const o: Record<string, number> = {
        phase: PHASE[s.phase], t: s.setT, ink: s.ink, fever: s.feverT, cost: sim.stats().cost,
        held0: s.laneHold[0]! >= 0 ? 1 : 0, held1: s.laneHold[1]! >= 0 ? 1 : 0, held2: s.laneHold[2]! >= 0 ? 1 : 0, held3: s.laneHold[3]! >= 0 ? 1 : 0,
      };
      let i = 0;
      for (const n of s.notes) {
        if (n.state !== 'live') continue;
        if (i >= 6) break;
        o[`n${i}id`] = n.id; o[`n${i}l`] = n.lane; o[`n${i}t`] = n.t; o[`n${i}len`] = n.len;
        i++;
      }
      return o;
    },
    dispose() {
      music.stop();
      unsubDevice?.();
    },
  };
}
