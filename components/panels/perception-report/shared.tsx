"use client";

import { TriangleAlertIcon } from "lucide-react";
import {
  deviceAngles,
  formatDistance,
  physicalSizeCm,
} from "@/lib/display-math";
import { legibilityColor } from "@/lib/legibility";
import { fitLabel, fitModeOf, fitStretchNote } from "@/lib/fit";
import type { Device, MediaItem } from "@/lib/types";
import { useMediaStore } from "@/stores/media-store";
import { useSettingsStore } from "@/stores/settings-store";

export function LegibilityDot({ arcmin }: { arcmin: number }) {
  return (
    <span
      className="inline-block size-2 rounded-full"
      style={{ background: legibilityColor(arcmin) }}
    />
  );
}

/**
 * The "this reading is vertical only" chip. `stretch` is the one fit
 * mode whose pixels aren't square, so every arc-minute figure quoted
 * for such a device is the height figure and needs saying so.
 */
function StretchChip({ item, d }: { item: MediaItem | null; d: Device }) {
  const note = item ? fitStretchNote(item, d) : null;
  if (!note) return null;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md bg-[#f5a524]/15 px-1.5 py-0.5 font-mono text-sm text-[#f5a524]"
      title={`"${fitLabel(fitModeOf(d))}" scales width and height independently on ${d.label}: the image is distorted, and the arc-minute figures here measure its HEIGHT.`}
    >
      <TriangleAlertIcon className="size-3 shrink-0" />
      {note}
    </span>
  );
}

/** Full spec lines, shown inside the selected column-1 entry. */
export function SpecLines({ d }: { d: Device }) {
  const unit = useSettingsStore((s) => s.unit);
  const activeId = useMediaStore((s) => s.activeId);
  const items = useMediaStore((s) => s.items);
  const activeItem = items.find((i) => i.id === activeId) ?? null;
  const size = physicalSizeCm(d.diagonalIn, d.aspect);
  const a = deviceAngles(d);
  return (
    <div className="mt-1 border-t border-border pt-1 font-mono leading-5 text-muted-foreground">
      <div>
        {d.diagonalIn}″ · {d.resolution.w}×{d.resolution.h}
        {d.curvatureR ? ` · ${d.curvatureR}R` : ""}
      </div>
      <div>
        {size.widthCm.toFixed(1)} × {size.heightCm.toFixed(1)} cm panel
      </div>
      <div>viewed at {formatDistance(d.distanceCm, unit)}</div>
      <div>
        {a.horizontalDeg.toFixed(0)}° × {a.verticalDeg.toFixed(0)}° ·{" "}
        {a.ppd.toFixed(0)} PPD
      </div>
      <StretchChip item={activeItem} d={d} />
    </div>
  );
}
