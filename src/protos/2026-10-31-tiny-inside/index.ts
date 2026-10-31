import { Container, Graphics, Text, type Application } from 'pixi.js';
import { play, defineSound } from '../../audio/index.ts';
import { music } from '../../audio/music.ts';
import { glyph, stickGlyph } from '../../core/index.ts';
import { tween, ease, shake, hitStop, SquashStretch, Particles, numberPop, chaseDt, clamp } from '../../juice/index.ts';
import type { Ctx, InputState, Prototype, SimEvent, View } from '../../core/types.ts';
import { BALANCE, PR, Sim, TIERS, partsFor } from './sim.ts';
import { makeMusic } from './music.ts';
import { arcPath } from './arc.ts';
export { bots } from './bots.ts';

const PAPER = 0xf3ecdc, INK = 0x1d1b22, CORAL = 0xff5638, SHADE = 0xe2d6bb, RIBBON = 0x8a7f6a;
const SEMI = (n: number) => Math.pow(2, n / 12);

defineSound('hop', { wave: 'sine', freq: 420, slide: 1.6, attack: 0.002, sustain: 0.03, decay: 0.12, volume: 0.35 });
defineSound('land', { wave: 'noise', freq: 140, slide: -1, attack: 0.001, sustain: 0.02, decay: 0.12, lowpass: 700, transient: 0.3, volume: 0.35 });
defineSound('glint', { wave: 'sine', freq: 880, attack: 0.001, sustain: 0.04, decay: 0.28, vibratoDepth: 0.02, vibratoSpeed: 14, transient: 0.15, volume: 0.35 });
defineSound('tier', { wave: 'triangle', freq: 200, slide: 1.2, attack: 0.08, sustain: 0.2, decay: 0.8, lowpass: 3000, volume: 0.5 });
defineSound('lowwarn', { wave: 'sine', freq: 300, slide: -0.5, attack: 0.01, sustain: 0.1, decay: 0.4, volume: 0.35 });
defineSound('fade', { wave: 'saw', freq: 330, slide: -1.4, attack: 0.01, sustain: 0.2, decay: 0.7, lowpass: 900, volume: 0.35 });

