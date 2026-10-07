"use client";

import { PinIcon } from "lucide-react";
import { FEATURE_PINNED_DEVICES } from "@/lib/flags";
import { useDeviceStore } from "@/stores/device-store";
import { useUiStore } from "@/stores/ui-store";
import { Button } from "@/components/ui/button";
import { DeviceEditor } from "./device-editor";

/**
 * Selector fallback MUST be a stable module constant: an inline `?? {...}`
 * returns a fresh object every getSnapshot call, which React treats as a
 * changed store snapshot → infinite re-render loop. It only bites when the
 * stored position is unset — i.e. every brand-new visitor — which is
 * exactly how it shipped: dev machines all had stored positions, and
 * v0.3.0 crashed on load for fresh-state users (React #185).
 */
const DEFAULT_DEVICES_PANEL_POS = { x: 64, y: 16 };

/**
 * Column 2 of the Device Manager tab: the editor for the selected row
 * (This Device by default), pinnable into its own window — the old
 * floating flyout, embedded (Taylor 2026-08-17: two columns like the
 * Media Library and Perception Report).
 */
export function EditorColumn() {
  const selectedDeviceId = useUiStore((s) => s.selectedDeviceId);
  const selectDevice = useUiStore((s) => s.selectDevice);
  const pinDetail = useUiStore((s) => s.pinDetail);
  const panelPos = useUiStore(
    (s) => s.panelPositions.workbench ?? DEFAULT_DEVICES_PANEL_POS,
  );
  const panelWidth = useUiStore((s) => s.panelWidths.workbench ?? 860);
  const thisDevice = useDeviceStore((s) => s.thisDevice);
  const devices = useDeviceStore((s) => s.devices);
  const updateThisDevice = useDeviceStore((s) => s.updateThisDevice);
  const updateDevice = useDeviceStore((s) => s.updateDevice);
  const removeDevice = useDeviceStore((s) => s.removeDevice);
  const duplicateDevice = useDeviceStore((s) => s.duplicateDevice);

  const device =
    (selectedDeviceId && thisDevice.id !== selectedDeviceId
      ? devices.find((d) => d.id === selectedDeviceId)
      : thisDevice) ?? thisDevice;
  const isThis = device.id === thisDevice.id;

  return (
    <div className="flex min-h-0 flex-col">
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border px-2.5">
        {/* Key color picker lives on the selected device's title —
            styled as a button so it reads as customizable. */}
        <label
          className="relative block h-6 w-8 shrink-0 cursor-pointer overflow-hidden rounded-md border border-border shadow-sm transition-shadow hover:ring-2 hover:ring-ring"
          title="Change this device's key color"
          style={{ background: device.color }}
        >
          <input
            type="color"
            aria-label="Device key color"
            className="absolute inset-0 cursor-pointer opacity-0"
            value={device.color}
            onChange={(e) =>
              isThis
                ? updateThisDevice({ color: e.target.value })
                : updateDevice(device.id, { color: e.target.value })
            }
          />
        </label>
        <span className="min-w-0 flex-1 truncate text-base font-medium">
          {device.label}
          {isThis ? (
            <span className="ml-1.5 font-normal text-muted-foreground">
              This Device
            </span>
          ) : null}
        </span>
        {FEATURE_PINNED_DEVICES ? (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Pin details as a window"
            title="Pin — keep these details open and inspect another device"
            className="size-7 text-muted-foreground hover:text-foreground"
            onClick={() =>
              pinDetail(device.id, {
                x: panelPos.x + panelWidth + 8,
                y: panelPos.y,
              })
            }
          >
            <PinIcon className="size-4" />
          </Button>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-x-clip overflow-y-scroll">
        <DeviceEditor
          device={device}
          onPatch={(patch) =>
            isThis ? updateThisDevice(patch) : updateDevice(device.id, patch)
          }
          onRemove={
            isThis
              ? undefined
              : () => {
                  removeDevice(device.id);
                  selectDevice(null);
                }
          }
          onDuplicate={() => duplicateDevice(device.id)}
        />
      </div>
    </div>
  );
}
