"use client";

import { useMemo, useState } from "react";
import { contentPxToArcmin } from "@/lib/display-math";
import { useDeviceStore } from "@/stores/device-store";
import { useMediaStore } from "@/stores/media-store";
import { useSettingsStore } from "@/stores/settings-store";
import { SplitGrid } from "./split-grid";
import { DeviceColumn } from "./perception-report/device-column";
import { ProbeSection } from "./perception-report/probe-section";
import { ScanToolbar } from "./perception-report/scan-toolbar";
import { TextEntryList } from "./perception-report/text-entry-list";
import { useEntryVerdicts } from "./perception-report/use-entry-verdicts";

/**
 * The product's thesis, in words: what fits comfortably on the screen
 * you're designing at will read very differently everywhere else.
 *
 * Miller columns (plan 6.x, layout per Taylor 14:58): column 1 carries
 * the DEVICE DETAILS — All Devices, My Device (blessed), and every
 * project device including hidden ones, each entry showing its
 * comparison summary and, when selected, its full specs. Column 2 shows
 * the SCANNED TEXT for the active media with per-device verdicts, plus
 * the probe.
 */

/** Perception Report tab content (hosted by the workbench panel). */
export function PerceptionReportContent() {
  const thisDevice = useDeviceStore((s) => s.thisDevice);
  const devices = useDeviceStore((s) => s.devices);
  const showBands = useSettingsStore((s) => s.showLegibilityBands);
  const [fontPx, setFontPx] = useState(24);
  const [refH, setRefH] = useState(1080);
  const items = useMediaStore((s) => s.items);
  const activeId = useMediaStore((s) => s.activeId);
  const activeItem = items.find((i) => i.id === activeId) ?? null;

  const [column, setColumn] = useState<"all" | "mine" | string>("all");
  const pickedDevice =
    column !== "all" && column !== "mine"
      ? (devices.find((d) => d.id === column) ?? null)
      : null;
  const mode = pickedDevice ? "device" : column === "mine" ? "mine" : "all";

  const hostArcmin = useMemo(
    () => contentPxToArcmin(fontPx, refH, thisDevice),
    [fontPx, refH, thisDevice],
  );

  /** Which devices annotate each text entry's verdict row. */
  const verdictDevices = useMemo(
    () =>
      mode === "device" && pickedDevice
        ? [pickedDevice]
        : mode === "mine"
          ? [thisDevice]
          : [thisDevice, ...devices],
    [mode, pickedDevice, thisDevice, devices],
  );

  const { textEntries, entryVerdicts } = useEntryVerdicts(
    activeItem,
    verdictDevices,
  );

  return (
    <SplitGrid
      // Column 1: device details — All Devices, My Device (in the
      // list, per Taylor), every project device incl. hidden.
      // Selection specs pin to the bottom so rows never resize.
      left={
        <DeviceColumn
          column={column}
          setColumn={setColumn}
          mode={mode}
          pickedDevice={pickedDevice}
          fontPx={fontPx}
          refH={refH}
        />
      }
      // Column 2: the scanned text for the active media.
      right={
        <div className="min-h-0 space-y-2.5 overflow-y-scroll p-2.5">
          <ScanToolbar activeItem={activeItem} />
          <TextEntryList
            activeItem={activeItem}
            textEntries={textEntries}
            entryVerdicts={entryVerdicts}
          />

          {showBands ? (
            <ProbeSection
              fontPx={fontPx}
              setFontPx={setFontPx}
              refH={refH}
              setRefH={setRefH}
              hostArcmin={hostArcmin}
            />
          ) : null}
        </div>
      }
    />
  );
}
