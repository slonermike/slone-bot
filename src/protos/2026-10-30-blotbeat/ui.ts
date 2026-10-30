// Look helpers for Blot Beat: one plum hue in five tints, white, and a lime accent that means "ink / mistake / stamp".
// Everything gets a fat dark outline (thick ink), the board is thin wireframe lines, the UI is made of stickers.
import { Container, Graphics, Text } from 'pixi.js';

export const C = {
  ink: 0x120a22, // darkest tint: every outline
  bg: 0x241446,
  board: 0x3b2672,
  line: 0x7857c4,
  tint: 0xb9a3ee,
  white: 0xffffff,
  lime: 0xc6ff3d, // the one contrasting accent
} as const;

/** One hue per lane, the standard pad colours in our own flavour: Y amber (north), B coral red (east), A teal (south, a cool green kept clear of the lime ink), X blue (west). */
export const LANE_COLORS = [0xffbe2e, 0xff5a5f, 0x1fd6b5, 0x4f8bff] as const;

export const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

export function label(text: string, size: number, fill: number = C.white, opts: { stroke?: number; sw?: number; weight?: string; align?: 'left' | 'center' | 'right'; anchor?: [number, number] } = {}): Text {
  const t = new Text({
    text,
    style: {
      fontFamily: FONT, fontSize: size, fontWeight: (opts.weight ?? '800') as '800', fill,
      stroke: opts.stroke === undefined ? undefined : { color: opts.stroke, width: opts.sw ?? Math.max(4, size * 0.16), join: 'round' },
      align: opts.align ?? 'left',
    },
  });
  const a = opts.anchor ?? [0.5, 0.5];
  t.anchor.set(a[0], a[1]);
  return t;
}

/** A sticker: fat dark outline, offset hard shadow, optional tilt. Draws centered on (0,0). */
export function stickerShape(g: Graphics, w: number, h: number, fill: number, r = 14, line: number = C.tint): Graphics {
  g.clear();
  g.roundRect(-w / 2 + 5, -h / 2 + 7, w, h, r).fill(C.ink);
  g.roundRect(-w / 2, -h / 2, w, h, r).fill(fill).stroke({ width: 7, color: C.ink, join: 'round' });
  g.roundRect(-w / 2 + 6, -h / 2 + 6, w - 12, h - 12, Math.max(4, r - 6)).stroke({ width: 1.5, color: line, alpha: 0.7 });
  return g;
}

export function sticker(w: number, h: number, fill: number, r = 14, line: number = C.tint): Graphics {
  return stickerShape(new Graphics(), w, h, fill, r, line);
}

/** A key cap: rounded chip with the button label. */
export function chip(text: string, size = 22, fill: number = C.white, ink: number = C.ink): Container {
  const c = new Container();
  const t = label(text, size, ink, { weight: '900' });
  const w = Math.max(size * 1.5, t.width + size * 0.9);
  const h = size * 1.5;
  const g = new Graphics();
  g.roundRect(-w / 2 + 3, -h / 2 + 5, w, h, h * 0.3).fill(C.ink);
  g.roundRect(-w / 2, -h / 2, w, h, h * 0.3).fill(fill).stroke({ width: 5, color: C.ink, join: 'round' });
  c.addChild(g, t);
  (c as Container & { chipW: number }).chipW = w;
  return c;
}

export type HintPart = string | { key: string; fill?: number };

/** An anchored prompt plate: text and key-cap chips on a sticker. Centered on (0,0). */
export function hintPlate(parts: HintPart[], size = 24, fill: number = C.board): Container {
  const c = new Container();
  const items: Container[] = [];
  let x = 0;
  const gap = 10;
  for (const p of parts) {
    const it = typeof p === 'string' ? label(p, size, C.white, { anchor: [0, 0.5] }) : chip(p.key, size * 0.85, p.fill ?? C.white);
    const w = typeof p === 'string' ? (it as Text).width : (it as Container & { chipW: number }).chipW;
    if (typeof p === 'string') it.position.set(x, 0); else it.position.set(x + w / 2, 0);
    items.push(it);
    x += w + gap;
  }
  const total = x - gap;
  const bg = sticker(total + 56, size * 2.1, fill, 16);
  c.addChild(bg);
  items.forEach((it) => { it.x -= total / 2; c.addChild(it); });
  return c;
}

