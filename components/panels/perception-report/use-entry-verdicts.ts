"use client";

import { useMemo } from "react";
import { boxMetricsInCrop, type BoxDeviceMetrics } from "@/lib/box-metrics";
import { fitStretchNote } from "@/lib/fit";
import { buildTextEntries } from "@/lib/perception-report";
import type { Device, MediaItem } from "@/lib/types";

/** One verdict row for a (text entry, device) pair. */
export type EntryVerdict =
  | { kind: "cropped"; device: Device }
  | {
      kind: "shown";
      device: Device;
      m: BoxDeviceMetrics;
      stretch: string | null;
    };

/** Column 2's text entries for the active item, plus their verdicts. */
export function useEntryVerdicts(
  activeItem: MediaItem | null,
  verdictDevices: Device[],
) {
  // Pure function of the item's own content (boxes/scan/keyframes) —
  // doesn't depend on the playhead, so it shouldn't recompute every
  // timeSec tick the way running it straight in the render body did.
  const textEntries = useMemo(
    () => (activeItem ? buildTextEntries(activeItem) : []),
    [activeItem],
  );

  /** One verdict row per (text entry, device) pair — cropped-out, or
   * shown with its measured metrics. Same shape the render below used
   * to compute inline on every render (including every playhead tick,
   * via the timeSec subscription below); moved here so it only
   * recomputes when the item, its entries, or the device set change. */
  const entryVerdicts = useMemo(() => {
    const map = new Map<string, Array<EntryVerdict>>();
    if (!activeItem) return map;
    for (const e of textEntries) {
      map.set(
        e.id,
        verdictDevices.map((d) => {
          const m = boxMetricsInCrop(e.box, e.h, activeItem, d);
          if (!m) return { kind: "cropped" as const, device: d };
          return {
            kind: "shown" as const,
            device: d,
            m,
            stretch: fitStretchNote(activeItem, d),
          };
        }),
      );
    }
    return map;
  }, [activeItem, textEntries, verdictDevices]);

  return { textEntries, entryVerdicts };
}
