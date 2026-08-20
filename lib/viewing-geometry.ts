/**
 * Where a screen sits and which way it points, per viewing scenario.
 *
 * Pure (no React, no DOM). Companion to `display-math` — that module
 * answers "how big does this subtend", this one answers "how is the
 * panel actually placed in the room".
 *
 * See `wiki/notes/decision-viewing-geometry-tilt-and-falloff.md`.
 */

import type { Device, DeviceCategory } from "./types";
// Type-only, so it erases at compile time and this module keeps no
// runtime dependency on the store — importing the alias rather than
// re-declaring the three stance keys is what stops the two drifting.
import type { Scenario } from "@/stores/viewer-store";

/**
 * Tilt sign convention, shared by the UI and the 3D scene:
 * **positive tips the panel's face UPWARD** — its top edge leans away
 * from the viewer, the way a desk monitor on a stand is angled up at a
 * seated head. Negative aims the face down. Zero is dead vertical.
 *
 * This is also three.js `rotation.x` directly: rotating about +X sends
 * the panel's top toward +Z, and the viewer sits at -Z, so a positive
 * angle leans the top away from them. No conversion anywhere.
 */
export const TILT_LIMIT_DEG = 45;

/**
 * Which categories point themselves at the viewer unless told otherwise.
 * Held things track your gaze; furniture does not (Taylor 2026-08-20).
 */
const AUTO_ORIENT_BY_CATEGORY: Record<DeviceCategory, boolean> = {
  handheld: true,
  phone: true,
  tablet: true,
  monitor: false,
  tv: false,
  projector: false,
  custom: false,
};

/**
 * What this category does when nothing is stored. Exported so the UI can
 * persist `undefined` whenever the choice matches the default, keeping
 * untouched devices byte-identical in localStorage.
 */
export function autoOrientDefaultFor(category: DeviceCategory): boolean {
  return AUTO_ORIENT_BY_CATEGORY[category] ?? false;
}

/** Absent `autoOrient` falls back to the category's habit. */
export function autoOrientOf(device: Pick<Device, "category" | "autoOrient">): boolean {
  return device.autoOrient ?? AUTO_ORIENT_BY_CATEGORY[device.category] ?? false;
}

/**
 * The pitch that points a panel's face straight at the eye.
 *
 * The panel centre sits at (0, centerY, distanceCm) and the eye at
 * (0, eyeY, 0), so the face must lean by the angle between the sight
 * line and the horizontal. A screen BELOW eye level gets a positive
 * (face-up) angle, which is exactly what a handheld in your lap does.
 *
 * Degenerate distance (a panel at the eye) yields 0 rather than a
 * quarter turn — nothing sensible to aim at.
 */
export function autoTiltDeg(
  centerY: number,
  eyeY: number,
  distanceCm: number,
): number {
  if (!(distanceCm > 1e-6)) return 0;
  return (Math.atan2(eyeY - centerY, distanceCm) * 180) / Math.PI;
}

/** A stored manual tilt for one stance, if the device has one. */
export function storedTiltDeg(
  device: Pick<Device, "tilt">,
  scenario: Scenario,
): number | undefined {
  return device.tilt?.[scenario];
}

/**
 * The angle this panel is actually drawn at: aimed at the eye when
 * auto-orienting, otherwise the stance's stored tilt (default flat).
 *
 * The clamp guards the STORED value only — that is the one a stray
 * number could fold through itself. An auto angle is derived from real
 * geometry and is already bounded by atan2, and clamping it would be
 * wrong: a handheld 40cm below the eye at arm's length genuinely needs
 * ~48° to face you, and pinning that to the slider's 45° limit would
 * leave it visibly not pointing where it should.
 */
export function resolvedTiltDeg(
  device: Pick<Device, "category" | "autoOrient" | "tilt">,
  scenario: Scenario,
  centerY: number,
  eyeY: number,
  distanceCm: number,
): number {
  if (autoOrientOf(device)) return autoTiltDeg(centerY, eyeY, distanceCm);
  const deg = storedTiltDeg(device, scenario) ?? 0;
  return Math.max(-TILT_LIMIT_DEG, Math.min(TILT_LIMIT_DEG, deg));
}

export const degToRad = (deg: number): number => (deg * Math.PI) / 180;

/**
 * Eye height for a stance, in cm from the floor. Mirrors
 * `eyeHeightCm`'s constants; kept here so the pure layer can seed a
 * per-stance height override without reaching into the viewer store.
 */
export function eyeLevelForScenario(
  scenario: Scenario,
  bodyHeightCm: number,
): number {
  switch (scenario) {
    case "standing":
      return bodyHeightCm * 0.936;
    case "desk":
      return bodyHeightCm * 0.45 + 45;
    case "couch":
      return bodyHeightCm * 0.45 + 40;
  }
}