export function createPrototype(): Prototype {
  const sim = new Sim();
  let ctx!: Ctx;
  let view: View; let W: Container, U: Container;
  let cam: Container, body: Container, bodyG: Graphics, glintG: Graphics, playerC: Container, halo: Graphics, eyeG: Graphics;
  let parts: Particles, ss: SquashStretch;
  let moteG: Graphics, bloomG: Graphics, windG: Graphics, uiGlow: Graphics, uiTier: Graphics, uiTierTxt: Text, hint: Text, veil: Graphics;
  let zoom = 0.6, zlog = Math.log(0.6), fx = 0, fy = 0, t = 0, eyeOpen = 0;
  const eye = { open: 0 };
  const bloomAmt: number[] = [];
  let song: ReturnType<typeof makeMusic>;
  let mode: 'calm' | 'tense' = 'calm';
  let moved = 0; let doneT = 0;

  const zoomFor = (i: number) => { const b = sim.bodies[i]; return 330 / (b.r + 2.2 * b.gap); };

  function drawWorld() {
    bodyG.clear();
    sim.bodies.forEach((b, i) => {
      const w = 7 * b.f;
      for (let k = 0; k < 5; k++) bodyG.circle(b.x, b.y, b.r * (1 - k * 0.12)).fill({ color: k % 2 ? 0xf8f2e4 : SHADE, alpha: k === 0 ? 1 : 0.55 });
      bodyG.circle(b.x, b.y, b.r).stroke({ width: w, color: INK });
      // ribbons: flowing arcs inside the disc, plus one coral spot ribbon
      for (let k = 0; k < 5; k++) {
        const rr = b.r * (0.35 + 0.11 * k), a0 = i * 1.7 + k * 1.3;
        arcPath(bodyG, b.x, b.y, rr, a0, a0 + 1.4 + k * 0.25); bodyG.stroke({ width: 2.2 * b.f, color: RIBBON, alpha: 0.7 });
      }
      arcPath(bodyG, b.x, b.y, b.r * 0.82, i * 2.1, i * 2.1 + 1.1); bodyG.stroke({ width: 5 * b.f, color: CORAL, alpha: 0.85 });
      if (i === TIERS - 1) return;
    });
  }

  function drawEye() {
    const b = sim.bodies[TIERS - 1];
    const o = eye.open, R = b.r * 0.78, h = R * 0.5 * o;
    eyeG.clear();
    const cx = b.x, cy = b.y;
    if (o < 0.02) { eyeG.moveTo(cx - R, cy).quadraticCurveTo(cx, cy + R * 0.06, cx + R, cy).stroke({ width: 9 * b.f, color: INK }); return; }
    eyeG.moveTo(cx - R, cy).quadraticCurveTo(cx, cy - h * 2, cx + R, cy).quadraticCurveTo(cx, cy + h * 2, cx - R, cy).fill(0xfffaf0).stroke({ width: 8 * b.f, color: INK });
    const ix = cx + clamp((sim.x - cx) * 0.05, -R * 0.2, R * 0.2), iy = cy + clamp((sim.y - cy) * 0.05, -h * 0.4, h * 0.4);
    eyeG.circle(ix, iy, h * 0.9).fill(CORAL).stroke({ width: 5 * b.f, color: INK });
    eyeG.circle(ix, iy, h * 0.4).fill(INK);
    eyeG.circle(ix - h * 0.25, iy - h * 0.25, h * 0.14).fill(0xffffff);
  }

  function label(txt: string, size: number, fill = INK) {
    return new Text({ text: txt, style: { fontFamily: 'Space Grotesk, sans-serif', fontWeight: '700', fontSize: size, fill } });
  }

  function setMode(m: 'calm' | 'tense') {
    mode = m;
    music.play(m === 'calm' ? song.calm : song.tense, partsFor(sim.best, m === 'tense', sim.done) as never);
  }

  return {
    meta: { slug: '2026-10-31-tiny-inside', title: 'Speck', question: 'Does the camera pulling back on every landing make a simple planet-hopper feel wonderful?', targetFeeling: 'awe and tenderness at being very small in a very large thing', mode: 'content' },
    balance: BALANCE,
    init(c: Ctx) { ctx = c; sim.init(c); const T = Number(c.params.tier ?? 0); if (T > 0) { sim.best = T; sim.spawn(T); } if (c.params.eye === '1') eye.open = 1; if (c.params.done === '1') sim.done = true; const b = sim.bodies[0]; zoom = zoomFor(0); zlog = Math.log(zoom); fx = b.x; fy = b.y; },
    step(dt: number, input: InputState) { sim.step(dt, input); },
    events() { return sim.events(); },

    mount(v: View) {
      view = v; W = v.world as Container; U = v.ui as Container;
      (v.app as Application).renderer.background.color = PAPER;
      cam = new Container(); body = new Container(); bodyG = new Graphics(); glintG = new Graphics(); eyeG = new Graphics();
      playerC = new Container(); halo = new Graphics();
      halo.circle(0, 0, PR * 3.2).fill({ color: CORAL, alpha: 0.12 }).circle(0, 0, PR * 2.1).fill({ color: CORAL, alpha: 0.22 });
      const dot = new Graphics().circle(0, 0, PR).fill(CORAL).stroke({ width: 3, color: INK });
      const gleam = new Graphics().circle(-4, -5, 4).fill(0xffffff);
      playerC.addChild(halo, dot, gleam);
      bloomG = new Graphics(); moteG = new Graphics();
      body.addChild(bodyG, bloomG, eyeG, moteG, glintG);
      cam.addChild(body, playerC);
      W.addChild(cam);
      parts = new Particles(W, { confettiColors: [CORAL, INK, 0xffc94a, 0x6fb3a6] });
      v.onFrame((dt) => parts.update(dt));
      ss = new SquashStretch(playerC);
      drawWorld();
      // sticker UI
      windG = new Graphics(); uiGlow = new Graphics(); uiTier = new Graphics(); uiTierTxt = label('', 20);
      hint = label('', 22, INK); hint.anchor.set(0.5); hint.position.set(640, 735);
      veil = new Graphics().rect(0, 0, 1280, 800).fill(0xffffff); veil.alpha = 0;
      U.addChild(windG, uiGlow, uiTier, uiTierTxt, hint, veil);
      song = makeMusic();
      setMode('calm');
    },

    render(alpha: number) {
      const dt = view.frame.dt; t += dt;
      const px = sim.px + (sim.x - sim.px) * alpha, py = sim.py + (sim.y - sim.py) * alpha;
      // camera: zoom to the nearest world, centre between that world and the player
      let zt = Math.log(zoomFor(sim.cur));
      let ox = 0, oy = 0, wide = 0;
      if (sim.done) {
        doneT += dt;
        if (doneT > 2.6) { // the pull-back: the whole constellation, every world a freckle
          const bs = sim.bodies; let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
          for (const q of bs) { x0 = Math.min(x0, q.x - q.r); x1 = Math.max(x1, q.x + q.r); y0 = Math.min(y0, q.y - q.r); y1 = Math.max(y1, q.y + q.r); }
          zt = Math.log(Math.min(1100 / (x1 - x0), 700 / (y1 - y0))); ox = (x0 + x1) / 2; oy = (y0 + y1) / 2; wide = 1;
          if (doneT < 2.7) { shake(0.5); play('tier', { pitch: 0.5, volume: 0.6 }); }
        }
      }
      zlog = chaseDt(zlog, zt, wide ? 0.35 : 0.9, dt);
      zoom = Math.exp(zlog);
      const b = sim.bodies[sim.cur];
      fx = chaseDt(fx, wide ? ox : b.x * 0.6 + px * 0.4, wide ? 0.35 : 0.9, dt); fy = chaseDt(fy, wide ? oy : b.y * 0.6 + py * 0.4, wide ? 0.35 : 0.9, dt);
      cam.scale.set(zoom); cam.position.set(640 - fx * zoom, 400 - fy * zoom);
      // player
      const up = Math.atan2(py - b.y, px - b.x) + Math.PI / 2;
      playerC.position.set(px, py); playerC.rotation = up;
      const vis = Math.max(1, 8 / (PR * zoom));
      halo.scale.set(vis * (1 + 0.08 * Math.sin(t * 5)));
      ss.update(dt, 0, sim.grounded ? 0 : -Math.hypot(sim.vx, sim.vy) / (900 * b.f));
      // glints
      glintG.clear();
      const gs = Math.max(1, 6 / (PR * 0.5 * zoom));
      for (const g of sim.glints) {
        if (!g.on) continue;
        const bob = Math.sin(t * 3 + g.x) * 6 * sim.bodies[g.body].f;
        glintG.star(g.x, g.y + bob, 4, 10 * gs, 4 * gs, t).fill(0xffc94a).stroke({ width: 1.5 * gs, color: INK });
      }
      if (sim.best >= TIERS - 2 || eye.open > 0) drawEye(); else eyeG.clear();
      moteG.clear(); bloomG.clear();
      sim.bodies.forEach((bb, i) => { const a = (bloomAmt[i] = chaseDt(bloomAmt[i] ?? (sim.bloomed[i] ? 1 : 0), sim.bloomed[i] ? 1 : 0, 0.9, dt)); if (a > 0) { bloomG.circle(bb.x, bb.y, bb.r * a).fill({ color: CORAL, alpha: 0.22 }); bloomG.circle(bb.x, bb.y, bb.r * 0.5 * a).fill({ color: 0xffc94a, alpha: 0.25 }); } });
      for (const m of sim.motes) {
        if (!m.on) continue;
        const bb = sim.bodies[m.body], mx = bb.x + Math.cos(m.a) * (bb.r + PR * 0.4), my = bb.y + Math.sin(m.a) * (bb.r + PR * 0.4);
        const sz = Math.max(12 * bb.f, 6 / zoom) * (1 + 0.15 * Math.sin(t * 6 + m.a));
        moteG.circle(mx, my, sz).fill(CORAL).stroke({ width: Math.max(2 * bb.f, 1.5 / zoom), color: INK });
        moteG.circle(mx - sz * 0.3, my - sz * 0.3, sz * 0.25).fill(0xffffff);
      }
      // ambient dust trail
      moved += Math.hypot(sim.vx, sim.vy) * dt;
      if (!sim.grounded && ctx.vfxRng.next() < 0.5) parts.emit('dust', px, py, { count: 1, color: CORAL, size: 5 / zoom, speed: 30 / zoom });
      // gust ribbons sweep across the screen: faint while telegraphed, strong while pushing
      windG.clear();
      if (sim.windOn > 0) {
        const act = sim.windOn < 1.4, ca = Math.cos(sim.windA), sa = Math.sin(sim.windA), ph = (2.2 - sim.windOn) * (act ? 900 : 300);
        for (let k = 0; k < 9; k++) {
          const off = (k - 4) * 120, cx = 640 + -sa * off + ca * ((ph + k * 211) % 1800 - 900), cy = 400 + ca * off + sa * ((ph + k * 211) % 1800 - 900);
          windG.moveTo(cx - ca * 90, cy - sa * 90).quadraticCurveTo(cx - sa * 30, cy + ca * 30, cx + ca * 90, cy + sa * 90).stroke({ width: act ? 6 : 3, color: RIBBON, alpha: act ? 0.55 : 0.25, cap: 'round' });
        }
      }
      // UI stickers
      const gl = sim.glow, low = gl < 0.3;
      uiGlow.clear();
      uiGlow.circle(76, 76, 50).fill(0xfffaf0).stroke({ width: 5, color: INK });
      arcPath(uiGlow, 76, 76, 36, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(0.999, Math.max(0.001, gl))); uiGlow.stroke({ width: 14, color: low && Math.sin(t * 14) > 0 ? INK : CORAL, cap: 'round' });
      uiGlow.circle(76, 76, 18).fill({ color: CORAL, alpha: 0.35 + 0.65 * gl });
      uiTier.clear();
      for (let i = 0; i < TIERS; i++) {
        const on = i <= sim.best, cur = i === sim.cur;
        uiTier.circle(1280 - 40 - (TIERS - 1 - i) * 30, 52, cur ? 12 : 9).fill(on ? CORAL : 0xfffaf0).stroke({ width: 3, color: INK });
      }
      uiTierTxt.text = ''; 
      hint.alpha = sim.time < 14 ? 1 : 0;
      hint.text = `${stickGlyph('left')}: run    ${glyph('a')}: hop (hold to go higher)`;
    },

    onEvent(e: SimEvent) {
      const m = e.magnitude ?? 0.5, x = e.x ?? 0, y = e.y ?? 0, s = 1 / zoom;
      const tier = Number(e.data?.tier ?? 0);
      switch (e.type) {
        case 'jump': play('hop', { variation: 0.05 }); ss.pop(0.35, 'y'); parts.emit('puff', x, y, { count: 6, color: PAPER, size: 7 * s, speed: 90 * s }); break;
        case 'land':
          play('land', { volume: 0.3 + 0.7 * m, pitch: 0.9 + 0.2 * m, variation: 0.05 });
          ss.pop(0.2 + 0.4 * m, 'y');
          parts.emit('dust', x, y, { count: 4 + Math.floor(8 * m), color: SHADE, size: 6 * s, speed: 120 * s });
          if (m > 0.5) shake(0.15 * m);
          break;
        case 'glint': {
          const c = Number(e.data?.combo ?? 1);
          play('glint', { pitch: SEMI(Math.min(c - 1, 12) * 2 % 13), variation: 0.01 });
          parts.emit('sparks', x, y, { count: 8, color: 0xffc94a, size: 6 * s, speed: 160 * s });
          numberPop(W, c > 2 ? `x${c}` : '+', x, y - 30 * s, { color: CORAL, stroke: INK, size: 26 * s, rise: 60 * s });
          if (c === 5) music.stinger(song.glint, { duck: 0.5 } as never);
          break;
        }
        case 'tier': case 'finale': {
          play('tier', { pitch: SEMI(tier) });
          shake(0.35 + 0.05 * tier); hitStop(6);
          parts.emit('confetti', x, y, { count: 40, size: 9 * s, speed: 300 * s });
          veil.alpha = 0.7; tween(veil, { alpha: 0 }, 700, ease.outCubic);
          zlog += 0.5; // the camera starts closer and swoops back out: the reveal
          music.stinger(e.type === 'finale' ? song.win : song.tier, { duck: 0.6 } as never);
          music.setParts(partsFor(sim.best, false, e.type === 'finale') as never, 1.5);
          if (mode === 'tense') setMode('calm');
          if (e.type === 'finale') tween(eye, { open: 1 }, 2200, ease.outCubic);
          break;
        }
        case 'mote': { const l = Number(e.data?.left ?? 0); play('glint', { pitch: SEMI(7 + (sim.motes.filter((q) => q.body === sim.cur).length - l) % 8), volume: 0.4 }); parts.emit('sparks', x, y, { count: 7, color: CORAL, size: 6 * s, speed: 140 * s }); break; }
        case 'bloom': {
          const bi = Number(e.data?.body ?? 0); bloomAmt[bi] = 0;
          play('tier', { pitch: SEMI(4 + bi), volume: 0.45 }); shake(0.3); hitStop(4);
          parts.emit('confetti', x, y, { count: 36, size: 8 * s, speed: 260 * s });
          music.stinger(song.glint, { duck: 0.5 } as never); break;
        }
        case 'gust': play('lowwarn', { pitch: 1.6, volume: 0.3 }); break;
        case 'low': play('lowwarn'); setMode('tense'); break;
        case 'recover': if (mode === 'tense') setMode('calm'); break;
        case 'faded':
          play('fade'); shake(0.4); parts.emit('puff', x, y, { count: 30, color: CORAL, size: 10 * s, speed: 200 * s });
          music.stinger(song.lose, { duck: 0.7 } as never); setMode('calm'); veil.alpha = 0.9; tween(veil, { alpha: 0 }, 900, ease.outCubic);
          break;
      }
    },

    telemetry: () => ({ blooms: sim.blooms, tier: sim.cur, best: sim.best, glints: sim.glints_got, deaths: sim.deaths, glow: Math.max(0, sim.glow), scoreOrProgress: sim.best * 100 + sim.glints_got }),
    getState: () => {
      const b = sim.bodies[sim.cur], n = sim.bodies[Math.min(sim.cur + 1, TIERS - 1)];
      let ma = -99, bd = 9; for (const m of sim.motes) if (m.on && m.body === sim.cur) { let d = Math.atan2(sim.y - b.y, sim.x - b.x) - m.a; d = Math.abs(Math.atan2(Math.sin(d), Math.cos(d))); if (d < bd) { bd = d; ma = m.a; } }
      return { ma, x: sim.x, y: sim.y, cx: b.x, cy: b.y, tx: n.x, ty: n.y, grounded: sim.grounded ? 1 : 0 };
    },
    dispose() { music.stop(); },
  };
}
