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

export type HintPart = string | { key: string };

/** An anchored prompt plate: text and key-cap chips on a sticker. Centered on (0,0). */
export function hintPlate(parts: HintPart[], size = 24, fill: number = C.board): Container {
  const c = new Container();
  const items: Container[] = [];
  let x = 0;
  const gap = 10;
  for (const p of parts) {
    const it = typeof p === 'string' ? label(p, size, C.white, { anchor: [0, 0.5] }) : chip(p.key, size * 0.85);
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
