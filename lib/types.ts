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
  /**
   * Screen-center height from the floor in cm (3D view). Undefined means
   * "aligned to the viewer's eye height" — the angular math assumes a
   * centered gaze either way; elevation is a scene-realism control.
   */
  elevationCm?: number;
  /**
   * Curvature radius in mm using the industry convention (1000R = 1m
   * radius; smaller = curvier). Undefined/0 = flat panel.
   */
  curvatureR?: number;
  /** Show the device's 3D body/chassis model when one exists. Default on. */
  show3dBody?: boolean;
}

/** A preset is a Device minus per-instance state. */
export type DevicePreset = Omit<Device, "id" | "visible" | "color"> & {
  presetId: string;
};

/**
 * A measurement rectangle drawn over a media item, in coordinates
 * normalized to the media's intrinsic size (0–1), so it lands on the
 * same content across devices and resolutions.
 */
export interface HighlightBox {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface MediaItem {
  id: string;
  name: string;
  /** MIME type of the stored blob. */
  type: string;
  kind: "image" | "video";
  /** Video duration in seconds. */
  duration?: number;
  /** Intrinsic pixel size of the content. */
  width: number;
  height: number;
  /**
   * The resolution class this image was authored at (its "reference size",
   * e.g. 1080p gameplay capture). Defaults to intrinsic height.
   */
  referenceHeight: number;
  addedAt: number;
  /** Measurement boxes drawn over this item. */
  boxes?: HighlightBox[];
}

export type LengthUnit = "in" | "cm";
