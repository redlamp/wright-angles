"use client";

import { useEffect, useState } from "react";
import {
  ACUITY,
  boxMetricsOnDevice,
  strokesSubAcuity,
} from "@/lib/display-math";
import { groupColor } from "@/lib/text-groups";
import { useAnnotationStore } from "@/stores/annotation-store";
import { useDeviceStore } from "@/stores/device-store";
import { useMediaStore } from "@/stores/media-store";

const bandColor = (arcmin: number) =>
  arcmin >= ACUITY.comfortableTextArcmin
    ? "#46a758"
    : arcmin >= ACUITY.minCriticalTextArcmin
      ? "#f5a524"
      : "#e5484d";

const CARD_W = 232;

/**
 * Cursor-following hover card for text boxes (Taylor 2026-08-18):
 * hovering a box in EITHER view shows its details in context near the
 * pointer — label, source px, and what the text measures on the box's
 * own device — detached from the device inspector, which stays purely
 * device-level. Follows the shared deviceHover state, so the 2D and 3D
 * hover plumbing feeds one card.
 */
export function HoverTextCard() {
  const deviceHover = useAnnotationStore((s) => s.deviceHover);
  const thisDevice = useDeviceStore((s) => s.thisDevice);
  const devices = useDeviceStore((s) => s.devices);
  const items = useMediaStore((s) => s.items);
  const activeId = useMediaStore((s) => s.activeId);
  const [pt, setPt] = useState<{ x: number; y: number } | null>(null);

  const box = deviceHover?.box ?? null;
  const hasBox = box !== null;

  // Track the pointer only while a box is hovered; the card appears on
  // the first move (hovering implies the pointer is moving). Stale pt
  // after unhover is harmless — no box, no render.
  useEffect(() => {
    if (!hasBox) return;
    const move = (e: PointerEvent) => setPt({ x: e.clientX, y: e.clientY });
    window.addEventListener("pointermove", move);
    return () => window.removeEventListener("pointermove", move);
  }, [hasBox]);

  const device =
    deviceHover &&
    (deviceHover.deviceId === thisDevice.id
      ? thisDevice
      : devices.find((d) => d.id === deviceHover.deviceId));
  const activeItem = items.find((i) => i.id === activeId);
  if (!box || !device || !activeItem || !pt) return null;

  const m = boxMetricsOnDevice(box.hFull, activeItem, device);
  const left =
    pt.x + 16 + CARD_W > window.innerWidth ? pt.x - 16 - CARD_W : pt.x + 16;
  const top = pt.y + 16 + 96 > window.innerHeight ? pt.y - 16 - 96 : pt.y + 16;

  return (
    <div
      className="panel-frame pointer-events-none fixed z-[260] rounded-md border border-border px-2.5 py-1.5"
      style={{ left, top, width: CARD_W }}
    >
      <div className="flex items-center gap-1.5">
        {box.groupId !== undefined ? (
          <span
            className="size-2 shrink-0 rounded-full"
            style={{ background: groupColor(box.groupId) }}
          />
        ) : null}
        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          {box.label?.trim() || "Text box"}
        </span>
      </div>
      <div className="font-mono text-sm leading-5 text-muted-foreground">
        <div className="truncate" style={{ color: device.color }}>
          on {device.label}
        </div>
        <div>{box.srcPx}px in source</div>
        {/* Spelled-out unit: the arcminute prime reads as imperial
            feet at a glance, and this card can't carry tooltips. */}
        <div className="flex items-center gap-1.5">
          <span style={{ color: bandColor(m.arcmin) }}>
            {m.arcmin.toFixed(1)} arcmin
          </span>
          · {m.mm.toFixed(1)}mm · {Math.round(m.devicePx)}px here
          {strokesSubAcuity(m.arcmin) ? (
            <span title="Strokes render below 1′ — detail is invisible at this distance">
              ⚠
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
