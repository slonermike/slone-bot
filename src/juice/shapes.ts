import type { Graphics } from 'pixi.js';

/** Vertex lists for flat, angular looks. Each returns a flat [x0, y0, x1, y1, ...] array for `graphics.poly(points)`. */

/** A regular polygon: `n` sides, circumradius `r`, first vertex at angle `rot` (radians; 0 points right). */
export function ngon(cx: number, cy: number, r: number, n: number, rot = 0): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * Math.PI * 2;
    out.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  return out;
}

/** A rectangle with its four corners cut off at 45 degrees by `c` px. */
export function chamfer(x: number, y: number, w: number, h: number, c: number): number[] {
  return [x + c, y, x + w - c, y, x + w, y + c, x + w, y + h - c, x + w - c, y + h, x + c, y + h, x, y + h - c, x, y + c];
}

/** A slanted rectangle (parallelogram): the top edge is shifted right by `skew`. Good for panels and gauge segments. */
export function slab(x: number, y: number, w: number, h: number, skew = 14): number[] {
  return [x + skew, y, x + w + skew, y, x + w, y + h, x, y + h];
}

/** A hollow regular polygon outline drawn as a filled polygon with a hole cut out (flat look, no strokes). */
export function polyRing(g: Graphics, cx: number, cy: number, r: number, thick: number, sides: number, rot: number, color: number, alpha = 1): void {
  if (r <= thick) return;
  g.poly(ngon(cx, cy, r, sides, rot)).fill({ color, alpha });
  g.poly(ngon(cx, cy, r - thick, sides, rot)).cut();
}
