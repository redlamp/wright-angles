"use client";

import { useRef, useState } from "react";
import { PinOffIcon, XIcon } from "lucide-react";
import { FEATURE_PINNED_DEVICES } from "@/lib/flags";
import { useDeviceStore } from "@/stores/device-store";
import { useUiStore } from "@/stores/ui-store";
import { Button } from "@/components/ui/button";
import { DeviceEditor } from "./device-manager";
import { nextZ } from "./floating-panel";

/**
 * Pinned device-detail windows: independent draggable copies of the
 * detail flyout so several devices' specs can be compared side by side.
 */
function DetailWindow({ id }: { id: string }) {
  const pos = useUiStore((s) => s.pinnedDetails[id]);
  const moveDetail = useUiStore((s) => s.moveDetail);
  const unpinDetail = useUiStore((s) => s.unpinDetail);
  const thisDevice = useDeviceStore((s) => s.thisDevice);
  const devices = useDeviceStore((s) => s.devices);
  const updateThisDevice = useDeviceStore((s) => s.updateThisDevice);
  const updateDevice = useDeviceStore((s) => s.updateDevice);
  const removeDevice = useDeviceStore((s) => s.removeDevice);
  const duplicateDevice = useDeviceStore((s) => s.duplicateDevice);

  const [z, setZ] = useState(nextZ);
  const drag = useRef<{ dx: number; dy: number } | null>(null);

  const isThis = thisDevice.id === id;
  const device = isThis ? thisDevice : devices.find((d) => d.id === id);
  if (!device || !pos) return null;

  return (
    <div
      className="panel-frame fixed w-80 rounded-lg border border-border"
      style={{ left: pos.x, top: pos.y, zIndex: z }}
      onPointerDown={() => setZ(nextZ())}
    >
      <div
        className="flex h-9 cursor-grab touch-none items-center gap-2 border-b border-border px-2.5 select-none active:cursor-grabbing"
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest("button")) return;
          drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          moveDetail(id, {
            x: Math.min(
              Math.max(e.clientX - drag.current.dx, 8 - 280),
              window.innerWidth - 48,
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
        <Button
          variant="ghost"
          size="icon"
          aria-label="Unpin details"
          className="size-7 text-muted-foreground hover:text-foreground"
          onClick={() => unpinDetail(id)}
        >
          <PinOffIcon className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Close details"
          className="size-7 text-muted-foreground hover:text-foreground"
          onClick={() => unpinDetail(id)}
        >
          <XIcon className="size-4" />
        </Button>
      </div>
      <div className="max-h-[calc(100vh-10rem)] overflow-x-clip overflow-y-auto">
        <DeviceEditor
          device={device}
          onPatch={(patch) =>
            isThis ? updateThisDevice(patch) : updateDevice(id, patch)
          }
          onRemove={
            isThis
              ? undefined
              : () => {
                  removeDevice(id);
                  unpinDetail(id);
                }
          }
          onDuplicate={() => duplicateDevice(id)}
        />
      </div>
    </div>
  );
}

export function DeviceDetailWindows() {
  const pinnedDetails = useUiStore((s) => s.pinnedDetails);
  // Feature parked: previously pinned windows stay hidden (state kept)
  // until the flag returns.
  if (!FEATURE_PINNED_DEVICES) return null;
  return (
    <>
      {Object.keys(pinnedDetails).map((id) => (
        <DetailWindow key={id} id={id} />
      ))}
    </>
  );
}
