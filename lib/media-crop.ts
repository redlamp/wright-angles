/**
 * Per-media crop helpers. A crop is a normalized window (0–1, y-down)
 * against the intrinsic image — see MediaCrop in types.ts. Pure module:
 * components and the 3D layer consume it; nothing here touches the DOM.
 */

import type { HighlightBox, MediaCrop, MediaItem } from "./types";

type Cropped = Pick<MediaItem, "width" | "height" | "crop">;

export const FULL_CROP: MediaCrop = { x: 0, y: 0, w: 1, h: 1 };

export function cropOf(item: Pick<MediaItem, "crop">): MediaCrop {
  return item.crop ?? FULL_CROP;
}

/** Cropped pixel dims (rounded); the intrinsic dims when no crop. */
export function effectiveDims(item: Cropped): {
  width: number;
  height: number;
} {
  const c = cropOf(item);
  return {
    width: Math.round(c.w * item.width),
    height: Math.round(c.h * item.height),
  };
}

const EPS = 1e-4;

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
  const c = item.crop;
  if (!c) return {};
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
  const c = cropOf(item);
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

export type CropPreset = "bottom-16-9" | "center-16-9" | "square";

/**
 * Preset crops from the intrinsic dims. Null = not applicable: the image
 * is already that shape, or (bottom-16-9) is wider than 16:9 so no
 * full-width 16:9 area exists. "bottom-16-9" is the chrome-trim case —
 * e.g. a 1920×1112 capture cropped to its bottom 1920×1080.
 */
export function presetCrop(
  preset: CropPreset,
  width: number,
  height: number,
): MediaCrop | null {
  if (width <= 0 || height <= 0) return null;
  const a = width / height;
  const near = (r: number) => Math.abs(a - r) / r < 1e-3;
  if (preset === "square") {
    if (near(1)) return null;
    const side = Math.min(width, height);
    return {
      x: (1 - side / width) / 2,
      y: (1 - side / height) / 2,
      w: side / width,
      h: side / height,
    };
  }
  const R = 16 / 9;
  if (near(R)) return null;
  if (preset === "bottom-16-9") {
    if (a > R) return null;
    const h = width / R / height;
    return { x: 0, y: 1 - h, w: 1, h };
  }
  if (a > R) {
    const w = (height * R) / width;
    return { x: (1 - w) / 2, y: 0, w, h: 1 };
  }
  const h = width / R / height;
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
