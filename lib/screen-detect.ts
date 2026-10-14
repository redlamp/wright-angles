/**
 * Native-resolution guess from what the browser reports, used to prefill
 * This Device's resolution on a fresh setup. Pure: the caller passes
 * `screen.width`, `screen.height` and `devicePixelRatio` (and, when it
 * has one, a page-zoom hint).
 *
 * Chrome and Safari keep `screen.*` in 100%-zoom CSS px while
 * `devicePixelRatio` scales with page zoom, so the product is only the
 * panel's native size at 100% zoom (see lib/browser-zoom.ts); Firefox
 * reports differently. A zoomed page therefore yields a zoom-scaled
 * "native" size, and sometimes one that snaps neatly to a real panel
 * (1440p at 150% reads as 4K). So the result carries a confidence, and
 * only a confident one may be applied without asking. It's a starting
 * value the user can edit, never a measurement.
 */

/** Common panel sizes (landscape) the raw product snaps to. */
export const COMMON_PANEL_SIZES: readonly { w: number; h: number }[] = [
  { w: 1280, h: 720 },
  { w: 1280, h: 800 },
  { w: 1366, h: 768 },
  { w: 1440, h: 900 },
  { w: 1600, h: 900 },
  { w: 1680, h: 1050 },
  { w: 1920, h: 1080 },
  { w: 1920, h: 1200 },
  { w: 2256, h: 1504 },
  { w: 2560, h: 1080 },
  { w: 2560, h: 1440 },
  { w: 2560, h: 1600 },
  { w: 2560, h: 1664 },
  { w: 2880, h: 1800 },
  { w: 2880, h: 1864 },
  { w: 3024, h: 1964 },
  { w: 3440, h: 1440 },
  { w: 3456, h: 2234 },
  { w: 3840, h: 1600 },
  { w: 3840, h: 2160 },
  { w: 3840, h: 2400 },
  { w: 5120, h: 1440 },
  { w: 5120, h: 2160 },
  { w: 5120, h: 2880 },
  { w: 6016, h: 3384 },
  { w: 7680, h: 4320 },
];

/** Snap when both axes are within this fraction of a common size. */
export const SNAP_TOLERANCE = 0.02;

/**
 * Device pixel ratios an OS display-scaling setting produces on its own.
 * Anything else (1.1, 0.9, 2.2…) is OS scaling times a browser zoom
 * level, which means the product is zoom-scaled.
 */
export const OS_SCALE_FACTORS: readonly number[] = [
  1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3, 3.5, 4,
];

/** A page-zoom hint further than this from 1 counts as zoomed. */
export const ZOOM_HINT_TOLERANCE = 0.05;

export interface DetectedResolution {
  w: number;
  h: number;
  /** True when the raw product was snapped to a common panel size. */
  snapped: boolean;
  /**
   * Snapped, AND nothing hints at page zoom (a standard OS scale factor,
   * and the zoom hint, if any, reads ~100%). Only a confident result may
   * be prefilled or offered as a one-click fix; anything else is a
   * suggestion the user confirms.
   */
  confident: boolean;
}

/**
 * Page-zoom hint from window sizes: Chrome reports `outerWidth` in
 * unzoomed px and `innerWidth` in zoomed CSS px, so their ratio reads the
 * zoom. A side panel or docked devtools skews it, which only ever makes
 * detection LESS confident, never more. Null when unusable.
 */
export function zoomHintFromWindow(
  outerWidth: number,
  innerWidth: number,
): number | null {
  if (!(outerWidth > 0) || !(innerWidth > 0)) return null;
  const r = outerWidth / innerWidth;
  return Number.isFinite(r) ? r : null;
}

/** True when a zoom hint reads as zoomed (not ~100%). */
export function hintsZoom(zoomHint: number | null): boolean {
  return zoomHint !== null && Math.abs(zoomHint - 1) > ZOOM_HINT_TOLERANCE;
}

/**
 * round(screen × dpr) per axis, snapped to a common panel size within
 * ±2% (orientation-aware). Null when the inputs are unusable.
 */
export function detectNativeResolution(
  screenWidthCss: number,
  screenHeightCss: number,
  dpr: number,
  zoomHint: number | null = null,
): DetectedResolution | null {
  if (
    !(screenWidthCss > 0) ||
    !(screenHeightCss > 0) ||
    !(dpr > 0) ||
    !Number.isFinite(screenWidthCss * screenHeightCss * dpr)
  ) {
    return null;
  }
  const w = Math.round(screenWidthCss * dpr);
  const h = Math.round(screenHeightCss * dpr);
  const portrait = h > w;
  const long = portrait ? h : w;
  const short = portrait ? w : h;
  const near = (a: number, b: number) => Math.abs(a - b) / b <= SNAP_TOLERANCE;
  const hit = COMMON_PANEL_SIZES.find(
    (p) => near(long, p.w) && near(short, p.h),
  );
  if (!hit) return { w, h, snapped: false, confident: false };
  const osScale = OS_SCALE_FACTORS.some((f) => Math.abs(f - dpr) < 0.01);
  const confident = osScale && !hintsZoom(zoomHint);
  return portrait
    ? { w: hit.h, h: hit.w, snapped: true, confident }
    : { w: hit.w, h: hit.h, snapped: true, confident };
}
