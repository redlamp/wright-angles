"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { COMMON_DIAGONALS_IN } from "@/lib/calibration";
import { aspectLabel } from "@/lib/aspect-label";
import { CM_PER_IN, physicalSizeCm } from "@/lib/display-math";
import type { Resolution } from "@/lib/types";
import { SizeUnitFlip } from "@/components/unit-flip";
import { useSettingsStore } from "@/stores/settings-store";
import { NumberStepper } from "@/components/number-stepper";
import { Button } from "@/components/ui/button";
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FOCUS_RING, NARROW_STEP, fmtIn } from "./constants";

/** Common diagonals by the kind of screen they're sold as. */
const SIZE_GROUPS: { label: string; test: (inches: number) => boolean }[] = [
  { label: "Laptop", test: (d) => d < 18 },
  { label: "Monitor", test: (d) => d >= 18 && d < 40 },
  { label: "TV", test: (d) => d >= 40 },
];

/** "I know my screen size": common diagonals, or type one. */
export function KnownStep({
  diagonalIn,
  resolution,
  onBack,
  onApply,
}: {
  diagonalIn: number;
  /** This Device's pixels; with square pixels they give the aspect. */
  resolution: Resolution;
  onBack: () => void;
  onApply: (diagonalIn: number) => void;
}) {
  const [value, setValue] = useState(diagonalIn);
  const inches = useSettingsStore((s) => s.sizeUnit) === "in";
  const aspect = aspectLabel(resolution);
  // The exact pixel ratio, not the rounded label, sets the panel shape.
  const panel = physicalSizeCm(value, { w: resolution.w, h: resolution.h });
  const len = (cm: number) =>
    inches ? `${(cm / CM_PER_IN).toFixed(1)}″` : `${cm.toFixed(1)} cm`;
  return (
    <div className={`grid gap-4 ${NARROW_STEP}`}>
      <DialogHeader>
        <DialogTitle>Your screen size</DialogTitle>
        <DialogDescription className="leading-5">
          Screens are sold by their diagonal, corner to corner. It&rsquo;s
          usually on the box, the sticker on the back, or the product
          page.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-1.5">
        <span className="text-sm text-muted-foreground">
          Common sizes
        </span>
        <div className="grid gap-1.5">
          {SIZE_GROUPS.map((g) => (
            <div
              key={g.label}
              role="group"
              aria-label={`${g.label} sizes`}
              className="flex flex-wrap items-center gap-1"
            >
              <span className="w-16 text-sm text-muted-foreground">{g.label}</span>
              {COMMON_DIAGONALS_IN.filter(g.test).map((size) => (
                <button
                  key={size}
                  type="button"
                  aria-pressed={size === value}
                  aria-label={`${size} inches`}
                  onClick={() => setValue(size)}
                  className={cn(
                    "h-8 min-w-11 rounded-md px-2 font-mono text-sm motion-safe:transition-colors",
                    FOCUS_RING,
                    size === value
                      ? "bg-foreground text-background"
                      : "bg-muted text-foreground hover:bg-muted/70",
                  )}
                >
                  {size}″
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
      {aspect ? (
        <p className="text-sm text-muted-foreground">
          Aspect ratio{" "}
          <span className="font-mono text-foreground">{aspect}</span>, from
          your {resolution.w}×{resolution.h} resolution (square pixels).
        </p>
      ) : null}
      <div className="grid gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm text-muted-foreground">Or type it</span>
          <SizeUnitFlip />
        </div>
        <NumberStepper
          ariaLabel={`screen diagonal in ${inches ? "inches" : "centimeters"}`}
          value={inches ? value : value * CM_PER_IN}
          onChange={(v) => setValue(inches ? v : v / CM_PER_IN)}
          step={inches ? 0.1 : 0.5}
          bigStep={inches ? 1 : 5}
          min={inches ? 5 : 13}
          max={inches ? 200 : 508}
          decimals={1}
          className="h-8 w-40"
        />
        <span className="font-mono text-sm text-muted-foreground">
          {inches
            ? `= ${(value * CM_PER_IN).toFixed(1)} cm`
            : `= ${fmtIn(value)}″`}{" "}
          · picture {len(panel.widthCm)} × {len(panel.heightCm)}
        </span>
      </div>
      <DialogFooter className="sm:justify-between">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button onClick={() => onApply(value)}>Use {fmtIn(value)}″</Button>
      </DialogFooter>
    </div>
  );
}
