"use client";

import { cssPxPerCm, nearestCommonDiagonal } from "@/lib/calibration";
import { CM_PER_IN, aspectFromResolution, physicalSizeCm } from "@/lib/display-math";
import type { Resolution } from "@/lib/types";
import { useSettingsStore } from "@/stores/settings-store";
import { Button } from "@/components/ui/button";
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { NARROW_STEP, fmtIn } from "./constants";

/**
 * What the measurement says, in plain terms, with the choice between a
 * nearby common size and the raw reading, and an optional ruler check
 * drawn at the new scale.
 */
export function ResultStep({
  measuredIn,
  resolution,
  dpr,
  onBack,
  onApply,
}: {
  measuredIn: number;
  resolution: Resolution;
  dpr: number;
  onBack: () => void;
  onApply: (diagonalIn: number) => void;
}) {
  const unit = useSettingsStore((s) => s.unit);
  const rounded = Math.round(measuredIn * 10) / 10;
  const common = nearestCommonDiagonal(measuredIn);
  const both = common !== null && common !== rounded ? common : null;
  const { widthCm, heightCm } = physicalSizeCm(
    measuredIn,
    aspectFromResolution(resolution),
  );

  const checkCm = unit === "cm" ? 5 : 2 * CM_PER_IN;
  const checkLabel = unit === "cm" ? "5 cm" : "2 in";
  const checkPx = cssPxPerCm(measuredIn, resolution, dpr) * checkCm;

  return (
    <div className={`grid gap-4 ${NARROW_STEP}`}>
      <DialogHeader>
        <DialogTitle className="text-lg leading-snug">
          Your screen is about {fmtIn(measuredIn)}″ (
          {(measuredIn * CM_PER_IN).toFixed(1)} cm)
        </DialogTitle>
        <DialogDescription className="leading-5">
          Its picture area is about {widthCm.toFixed(1)} × {heightCm.toFixed(1)}{" "}
          cm.
          {both !== null
            ? ` That's close to ${fmtIn(both)}″, a common size, so it is most likely that.`
            : null}
        </DialogDescription>
      </DialogHeader>

      <figure className="panel-inset grid gap-2 rounded-md px-3 py-3">
        <figcaption className="text-sm text-muted-foreground">
          Check: this line should be exactly {checkLabel}. Hold a ruler to it if you like.
        </figcaption>
        <div className="overflow-x-auto py-1">
          <div
            role="img"
            aria-label={`A line drawn ${checkLabel} long at the new scale`}
            className="relative h-4"
            style={{ width: checkPx }}
          >
            <div className="absolute inset-y-0 left-0 w-0.5 bg-foreground" />
            <div className="absolute top-1/2 right-0 left-0 h-0.5 -translate-y-1/2 bg-foreground" />
            <div className="absolute inset-y-0 right-0 w-0.5 bg-foreground" />
          </div>
        </div>
      </figure>

      <DialogFooter className="sm:justify-between">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          {both !== null ? (
            <>
              <Button variant="outline" onClick={() => onApply(rounded)}>
                Use {fmtIn(rounded)}″ (as measured)
              </Button>
              <Button onClick={() => onApply(both)}>
                Use {fmtIn(both)}″ (a common size)
              </Button>
            </>
          ) : (
            <Button onClick={() => onApply(rounded)}>Use {fmtIn(rounded)}″</Button>
          )}
        </div>
      </DialogFooter>
    </div>
  );
}
