/**
 * Pure helpers behind the Perception Report tab
 * (components/panels/perception-report.tsx): the comparison-ratio note
 * and the flattening of an item's measure boxes and keyframe lines into
 * one list of text entries. No React, no DOM.
 */
import type { MediaItem } from "@/lib/types";

export function ratioNote(r: number): string {
  if (r > 1.03)
    return "designs will feel roomier there; check overwhelm at close range.";
  if (r < 0.5)
    return "half your working size or less — treat small text as invisible.";
  if (r < 0.97)
    return "everything shrinks; padding and hit targets tighten first.";
  return "a near-1:1 reference for this setup.";
}

/** One text entry for column 2 (measure box or keyframe line). */
export interface TextEntry {
  id: string;
  label: string;
  /** Full-image normalized height used for verdicts (group-corrected). */
  h: number;
  srcH: number;
  /** Keyframe timestamp for video lines; null = plain measure box. */
  kfTime: number | null;
  /** Removable only for real measure boxes. */
  removable: boolean;
  /** Full-image box rect, for per-device fit-crop visibility. */
  box: { x: number; y: number; w: number; h: number };
}

export function buildTextEntries(item: MediaItem): TextEntry[] {
  const entries: TextEntry[] = [];
  (item.boxes ?? []).forEach((b, idx) => {
    entries.push({
      id: b.id,
      label: b.label?.trim() || `Box ${idx + 1}`,
      h: b.h,
      srcH: Math.round(b.h * item.height),
      kfTime: null,
      removable: true,
      box: { x: b.x, y: b.y, w: b.w, h: b.h },
    });
  });
  for (const k of item.scanKeyframes ?? [])
    for (const l of k.lines ?? [])
      entries.push({
        id: l.id,
        label: l.text,
        h: l.sizePx ? l.sizePx / item.height : l.box.h,
        srcH: Math.round(l.sizePx ?? l.box.h * item.height),
        kfTime: k.timeSec,
        removable: false,
        box: l.box,
      });
  return entries;
}

/** CSS box for a background-image crop of one text line's region. */
export interface LineThumb {
  /** Thumbnail size, CSS px. */
  width: number;
  height: number;
  /** background-size, CSS px. */
  bgWidth: number;
  bgHeight: number;
  /** background-position, CSS px (≤ 0). */
  bgX: number;
  bgY: number;
}

/**
 * Crop a normalized box (full-image 0–1 coords) out of a `imgW`×`imgH`
 * image as a CSS background: the region (padded by `padFrac` of the
 * box height on every side, clamped to the image) scaled to `maxH`
 * tall, and clipped on the right at `maxW` — a long line keeps legible
 * glyphs and shows its start rather than shrinking to a smear. Lets a
 * report row show the pixels the OCR read, so a misread label ("47px"
 * for "17px") can be caught at a glance — with no canvas and no copy of
 * the image. Null for an empty box or image.
 */
export function lineThumb(
  box: { x: number; y: number; w: number; h: number },
  imgW: number,
  imgH: number,
  maxW: number,
  maxH: number,
  padFrac = 0.25,
): LineThumb | null {
  if (!(imgW > 0 && imgH > 0 && box.w > 0 && box.h > 0)) return null;
  const pad = box.h * imgH * padFrac;
  const x0 = Math.max(0, box.x * imgW - pad);
  const y0 = Math.max(0, box.y * imgH - pad);
  const x1 = Math.min(imgW, (box.x + box.w) * imgW + pad);
  const y1 = Math.min(imgH, (box.y + box.h) * imgH + pad);
  const rw = x1 - x0;
  const rh = y1 - y0;
  if (!(rw > 0 && rh > 0)) return null;
  const s = maxH / rh;
  return {
    width: Math.min(rw * s, maxW),
    height: rh * s,
    bgWidth: imgW * s,
    bgHeight: imgH * s,
    bgX: -x0 * s,
    bgY: -y0 * s,
  };
}
