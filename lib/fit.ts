/**
 * How content lands on a screen whose shape differs from its own.
 *
 * Two jobs live here, both pure (no React, no DOM):
 * - `containFit`: the pixel geometry of an object-contain box.
 * - The device `fit` modes (decision-media-crop-vs-device-fit): the
 *   fill modes ARE crops — computed instead of hand-drawn — so the
 *   render pipeline downstream is the same one the source crop feeds.
 *
 * Nothing here ever stretches content: an anamorphic mode would make
 * every arc-minute reading a lie.
 */

import { cropOf } from "./media-crop";
import type { Device, FitMode, MediaCrop, MediaItem } from "./types";

/**
 * Object-contain fit: where content of aspect (cw×ch) lands inside a box
 * of (bw×bh), centered with bars. Returned in the box's coordinate space.
 */
export function containFit(
  cw: number,
  ch: number,
  bw: number,
  bh: number,
): { x: number; y: number; w: number; h: number } {
  if (cw <= 0 || ch <= 0 || bw <= 0 || bh <= 0)
    return { x: 0, y: 0, w: 0, h: 0 };
  const s = Math.min(bw / cw, bh / ch);
  const w = cw * s;
  const h = ch * s;
  return { x: (bw - w) / 2, y: (bh - h) / 2, w, h };
}

/** A device's fit mode; absent = contain, today's behaviour. */
export function fitModeOf(device: Pick<Device, "fit">): FitMode {
  return device.fit ?? "contain";
}

/** The user-facing names for the three modes, in UI order. */
export const FIT_MODES: { id: FitMode; label: string }[] = [
  { id: "contain", label: "Scale to fit" },
  { id: "fill-width", label: "Fill width (crop top/bottom)" },
  { id: "fill-height", label: "Fill height (crop sides)" },
];

export const fitLabel = (mode: FitMode): string =>
  FIT_MODES.find((m) => m.id === mode)?.label ?? mode;

/**
 * Content-to-box scale factor for a fit mode: how many box units one
 * content unit becomes. `contain` takes the smaller of the two ratios
 * (bars on the slack axis); `fill-width` matches the widths and
 * `fill-height` the heights, whichever way that comes out.
 *
 * NOT `Math.max` for the fill modes — max would pick whichever axis
 * happens to overflow, which is only the same answer when the fill
 * direction is also the overflowing one.
 */
export function fitScale(
  mode: FitMode,
  contentW: number,
  contentH: number,
  boxW: number,
  boxH: number,
): number {
  switch (mode) {
    case "fill-width":
      return boxW / contentW;
    case "fill-height":
      return boxH / contentH;
    default:
      return Math.min(boxW / contentW, boxH / contentH);
  }
}

/**
 * The crop a fit mode derives over an already source-cropped image.
 *
 * `source` is the item's own crop window, normalized to the FULL
 * intrinsic image (y-down); the result keeps that same normalization —
 * the invariant that lets boxes, scans and textures compose without
 * knowing which layer they came from. The source crop applies first;
 * the fit crop only reframes what is left of it, centred.
 *
 * `boxAspect` is the destination rect's width/height (a device's
 * `aspect`, i.e. its physical panel shape).
 *
 * - contain → `source` unchanged; the bars happen at draw time.
 * - fill-width → keep the full cropped width, trim height equally off
 *   top and bottom until it matches the box shape.
 * - fill-height → keep the full cropped height, trim width equally off
 *   left and right.
 *
 * A fill mode that would need to ADD content (the image is already
 * slacker than the panel on that axis) trims nothing and letterboxes on
 * the other axis instead — clamped by the Math.min, never extrapolated.
 */
export function fitCrop(
  mode: FitMode,
  source: MediaCrop,
  imgW: number,
  imgH: number,
  boxAspect: number,
): MediaCrop {
  if (mode === "contain") return source;
  if (!(boxAspect > 0) || imgW <= 0 || imgH <= 0) return source;
  const cw = source.w * imgW;
  const ch = source.h * imgH;
  if (cw <= 0 || ch <= 0) return source;
  if (mode === "fill-width") {
    const h = Math.min(ch, cw / boxAspect) / imgH;
    return { x: source.x, y: source.y + (source.h - h) / 2, w: source.w, h };
  }
  const w = Math.min(cw, ch * boxAspect) / imgW;
  return { x: source.x + (source.w - w) / 2, y: source.y, w, h: source.h };
}

/**
 * The window this device actually renders of this item: the item's
 * source crop, reframed by the device's fit mode. Equal to the source
 * crop for `contain` (and for any fill mode that has no work to do), so
 * the shared-texture / no-crop fast paths keep firing.
 */
export function deviceFitCrop(
  item: Pick<MediaItem, "width" | "height" | "crop">,
  device: Pick<Device, "aspect" | "fit">,
): MediaCrop {
  return fitCrop(
    fitModeOf(device),
    cropOf(item),
    item.width,
    item.height,
    device.aspect.w / device.aspect.h,
  );
}

/** True when the media's shape and the device's shape actually disagree. */
export function aspectsDisagree(
  item: Pick<MediaItem, "width" | "height" | "crop">,
  device: Pick<Device, "aspect">,
  tolerance = 0.01,
): boolean {
  const c = cropOf(item);
  const cw = c.w * item.width;
  const ch = c.h * item.height;
  if (cw <= 0 || ch <= 0) return false;
  const panel = device.aspect.w / device.aspect.h;
  if (!(panel > 0)) return false;
  return Math.abs(cw / ch - panel) > tolerance;
}
