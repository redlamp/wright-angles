"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { COMMON_DIAGONALS_IN } from "@/lib/calibration";
import { CM_PER_IN } from "@/lib/display-math";
import { NumberStepper } from "@/components/number-stepper";
import { Button } from "@/components/ui/button";
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FOCUS_RING, NARROW_STEP, fmtIn } from "./constants";

/** "I know my screen size": common diagonals, or type one. */
export function KnownStep({
  diagonalIn,
  onBack,
  onApply,
}: {
  diagonalIn: number;
  onBack: () => void;
  onApply: (diagonalIn: number) => void;
}) {
  const [value, setValue] = useState(diagonalIn);
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
        <span id="common-sizes-label" className="text-sm text-muted-foreground">
          Common sizes
        </span>
        <div role="group" aria-labelledby="common-sizes-label" className="flex flex-wrap gap-1">
          {COMMON_DIAGONALS_IN.map((size) => (
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
      </div>
      <label className="grid gap-1.5">
        <span className="text-sm text-muted-foreground">Or type it (inches)</span>
        <div className="flex items-center gap-3">
          <NumberStepper
            ariaLabel="screen diagonal in inches"
            value={value}
            onChange={setValue}
            step={0.1}
            bigStep={1}
            min={5}
            max={200}
            decimals={1}
            className="h-8 w-40"
          />
          <span className="font-mono text-sm text-muted-foreground">
            = {(value * CM_PER_IN).toFixed(1)} cm
          </span>
        </div>
      </label>
      <DialogFooter className="sm:justify-between">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button onClick={() => onApply(value)}>Use {fmtIn(value)}″</Button>
      </DialogFooter>
    </div>
  );
}
