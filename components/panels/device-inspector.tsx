"use client";

import { useRef, useState } from "react";
import {
  CornerDownRightIcon,
  EyeIcon,
  EyeOffIcon,
  XIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
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
import { useUiStore } from "@/stores/ui-store";
import { nextZ } from "./floating-panel";

const bandColor = (arcmin: number) =>
  arcmin >= ACUITY.comfortableTextArcmin
    ? "#46a758"
    : arcmin >= ACUITY.minCriticalTextArcmin
      ? "#f5a524"
      : "#e5484d";

/**
 * Click-to-inspect side panel (plan 3.1–3.4): selecting a device in the
 * 2D or 3D view (or the comparison table — selection is one app-wide
 * store) opens this floating card. Details + hide/show, movable by its
 * header, and idles at 40% alpha so it reads as an annotation over the
 * scene rather than a window; full opacity on hover. View-wide tools
 * (color-vision sim etc.) live with the view toolbars, not here —
 * only device-scoped controls belong on this card (Taylor).
 */
export function DeviceInspector() {
  const selectedId = useUiStore((s) => s.selectedDeviceId);
  const selectDevice = useUiStore((s) => s.selectDevice);
  const openWorkbenchTab = useUiStore((s) => s.openWorkbenchTab);
  const openDetail = useUiStore((s) => s.openDetail);
  const thisDevice = useDeviceStore((s) => s.thisDevice);
  const devices = useDeviceStore((s) => s.devices);
  const updateThisDevice = useDeviceStore((s) => s.updateThisDevice);
  const toggleVisible = useDeviceStore((s) => s.toggleVisible);
  const unit = useSettingsStore((s) => s.unit);
  const deviceHover = useAnnotationStore((s) => s.deviceHover);
  const items = useMediaStore((s) => s.items);
  const activeId = useMediaStore((s) => s.activeId);
  const activeItem = items.find((i) => i.id === activeId);

  // Session-only position: right-anchored until the first drag.
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [z, setZ] = useState(45);
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ dx: number; dy: number } | null>(null);

  // A fresh selection opens (or re-targets) the card — surface it.
  // Render-time adjustment; an effect would lint as cascading setState.
  const [prevSelectedId, setPrevSelectedId] = useState(selectedId);
  if (selectedId !== prevSelectedId) {
    setPrevSelectedId(selectedId);
    if (selectedId) setZ(nextZ());
  }

  const byId = (id: string | null | undefined) =>
    id === thisDevice.id ? thisDevice : devices.find((d) => d.id === id);
  // A selection PINS the card to that device (Taylor 2026-08-18);
  // without one, hovering a device in either view shows it transiently.
  const hoverDevice = byId(deviceHover?.deviceId);
  const device = byId(selectedId) ?? hoverDevice;
  if (!device) return null;
  const isThis = device.id === thisDevice.id;
  // Box details always measure on the box's OWN device, even when the
  // card is pinned to a different one (called out in the section).
  const hoverBox = hoverDevice ? deviceHover?.box : null;
  const boxMetrics =
    hoverBox && hoverDevice && activeItem
      ? boxMetricsOnDevice(hoverBox.hFull, activeItem, hoverDevice)
      : null;

  return (
    <div
      ref={ref}
      className={cn(
        "panel-frame fixed w-64 rounded-lg border border-border transition-opacity duration-150",
        // Full alpha while pinned to a selection, hovering a device in
        // either view, or hovering the panel itself.
        selectedId || deviceHover
          ? "opacity-100"
          : "opacity-40 hover:opacity-100 focus-within:opacity-100",
      )}
      style={{
        zIndex: z,
        ...(pos ? { left: pos.x, top: pos.y } : { right: 16, top: 96 }),
      }}
      onPointerDown={() => setZ(nextZ())}
    >
      <div
        className="flex h-8 cursor-grab touch-none items-center gap-2 px-2.5 select-none active:cursor-grabbing"
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest("button")) return;
          const r = ref.current!.getBoundingClientRect();
          drag.current = { dx: e.clientX - r.left, dy: e.clientY - r.top };
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          setPos({
            x: Math.min(
              Math.max(e.clientX - drag.current.dx, 8 - 200),
              window.innerWidth - 56,
            ),
            y: Math.min(
              Math.max(e.clientY - drag.current.dy, 8),
              window.innerHeight - 40,
            ),
          });
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
      >
        <span
          className="size-2.5 shrink-0 rounded-full"
          style={{ background: device.color }}
        />
        <span className="min-w-0 flex-1 truncate text-base font-medium">
          {device.label}
        </span>
        <button
          type="button"
          aria-label={device.visible ? "Hide in views" : "Show in views"}
          title={
            device.visible
              ? "Hide this device in the 2D and 3D views"
              : "Show this device in the 2D and 3D views"
          }
          className={cn(
            "flex size-6 items-center justify-center rounded-md transition-colors hover:bg-muted",
            device.visible
              ? "text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
          onClick={() =>
            isThis
              ? updateThisDevice({ visible: !device.visible })
              : toggleVisible(device.id)
          }
        >
          {device.visible ? (
            <EyeIcon className="size-3.5" />
          ) : (
            <EyeOffIcon className="size-3.5" />
          )}
        </button>
        <button
          type="button"
          aria-label="Close inspector"
          className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          onClick={() => selectDevice(null)}
        >
          <XIcon className="size-3.5" />
        </button>
      </div>

      {/* Three lines (Taylor 2026-08-18): label lives in the header;
          then size · res · curvature (omitted when flat); distance. */}
      <div className="space-y-2 border-t border-border px-2.5 py-2">
        <div className="font-mono text-sm leading-5 text-muted-foreground">
          <div>
            {device.diagonalIn}″ · {device.resolution.w}×{device.resolution.h}
            {device.curvatureR ? ` · ${device.curvatureR}R` : ""}
          </div>
          <div>viewed at {formatDistance(device.distanceCm, unit)}</div>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-sm text-foreground underline-offset-2 hover:underline"
          onClick={() => {
            openDetail(isThis ? null : device.id);
            openWorkbenchTab("devices");
          }}
        >
          <CornerDownRightIcon className="size-3.5" />
          Edit in Device Manager
        </button>
      </div>

      {/* Live details for the text box hovered in a view (Taylor): what
          this text measures ON THIS device. */}
      {hoverBox && boxMetrics ? (
        <div className="space-y-1 border-t border-border px-2.5 py-2">
          <div className="flex items-center gap-1.5">
            {hoverBox.groupId !== undefined ? (
              <span
                className="size-2 shrink-0 rounded-full"
                title="Text group — size shared across the block"
                style={{ background: groupColor(hoverBox.groupId) }}
              />
            ) : null}
            <span className="min-w-0 flex-1 truncate text-sm font-medium">
              {hoverBox.label?.trim() || "Text box"}
            </span>
            {hoverDevice && hoverDevice.id !== device.id ? (
              <span
                className="shrink-0 text-sm"
                style={{ color: hoverDevice.color }}
                title={`Measured on ${hoverDevice.label}, not the pinned device`}
              >
                on {hoverDevice.label}
              </span>
            ) : null}
          </div>
          <div className="font-mono text-sm leading-5 text-muted-foreground">
            <div>{hoverBox.srcPx}px in source</div>
            <div className="flex items-center gap-1.5">
              <span style={{ color: bandColor(boxMetrics.arcmin) }}>
                {boxMetrics.arcmin.toFixed(1)}′
              </span>
              · {boxMetrics.mm.toFixed(1)}mm ·{" "}
              {Math.round(boxMetrics.devicePx)}px here
              {strokesSubAcuity(boxMetrics.arcmin) ? (
                <span title="Strokes render below 1′ — detail is invisible at this distance">
                  ⚠
                </span>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
