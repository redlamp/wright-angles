/**
 * Per-media crop helpers. A crop is a normalized window (0–1, y-down)
 * against the intrinsic image — see MediaCrop in types.ts. Pure module:
 * components and the 3D layer consume it; nothing here touches the DOM.
 *
 * This is the SOURCE crop only: one window per item, applied everywhere
 * ("this screenshot has browser chrome in it"). How a panel of a
 * different shape presents that content is the device's `fit` mode —
 * lib/fit.ts, which derives a second crop in these same coordinates so
 * everything below composes unchanged.
 */

import type { HighlightBox, MediaCrop, MediaItem } from "./types";

type Cropped = Pick<MediaItem, "width" | "height" | "crop">;

export const FULL_CROP: MediaCrop = { x: 0, y: 0, w: 1, h: 1 };

export function cropOf(item: Pick<MediaItem, "crop">): MediaCrop {
  return item.crop ?? FULL_CROP;
}

/** Pixel dims (rounded) of an arbitrary crop window over the item. */
export function cropDims(
  item: Pick<MediaItem, "width" | "height">,
  crop: MediaCrop,
): { width: number; height: number } {
  return {
    width: Math.round(crop.w * item.width),
    height: Math.round(crop.h * item.height),
  };
}

/** Cropped pixel dims (rounded); the intrinsic dims when no crop. */
export function effectiveDims(item: Cropped): {
  width: number;
  height: number;
} {
  return cropDims(item, cropOf(item));
}

const EPS = 1e-4;

/** Field-wise equality within EPS — how the UI matches a crop to a preset. */
export function cropsEqual(a: MediaCrop, b: MediaCrop): boolean {
  return (
    Math.abs(a.x - b.x) < EPS &&
    Math.abs(a.y - b.y) < EPS &&
    Math.abs(a.w - b.w) < EPS &&
    Math.abs(a.h - b.h) < EPS
  );
}

/** True when the crop covers (essentially) the whole frame. */
export function isFullFrame(crop: MediaCrop): boolean {
  return (
    crop.x < EPS &&
    crop.y < EPS &&
    crop.x + crop.w > 1 - EPS &&
    crop.y + crop.h > 1 - EPS
  );
}

/**
 * CSS crop for <img>/<video> via object-view-box (Chromium): inset from
 * each edge in percent of the intrinsic box. The element's used intrinsic
 * size becomes the crop window, so object-contain letterboxes against the
 * effective dims. Empty when no crop, keeping that path byte-identical.
 */
export function viewBoxStyle(item: Cropped): { objectViewBox?: string } {
  return viewBoxOf(item.crop);
}

/** viewBoxStyle for an explicit crop (per-device rendering paths). */
export function viewBoxOf(c: MediaCrop | undefined): { objectViewBox?: string } {
  if (!c || isFullFrame(c)) return {};
  const pct = (v: number) => `${(v * 100).toFixed(4)}%`;
  return {
    objectViewBox: `inset(${pct(c.y)} ${pct(1 - c.x - c.w)} ${pct(1 - c.y - c.h)} ${pct(c.x)})`,
  };
}

/**
 * Inner-element geometry for the wrapper-based CSS crop, used where an
 * inline object-view-box can't be applied (SyncedVideo and the GIF
 * follower canvas take no style prop): inside a clipping box shaped to
 * the effective dims, the full-frame child is oversized by 1/crop and
 * shifted so exactly the crop window shows through.
 */
export function cropScaleStyle(item: Cropped): {
  left: string;
  top: string;
  width: string;
  height: string;
} {
  return cropScaleOf(cropOf(item));
}

/** cropScaleStyle for an explicit crop (per-device rendering paths). */
export function cropScaleOf(c: MediaCrop): {
  left: string;
  top: string;
  width: string;
  height: string;
} {
  return {
    left: `${(-c.x / c.w) * 100}%`,
    top: `${(-c.y / c.h) * 100}%`,
    width: `${(1 / c.w) * 100}%`,
    height: `${(1 / c.h) * 100}%`,
  };
}

/**
 * A highlight box (normalized to the FULL intrinsic image — persisted
 * boxes must not shift when the crop changes) mapped into crop space for
 * rendering: intersected with the window; null when fully outside.
 */
