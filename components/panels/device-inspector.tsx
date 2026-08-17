"use client";

import { useRef, useState } from "react";
import {
  CornerDownRightIcon,
  EyeIcon,
  EyeOffIcon,
  XIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { deviceAngles, formatDistance, physicalSizeCm } from "@/lib/display-math";
import { useDeviceStore } from "@/stores/device-store";
import { useSettingsStore } from "@/stores/settings-store";
import { useUiStore } from "@/stores/ui-store";
import { nextZ } from "./floating-panel";

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

  // Session-only position: right-anchored until the first drag.
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [z, setZ] = useState(45);
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ dx: number; dy: number } | null>(null);

  const device =
    selectedId === thisDevice.id
      ? thisDevice
      : devices.find((d) => d.id === selectedId);
  if (!device) return null;
  const isThis = device.id === thisDevice.id;

  const size = physicalSizeCm(device.diagonalIn, device.aspect);
  const a = deviceAngles(device);

  return (
    <div
      ref={ref}
      className="panel-frame fixed w-64 rounded-lg border border-border opacity-40 transition-opacity duration-150 hover:opacity-100 focus-within:opacity-100"
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

      <div className="space-y-2 border-t border-border px-2.5 py-2">
        {device.deviceName ? (
          <div className="truncate text-sm text-muted-foreground">
            {device.deviceName}
            {isThis ? " · This Device" : ""}
          </div>
        ) : isThis ? (
          <div className="text-sm text-muted-foreground">This Device</div>
        ) : null}
        <div className="font-mono text-sm leading-5 text-muted-foreground">
          <div>
            {device.diagonalIn}″ · {device.resolution.w}×{device.resolution.h}
            {device.curvatureR ? ` · ${device.curvatureR}R` : ""}
          </div>
          <div>
            {size.widthCm.toFixed(1)} × {size.heightCm.toFixed(1)} cm panel
          </div>
          <div>viewed at {formatDistance(device.distanceCm, unit)}</div>
          <div>
            {a.horizontalDeg.toFixed(0)}° × {a.verticalDeg.toFixed(0)}° ·{" "}
            {a.ppd.toFixed(0)} PPD
          </div>
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

    </div>
  );
}
