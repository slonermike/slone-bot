import { Container, Graphics, Text, type Application } from 'pixi.js';
import { play, defineSound } from '../../audio/index.ts';
import { music } from '../../audio/music.ts';
import { glyph, stickGlyph } from '../../core/index.ts';
import { tween, ease, shake, hitStop, SquashStretch, Particles, chaseDt, clamp } from '../../juice/index.ts';
import type { Ctx, InputState, Prototype, SimEvent, View } from '../../core/types.ts';
import { BALANCE, LEVELS, LEVEL_COUNT, PR, Sim, partsFor, predictPath, type World } from './sim.ts';
import { makeMusic } from './music.ts';
import { arcPath } from './arc.ts';
import { live } from './live.ts';
export { bots } from './bots.ts';

const PAPER = 0xf3ecdc, INK = 0x1d1b22, CORAL = 0xff5638, SHADE = 0xe2d6bb, RIBBON = 0x8a7f6a, GOLD = 0xffc94a;
const SEMI = (n: number) => Math.pow(2, n / 12);

defineSound('hop', { wave: 'sine', freq: 420, slide: 1.6, attack: 0.002, sustain: 0.03, decay: 0.12, volume: 0.35 });
defineSound('land', { wave: 'noise', freq: 140, slide: -1, attack: 0.001, sustain: 0.02, decay: 0.12, lowpass: 700, transient: 0.3, volume: 0.35 });
defineSound('boing', { wave: 'sine', freq: 200, slide: 2.4, attack: 0.002, sustain: 0.05, decay: 0.3, vibratoDepth: 0.05, vibratoSpeed: 20, volume: 0.4 });
defineSound('chime', { wave: 'triangle', freq: 523, attack: 0.01, sustain: 0.15, decay: 0.7, transient: 0.1, volume: 0.45 });
defineSound('boom', { wave: 'sine', freq: 90, slide: -0.3, attack: 0.01, sustain: 0.3, decay: 1.4, lowpass: 400, volume: 0.5 });
defineSound('burn', { wave: 'noise', freq: 500, slide: -1.2, attack: 0.002, sustain: 0.1, decay: 0.5, lowpass: 1800, transient: 0.4, volume: 0.5 });
defineSound('shatter', { wave: 'noise', freq: 900, slide: -0.6, attack: 0.001, sustain: 0.05, decay: 0.35, highpass: 600, transient: 0.5, volume: 0.45 });
defineSound('tick', { wave: 'square', freq: 700, attack: 0.001, sustain: 0.01, decay: 0.05, volume: 0.15 });
defineSound('whoosh', { wave: 'noise', freq: 700, slide: -0.4, attack: 0.12, sustain: 0.1, decay: 0.4, lowpass: 1500, highpass: 200, volume: 0.25 });
defineSound('warn', { wave: 'sine', freq: 300, slide: -0.5, attack: 0.01, sustain: 0.1, decay: 0.4, volume: 0.25 });

