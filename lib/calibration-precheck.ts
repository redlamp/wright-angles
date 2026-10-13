/**
 * Pre-measurement check for screen calibration. Both measuring methods
 * turn a CSS-px length into a diagonal through This Device's native
 * resolution, so a wrong resolution silently ruins the result. This
 * compares what the browser reports with what's configured and names
 * the ONE likely cause, so the panel can say something specific instead
 * of one ambiguous warning. Pure: the view layer passes the readings.
 */

import { zoomWarningPct } from "./browser-zoom";
import { detectNativeResolution, hintsZoom } from "./screen-detect";
import type { Resolution } from "./types";

export type Precheck =
  | { kind: "ok" }
  /** The browser confidently reports a different panel: offer it. */
  | { kind: "resolution"; detected: Resolution }
  /** The reported size differs, but not confidently: suggest only. */
  | { kind: "resolution-unsure"; reported: Resolution }
  /** The mismatch is what page zoom at about `pct`% would produce. */
  | { kind: "zoom"; pct: number };

export interface ScreenReadings {
  screenW: number;
  screenH: number;
  dpr: number;
  /** See zoomHintFromWindow; null when unavailable. */
  zoomHint: number | null;
}

/** Two axis ratios this close mean "the same shape, just scaled". */
const SAME_SHAPE = 0.02;

export function precheckCalibration(
  r: ScreenReadings,
  configured: Resolution,
): Precheck {
  const det = detectNativeResolution(r.screenW, r.screenH, r.dpr, r.zoomHint);
  if (!det) return { kind: "ok" };
  if (det.w === configured.w && det.h === configured.h) {
    // Resolutions agree; the zoom estimate (or, failing that, the window
    // hint) is the only remaining tell.
    const pct =
      zoomWarningPct(r.screenW, r.dpr, configured.w) ??
      (hintsZoom(r.zoomHint) ? Math.round((r.zoomHint ?? 1) * 100) : null);
    return pct === null ? { kind: "ok" } : { kind: "zoom", pct };
  }
  if (det.confident) {
    return { kind: "resolution", detected: { w: det.w, h: det.h } };
  }
  // Not confident: if the reported size is the configured one scaled
  // evenly on both axes by an off-100% factor, that's page zoom.
  const rw = (r.screenW * r.dpr) / configured.w;
  const rh = (r.screenH * r.dpr) / configured.h;
  const pct = zoomWarningPct(r.screenW, r.dpr, configured.w);
  if (Math.abs(rw - rh) <= SAME_SHAPE && pct !== null) {
    return { kind: "zoom", pct };
  }
  return {
    kind: "resolution-unsure",
    reported: {
      w: Math.round(r.screenW * r.dpr),
      h: Math.round(r.screenH * r.dpr),
    },
  };
}
