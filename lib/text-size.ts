/**
 * Designer units first: the smallest text size, in pixels at the
 * media's AUTHORING resolution (e.g. "at 1080p"), that clears the ISO
 * 9241-303 bands on a given device. This is the answer a UI designer
 * actually wants — arc minutes are how we get there, not what they
 * type into their font field.
 *
 * Built on display-math's `contentPxToArcmin` (content authored at
 * `referenceHeight`, shown fullscreen on the device). Pure; no React.
 */

import { ACUITY, contentPxToArcmin } from "./display-math";
import type { Device } from "./types";

/**
 * Smallest whole pixel size, authored at `referenceHeight`, whose cap
 * height reaches `arcmin` on `device`. The px → arc-minute curve is the
 * exact subtense (nearly but not quite linear), so the linear estimate
 * is corrected by stepping until it is the true minimum.
 * Returns 0 for degenerate input (no reference height, zero-size panel).
 */
export function minPxForArcmin(
  arcmin: number,
  referenceHeight: number,
  device: Device,
): number {
  const perPx = contentPxToArcmin(1, referenceHeight, device);
  if (!(perPx > 0) || !(arcmin > 0)) return 0;
  let px = Math.max(1, Math.ceil(arcmin / perPx - 1e-9));
  while (px > 1 && contentPxToArcmin(px - 1, referenceHeight, device) >= arcmin)
    px--;
  while (contentPxToArcmin(px, referenceHeight, device) < arcmin) px++;
  return px;
}

/** Minimum (16′) and comfortable (20′) text sizes at one resolution. */
export interface TextSizeGuide {
  /** Smallest px for the ISO minimum band (≥16′). */
  minPx: number;
  /** Smallest px for the comfortable band (≥20′) — the body-text size. */
  comfortablePx: number;
  /** Authoring resolution the px figures are quoted at. */
  referenceHeight: number;
}

export function textSizeGuide(
  referenceHeight: number,
  device: Device,
): TextSizeGuide {
  return {
    minPx: minPxForArcmin(
      ACUITY.minCriticalTextArcmin,
      referenceHeight,
      device,
    ),
    comfortablePx: minPxForArcmin(
      ACUITY.comfortableTextArcmin,
      referenceHeight,
      device,
    ),
    referenceHeight,
  };
}

/** "1080p" — the way designers name an authoring resolution. */
export function formatReferenceHeight(h: number): string {
  return `${Math.round(h)}p`;
}

/** Fallback authoring resolution when no media is active. */
export const DEFAULT_REFERENCE_HEIGHT = 1080;