/** Teardrop path centered on (0,0), point up, height h. */
export function drop(g: Graphics, h: number): Graphics {
  const w = h * 0.38;
  g.moveTo(0, -h * 0.55)
    .bezierCurveTo(w * 0.2, -h * 0.2, w, 0, w, h * 0.18)
    .bezierCurveTo(w, h * 0.42, w * 0.5, h * 0.5, 0, h * 0.5)
    .bezierCurveTo(-w * 0.5, h * 0.5, -w, h * 0.42, -w, h * 0.18)
    .bezierCurveTo(-w, 0, -w * 0.2, -h * 0.2, 0, -h * 0.55)
    .closePath();
  return g;
}

/** A sheet of paper with a folded corner. Centered. */
export function sheet(g: Graphics, w: number, h: number, fill: number, lined = true): Graphics {
  const f = w * 0.3;
  g.clear();
  g.poly([-w / 2, -h / 2, w / 2 - f, -h / 2, w / 2, -h / 2 + f, w / 2, h / 2, -w / 2, h / 2]).fill(fill).stroke({ width: 5, color: C.ink, join: 'round' });
  g.poly([w / 2 - f, -h / 2, w / 2 - f, -h / 2 + f, w / 2, -h / 2 + f]).fill(C.tint).stroke({ width: 3, color: C.ink, join: 'round' });
  if (lined) for (let i = 0; i < 3; i++) g.moveTo(-w / 2 + 8, -h / 2 + f + 8 + i * 9).lineTo(w / 2 - 8, -h / 2 + f + 8 + i * 9).stroke({ width: 1.5, color: C.line });
  return g;
}

/** A small pictogram for each sticker (drawn about 76 px across, centered), in ink on the white badge. */
export function stickerIcon(id: string): Container {
  const c = new Container();
  const g = new Graphics();
  c.addChild(g);
  const outline = { width: 5, color: C.ink, join: 'round' as const };
  switch (id) {
    case 'nib':
      g.poly([0, -34, 20, -2, 12, 26, 0, 34, -12, 26, -20, -2]).fill(C.line).stroke(outline);
      g.moveTo(0, -4).lineTo(0, 30).stroke({ width: 3, color: C.ink });
      g.circle(0, -6, 5).fill(C.ink);
      break;
    case 'sponge':
      g.roundRect(-32, -22, 64, 46, 12).fill(C.tint).stroke(outline);
      for (const [x, y, r] of [[-16, -6, 5], [8, -10, 4], [16, 8, 6], [-6, 10, 4], [-20, 12, 3]] as const) g.ellipse(x, y, r, r * 0.8).fill(C.ink);
      break;
    case 'bounty':
      g.circle(0, 0, 30).fill(C.tint).stroke(outline);
      g.circle(0, 0, 22).stroke({ width: 2, color: C.ink });
      drop(g, 34).fill(C.lime).stroke({ width: 4, color: C.ink, join: 'round' });
      break;
    case 'thrift':
      g.roundRect(-30, -24, 60, 48, 10).fill(C.lime).stroke(outline);
      c.addChild(Object.assign(label('-1', 34, C.ink, { weight: '900' }), { y: 1 }));
      break;
    case 'long':
      g.poly([-22, -32, 22, -32, 0, 0]).fill(C.tint).stroke(outline);
      g.poly([0, 0, 22, 32, -22, 32]).fill(C.lime).stroke(outline);
      g.rect(-26, -36, 52, 6).fill(C.ink);
      g.rect(-26, 31, 52, 6).fill(C.ink);
      break;
    case 'blotter':
      sheet(g, 50, 60, C.white, false);
      drop(g, 30).fill(C.lime).stroke({ width: 4, color: C.ink, join: 'round' });
      break;
    case 'siphon':
      drop(g, 44).fill(C.lime).stroke(outline);
      g.poly([22, -2, 34, -2, 28, -14]).fill(C.ink);
      g.moveTo(28, -4).lineTo(28, 22).stroke({ width: 5, color: C.ink, cap: 'round' });
      break;
    case 'spare':
      sheet(g, 50, 62, C.white, true);
      c.addChild(Object.assign(label('+1', 30, C.ink, { weight: '900' }), { y: 14 }));
      break;
    default:
      g.circle(0, 0, 24).fill(C.tint).stroke(outline);
  }
  return c;
}
