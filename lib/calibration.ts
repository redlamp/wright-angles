/**
 * Credit-card screen calibration (test plan 11.2).
 *
 * An ISO/IEC 7810 ID-1 card (any bank card) is a physical ruler everyone
 * owns: 85.60mm × 53.98mm. If the user resizes an on-screen rectangle
 * until a real card covers it exactly, the rectangle's CSS-pixel width
 * pins the panel's true pixels-per-centimeter — and with the (trusted)
 * native resolution, the true diagonal.
 *
 * Pure math only — devicePixelRatio is read by the view layer and passed
 * in as a number.
 */

import { CM_PER_IN, physicalSizeCm } from "./display-math";
import type { Aspect, Resolution } from "./types";

/** ISO/IEC 7810 ID-1 card size, mm. */
export const CARD_W_MM = 85.6;
export const CARD_H_MM = 53.98;

const CARD_W_CM = CARD_W_MM / 10;

/**
 * CSS pixels the card SHOULD span if This Device's spec (diagonal,
 * aspect, native width) is accurate. Used to seed the calibration
 * rectangle; if the spec is right, the card lines up immediately.
 */
export function cardWidthCssPx(
  diagonalIn: number,
  aspect: Aspect,
  resolutionW: number,
  dpr: number,
): number {
  const { widthCm } = physicalSizeCm(diagonalIn, aspect);
  const nativePxPerCm = resolutionW / widthCm;
  const cssPxPerCm = nativePxPerCm / dpr;
  return CARD_W_CM * cssPxPerCm;
}

/**
 * Inverse: the user says "this many CSS px really is 85.6mm on my
 * panel". With the native resolution trusted, that measures the panel
 * and yields its true diagonal in inches (unrounded; caller rounds
 * for display/storage).
 */
export function diagonalFromCardPx(
  adjustedCssPx: number,
  dpr: number,
  resolution: Resolution,
): number {
  const nativePxPerCm = (adjustedCssPx * dpr) / CARD_W_CM;
  const diagPx = Math.hypot(resolution.w, resolution.h);
  return diagPx / nativePxPerCm / CM_PER_IN;
}
