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
