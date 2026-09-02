/**
 * The ISO 16'/20' legibility verdict band, as a color — copied
 * identically into four view components before this. One definition.
 */

import { ACUITY } from "./display-math";

export const LEGIBILITY_COLORS = {
  /** >= 20' — comfortable, ISO 9241-303's required band. */
  good: "#46a758",
  /** >= 16', < 20' — the ISO minimum, but not comfortable. */
  warn: "#f5a524",
  /** < 16' — under the ISO minimum. */
  bad: "#e5484d",
  /** No visible device shows this box at all (every device's fit crops
   * it away) — there's no verdict to color it by. */
  none: "#71717a59",
} as const;

/** Verdict color for an arc-minute reading; null renders as the muted
 * "no visible device shows this" neutral. */
export function legibilityColor(arcmin: number | null): string {
  if (arcmin === null) return LEGIBILITY_COLORS.none;
  if (arcmin >= ACUITY.comfortableTextArcmin) return LEGIBILITY_COLORS.good;
  if (arcmin >= ACUITY.minCriticalTextArcmin) return LEGIBILITY_COLORS.warn;
  return LEGIBILITY_COLORS.bad;
}
