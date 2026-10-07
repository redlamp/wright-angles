"use client";

import {
  useAnnotationStore,
  type DeviceHover,
} from "@/stores/annotation-store";
import { fitBox } from "@/lib/fit";
import { legibilityColor } from "@/lib/legibility";
import { groupColor } from "@/lib/text-groups";
import { boxInCrop, cropDims } from "@/lib/media-crop";
import type { FitMode, HighlightBox, MediaCrop, MediaItem } from "@/lib/types";

/** Module-level mutator (react-compiler convention): view hover state. */
export const setDeviceHover = (h: DeviceHover | null) =>
  useAnnotationStore.getState().setDeviceHover(h);


/**
 * Highlight boxes over one device rect. Coordinates are normalized to
 * the media's content area — wherever this device's fit mode puts it in
 * the rect (`fitBox`) — so the same box lands on the same pixels of the
 * image on every device, stretched panels included.
 */
export function BoxLayer({
  rectW,
  rectH,
  media,
  boxes,
  worstByBox,
  groupById,
  isHost,
  deviceId,
  crop,
  mode,
}: {
  rectW: number;
  rectH: number;
  media: MediaItem;
  /** Measure boxes + active-keyframe lines, full-image normalized. */
  boxes: HighlightBox[];
  /** null = no visible device's fit shows this box; render it muted. */
  worstByBox: Map<string, number | null>;
  /** Text-block ids for the global Groups color mode. */
  groupById: Map<string, number>;
  isHost: boolean;
  /** Owning rect's device — box hovers feed the inspector with it. */
  deviceId: string;
  /** The owning device's rendered crop (source crop, fit-reframed). */
  crop: MediaCrop;
  /** The owning device's fit mode — boxes must land where IT draws. */
  mode: FitMode;
}) {
  const selectedBoxId = useAnnotationStore((s) => s.selectedBoxId);
  const selectBox = useAnnotationStore((s) => s.selectBox);
  const colorMode = useAnnotationStore((s) => s.scanColorMode);
  const eff = cropDims(media, crop);
  const area = fitBox(mode, eff.width, eff.height, rectW, rectH);
  if (!area.w) return null;
  return (
    <>
      {boxes.map((b) => {
        // Boxes stay normalized to the full image; render them through
        // the crop window (clipped; hidden when fully outside).
        const cb = boxInCrop(b, crop);
        if (!cb) return null;
        const gid = groupById.get(b.id);
        const color =
          colorMode === "group" && gid !== undefined
            ? groupColor(gid)
            : legibilityColor(worstByBox.get(b.id) ?? null);
        const selected = b.id === selectedBoxId;
        return (
          <div
            key={b.id}
            role={isHost ? "button" : undefined}
            aria-label={
              isHost ? `Measure box: ${b.label || "unlabeled"}` : undefined
            }
            aria-pressed={isHost ? selected : undefined}
            className="absolute"
            style={{
              left: area.x + cb.x * area.w,
              top: area.y + cb.y * area.h,
              width: cb.w * area.w,
              height: cb.h * area.h,
              border: `${selected && isHost ? 2 : 1}px solid ${color}`,
              boxShadow: selected && isHost ? `0 0 0 1px ${color}55` : undefined,
              cursor: isHost ? "pointer" : undefined,
              // All rects' boxes are hoverable (inspector details);
              // only the host's are clickable.
              pointerEvents: "auto",
            }}
            onClick={
              isHost
                ? (e) => {
                    e.stopPropagation();
                    selectBox(selected ? null : b.id);
                  }
                : undefined
            }
            onPointerEnter={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              const s = e.currentTarget.parentElement?.getBoundingClientRect();
              setDeviceHover({
                deviceId,
                box: {
                  id: b.id,
                  label: b.label,
                  srcPx: Math.round(b.h * media.height),
                  hFull: b.h,
                  groupId: groupById.get(b.id),
                  bounds: {
                    left: r.left,
                    top: r.top,
                    right: r.right,
                    bottom: r.bottom,
                  },
                  screen: s
                    ? {
                        left: s.left,
                        top: s.top,
                        right: s.right,
                        bottom: s.bottom,
                      }
                    : undefined,
                },
              });
            }}
            onPointerLeave={() => setDeviceHover({ deviceId, box: null })}
          />
        );
      })}
    </>
  );
}