export function boxInCrop(
  box: Pick<HighlightBox, "x" | "y" | "w" | "h">,
  crop: MediaCrop,
): { x: number; y: number; w: number; h: number } | null {
  const x0 = Math.max(box.x, crop.x);
  const y0 = Math.max(box.y, crop.y);
  const x1 = Math.min(box.x + box.w, crop.x + crop.w);
  const y1 = Math.min(box.y + box.h, crop.y + crop.h);
  if (x1 <= x0 || y1 <= y0) return null;
  return {
    x: (x0 - crop.x) / crop.w,
    y: (y0 - crop.y) / crop.h,
    w: (x1 - x0) / crop.w,
    h: (y1 - y0) / crop.h,
  };
}

/** The standard aspect-ratio presets the crop UI offers, in UI order. */
export const ASPECT_PRESETS: { label: string; ratio: number }[] = [
  { label: "4:3", ratio: 4 / 3 },
  { label: "5:4", ratio: 5 / 4 },
  { label: "16:9", ratio: 16 / 9 },
  { label: "16:10", ratio: 16 / 10 },
  { label: "21:9", ratio: 21 / 9 },
  { label: "32:9", ratio: 32 / 9 },
];

/**
 * The largest centered window of the given aspect ratio (w/h) inside an
 * intrinsic width×height frame. Wider images keep full height and center
 * horizontally; taller ones keep full width and center vertically. An
 * image already at the target aspect yields the full frame — callers
 * treat that as "no crop" via isFullFrame.
 */
export function aspectCrop(
  ratio: number,
  imgW: number,
  imgH: number,
): MediaCrop {
  if (ratio <= 0 || imgW <= 0 || imgH <= 0) return { ...FULL_CROP };
  if (imgW / imgH > ratio) {
    const w = (imgH * ratio) / imgW;
    return { x: (1 - w) / 2, y: 0, w, h: 1 };
  }
  const h = imgW / ratio / imgH;
  return { x: 0, y: (1 - h) / 2, w: 1, h };
}

export type CropHandle =
  | "n"
  | "s"
  | "e"
  | "w"
  | "ne"
  | "nw"
  | "se"
  | "sw"
  | "move";

const MIN_CROP = 0.02;
const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

/**
 * One step of the freeform editor's drag: `base` is the crop at
 * pointer-down, dx/dy the pointer delta in normalized image units.
 * `wPerH` locks the aspect when set — it is width-per-height in
 * NORMALIZED units, i.e. pixelAspect · (imageH / imageW); corners anchor
 * the opposite corner (width drives), side handles keep the base's
 * midline. Everything clamps to the frame with a small minimum size.
 */
export function dragCrop(
  base: MediaCrop,
  handle: CropHandle,
  dx: number,
  dy: number,
  wPerH: number | null,
): MediaCrop {
  if (handle === "move") {
    return {
      ...base,
      x: clamp(base.x + dx, 0, 1 - base.w),
      y: clamp(base.y + dy, 0, 1 - base.h),
    };
  }
  const west = handle.includes("w");
  const east = handle.includes("e");
  const north = handle.includes("n");
  const south = handle.includes("s");
  let x0 = base.x;
  let x1 = base.x + base.w;
  let y0 = base.y;
  let y1 = base.y + base.h;
  if (west) x0 = clamp(x0 + dx, 0, x1 - MIN_CROP);
  if (east) x1 = clamp(x1 + dx, x0 + MIN_CROP, 1);
  if (north) y0 = clamp(y0 + dy, 0, y1 - MIN_CROP);
  if (south) y1 = clamp(y1 + dy, y0 + MIN_CROP, 1);

  if (wPerH) {
    if ((east || west) && (north || south)) {
      const ax = west ? x1 : x0;
      const ay = north ? y1 : y0;
      const availW = west ? ax : 1 - ax;
      const availH = north ? ay : 1 - ay;
      const w = clamp(x1 - x0, MIN_CROP, Math.min(availW, availH * wPerH));
      const h = w / wPerH;
      x0 = west ? ax - w : ax;
      x1 = x0 + w;
      y0 = north ? ay - h : ay;
      y1 = y0 + h;
    } else if (east || west) {
      const cy = base.y + base.h / 2;
      const w = Math.min(x1 - x0, 2 * Math.min(cy, 1 - cy) * wPerH);
      const h = w / wPerH;
      if (west) x0 = x1 - w;
      else x1 = x0 + w;
      y0 = cy - h / 2;
      y1 = cy + h / 2;
    } else {
      const cx = base.x + base.w / 2;
      const h = Math.min(y1 - y0, (2 * Math.min(cx, 1 - cx)) / wPerH);
      const w = h * wPerH;
      if (north) y0 = y1 - h;
      else y1 = y0 + h;
      x0 = cx - w / 2;
      x1 = cx + w / 2;
    }
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
