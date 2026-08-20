"use client";

import { useRef, useState } from "react";
import {
  CornerDownRightIcon,
  EyeIcon,
  EyeOffIcon,
  XIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistance } from "@/lib/display-math";
import { FIT_MODES, aspectsDisagree, fitLabel, fitModeOf } from "@/lib/fit";
import type { Device, FitMode } from "@/lib/types";
import { useAnnotationStore } from "@/stores/annotation-store";
import { useDeviceStore } from "@/stores/device-store";
import { useMediaStore } from "@/stores/media-store";
import { useSettingsStore } from "@/stores/settings-store";
import { useUiStore } from "@/stores/ui-store";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  const thisDevice = useDeviceStore((s) => s.thisDevice);
  const devices = useDeviceStore((s) => s.devices);
  const updateThisDevice = useDeviceStore((s) => s.updateThisDevice);
  const updateDevice = useDeviceStore((s) => s.updateDevice);
  const toggleVisible = useDeviceStore((s) => s.toggleVisible);
  const unit = useSettingsStore((s) => s.unit);
  const deviceHover = useAnnotationStore((s) => s.deviceHover);
  const mediaItems = useMediaStore((s) => s.items);
  const activeMediaId = useMediaStore((s) => s.activeId);

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

  // Quick fit access (decision-media-crop-vs-device-fit): shown ONLY
  // when this panel's shape and the active media's actually disagree —
  // with matching aspects all four modes render identically (stretch
  // included: it only distorts when the shapes differ), so the control
  // would be pure noise.
  const activeItem = mediaItems.find((i) => i.id === activeMediaId) ?? null;
  const showFit = !!activeItem && aspectsDisagree(activeItem, device);
  const patchDevice = (p: Partial<Device>) =>
    isThis ? updateThisDevice(p) : updateDevice(device.id, p);

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
        {showFit ? (
          <Select
            value={fitModeOf(device)}
            onValueChange={(v) =>
              patchDevice({ fit: v === "contain" ? undefined : (v as FitMode) })
            }
          >
            <SelectTrigger
              size="sm"
              className="w-full"
              aria-label="Content fit"
              title="This media's shape differs from this panel's — choose what gives"
            >
              <SelectValue>{fitLabel(fitModeOf(device))}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {FIT_MODES.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        <button
          type="button"
          className="inline-flex items-center gap-1 text-sm text-foreground underline-offset-2 hover:underline"
          onClick={() => {
            // Selection is shared app-wide; the editor follows it.
            selectDevice(device.id);
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
