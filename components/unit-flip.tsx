"use client";

import { cn } from "@/lib/utils";
import type { LengthUnit } from "@/lib/types";
import { useSettingsStore } from "@/stores/settings-store";

/** Tiny in/cm switcher inline with a section label. */
export function UnitFlip({
  value,
  onChange,
  label = "Units",
}: {
  value: LengthUnit;
  onChange: (u: LengthUnit) => void;
  /** Accessible name for the pair, e.g. "Screen size units". */
  label?: string;
}) {
  return (
    <span role="group" aria-label={label} className="flex items-center gap-0.5">
      {(["in", "cm"] as const).map((u) => (
        <button
          key={u}
          type="button"
          aria-pressed={u === value}
          aria-label={u === "in" ? "inches" : "centimeters"}
          className={cn(
            "rounded px-1.5 py-0.5 text-sm transition-colors",
            u === value
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:text-foreground",
          )}
          onClick={() => onChange(u)}
        >
          {u}
        </button>
      ))}
    </span>
  );
}

/** in/cm switch for screen sizes (the app-wide size unit setting). */
export function SizeUnitFlip() {
  const unit = useSettingsStore((s) => s.sizeUnit);
  const setUnit = useSettingsStore((s) => s.setSizeUnit);
  return <UnitFlip value={unit} onChange={setUnit} label="Screen size units" />;
}

/** in/cm switch for viewing distances (the app-wide distance unit). */
export function DistanceUnitFlip() {
  const unit = useSettingsStore((s) => s.unit);
  const setUnit = useSettingsStore((s) => s.setUnit);
  return <UnitFlip value={unit} onChange={setUnit} label="Distance units" />;
}
