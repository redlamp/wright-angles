/**
 * Browser-zoom estimate (plan 11.1). Chrome and Safari keep
 * `screen.width` in 100%-zoom CSS px while `devicePixelRatio` scales
 * with page zoom, so — with This Device set to this screen's real
 * panel — their product over the native width reads the zoom factor.
 *
 * Firefox recomputes `screen.width` live with zoom, which pins the
 * product at the native width and makes this read 100% at any zoom
 * (issue 9). Every zoom check goes through here so that fix lands in
 * one place.
 */

/** Zoom outside ±this many percent counts as "not 100%". */
export const ZOOM_TOLERANCE_PCT = 2;

/** Estimated page zoom in whole percent; 100 = unzoomed. */
export function estimateZoomPct(
  screenWidthCss: number,
  dpr: number,
  nativeWidthPx: number,
): number {
  return Math.round(((screenWidthCss * dpr) / nativeWidthPx) * 100);
}

/** The zoom percentage when it's off 100% beyond tolerance, else null. */
export function zoomWarningPct(
  screenWidthCss: number,
  dpr: number,
  nativeWidthPx: number,
): number | null {
  const pct = estimateZoomPct(screenWidthCss, dpr, nativeWidthPx);
  return Math.abs(pct - 100) > ZOOM_TOLERANCE_PCT ? pct : null;
}
