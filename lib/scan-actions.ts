"use client";

import { captureFrameAt } from "./frame-capture";
import { isAnimatedItem } from "./playback-engine";
import { withScan } from "./scan-keyframes";
import { groupTextLines } from "./text-groups";
import type { KeyframeLine, MediaItem } from "./types";
import { useMediaStore } from "@/stores/media-store";
import { usePlaybackStore } from "@/stores/playback-store";

/**
 * Store-driven text detection, callable from any panel (Media Library,
 * Perception Report). Images get a one-shot scan persisted on the item
 * plus labeled measure boxes; timeline media scans the CURRENT frame
 * onto a keyframe at the playhead.
 */

/** Detected lines are capped to the largest few so a text-dense shot
 * doesn't flood the overlays and the Perception Report. */
export const MAX_DETECTED_BOXES = 24;

const newBoxId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

/** OCR one frame URL into grouped, size-corrected lines. */
async function ocrUrl(
  url: string,
  item: MediaItem,
): Promise<{ lines: KeyframeLine[]; medianPx: number }> {
  // Client-only dynamic import: the OCR module (and the Tesseract
  // worker behind it) never loads during prerender.
  const { detectTextLines, largestByArea, medianHeightPx } = await import(
    "./ocr"
  );
  const intrinsic = { width: item.width, height: item.height };
  const raw = largestByArea(
    await detectTextLines(url, intrinsic, item.crop),
    MAX_DETECTED_BOXES,
  );
  const { groupOf, groups } = groupTextLines(
    raw.map((l) => l.box),
    intrinsic,
  );
  return {
    lines: raw.map((l, i) => ({
      id: newBoxId(),
      text: l.text,
      confidence: l.confidence,
      box: l.box,
      groupId: groupOf[i],
      sizePx: groups[groupOf[i]].sizePx,
    })),
    medianPx: medianHeightPx(raw, intrinsic),
  };
}

/** Pause, seek, capture, and scan one keyframe of a timeline item. */
export async function scanKeyframeAt(
  itemId: string,
  timeSec: number,
): Promise<void> {
  const media = useMediaStore.getState();
  const item = media.items.find((i) => i.id === itemId);
  if (!item) throw new Error("media item not found");
  const frame = await captureFrameAt(timeSec);
  if (!frame) throw new Error("no decodable frame at the playhead");
  try {
    const { lines, medianPx } = await ocrUrl(frame.url, item);
    const cur =
      useMediaStore.getState().items.find((i) => i.id === itemId)
        ?.scanKeyframes ?? [];
    media.setScanKeyframes(itemId, withScan(cur, timeSec, lines, medianPx));
  } finally {
    frame.revoke();
  }
}

/**
 * Detect text on the item: current playhead frame for timeline media
 * (adding a keyframe), the whole image otherwise. Image re-detection
 * replaces the previous scan's boxes instead of stacking duplicates.
 */
export async function detectTextForItem(itemId: string): Promise<void> {
  const media = useMediaStore.getState();
  const item = media.items.find((i) => i.id === itemId);
  if (!item) throw new Error("media item not found");
  if (isAnimatedItem(item)) {
    await scanKeyframeAt(itemId, usePlaybackStore.getState().timeSec);
    return;
  }
  const url = media.objectUrls[itemId];
  if (!url) throw new Error("media blob not loaded");
  const { lines, medianPx } = await ocrUrl(url, item);
  for (const old of item.scan?.lines ?? []) media.removeBox(itemId, old.id);
  for (const line of lines)
    media.addBox(itemId, { id: line.id, label: line.text, ...line.box });
  media.setScan(itemId, { lines, medianPx });
}
