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
   * Screen-center height from the floor in cm, per viewing scenario (3D
   * view). A missing entry means "aligned to the viewer's eye height" —
   * the angular math assumes a centered gaze either way; elevation is a
   * scene-realism control. (A standing-desk monitor sits differently
   * than the same monitor seen from a couch.)
   */
  elevation?: { standing?: number; desk?: number; couch?: number };
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
  /** OCR-read text when the box came from a scan ("Box N" fallback). */
  label?: string;
}

/**
 * Crop window over a media item, normalized 0–1 against the intrinsic
 * image (y-down, like image pixels). Absent = full frame.
 */
export interface MediaCrop {
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
  /** Manual library position (drag-reorder); unset items sort last. */
  sortIndex?: number;
  /** Measurement boxes drawn over this item. */
  boxes?: HighlightBox[];
  /**
   * Optional crop applied everywhere the item is displayed (2D rects, 3D
   * textures, previews, export). Boxes stay normalized to the FULL
   * intrinsic image so they never shift when the crop changes.
   */
  crop?: MediaCrop;
  /**
   * Per-device crop overrides, keyed by device id. Each window is
   * normalized to the FULL intrinsic image exactly like `crop` (NOT
   * relative to it) — the same rule that keeps boxes and scans valid
   * when any crop changes. An absent entry inherits the plain media
   * crop, so existing libraries need no migration.
   */
  deviceCrops?: Record<string, MediaCrop>;
  /**
   * OCR keyframes for timeline media (video/GIF): user-placed points on
   * the timeline, each optionally holding its frame's scan. A scan stays
   * on screen until the playhead passes the NEXT keyframe.
   */
  scanKeyframes?: ScanKeyframe[];
  /**
   * The image's one-shot OCR scan (group/size data behind the panel
   * overlay + list). Persisted so returning to the item shows the scan
   * again; the derived measure boxes live in `boxes` as always.
   */
  scan?: { lines: KeyframeLine[]; medianPx: number };
}

/** One text line detected on a keyframe's frame (full-image normalized). */
export interface KeyframeLine {
  id: string;
  text: string;
  confidence: number;
  box: { x: number; y: number; w: number; h: number };
  /** Text block this line belongs to (lib/text-groups). */
  groupId?: number;
  /**
   * Descender-aware font-size estimate in source px, shared by the
   * line's group — the ink box under-measures lines without descenders.
   */
  sizePx?: number;
}

export interface ScanKeyframe {
  timeSec: number;
  /** null = placed but not yet scanned. */
  lines: KeyframeLine[] | null;
  medianPx?: number;
}

export type LengthUnit = "in" | "cm";
