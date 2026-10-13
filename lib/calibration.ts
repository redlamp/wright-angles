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
import type { Aspect, LengthUnit, Resolution } from "./types";

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
 * CSS pixels per centimetre on this panel, if `diagonalIn` and the
 * native `resolution` are both right. Measured along the diagonal, so
 * the aspect needs no separate input. Seeds the ruler and draws the
 * result screen's check line.
 */
export function cssPxPerCm(
  diagonalIn: number,
  resolution: Resolution,
  dpr: number,
): number {
  const diagPx = Math.hypot(resolution.w, resolution.h);
  return diagPx / (diagonalIn * CM_PER_IN) / dpr;
}

/**
 * The general measurement: the user says "this many CSS px really is
 * `lengthCm` on my panel" (a card's width, a ruler mark). With the
 * native resolution trusted, that measures the panel and yields its
 * true diagonal in inches (unrounded; caller rounds for display).
 */
export function diagonalFromLengthPx(
  adjustedCssPx: number,
  lengthCm: number,
  dpr: number,
  resolution: Resolution,
): number {
  const nativePxPerCm = (adjustedCssPx * dpr) / lengthCm;
  const diagPx = Math.hypot(resolution.w, resolution.h);
  return diagPx / nativePxPerCm / CM_PER_IN;
}

/**
 * Inverse of cardWidthCssPx: the user says "this many CSS px really is
 * 85.6mm on my panel" — diagonalFromLengthPx for the card's width.
 */
export function diagonalFromCardPx(
  adjustedCssPx: number,
  dpr: number,
  resolution: Resolution,
): number {
  return diagonalFromLengthPx(adjustedCssPx, CARD_W_CM, dpr, resolution);
}

/**
 * CSS px for one fine-adjust step of `stepMm`, on a shape currently
 * `lengthPx` wide that stands for `lengthMm` of a real object. Uses the
 * shape's own current scale — the one the user is converging on — so a
 * step is the same physical nudge whatever the seed was.
 */
export function fineStepPx(
  lengthPx: number,
  lengthMm: number,
  stepMm = 0.1,
): number {
  return (lengthPx / lengthMm) * stepMm;
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

/**
 * The common size a measurement most plausibly is, when it lands within
 * `toleranceIn` of one (a careful card match is good to about 1%, so a
 * 26.8″ reading is very likely a 27″ panel). Null when nothing is that
 * close, so the result never rounds to a size it isn't near.
 */
export function nearestCommonDiagonal(
  diagonalIn: number,
  toleranceIn = 0.4,
): number | null {
  let best: number | null = null;
  for (const size of COMMON_DIAGONALS_IN) {
    const off = Math.abs(size - diagonalIn);
    if (off > toleranceIn + 1e-9) continue;
    if (best === null || off < Math.abs(best - diagonalIn)) best = size;
  }
  return best;
}

/**
 * Ruler lengths offered in ruler mode, per display unit: the mark the
 * user lines the end handle up to, and its length in centimetres.
 */
export const RULER_LENGTHS: Record<
  LengthUnit,
  readonly { label: string; cm: number }[]
> = {
  cm: [
    { label: "10 cm", cm: 10 },
    { label: "15 cm", cm: 15 },
  ],
  in: [
    { label: "4 in", cm: 4 * CM_PER_IN },
    { label: "6 in", cm: 6 * CM_PER_IN },
  ],
};
