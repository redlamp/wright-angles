"use client";

import { useEffect, useState } from "react";
import { DraftingCompassIcon, RulerDimensionLineIcon } from "lucide-react";
import {
  ACUITY,
  boxMetricsOnDevice,
  formatDistance,
  strokesSubAcuity,
} from "@/lib/display-math";
import { groupColor } from "@/lib/text-groups";
import { useAnnotationStore } from "@/stores/annotation-store";
import { useDeviceStore } from "@/stores/device-store";
import { useMediaStore } from "@/stores/media-store";
import { useSettingsStore } from "@/stores/settings-store";

const bandColor = (arcmin: number) =>
  arcmin >= ACUITY.comfortableTextArcmin
    ? "#46a758"
    : arcmin >= ACUITY.minCriticalTextArcmin
      ? "#f5a524"
      : "#e5484d";

/**
 * Cursor-following hover card for text boxes (Taylor 2026-08-18 v2):
 * the label on its own unwrapped line (the card grows to fit), the
 * owning device @ its distance, source/display pixel sizes, then the
 * angular size (drafting-compass icon, verdict-graded color) and the
 * physical size (dimension-ruler icon, mm or inches per the unit
 * setting). The card's border wears the same color as the hovered
 * box's outline. One card rides the shared deviceHover state from
 * both views; pointer-transparent.
 */
export function HoverTextCard() {
  const deviceHover = useAnnotationStore((s) => s.deviceHover);
  const colorMode = useAnnotationStore((s) => s.scanColorMode);
  const thisDevice = useDeviceStore((s) => s.thisDevice);
  const devices = useDeviceStore((s) => s.devices);
  const items = useMediaStore((s) => s.items);
  const activeId = useMediaStore((s) => s.activeId);
  const unit = useSettingsStore((s) => s.unit);
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
  const band = bandColor(m.arcmin);
  // Match the hovered box's outline: group tint in Groups mode, else
  // the verdict band on this device.
  const borderColor =
    colorMode === "group" && box.groupId !== undefined
      ? groupColor(box.groupId)
      : band;
  const phys =
    unit === "in" ? `${(m.mm / 25.4).toFixed(2)}″` : `${m.mm.toFixed(1)}mm`;

  // The card is content-sized (no wrap), so anchor it to whichever
  // side of the cursor has the room.
  const anchorRight = pt.x > window.innerWidth / 2;
  const top = pt.y + 16 + 104 > window.innerHeight ? pt.y - 16 - 104 : pt.y + 16;

  return (
    <div
      className="panel-frame pointer-events-none fixed z-[260] rounded-md border px-2.5 py-1.5 whitespace-nowrap"
      style={{
        borderColor,
        top,
        ...(anchorRight
          ? { right: window.innerWidth - pt.x + 16 }
          : { left: pt.x + 16 }),
      }}
    >
      <div className="text-sm font-medium">
        {box.label?.trim() || "Text box"}
      </div>
      <div className="font-mono text-sm leading-5 text-muted-foreground">
        <div>
          <span style={{ color: device.color }}>{device.label}</span> @{" "}
          {formatDistance(device.distanceCm, unit)}
        </div>
        <div>
          {box.srcPx}px (on source), {Math.round(m.devicePx)}px (on display)
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className="flex items-center gap-1"
            style={{ color: band }}
          >
            <DraftingCompassIcon className="size-3.5" />
            {m.arcmin.toFixed(1)}
          </span>
          ,
          <span className="flex items-center gap-1">
            <RulerDimensionLineIcon className="size-3.5" />
            {phys}
          </span>
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
