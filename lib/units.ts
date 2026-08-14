import type { LengthUnit } from "./types";
import { CM_PER_IN } from "./display-math";

/**
 * Canonical storage is diagonal-inches and distance-centimeters; these
 * helpers convert to/from the display unit at the UI edge.
 */

export function displayLength(canonical: number, from: LengthUnit, to: LengthUnit): number {
  if (from === to) return canonical;
  return from === "in" ? canonical * CM_PER_IN : canonical / CM_PER_IN;
}

export function formatLength(canonical: number, from: LengthUnit, to: LengthUnit): string {
  const v = displayLength(canonical, from, to);
  const rounded = to === "in" ? Math.round(v * 10) / 10 : Math.round(v);
  return `${rounded} ${to}`;
}