export function createPrototype(): Prototype {
  const sim = new Sim();
  let ctx!: Ctx;
  let view: View; let W: Container, U: Container;
  let cam: Container, worldG: Graphics, fxG: Graphics, playerC: Container, halo: Graphics;
  let parts: Particles, ss: SquashStretch;
  let ptr: Graphics, badge: Graphics, badgeTxt: Text, hint: Text, veil: Graphics;
  let zoom = 0.8, zlog = Math.log(0.8), fx = 0, fy = 0, t = 0, safeT = 0, eyeOpen = 0, finale = 0;
  let song: ReturnType<typeof makeMusic>;
  let mode: 'calm' | 'tense' = 'calm';

  const label = (txt: string, size: number, fill = INK) => new Text({ text: txt, style: { fontFamily: 'Space Grotesk, sans-serif', fontWeight: '700', fontSize: size, fill } });
  const setMode = (m: 'calm' | 'tense') => { mode = m; music.play(m === 'calm' ? song.calm : song.tense, partsFor(sim.level, m === 'tense', finale > 0) as never); };
  const levelZoom = () => { const b = sim.bounds; return clamp(Math.min(1120 / (b.x1 - b.x0), 640 / (b.y1 - b.y0)), 0.55, 1); };

  function drawWorld(g: Graphics, w: World, idx: number) {
    const x = w.x, y = w.y, r = w.r, lim = ctx.balance.stayTime ?? 2.5;
    if (w.orbit) { g.circle(w.ox, w.oy, w.orbit.rad).stroke({ width: 2 / zoom, color: RIBBON, alpha: 0.25 }); }
    if (!w.on) { // ghost: where it will come back
      g.circle(x, y, r).stroke({ width: 2 / zoom, color: RIBBON, alpha: 0.28 });
      return;
    }
    const disc = (fill: number, a = 1) => { for (let k = 0; k < 4; k++) g.circle(x, y, r * (1 - k * 0.1)).fill({ color: k % 2 ? 0xf8f2e4 : fill, alpha: k === 0 ? a : 0.5 * a }); };
    const rim = (c = INK, wd = 4, a = 1) => g.circle(x, y, r).stroke({ width: wd, color: c, alpha: a });
    const standing = sim.grounded && sim.gi === idx;
    if (w.type !== 'sun' && w.type !== 'repel' && w.type !== 'home') g.circle(x, y, r * 1.7).stroke({ width: 2 / zoom, color: RIBBON, alpha: 0.1 + (!sim.grounded && Math.hypot(sim.x - x, sim.y - y) < r * 4 ? 0.1 * (1 + Math.sin(t * 5)) : 0) });
    switch (w.type) {
      case 'rock':
        disc(SHADE); rim();
        for (let k = 0; k < 3; k++) { const a0 = idx * 1.9 + k * 2.1, rr = r * (0.45 + 0.17 * k); arcPath(g, x, y, rr, a0, a0 + 1.5); g.stroke({ width: 2, color: RIBBON, alpha: 0.7 }); }
        break;
      case 'sun': {
        for (const k of [2.4, 3.6]) g.circle(x, y, r * k).stroke({ width: 2, color: CORAL, alpha: 0.18 });
        for (let k = 0; k < 16; k++) { const a = k * 0.3927 + t * 0.4, r1 = r + 4, r2 = r + 22 + 6 * Math.sin(t * 5 + k); g.poly([x + Math.cos(a - 0.1) * r1, y + Math.sin(a - 0.1) * r1, x + Math.cos(a) * r2, y + Math.sin(a) * r2, x + Math.cos(a + 0.1) * r1, y + Math.sin(a + 0.1) * r1]).fill(CORAL); }
        g.circle(x, y, r).fill(INK).stroke({ width: 4, color: CORAL });
        g.circle(x, y, r * 0.55).fill({ color: CORAL, alpha: 0.35 + 0.15 * Math.sin(t * 4) });
        break;
      }
      case 'crumble': {
        disc(0xd8c79d); 
        const fr = standing ? clamp(w.stay / lim, 0, 1) : clamp(w.stay / lim, 0, 1);
        for (let k = 0; k < 14; k++) { const a0 = k * 0.449; arcPath(g, x, y, r, a0, a0 + 0.2); g.stroke({ width: 4, color: INK }); }
        for (let k = 0; k < 5; k++) { const a = idx + k * 1.26, l = r * (0.3 + 0.7 * fr); g.moveTo(x, y).lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l * 0.9).stroke({ width: 2 + 2 * fr, color: INK, alpha: 0.4 + 0.5 * fr }); }
        if (fr > 0 || standing) { arcPath(g, x, y, r + 12, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0.02, Math.min(0.999, fr))); g.stroke({ width: 7, color: CORAL, cap: 'round' }); }
        break;
      }
      case 'fade': {
        const fr = clamp(w.stay / lim, 0, 1), al = 1 - 0.55 * fr;
        disc(0xe9efe9, al); g.circle(x, y, r).stroke({ width: 3, color: INK, alpha: al });
        for (let k = 0; k < 6; k++) { const a0 = k * 1.05 + t * 0.3; arcPath(g, x, y, r * 0.75, a0, a0 + 0.5); g.stroke({ width: 2, color: RIBBON, alpha: 0.5 * al }); }
        if (fr > 0) { arcPath(g, x, y, r + 12, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(0.999, fr)); g.stroke({ width: 6, color: INK, cap: 'round', alpha: 0.8 }); }
        break;
      }
      case 'blink': {
        const left = w.onFor - ((sim.time + w.phase) % w.period);
        const flick = left < 0.9 && Math.sin(t * 30) > 0 ? 0.35 : 1;
        disc(0xdfe8ee, flick); g.circle(x, y, r).stroke({ width: 4, color: INK, alpha: flick });
        g.circle(x, y, r * 0.3).stroke({ width: 3, color: INK, alpha: flick }); // a little clock
        g.moveTo(x, y).lineTo(x + Math.cos(-Math.PI / 2 + (left / w.onFor) * 6.283) * r * 0.3, y + Math.sin(-Math.PI / 2 + (left / w.onFor) * 6.283) * r * 0.3).stroke({ width: 3, color: INK, alpha: flick });
        break;
      }
      case 'gum': {
        const sq = 1 + 0.05 * Math.sin(t * 6 + idx);
        disc(0xffb9a6); g.ellipse(x, y, r * sq, r / sq).stroke({ width: 5, color: INK });
        for (let k = 1; k <= 2; k++) g.circle(x, y, r * (0.3 * k)).stroke({ width: 3, color: CORAL, alpha: 0.6 });
        break;
      }
      case 'repel': {
        for (const k of [1.8, 2.6]) g.circle(x, y, r * k).stroke({ width: 2, color: RIBBON, alpha: 0.18 });
        disc(0xf8f2e4); for (let k = 0; k < 12; k++) { const a0 = k * 0.5236; arcPath(g, x, y, r, a0, a0 + 0.26); g.stroke({ width: 4, color: CORAL }); }
        for (let k = 0; k < 8; k++) { const a = k * 0.785 + 0.2, ph = (t * 0.8 + k * 0.13) % 1, rr = r + 10 + ph * 40; g.poly([x + Math.cos(a - 0.08) * rr, y + Math.sin(a - 0.08) * rr, x + Math.cos(a) * (rr + 12), y + Math.sin(a) * (rr + 12), x + Math.cos(a + 0.08) * rr, y + Math.sin(a + 0.08) * rr]).fill({ color: CORAL, alpha: 1 - ph }); }
        break;
      }
      case 'home': {
        // the goal is unmistakable at all times: golden, rayed, haloed, pulsing, nothing else looks like it
        const pulse = 1 + 0.05 * Math.sin(t * 3);
        g.circle(x, y, r * 2.6 * pulse).fill({ color: GOLD, alpha: 0.1 }); g.circle(x, y, r * 1.8 * pulse).fill({ color: GOLD, alpha: 0.16 });
        for (let k = 0; k < 14; k++) { const a = k * 0.4488 + t * 0.25, r1 = r + 6, r2 = r * (1.7 + 0.25 * Math.sin(t * 2 + k * 2)); g.poly([x + Math.cos(a - 0.07) * r1, y + Math.sin(a - 0.07) * r1, x + Math.cos(a) * r2, y + Math.sin(a) * r2, x + Math.cos(a + 0.07) * r1, y + Math.sin(a + 0.07) * r1]).fill({ color: GOLD, alpha: 0.9 }).stroke({ width: 1.5, color: INK }); }
        g.circle(x, y, r).fill(GOLD).stroke({ width: 6, color: INK });
        g.circle(x, y, r * 0.78).stroke({ width: 4, color: CORAL });
        g.circle(x, y, r * 0.52).fill({ color: 0xfff4c8 });
        g.star(x, y, 5, r * 0.4, r * 0.17, t * 0.6).fill(CORAL).stroke({ width: 3, color: INK });
        if (sim.level === LEVEL_COUNT - 1) { // the last home is a sleeping eye
          const o = eyeOpen, R = r * 0.7, h = R * 0.55 * o;
          if (o < 0.03) g.moveTo(x - R, y).quadraticCurveTo(x, y + R * 0.1, x + R, y).stroke({ width: 7, color: INK });
          else { g.moveTo(x - R, y).quadraticCurveTo(x, y - h * 2, x + R, y).quadraticCurveTo(x, y + h * 2, x - R, y).fill(0xfffaf0).stroke({ width: 6, color: INK }); g.circle(x + clamp((sim.x - x) * 0.05, -R * 0.2, R * 0.2), y, h * 0.9).fill(CORAL).stroke({ width: 4, color: INK }); g.circle(x + clamp((sim.x - x) * 0.05, -R * 0.2, R * 0.2), y, h * 0.4).fill(INK); }
        }
        break;
      }
    }
  }

  return {
    meta: { slug: '2026-10-31-tiny-inside', title: 'Speck', question: 'Is bending a path through a sea of gravity wells (hop, orbit, slingshot) a toy worth building levels on?', targetFeeling: 'awe and tenderness at being very small in a very large thing', mode: 'content' },
    balance: BALANCE,
    init(c: Ctx) { ctx = c; live.sim = sim; sim.init(c); zlog = Math.log(levelZoom()); zoom = Math.exp(zlog); fx = (sim.bounds.x0 + sim.bounds.x1) / 2; fy = (sim.bounds.y0 + sim.bounds.y1) / 2; },
    step(dt: number, input: InputState) { sim.step(dt, input); },
    events() { return sim.events(); },

    mount(v: View) {
      view = v; W = v.world as Container; U = v.ui as Container;
      (v.app as Application).renderer.background.color = PAPER;
      cam = new Container(); worldG = new Graphics(); fxG = new Graphics(); playerC = new Container(); halo = new Graphics();
      halo.circle(0, 0, PR * 3.2).fill({ color: CORAL, alpha: 0.12 }).circle(0, 0, PR * 2.1).fill({ color: CORAL, alpha: 0.22 });
      playerC.addChild(halo, new Graphics().circle(0, 0, PR).fill(CORAL).stroke({ width: 3, color: INK }), new Graphics().circle(-3.5, -4.5, 3.5).fill(0xffffff));
      cam.addChild(worldG, fxG, playerC); W.addChild(cam);
      parts = new Particles(W, { confettiColors: [CORAL, INK, GOLD, 0x6fb3a6] });
      v.onFrame((dt) => parts.update(dt));
      ss = new SquashStretch(playerC);
      ptr = new Graphics(); badge = new Graphics(); badgeTxt = label('', 22); hint = label('', 22); hint.anchor.set(0.5); hint.position.set(640, 745);
      veil = new Graphics().rect(0, 0, 1280, 800).fill(0xffffff); veil.alpha = 0;
      U.addChild(ptr, badge, badgeTxt, hint, veil);
      song = makeMusic(); setMode('calm');
    },

    render(alpha: number) {
      const dt = view.frame.dt; t += dt;
      const px = sim.px + (sim.x - sim.px) * alpha, py = sim.py + (sim.y - sim.py) * alpha;
      const b = sim.bounds, cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
      zlog = chaseDt(zlog, Math.log(levelZoom()), 0.7, dt); zoom = Math.exp(zlog);
      const fit = Math.min(1180 / (b.x1 - b.x0), 640 / (b.y1 - b.y0)) >= 0.55;
      const hm = sim.ws.find((q) => q.type === 'home')!;
      const lead = (k: number, p: number, h: number) => p + (h - p) * k; // lean toward the goal a little so the way forward is on screen
      fx = chaseDt(fx, fit ? cx : lead(0.18, px, hm.x), 0.8, dt); fy = chaseDt(fy, fit ? cy : lead(0.18, py, hm.y), 0.8, dt);
      cam.scale.set(zoom); cam.position.set(640 - fx * zoom, 410 - fy * zoom);
      if (sim.level === LEVEL_COUNT - 1 && sim.clearT > 0) { finale += dt; eyeOpen = Math.min(1, eyeOpen + dt * 0.8); } else if (sim.level !== LEVEL_COUNT - 1) eyeOpen = 0;
      worldG.clear(); fxG.clear();
      sim.ws.forEach((w, i) => drawWorld(worldG, w, i));
      // the Hunter and its spit
      if (sim.boss) {
        const B = sim.boss, awake = B.delay <= 0, ch = B.charge > 0 ? 1 - B.charge / 0.7 : 0;
        const pulse = 1 + 0.06 * Math.sin(t * 6) + 0.2 * ch, R0 = 46 * pulse;
        const a0 = awake ? 1 : 0.35;
        for (let k = 0; k < 6; k++) { const ph = t * 2 + k, tx = B.x - B.vx * 0.12 * (k + 1), ty = B.y - B.vy * 0.12 * (k + 1); worldG.circle(tx, ty, R0 * (0.8 - k * 0.1)).fill({ color: INK, alpha: 0.3 * a0 }); void ph; }
        const pts: number[] = [];
        for (let k = 0; k < 20; k++) { const a = (k / 20) * Math.PI * 2, rr = R0 * (1 + (k % 2 ? 0.28 : 0) + 0.06 * Math.sin(t * 5 + k * 1.7)); pts.push(B.x + Math.cos(a) * rr, B.y + Math.sin(a) * rr); }
        worldG.poly(pts).fill({ color: INK, alpha: a0 }).stroke({ width: 4, color: CORAL, alpha: a0 });
        const lx = clamp(sim.x - B.x, -1, 1), ly = clamp(sim.y - B.y, -1, 1), ln = Math.hypot(sim.x - B.x, sim.y - B.y) || 1;
        for (const sg of [-1, 1]) { const ex = B.x + sg * R0 * 0.38 + (sim.x - B.x) / ln * 5, ey = B.y - R0 * 0.15 + (sim.y - B.y) / ln * 5; worldG.circle(ex, ey, R0 * 0.2).fill({ color: awake ? CORAL : 0x6b3b34 }); worldG.circle(ex + lx * 4, ey + ly * 4, R0 * 0.08).fill(INK); }
        worldG.moveTo(B.x - R0 * 0.4, B.y + R0 * 0.35).quadraticCurveTo(B.x, B.y + R0 * (0.35 + 0.3 * ch), B.x + R0 * 0.4, B.y + R0 * 0.35).stroke({ width: 5, color: ch > 0 ? GOLD : CORAL });
        if (ch > 0) { worldG.circle(B.x, B.y, R0 * (1.4 + 1.2 * (1 - ch))).stroke({ width: 4, color: GOLD, alpha: ch }); const ax = sim.x - B.x, ay = sim.y - B.y, al = Math.hypot(ax, ay) || 1; for (let k = 1; k <= 14; k++) worldG.circle(B.x + (ax / al) * k * 34, B.y + (ay / al) * k * 34, 3).fill({ color: GOLD, alpha: ch * 0.8 }); }
        for (const q of sim.shots) { worldG.circle(q.x - q.vx * 0.03, q.y - q.vy * 0.03, 7).fill({ color: INK, alpha: 0.4 }); worldG.circle(q.x, q.y, 15).fill({ color: CORAL, alpha: 0.25 }); worldG.circle(q.x, q.y, 9).fill(INK).stroke({ width: 3, color: CORAL }); }
      }
      // hop preview dots (where a held hop would go)
      if (sim.deadT <= 0 && sim.clearT <= 0) {
        const pts = predictPath(sim, true, 40, 4);
        pts.forEach(([x, y], i) => fxG.circle(x, y, Math.max(3, 3.5 / zoom)).fill({ color: INK, alpha: (sim.grounded ? 0.55 : 0) * (1 - i / pts.length) }));
      }
      // player
      playerC.visible = sim.deadT <= 0;
      const w = sim.ws[sim.gi];
      const up = sim.grounded ? sim.ang + Math.PI / 2 : Math.atan2(sim.vy, sim.vx) + Math.PI / 2;
      playerC.position.set(px, py); playerC.rotation = up;
      halo.scale.set(Math.max(1, 9 / (PR * zoom)) * (1 + 0.08 * Math.sin(t * 5)));
      ss.update(dt, 0, sim.grounded ? 0 : -Math.hypot(sim.vx, sim.vy) / 600);
      if (!sim.grounded && ctx.vfxRng.next() < 0.5) parts.emit('dust', px, py, { count: 1, color: CORAL, size: 0.62 * (1 / zoom), speed: 0.50 * (1 / zoom) });
      void w;
      // offscreen goal pointer
      const home = sim.ws.find((q) => q.type === 'home')!;
      const sxh = 640 + (home.x - fx) * zoom, syh = 400 + (home.y - fy) * zoom;
      ptr.clear();
      if (sxh < 40 || sxh > 1240 || syh < 40 || syh > 760) { const ex = clamp(sxh, 50, 1230), ey = clamp(syh, 100, 740), an = Math.atan2(syh - ey, sxh - ex), pl = 1 + 0.15 * Math.sin(t * 6); ptr.poly([ex + Math.cos(an) * 26 * pl, ey + Math.sin(an) * 26 * pl, ex + Math.cos(an + 2.5) * 20, ey + Math.sin(an + 2.5) * 20, ex + Math.cos(an - 2.5) * 20, ey + Math.sin(an - 2.5) * 20]).fill(GOLD).stroke({ width: 4, color: INK }); }
      // calm again only after a second of safety (no flapping)
      if (mode === 'tense' && !sim.danger) { safeT += dt; if (safeT > 1) { safeT = 0; setMode('calm'); } } else safeT = 0;
      // stickers
      badge.clear();
      badge.roundRect(24, 24, 330, 56, 28).fill(0xfffaf0).stroke({ width: 5, color: INK });
      badgeTxt.text = `${sim.level + 1}  ${LEVELS[sim.level].name}`; badgeTxt.position.set(48, 38);
      for (let i = 0; i < LEVEL_COUNT; i++) badge.circle(1280 - 36 - (LEVEL_COUNT - 1 - i) * 24, 52, i === sim.level ? 10 : 7).fill(i < sim.cleared || i < sim.level ? CORAL : 0xfffaf0).stroke({ width: 3, color: INK });
      hint.alpha = sim.level < 2 && sim.levelTime < 20 ? 1 : 0;
      hint.text = `${stickGlyph('left')}: run    ${glyph('a')}: hop (hold to go higher)`;
    },

    onEvent(e: SimEvent) {
      const m = e.magnitude ?? 0.5, x = e.x ?? 0, y = e.y ?? 0, s = 1 / zoom;
      switch (e.type) {
        case 'jump': play('hop', { variation: 0.05 }); ss.pop(0.35, 'y'); parts.emit('puff', x, y, { count: 6, color: PAPER, size: 0.45 * s, speed: 0.41 * s }); break;
        case 'land': play('land', { volume: 0.3 + 0.7 * m, pitch: 0.9 + 0.2 * m, variation: 0.05 }); ss.pop(0.2 + 0.4 * m, 'y'); parts.emit('dust', x, y, { count: 4 + Math.floor(8 * m), color: SHADE, size: 0.75 * s, speed: 0.55 * s }); if (m > 0.5) shake(0.12 * m); break;
        case 'bounce': play('boing', { variation: 0.08 }); ss.pop(0.6, 'x'); shake(0.12); parts.emit('sparks', x, y, { count: 10, color: CORAL, size: 0.75 * s, speed: 0.91 * s }); break;
        case 'sling': {
          play('whoosh', { pitch: 1.8, volume: 0.5 }); play('chime', { pitch: 1.5, volume: 0.4 }); hitStop(4); shake(0.15);
          parts.emit('sparks', x, y, { count: 24, color: GOLD, size: 0.88 * s, speed: 1.30 * s });
          const tx = label('SLINGSHOT', 30, GOLD); tx.anchor.set(0.5); tx.position.set(640, 200); tx.alpha = 0; U.addChild(tx);
          tween(tx, { alpha: 1 }, 120, ease.outCubic); tween(tx, { alpha: 0 }, 400, ease.linear, { delay: 700, onComplete: () => tx.destroy() });
          break;
        }
        case 'charge': play('warn', { pitch: 0.7, volume: 0.55 }); shake(0.08); break;
        case 'spit': play('whoosh', { pitch: 1.4, volume: 0.35 }); break;
        case 'splat': play('tick', { pitch: 0.5 }); parts.emit('dust', x, y, { count: 5, color: INK, size: 0.50 * s, speed: 0.41 * s }); break;
        case 'bossHit': play('burn'); shake(0.45); hitStop(5); parts.emit('sparks', x, y, { count: 30, color: GOLD, size: 1.00 * s, speed: 1.30 * s }); break;
        case 'dropped': play('whoosh'); ss.pop(0.4, 'x'); break;
        case 'tick': play('tick', { pitch: 1 + 0.2 * Math.random() * 0 }); break;
        case 'vanish': play('land', { pitch: 0.6, volume: 0.6 }); shake(0.2); parts.emit('puff', x, y, { count: 24, color: SHADE, size: 0.9 * s, speed: 0.73 * s }); break;
        case 'blinkoff': play('tick', { pitch: 0.6, volume: 0.5 }); break;
        case 'return': play('chime', { pitch: 1.5, volume: 0.15 }); break;
        case 'shatter': play('shatter'); shake(0.35); parts.emit('debris', x, y, { count: 30, color: 0xd8c79d, size: 1.12 * s, speed: 1.18 * s }); break;
        case 'burn': play('burn'); shake(0.4); hitStop(3); parts.emit('sparks', x, y, { count: 30, color: CORAL, size: 1.00 * s, speed: 1.30 * s }); break;
        case 'die':
          if (e.data?.cause === 'lost') play('whoosh', { pitch: 0.6 });
          veil.clear().rect(0, 0, 1280, 800).fill(CORAL); veil.alpha = 0.25; tween(veil, { alpha: 0 }, 450, ease.outCubic); parts.emit('puff', x, y, { count: 10, color: INK, size: 0.5 * s, speed: 0.91 * s });
          music.stinger(song.lose, { duck: 0.7 } as never); setMode('calm');
          break;
        case 'respawn': play('chime', { pitch: 1.2, volume: 0.3 }); parts.emit('puff', x, y, { count: 12, color: CORAL, size: 0.6 * s, speed: 0.55 * s }); break;
        case 'danger': if (mode === 'calm') { play('warn'); setMode('tense'); } safeT = 0; break;
        case 'clear':
          play('chime', { pitch: SEMI(sim.level) * 0.8 }); play('boom', { volume: 0.3 + 0.03 * sim.level });
          shake(0.3 + 0.03 * sim.level); hitStop(7); parts.emit('confetti', x, y, { count: 50, size: 1.12 * s, speed: 1.30 * s });
          veil.clear().rect(0, 0, 1280, 800).fill(0xffffff); veil.alpha = 0.6; tween(veil, { alpha: 0 }, 800, ease.outCubic);
          music.stinger(sim.level === LEVEL_COUNT - 1 ? song.win : song.tier, { duck: 0.6 } as never);
          break;
        case 'level': {
          const n = Number(e.data?.level ?? 0);
          music.setParts(partsFor(n, false, false) as never, 1.5); if (n > 0) play('whoosh', { volume: 0.2 });
          const tx = label(LEVELS[n].name.toUpperCase(), 42, CORAL); tx.anchor.set(0.5); tx.position.set(640, 150); tx.alpha = 0; U.addChild(tx);
          tween(tx, { alpha: 1 }, 300, ease.outCubic); tween(tx, { alpha: 0 }, 600, ease.linear, { delay: 1700, onComplete: () => tx.destroy() });
          zlog += 0.35; // swoop in from a little closer
          break;
        }
        case 'complete': music.stinger(song.win, { duck: 0.5 } as never); parts.emit('confetti', x, y, { count: 60, size: 1.40 * s, speed: 1.30 * s }); break;
      }
    },

    telemetry: () => ({ level: sim.level, cleared: sim.cleared, deaths: sim.deaths, levelTime: sim.levelTime, scoreOrProgress: sim.cleared * 100 + sim.level }),
    getState: () => sim.snapshot(),
    dispose() { music.stop(); },
  };
}
