/**
 * The live acuity ladder: optotype and text rows sized in arc minutes
 * for one device at its own viewing distance. Pure geometry; the
 * overlay component turns device pixels into CSS pixels.
 *
 * Optotypes follow the Snellen convention: a 20/20 letter subtends 5′
 * with 1′ strokes and gap, scaling linearly with the denominator. Text
 * rows are cap heights, the same quantity every other reading in the
 * app reports.
 */

import {
  ACUITY,
  STROKE_PER_CAP,
  physicalSizeCm,
  sizeForArcmin,
} from "./display-math";
import { legibilityVerdict, type LegibilityVerdict } from "./legibility";
import type { Device } from "./types";

/** Device pixels that subtend `arcmin` on `device`: pixelsToArcmin's inverse. */
export function arcminToDevicePx(arcmin: number, device: Device): number {
  const { heightCm } = physicalSizeCm(device.diagonalIn, device.aspect);
  if (!(heightCm > 0) || !(device.resolution.h > 0)) return 0;
  const pitchCm = heightCm / device.resolution.h;
  return sizeForArcmin(arcmin, device.distanceCm) / pitchCm;
}

/** Snellen denominators shown, largest first (20/200 … 20/15). */
export const SNELLEN_DENOMINATORS = [200, 100, 70, 50, 40, 30, 20, 15] as const;

/** Letter height of a 20/`denominator` optotype, in arc minutes. */
export const snellenArcmin = (denominator: number) =>
  ACUITY.detailLimitArcmin * 5 * (denominator / 20);

export interface OptotypeRow {
  label: string;
  arcmin: number;
  /** Letter height in device pixels. */
  devicePx: number;
  /** True when the 1/5-height gap falls under one device pixel: the
   * panel cannot draw this row, whatever the viewer's eyes can do. */
  pixelLimited: boolean;
}

export function optotypeRows(device: Device): OptotypeRow[] {
  return SNELLEN_DENOMINATORS.map((d) => {
    const arcmin = snellenArcmin(d);
    const devicePx = arcminToDevicePx(arcmin, device);
    return {
      label: `20/${d}`,
      arcmin,
      devicePx,
      pixelLimited: devicePx / 5 < 1,
    };
  });
}

/** Cap heights on the text ladder, in arc minutes, largest first. The
 * 20′ and 16′ rungs are the ISO 9241-303 band edges; 6′ is the first
 * with sub-1′ strokes. */
export const TEXT_LADDER_ARCMIN = [30, 25, 20, 16, 12, 10, 8, 6] as const;

export interface TextLadderRow {
  arcmin: number;
  /** Cap height in device pixels. */
  devicePx: number;
  verdict: LegibilityVerdict;
  /** Strokes under 1′: the letterforms fit but blur out. */
  subAcuityStrokes: boolean;
  /** Strokes under one device pixel: the panel anti-aliases them away. */
  subPixelStrokes: boolean;
}

export function textLadderRows(device: Device): TextLadderRow[] {
  return TEXT_LADDER_ARCMIN.map((arcmin) => {
    const devicePx = arcminToDevicePx(arcmin, device);
    return {
      arcmin,
      devicePx,
      verdict: legibilityVerdict(arcmin),
      subAcuityStrokes: arcmin * STROKE_PER_CAP < ACUITY.detailLimitArcmin,
      subPixelStrokes: devicePx * STROKE_PER_CAP < 1,
    };
  });
}

/**
 * Drop rows from the front (the tallest) until the stack fits in
 * `budget`, measured by `heightOf`. Big rows go first: on a small or
 * near screen the fine end of the ladder is the part worth seeing.
 * Always keeps at least one row.
 */
export function fitRows<T>(
  rows: readonly T[],
  heightOf: (row: T) => number,
  budget: number,
): T[] {
  let out = [...rows];
  const total = (rs: T[]) => rs.reduce((s, r) => s + heightOf(r), 0);
  while (out.length > 1 && total(out) > budget) out = out.slice(1);
  return out;
}
