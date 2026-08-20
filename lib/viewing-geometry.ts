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
import { physicalSizeCm } from "./display-math";
import { HANDHELD_BODIES } from "./presets";
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

/** Absent `autoOrient` for this stance falls back to the category's habit. */
export function autoOrientOf(
  device: Pick<Device, "category" | "autoOrient">,
  scenario: Scenario,
): boolean {
  return device.autoOrient?.[scenario] ?? autoOrientDefaultFor(device.category);
}

/**
 * Where this panel's centre sits in the room: the viewer's eye height
 * plus the stance's offset from the line of vision. The offset is the
 * stored quantity, so moving the body or changing stance carries the
 * screen with the gaze instead of stranding it at a fixed floor height.
 */
export function centerYFor(
  device: Pick<Device, "heightOffsetCm">,
  scenario: Scenario,
  eyeY: number,
): number {
  return eyeY + (device.heightOffsetCm?.[scenario] ?? 0);
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
  if (autoOrientOf(device, scenario))
    return autoTiltDeg(centerY, eyeY, distanceCm);
  const deg = storedTiltDeg(device, scenario) ?? 0;
  return Math.max(-TILT_LIMIT_DEG, Math.min(TILT_LIMIT_DEG, deg));
}

export const degToRad = (deg: number): number => (deg * Math.PI) / 180;

/** Categories a person holds in both hands rather than sits in front of. */
const HELD_CATEGORIES = new Set<DeviceCategory>(["handheld", "phone", "tablet"]);

/** Assumed bezel each side when a device has no chassis in HANDHELD_BODIES. */
const BEZEL_CM = 1.5;
/** How far inboard of the outer edge a hand actually wraps. */
const GRIP_INSET_CM = 2;
/** Hands never close nearer than this, however small the device. */
const MIN_HALF_GRIP_CM = 6;
/**
 * A grip is not level with the screen's middle. The palm meets the
 * chassis a little below the mid-line, and the wrist hangs below the
 * palm again — the hand mesh is a slab the size of the palm's base, so
 * drawing it at screen-centre height reads as holding the device by its
 * top edge (Taylor 2026-08-20).
 */
const PALM_BELOW_CENTER = 0.15;
const WRIST_BELOW_PALM_CM = 3;

/** Where the figure's hands should be to hold a device, in world cm. */
export interface HeldGrip {
  /** Distance from the eye — the panel's own z. */
  distanceCm: number;
  /** Screen-centre height. */
  centerY: number;
  /** Where the WRIST goes — below the screen centre, see the constants. */
  wristY: number;
  /** Half the hand span: the CHASSIS's edge, not the screen's. */
  halfGripCm: number;
}

/**
 * The device the viewer is holding, of everything currently visible.
 *
 * Picks the LOWEST one (Taylor 2026-08-20): with two handhelds in the
 * scene the arms have to commit to one, and reaching for the higher one
 * put the hands straight through the lower. Lowest is also the safer
 * read — hands passing over a screen are less wrong than through it.
 *
 * The span comes from the device's BODY where we know it, because you
 * grip a Switch by its rails, not by the glass; the screen plus a bezel
 * is the fallback. Returns null when nothing hand-held is visible, and
 * the caller keeps its authored pose.
 */
export function heldGripFor(
  devices: Pick<
    Device,
    | "category"
    | "deviceName"
    | "diagonalIn"
    | "aspect"
    | "distanceCm"
    | "heightOffsetCm"
  >[],
  scenario: Scenario,
  eyeY: number,
): HeldGrip | null {
  let best: { d: (typeof devices)[number]; centerY: number } | null = null;
  for (const d of devices) {
    if (!HELD_CATEGORIES.has(d.category)) continue;
    const centerY = centerYFor(d, scenario, eyeY);
    if (!best || centerY < best.centerY) best = { d, centerY };
  }
  if (!best) return null;
  const { d, centerY } = best;
  const body = d.deviceName ? HANDHELD_BODIES[d.deviceName] : undefined;
  const screen = physicalSizeCm(d.diagonalIn, d.aspect);
  const spanCm = body?.bodyWCm ?? screen.widthCm + BEZEL_CM * 2;
  const chassisHCm = body?.bodyHCm ?? screen.heightCm + BEZEL_CM * 2;
  return {
    distanceCm: d.distanceCm,
    centerY,
    wristY: centerY - (chassisHCm * PALM_BELOW_CENTER + WRIST_BELOW_PALM_CM),
    halfGripCm: Math.max(MIN_HALF_GRIP_CM, spanCm / 2 - GRIP_INSET_CM),
  };
}

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
