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

/**
 * Card aspect, height/width. The card's shape is fixed (it's a real
 * object), so dragging a top/bottom edge changes height directly and
 * this ratio is how that maps back to the width the rest of the math
 * runs on — the four-edge drag requirement that "a vertical drag drives
 * width through the ID-1 ratio".
 */
export const CARD_ASPECT = CARD_H_MM / CARD_W_MM;

export function heightFromWidthPx(widthPx: number): number {
  return widthPx * CARD_ASPECT;
}

export function widthFromHeightPx(heightPx: number): number {
  return heightPx / CARD_ASPECT;
}

/**
 * Card diagonal, in units of width (i.e. diagonal = width *
 * CARD_DIAGONAL_RATIO). A corner drag scales the card along its own
 * diagonal — the opposite corner pins, and the distance from that pin
 * to the pointer, projected onto the card's true diagonal direction,
 * is the new diagonal length. This ratio converts that back to width.
 */
export const CARD_DIAGONAL_RATIO = Math.hypot(1, CARD_ASPECT);

export function widthFromDiagonalPx(diagonalPx: number): number {
  return diagonalPx / CARD_DIAGONAL_RATIO;
}

/**
 * Common diagonal sizes (inches), laptop through TV, for the "I think
 * the display is…" fallback — the lazy alternative to measuring, for
 * users who won't hold a card against the screen at all.
 */
export const COMMON_DIAGONALS_IN = [
  13.3, 14, 15.6, 16, 21.5, 24, 27, 32, 34, 42, 48, 55, 65,
];
