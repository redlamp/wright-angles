/**
 * How content lands on a screen whose shape differs from its own.
 *
 * Three jobs live here, all pure (no React, no DOM):
 * - `containFit`: the pixel geometry of an object-contain box.
 * - The device `fit` modes (decision-media-crop-vs-device-fit): the
 *   fill modes ARE crops — computed instead of hand-drawn — so the
 *   render pipeline downstream is the same one the source crop feeds.
 * - `fitBox`: where the content actually lands in a device rect, which
 *   every overlay (boxes, loupe, draw layer, export) must agree with.
 *
 * One mode DOES stretch. `stretch` scales the axes independently, by
 * explicit user choice: nothing is cropped, no bars appear, and the
 * image distorts. Under it a single scale factor can only be honest
 * about one axis, so everything here reports the VERTICAL figure — the
 * axis the rest of the app already speaks — and `fitDistorts` /
 * `fitStretchRatio` let the UI flag the reading as vertical-only
 * wherever those numbers surface.
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

/**
 * Where a fit mode actually puts the content inside a device rect —
 * `containFit` generalized to the mode. This is the ONE answer the
 * drawing path and every overlay (measure boxes, the pixel loupe, the
 * draw layer, the PNG export, the 3D content quad) must share: overlays
 * position themselves against the pixels the content occupies, so a rect
 * that draws one way and measures another misplaces every box.
 *
 * `stretch` covers the whole box — that is the mode's definition. Every
 * other mode is `containFit`, and that is exact rather than approximate:
 * the fill modes have ALREADY reshaped the content by cropping it
 * (`fitCrop`), so contain-fitting the cropped window lands flush against
 * the rect with no bars left to take up.
 *
 * `cw`/`ch` are the content's EFFECTIVE dims — source crop reframed by
 * the same mode (`deviceFitCrop` / `cropDims`), not the intrinsic image.
 */
export function fitBox(
  mode: FitMode,
  cw: number,
  ch: number,
  bw: number,
  bh: number,
): { x: number; y: number; w: number; h: number } {
  if (mode !== "stretch") return containFit(cw, ch, bw, bh);
  if (cw <= 0 || ch <= 0 || bw <= 0 || bh <= 0)
    return { x: 0, y: 0, w: 0, h: 0 };
  return { x: 0, y: 0, w: bw, h: bh };
}

/** A device's fit mode; absent = contain, today's behaviour. */
export function fitModeOf(device: Pick<Device, "fit">): FitMode {
  return device.fit ?? "contain";
}

/** The user-facing names for the four modes, in UI order. */
export const FIT_MODES: { id: FitMode; label: string }[] = [
  { id: "contain", label: "Scale to fit" },
  { id: "fill-width", label: "Fill width (crop top/bottom)" },
  { id: "fill-height", label: "Fill height (crop sides)" },
  { id: "stretch", label: "Stretch to fit" },
];

export const fitLabel = (mode: FitMode): string =>
  FIT_MODES.find((m) => m.id === mode)?.label ?? mode;

/**
 * True for the one mode whose pixels are no longer square. Callers use
 * it to decide whether an arc-minute reading needs the "vertical only"
 * caveat next to it.
 */
export const fitDistorts = (mode: FitMode): boolean => mode === "stretch";

/**
 * Content-to-box scale factor for a fit mode: how many box units one
 * content unit becomes. `contain` takes the smaller of the two ratios
 * (bars on the slack axis); `fill-width` matches the widths and
 * `fill-height` the heights, whichever way that comes out.
 *
 * NOT `Math.max` for the fill modes — max would pick whichever axis
 * happens to overflow, which is only the same answer when the fill
 * direction is also the overflowing one.
 *
 * `stretch` has no single scale: width and height are scaled
 * independently, which is the whole point of the mode. It returns the
 * VERTICAL one, `boxH / contentH`, because every measurement in this app
 * is height-normalized — `boxMetricsOnDevice` takes a normalized HEIGHT,
 * and the pinned Disco Elysium pipeline is px→mm→arcmin on height — and
 * text legibility is height-driven. A single number can only be honest
 * about one axis; height is the axis the rest of the system speaks.
 * `fitStretchRatio` says how far the other axis has drifted.
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
    case "stretch":
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
 * - stretch → `source` unchanged. Stretch never crops: the whole
 *   cropped image is shown, distorted, so there is nothing to trim.
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
  if (mode === "contain" || mode === "stretch") return source;
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

/**
 * How many times wider each pixel is drawn than tall on this device:
 * the horizontal scale divided by the vertical one. 1 = undistorted.
 *
 * Only `stretch` can move it off 1 — the other modes preserve the
 * aspect by construction (contain letterboxes, the fill modes crop), so
 * they always answer 1 and the UI badge needs no mode check of its own.
 * Under stretch it reduces to panelAspect / contentAspect: a 16:9 image
 * on a 32:9 panel reads 2 ("drawn twice as wide as it is tall"), and
 * since `fitScale` reports the vertical figure, this is exactly the
 * factor by which the horizontal reading would differ from it.
 */
export function fitStretchRatio(
  item: Pick<MediaItem, "width" | "height" | "crop">,
  device: Pick<Device, "aspect" | "fit">,
): number {
  if (!fitDistorts(fitModeOf(device))) return 1;
  const c = cropOf(item);
  const cw = c.w * item.width;
  const ch = c.h * item.height;
  const panel = device.aspect.w / device.aspect.h;
  if (cw <= 0 || ch <= 0 || !(panel > 0)) return 1;
  return panel / (cw / ch);
}

/**
 * The caveat that has to travel with any arc-minute reading off a
 * stretched device: the number is the VERTICAL one and the image is not
 * drawn at that proportion horizontally. Null when nothing distorts (an
 * undistorted device, or a stretch device the media happens to match),
 * so callers can render it unconditionally.
 */
export function fitStretchNote(
  item: Pick<MediaItem, "width" | "height" | "crop">,
  device: Pick<Device, "aspect" | "fit">,
): string | null {
  const r = fitStretchRatio(item, device);
  if (!(r > 0) || Math.abs(r - 1) < 0.01) return null;
  const n = r.toFixed(1).replace(/\.0$/, "");
  return `${r > 1 ? "stretched" : "squeezed"} ${n}× wide · arcmin is vertical`;
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
