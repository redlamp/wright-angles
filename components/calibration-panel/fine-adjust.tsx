"use client";

import { MinusIcon, PlusIcon } from "lucide-react";
import { CM_PER_IN } from "@/lib/display-math";
import { Button } from "@/components/ui/button";

/**
 * Fine adjust (0.1 mm a click, 1 mm with Shift) beside the live readout
 * of what the current match implies about the screen.
 */
export function FineAdjust({
  what,
  nudge,
  impliedIn,
}: {
  /** What grows and shrinks, for the button labels ("card", "bar"). */
  what: string;
  nudge: (mm: number) => void;
  impliedIn: number;
}) {
  const step = (dir: 1 | -1) => (e: React.MouseEvent) =>
    nudge(dir * (e.shiftKey ? 1 : 0.1));
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <div className="flex items-center gap-1.5">
        <span className="text-sm text-muted-foreground" id="fine-adjust-label">
          Fine adjust
        </span>
        <div
          role="group"
          aria-labelledby="fine-adjust-label"
          className="flex items-center gap-1"
        >
          <Button
            variant="outline"
            size="icon"
            aria-label={`Make the ${what} 0.1 mm smaller`}
            title="0.1 mm smaller (Shift: 1 mm)"
            onClick={step(-1)}
          >
            <MinusIcon />
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label={`Make the ${what} 0.1 mm larger`}
            title="0.1 mm larger (Shift: 1 mm)"
            onClick={step(1)}
          >
            <PlusIcon />
          </Button>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        Screen size from this:{" "}
        <span className="font-mono text-foreground">
          {impliedIn.toFixed(1)}″
        </span>{" "}
        <span className="font-mono">({(impliedIn * CM_PER_IN).toFixed(1)} cm)</span>
      </p>
    </div>
  );
}
