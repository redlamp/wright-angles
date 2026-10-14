"use client";

import { NumberStepper } from "@/components/number-stepper";

/** The probe: a font size at a reference height, read on this screen. */
export function ProbeSection({
  fontPx,
  setFontPx,
  refH,
  setRefH,
  hostArcmin,
}: {
  fontPx: number;
  setFontPx: (v: number) => void;
  refH: number;
  setRefH: (v: number) => void;
  hostArcmin: number;
}) {
  return (
    <div className="space-y-1.5">
      {/* Wraps rather than clips: the right column can be ~300 px
          wide (two-column workbench) and the steppers don't shrink. */}
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <span className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
          Probe text size
        </span>
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <span className="flex items-center gap-1.5">
            <NumberStepper
              ariaLabel="probe font pixels"
              value={fontPx}
              onChange={setFontPx}
              min={6}
              max={200}
              className="w-20"
            />
            <span className="text-sm text-muted-foreground">px @</span>
          </span>
          <span className="flex items-center gap-1.5">
            <NumberStepper
              ariaLabel="probe reference height"
              value={refH}
              onChange={setRefH}
              step={360}
              bigStep={360}
              min={360}
              max={4320}
              className="w-24"
            />
            <span className="text-sm text-muted-foreground">p</span>
          </span>
        </div>
      </div>
      <p className="font-mono text-sm text-muted-foreground">
        On your screen: {hostArcmin.toFixed(0)}′. Bands per ISO 9241-303 (cap
        height): ≥16′ minimum, ≥20′ comfortable.
      </p>
    </div>
  );
}
