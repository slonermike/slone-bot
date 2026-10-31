// Arc as an explicit polyline. Pixi's Graphics.arc() continues the current path, so an arc drawn without a
// moveTo (or after another shape) gets a stray line from wherever the path last was, usually the origin.
// Here the start is always a fresh moveTo and every point is explicit, so nothing can trail off.
export interface PathLike { moveTo(x: number, y: number): unknown; lineTo(x: number, y: number): unknown }
export function arcPath(g: PathLike, cx: number, cy: number, r: number, a0: number, a1: number, maxStep = 0.12): void {
  const n = Math.max(2, Math.ceil(Math.abs(a1 - a0) / maxStep));
  g.moveTo(cx + Math.cos(a0) * r, cy + Math.sin(a0) * r);
  for (let i = 1; i <= n; i++) { const a = a0 + ((a1 - a0) * i) / n; g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
}
