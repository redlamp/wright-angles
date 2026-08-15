/**
 * Object-contain fit: where content of aspect (cw×ch) lands inside a box
 * of (bw×bh), centered with bars. Returned in the box's coordinate space.
 */
export function containFit(
  cw: number,
  ch: number,
  bw: number,
  bh: number,
): { x: number; y: number; w: number; h: number } {
  if (cw <= 0 || ch <= 0 || bw <= 0 || bh <= 0)
    return { x: 0, y: 0, w: 0, h: 0 };
  const s = Math.min(bw / cw, bh / ch);
  const w = cw * s;
  const h = ch * s;
  return { x: (bw - w) / 2, y: (bh - h) / 2, w, h };
}
