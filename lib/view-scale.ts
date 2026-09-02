/**
 * "CSS px per device px" for placing a device's full resolution into a
 * 2D viewing area — shared by the flat 2D view and the 3D scene's
 * head-on pose/FOV, which both need to agree on how big the device
 * reads in the current window before this, three separately-written
 * copies of the same two-branch formula.
 *
 * Viewport mode maps the device 1:1 onto the physical screen the
 * window sits on (the window shows whatever slice of it is visible);
 * `viewportScreenW` is that screen's width in px, or null when
 * viewport mode isn't active (or has no live screen reading yet) — in
 * which case the whole panel is fit-shrunk into the given area, the
 * smaller of the two axis ratios so nothing overflows.
 */
export function deviceViewScale(
  resW: number,
  resH: number,
  areaW: number,
  areaH: number,
  viewportScreenW: number | null,
): number {
  if (!(areaW > 0) || !(areaH > 0) || !(resW > 0) || !(resH > 0)) return 0;
  if (viewportScreenW !== null) return viewportScreenW / resW;
  return Math.min(areaW / resW, areaH / resH);
}
