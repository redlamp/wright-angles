"use client";

import { useState } from "react";
import { ChevronRightIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { CM_PER_IN } from "@/lib/display-math";
import { useSettingsStore } from "@/stores/settings-store";
import { NumberStepper } from "@/components/number-stepper";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";

export const DIST_MIN_CM = 10;
const DIST_MAX_CM = 9999;
export const DIST_SLIDER_MAX_CM = 400;

export function Microlabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
      {children}
    </span>
  );
}

/**
 * Distance in the global unit, 4-character budget: integers from 100 up
 * (to 9999cm), one decimal below.
 */
export function DistanceStepper({
  distanceCm,
  onChange,
}: {
  distanceCm: number;
  onChange: (cm: number) => void;
}) {
  const unit = useSettingsStore((s) => s.unit);
  const inches = unit === "in";
  const shown = inches ? distanceCm / CM_PER_IN : distanceCm;
  return (
    <NumberStepper
      ariaLabel="viewing distance"
      value={shown}
      onChange={(v) => onChange(inches ? v * CM_PER_IN : v)}
      step={inches ? 0.5 : 1}
      bigStep={inches ? 5 : 10}
      min={inches ? DIST_MIN_CM / CM_PER_IN : DIST_MIN_CM}
      max={inches ? DIST_MAX_CM / CM_PER_IN : DIST_MAX_CM}
      decimals={shown >= 100 ? 0 : 1}
      className="h-7"
    />
  );
}

/**
 * Fold-away section, closed on mount. Local state, deliberately not
 * persisted — but React keeps the instance alive as you move between
 * devices, so an open section stays open while you compare them, and
 * only a fresh editor starts folded. That is the behaviour you want
 * here: nobody opens Offsets to look at exactly one device.
 */
export function Collapsible({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-1 text-muted-foreground hover:text-foreground"
      >
        <ChevronRightIcon
          className={cn(
            "size-3.5 transition-transform",
            open && "rotate-90",
          )}
        />
        <Microlabel>{label}</Microlabel>
      </button>
      {open ? <div className="space-y-3 pl-4.5">{children}</div> : null}
    </div>
  );
}

/** One labelled row inside Offsets; children fill slider/value/switch. */
export function StanceRow({
  label,
  active,
  children,
}: {
  label: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[4.25rem_minmax(0,1fr)_5.5rem_2.25rem] items-center gap-2">
      <span
        className={cn(
          "truncate text-sm",
          active ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {label}
      </span>
      {children}
    </div>
  );
}

/**
 * A signed offset from the eye line, shown in the viewing-distance
 * unit. Zero is dead level, so the slider is centred and the stored
 * value is dropped entirely at 0 — "level with the gaze" is the absence
 * of an offset, not an offset of nothing.
 */
const OFFSET_LIMIT_CM = 150;
export function OffsetControls({
  label,
  offsetCm,
  onChange,
}: {
  label: string;
  offsetCm: number | undefined;
  onChange: (cm: number | undefined) => void;
}) {
  const unit = useSettingsStore((s) => s.unit);
  const inches = unit === "in";
  const cm = offsetCm ?? 0;
  const shown = inches ? cm / CM_PER_IN : cm;
  const limit = inches ? OFFSET_LIMIT_CM / CM_PER_IN : OFFSET_LIMIT_CM;
  const set = (v: number) => onChange(v === 0 ? undefined : v);
  return (
    <>
      {/* Not disabled at zero: dragging IS the intent to set an offset,
          so it takes effect rather than making you flip the switch. */}
      <Slider
        thumbLabel={`${label} screen height offset`}
        min={-OFFSET_LIMIT_CM}
        max={OFFSET_LIMIT_CM}
        step={1}
        value={cm}
        aria-label={`${label} screen height offset`}
        onValueChange={(v) => set(Math.round(Array.isArray(v) ? v[0] : v))}
      />
      <NumberStepper
        ariaLabel={`${label} screen height offset from eye line`}
        value={shown}
        onChange={(v) => set(Math.round(inches ? v * CM_PER_IN : v))}
        step={inches ? 0.5 : 1}
        bigStep={inches ? 5 : 10}
        min={-limit}
        max={limit}
        decimals={inches ? 1 : 0}
        signed
        className="h-7"
      />
      <Switch
        checked={offsetCm === undefined}
        aria-label={`${label} level with the eye line`}
        onCheckedChange={(on) => onChange(on ? undefined : cm || 1)}
      />
    </>
  );
}

/** Inline flip for the global distance unit. */
export { DistanceUnitFlip, UnitFlip } from "@/components/unit-flip";
export { AngleReadout } from "./angle-readout";
