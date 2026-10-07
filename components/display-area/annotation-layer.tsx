"use client";

import { useRef, useState } from "react";
import { fitBox, fitModeOf } from "@/lib/fit";
import { boxInCrop } from "@/lib/media-crop";
import type { Device, HighlightBox, MediaCrop, MediaItem } from "@/lib/types";
import type { DeviceRect, Point } from "@/components/display-area/types";

/**
 * Host annotation layer: the measurement-box draft and the draw-mode
 * capture surface over This Device's rect.
 */
export function AnnotationLayer({
  rects,
  activeItem,
  eff,
  crop,
  thisDevice,
  center,
  drawMode,
  addBox,
  selectBox,
}: {
  rects: DeviceRect[];
  activeItem: MediaItem | null;
  eff: { width: number; height: number } | null;
  crop: MediaCrop | null;
  thisDevice: Device;
  center: Point;
  drawMode: boolean;
  addBox: (mediaId: string, box: HighlightBox) => void;
  selectBox: (id: string | null) => void;
}) {
  const [draft, setDraft] = useState<HighlightBox | null>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const hostRect = rects.find((r) => r.device.isThis);
  if (!activeItem || !eff || !crop || !hostRect) return null;
  // The layer overlays This Device's rect, so it maps through
  // This Device's fit — same geometry its BoxLayer uses.
  const hostMode = fitModeOf(thisDevice);
  const area = fitBox(
    hostMode,
    eff.width,
    eff.height,
    hostRect.w,
    hostRect.h,
  );
  // Draft is kept in full-image coords like persisted boxes; render
  // it through the crop window like BoxLayer does.
  const draftCb = draft ? boxInCrop(draft, crop) : null;
  return (
    <div
      // Above every device rect (z 1..n), below the app chrome
      // (sidebar z-30, panels z-40+), so UI stays clickable while
      // drawing.
      className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-1/2"
      style={{
        left: center.x,
        top: center.y,
        width: hostRect.w,
        height: hostRect.h,
      }}
    >
      {draftCb ? (
        <div
          className="pointer-events-none absolute border border-dashed border-white/80"
          style={{
            left: area.x + draftCb.x * area.w,
            top: area.y + draftCb.y * area.h,
            width: draftCb.w * area.w,
            height: draftCb.h * area.h,
          }}
        />
      ) : null}
      {drawMode ? (
        <div
          className="pointer-events-auto absolute inset-0 cursor-crosshair touch-none"
          onPointerDown={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            const a = fitBox(
              hostMode,
              eff.width,
              eff.height,
              r.width,
              r.height,
            );
            if (!a.w) return;
            // Screen → crop space → full-image coords (boxes are
            // stored against the full intrinsic image).
            dragStart.current = {
              x: crop.x + ((e.clientX - r.left - a.x) / a.w) * crop.w,
              y: crop.y + ((e.clientY - r.top - a.y) / a.h) * crop.h,
            };
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (!dragStart.current) return;
            const r = e.currentTarget.getBoundingClientRect();
            const a = fitBox(
              hostMode,
              eff.width,
              eff.height,
              r.width,
              r.height,
            );
            if (!a.w) return;
            const clamp = (v: number) => Math.min(1, Math.max(0, v));
            const nx =
              crop.x + clamp((e.clientX - r.left - a.x) / a.w) * crop.w;
            const ny =
              crop.y + clamp((e.clientY - r.top - a.y) / a.h) * crop.h;
            const s = dragStart.current;
            setDraft({
              id: "draft",
              x: Math.min(s.x, nx),
              y: Math.min(s.y, ny),
              w: Math.abs(nx - s.x),
              h: Math.abs(ny - s.y),
            });
          }}
          onPointerUp={() => {
            const d = draft;
            dragStart.current = null;
            setDraft(null);
            if (d && d.w > 0.004 && d.h > 0.004) {
              const id =
                typeof crypto !== "undefined" && "randomUUID" in crypto
                  ? crypto.randomUUID()
                  : Math.random().toString(36).slice(2);
              addBox(activeItem.id, { ...d, id });
              selectBox(id);
            }
          }}
        />
      ) : null}
    </div>
  );
}
