"use client";

import { lineThumb } from "@/lib/perception-report";
import type { MediaItem } from "@/lib/types";
import { useMediaStore } from "@/stores/media-store";

const MAX_W = 128;
const MAX_H = 20;

/**
 * The pixels behind one OCR'd line, cropped straight out of the media's
 * local object URL with CSS background geometry — no canvas, no copy,
 * no network. OCR can misread ("47px" for "17px"); the thumbnail lets
 * the designer check the label against the real text at a glance.
 * Video keyframe lines get none: the stored still is the poster frame,
 * not the frame the line was read from.
 */
export function LineThumb({
  item,
  box,
  isKeyframe,
}: {
  item: MediaItem;
  box: { x: number; y: number; w: number; h: number };
  isKeyframe: boolean;
}) {
  const url = useMediaStore((s) => s.objectUrls[item.id]);
  const t =
    url && !(item.kind === "video" && isKeyframe)
      ? lineThumb(box, item.width, item.height, MAX_W, MAX_H)
      : null;
  if (!t) return null;
  return (
    <span
      aria-hidden
      className="block shrink-0 rounded-sm bg-no-repeat ring-1 ring-border"
      style={{
        width: t.width,
        height: t.height,
        backgroundImage: `url("${url}")`,
        backgroundSize: `${t.bgWidth}px ${t.bgHeight}px`,
        backgroundPosition: `${t.bgX}px ${t.bgY}px`,
      }}
    />
  );
}
