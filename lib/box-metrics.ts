/**
 * The one path from "a highlight box, normalized to a media item's full
 * intrinsic frame" to "how big it reads on a given device" — crop and
 * fit included.
 *
 * A device shows a WINDOW of the item: its own source crop, reframed by
 * the device's fit mode (`deviceFitCrop`). A box is on-screen only when
 * it falls inside that window, and its measured height re-normalizes
 * against the window's height, not the full frame's — the same box
 * reads bigger once a crop has thrown away the space around it. Every
 * caller that reports a box's arc-minute size (or decides whether a
 * device shows it at all) needs this exact chain; four call sites used
 * to hand-roll their own version and could silently drift from each
 * other. This is the one they all share now.
 */

import { boxMetricsOnDevice } from "./display-math";
import { deviceFitCrop } from "./fit";
import { boxInCrop, cropDims } from "./media-crop";
import type { Device, HighlightBox, MediaCrop, MediaItem } from "./types";

/**
 * Re-exported so every call site that ends in an arc-minute reading off
 * a box — including the 3D scene, which resolves its crop and hNorm
 * upstream in scene-view's `boxesFor` (the same `deviceFitCrop` +
 * `boxInCrop` this module uses) before device-rect does the final
 * `boxMetricsOnDevice` call — imports the last step from the same
 * module as `boxMetricsInCrop`, instead of `lib/display-math` directly.
 */
export { boxMetricsOnDevice };

export interface BoxDeviceMetrics {
  /** Height of the box in HOST device pixels. */
  devicePx: number;
  /** Angular height, arc minutes. */
  arcmin: number;
  /** Physical height, millimeters. */
  mm: number;
}

/**
 * Angular size of a highlight box on a device, through that device's
 * rendered crop — null when the device's fit mode crops the box away
 * entirely (nothing to measure; callers should render a muted/absent
 * verdict rather than treat a missing box as infinitely legible OR as
 * a hard failure).
 *
 * `box` is normalized to the item's FULL intrinsic frame (as persisted
 * boxes always are). `hNorm` is the height to measure — usually `box.h`,
 * but callers pass a group-corrected, descender-aware height
 * (`sizePx / item.height`) when one exists; either way it's a height
 * against the FULL frame, matching `box`.
 */
export function boxMetricsInCrop(
  box: Pick<HighlightBox, "x" | "y" | "w" | "h">,
  hNorm: number,
  item: Pick<MediaItem, "width" | "height" | "crop">,
  device: Device,
): BoxDeviceMetrics | null {
  const crop = deviceFitCrop(item, device);
  if (!boxInCrop(box, crop)) return null;
  return boxMetricsOnDevice(hNorm / crop.h, cropDims(item, crop), device);
}

/** The device's rendered crop, or null when it excludes `box` entirely. */
export function boxRenderCrop(
  box: Pick<HighlightBox, "x" | "y" | "w" | "h">,
  item: Pick<MediaItem, "width" | "height" | "crop">,
  device: Pick<Device, "aspect" | "fit">,
): MediaCrop | null {
  const crop = deviceFitCrop(item, device);
  return boxInCrop(box, crop) ? crop : null;
}
