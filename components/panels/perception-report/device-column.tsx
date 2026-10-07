"use client";

import { LayoutGridIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  apparentWidthRatio,
  contentPxToArcmin,
  formatDistance,
} from "@/lib/display-math";
import { ratioNote } from "@/lib/perception-report";
import type { Device } from "@/lib/types";
import { useDeviceStore } from "@/stores/device-store";
import { useSettingsStore } from "@/stores/settings-store";
import { LegibilityDot, SpecLines } from "./shared";

/**
 * Column 1: device details — All Devices, My Device (in the list, per
 * Taylor), every project device incl. hidden. Selection specs pin to
 * the bottom so rows never resize.
 */
export function DeviceColumn({
  column,
  setColumn,
  mode,
  pickedDevice,
  fontPx,
  refH,
}: {
  column: "all" | "mine" | string;
  setColumn: (column: "all" | "mine" | string) => void;
  mode: "device" | "mine" | "all";
  pickedDevice: Device | null;
  fontPx: number;
  refH: number;
}) {
  const thisDevice = useDeviceStore((s) => s.thisDevice);
  const devices = useDeviceStore((s) => s.devices);
  const showBands = useSettingsStore((s) => s.showLegibilityBands);
  const unit = useSettingsStore((s) => s.unit);

  /** Column-1 entry: name + comparison summary; full specs when selected. */
  const deviceEntry = (d: Device, blessed: boolean) => {
    const key = blessed ? "mine" : d.id;
    const selected = column === key;
    const r = apparentWidthRatio(d, thisDevice);
    const arcmin = contentPxToArcmin(fontPx, refH, d);
    return (
      <button
        key={key}
        type="button"
        className={cn(
          "w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors",
          selected ? "panel-inset ring-1 ring-ring ring-inset" : "hover:bg-muted/50",
        )}
        title={blessed ? undefined : ratioNote(r)}
        onClick={() => setColumn(key)}
      >
        <div className="flex items-baseline justify-between gap-2">
          <span
            className="min-w-0 flex-1 truncate font-medium"
            style={{ color: d.color }}
          >
            {d.label}
          </span>
          <span className="shrink-0 font-mono text-muted-foreground">
            {formatDistance(d.distanceCm, unit)}
          </span>
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 font-mono text-muted-foreground">
          {blessed ? (
            <>This Device · baseline</>
          ) : (
            <>
              ≈{Math.round(r * 100)}%
              {showBands ? (
                <>
                  {" · "}
                  <LegibilityDot arcmin={arcmin} /> {arcmin.toFixed(0)}′
                </>
              ) : null}
              {!d.visible ? (
                <span className="text-muted-foreground/60">· hidden</span>
              ) : null}
            </>
          )}
        </div>
      </button>
    );
  };

  /** Selection details pin to the BOTTOM of the column — list items
   * keep a constant height (Taylor 17:48). All Devices shows the
   * baseline (This Device) block there too (Taylor 2026-08-18). */
  const detailsDevice =
    mode === "device" ? pickedDevice : thisDevice;

  return (
    <div className="flex min-h-0 flex-col">
      <div className="min-h-0 flex-1 space-y-0.5 overflow-y-scroll p-1.5">
        <button
          type="button"
          className={cn(
            "mb-1 flex h-8 w-full items-center gap-1.5 rounded-md border border-border px-2 text-left text-base font-medium transition-colors",
            column === "all"
              ? "panel-inset ring-1 ring-ring ring-inset"
              : "hover:bg-muted/50",
          )}
          onClick={() => setColumn("all")}
        >
          <LayoutGridIcon className="size-3.5 text-muted-foreground" />
          All Devices
        </button>
        {deviceEntry(thisDevice, true)}
        {devices.map((d) => deviceEntry(d, false))}
        {mode === "all" ? (
          <p className="px-2 pt-1 text-sm leading-4.5 text-muted-foreground">
            What you see on {thisDevice.label} at{" "}
            {formatDistance(thisDevice.distanceCm, unit)} is not what
            people see elsewhere — {"select a device to expand it."}
          </p>
        ) : null}
      </div>
      {detailsDevice ? (
        // This Device is the vision model's baseline (6.5): a
        // selected device's specs render BESIDE it, not instead.
        <div
          className={cn(
            "grid shrink-0 border-t border-border text-sm",
            detailsDevice.id !== thisDevice.id &&
              "grid-cols-2 divide-x divide-border",
          )}
        >
          {detailsDevice.id !== thisDevice.id ? (
            <div className="min-w-0 px-2.5 py-2">
              <span
                className="font-medium"
                style={{ color: thisDevice.color }}
              >
                {thisDevice.label}
              </span>
              <SpecLines d={thisDevice} />
            </div>
          ) : null}
          <div className="min-w-0 px-2.5 py-2">
            <span
              className="font-medium"
              style={{ color: detailsDevice.color }}
            >
              {detailsDevice.label}
            </span>
            <SpecLines d={detailsDevice} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
