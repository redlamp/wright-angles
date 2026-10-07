"use client";

import { useState } from "react";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Device } from "@/lib/types";
import { useUiStore } from "@/stores/ui-store";
import { Button } from "@/components/ui/button";

/** Shared collapsed-row grid: eye | name (in the device's key color). */
const ROW_GRID =
  "grid grid-cols-[1.75rem_minmax(0,1fr)] items-center gap-1.5";

interface ReorderHooks {
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  markerTop: boolean;
  markerBottom: boolean;
}

export function DeviceRow({
  device,
  onToggleVisible,
  reorder,
}: {
  device: Device;
  onToggleVisible: () => void;
  /** Present only for reorderable (test) devices. */
  reorder?: ReorderHooks;
}) {
  // Row selection IS the app-wide device selection (Taylor
  // 2026-08-19): clicking a row highlights the device in the 2D/3D
  // views, and clicking a device in a view highlights its row here.
  const selectedDeviceId = useUiStore((s) => s.selectedDeviceId);
  const selectDevice = useUiStore((s) => s.selectDevice);
  const pinned = useUiStore((s) => s.pinnedDetails[device.id]);
  const detailOpen = selectedDeviceId === device.id || Boolean(pinned);
  const toggleDetail = () =>
    selectDevice(selectedDeviceId === device.id ? null : device.id);
  const [dragging, setDragging] = useState(false);

  return (
    <div
      className={cn("relative", dragging && "opacity-40")}
      onDragOver={reorder?.onDragOver}
      onDrop={reorder?.onDrop}
    >
      {/* Insert markers: where the dragged device lands on release. */}
      {reorder?.markerTop ? (
        <div className="absolute -top-px right-2 left-2 z-10 h-0.5 rounded-full bg-ring" />
      ) : null}
      {reorder?.markerBottom ? (
        <div className="absolute right-2 -bottom-px left-2 z-10 h-0.5 rounded-full bg-ring" />
      ) : null}
      <div
        className={cn(
          ROW_GRID,
          "h-10 pr-1.5 pl-2",
          detailOpen && "bg-muted/40",
        )}
      >
        <Button
          variant="ghost"
          size="icon"
          aria-label={device.visible ? "Hide device" : "Show device"}
          className="size-7 text-muted-foreground hover:text-foreground"
          onClick={onToggleVisible}
        >
          {device.visible ? (
            <EyeIcon className="size-4" />
          ) : (
            <EyeOffIcon className="size-4 opacity-50" />
          )}
        </Button>
        <button
          type="button"
          draggable={Boolean(reorder)}
          onDragStart={
            reorder
              ? (e) => {
                  e.dataTransfer.setData(
                    "application/x-wa-device",
                    device.id,
                  );
                  e.dataTransfer.effectAllowed = "move";
                  setDragging(true);
                }
              : undefined
          }
          onDragEnd={
            reorder
              ? () => {
                  setDragging(false);
                  reorder.onDragEnd();
                }
              : undefined
          }
          className={cn(
            "min-w-0 truncate text-left text-base",
            // The name wears the device's key color (Taylor 2026-08-19);
            // hidden devices dim rather than losing their identity.
            !device.visible && "opacity-50",
            reorder && "cursor-grab active:cursor-grabbing",
          )}
          style={{ color: device.color }}
          onClick={toggleDetail}
          title={device.deviceName || device.label}
        >
          {device.label}
        </button>
      </div>
    </div>
  );
}
