/**
 * Core domain types.
 *
 * Canonical units, chosen to match how people actually talk about displays:
 * - display diagonal: inches
 * - viewing distance: centimeters
 * Unit toggles convert at the UI edge only; the math layer never sees them.
 */

export interface Resolution {
  w: number;
  h: number;
}

/** Aspect ratio as a pair, e.g. { w: 16, h: 9 }. */
export interface Aspect {
  w: number;
  h: number;
}

export type DeviceCategory =
  | "handheld"
  | "phone"
  | "tablet"
  | "monitor"
  | "tv"
  | "projector"
  | "custom";

export interface Device {
  id: string;
  /** User-facing name ("Living Room TV"). */
  label: string;
  /** Product identity ("Philips 49PUS8303"), optional. */
  deviceName?: string;
  category: DeviceCategory;
  /** Screen diagonal in inches. */
  diagonalIn: number;
  /** Viewing distance in centimeters. */
  distanceCm: number;
  resolution: Resolution;
  /** Usually derived from resolution; kept explicit so odd panels can override. */
  aspect: Aspect;
  /** Key color used for outlines/keylines everywhere this device is drawn. */
  color: string;
  visible: boolean;
}

/** A preset is a Device minus per-instance state. */
export type DevicePreset = Omit<Device, "id" | "visible" | "color"> & {
  presetId: string;
};

export interface MediaItem {
  id: string;
  name: string;
  /** MIME type of the stored blob. */
  type: string;
  /** Intrinsic pixel size of the image. */
  width: number;
  height: number;
  /**
   * The resolution class this image was authored at (its "reference size",
   * e.g. 1080p gameplay capture). Defaults to intrinsic height.
   */
  referenceHeight: number;
  addedAt: number;
}

export type LengthUnit = "in" | "cm";
