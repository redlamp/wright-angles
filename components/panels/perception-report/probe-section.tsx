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
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
          Probe text size
        </span>
        <div className="flex items-center gap-1.5">
          <NumberStepper
            ariaLabel="probe font pixels"
            value={fontPx}
            onChange={setFontPx}
            min={6}
            max={200}
            className="w-20"
          />
          <span className="text-sm text-muted-foreground">px @</span>
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
        </div>
      </div>
      <p className="font-mono text-sm text-muted-foreground">
        On your screen: {hostArcmin.toFixed(0)}′. Bands per ISO
        9241-303 (cap height): ≥16′ minimum, ≥20′ comfortable.
      </p>
    </div>
  );
}
