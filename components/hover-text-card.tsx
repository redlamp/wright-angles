"use client";

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
 * Hover card for text boxes (Taylor 2026-08-18 v2): the label on its
 * own unwrapped line (the card grows to fit), the owning device @ its
 * distance, source/display pixel sizes, then the angular size
 * (drafting-compass icon, verdict-graded color) and the physical size
 * (dimension-ruler icon, mm or inches per the unit setting). The
 * card's border wears the same color as the hovered box's outline. It
 * pins just outside the box's screen bounds — never covering the text
 * it describes. One card rides the shared deviceHover state from both
 * views; pointer-transparent.
 */
export function HoverTextCard() {
  const deviceHover = useAnnotationStore((s) => s.deviceHover);
  const colorMode = useAnnotationStore((s) => s.scanColorMode);
  const thisDevice = useDeviceStore((s) => s.thisDevice);
  const devices = useDeviceStore((s) => s.devices);
  const items = useMediaStore((s) => s.items);
  const activeId = useMediaStore((s) => s.activeId);
  const unit = useSettingsStore((s) => s.unit);

  const box = deviceHover?.box ?? null;

  const device =
    deviceHover &&
    (deviceHover.deviceId === thisDevice.id
      ? thisDevice
      : devices.find((d) => d.id === deviceHover.deviceId));
  const activeItem = items.find((i) => i.id === activeId);
  if (!box || !device || !activeItem) return null;

  const m = boxMetricsOnDevice(box.hFull, activeItem, device);
  const band = bandColor(m.arcmin);
  // Match the hovered box's outline: group tint in Groups mode, else
  // the verdict band on this device.
  const borderColor =
    colorMode === "group" && box.groupId !== undefined
      ? groupColor(box.groupId)
      : band;
  const phys =
    unit === "in" ? `${(m.mm / 25.4).toFixed(2)}″` : `${m.mm.toFixed(1)} mm`;

  // Placement (Taylor 2026-08-18): beside the DISPLAY when a side of
  // it has room (the card sits off the screen space, so the pointer
  // can run up and down the boxes unobstructed), else beside the BOX.
  // Side = toward the screen edge the box is closest to; vertically the
  // card tracks the box's top. Content-sized, so left placements
  // anchor `right:` and grow leftward — no width estimate needed.
  const b = box.bounds;
  const s = box.screen;
  const EST_W = 260;
  const vw = window.innerWidth;
  const preferLeft = s
    ? (b.left + b.right) / 2 < (s.left + s.right) / 2
    : (b.left + b.right) / 2 > vw / 2;
  let xStyle: React.CSSProperties;
  if (s && (s.left - 16 >= EST_W || vw - s.right - 16 >= EST_W)) {
    const useLeft = preferLeft ? s.left - 16 >= EST_W : vw - s.right - 16 < EST_W;
    xStyle = useLeft
      ? { right: vw - s.left + 12 }
      : { left: s.right + 12 };
  } else {
    const useLeft = preferLeft ? b.left - 16 >= EST_W : vw - b.right - 16 < EST_W;
    xStyle = useLeft
      ? { right: vw - b.left + 12 }
      : { left: b.right + 12 };
  }
  const top = Math.min(Math.max(8, b.top - 2), window.innerHeight - 130);

  return (
    <div
      className="panel-frame pointer-events-none fixed z-[260] rounded-md border px-2.5 py-1.5 whitespace-nowrap"
      style={{ borderColor, top, ...xStyle }}
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
          {box.srcPx} px (on source), {Math.round(m.devicePx)} px (on display)
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
