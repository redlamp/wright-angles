"use client";

import { TriangleAlertIcon } from "lucide-react";
import type { Precheck } from "@/lib/calibration-precheck";
import type { Resolution } from "@/lib/types";
import { Button } from "@/components/ui/button";

const fmt = (r: Resolution) => `${r.w}×${r.h}`;

/**
 * The one thing that would spoil a measurement, named specifically:
 * a different resolution (with a one-click fix only when the browser is
 * confident), or page zoom. Foreground text for contrast; the amber
 * icon carries the colour.
 */
export function PrecheckNotice({
  check,
  configured,
  onUseResolution,
}: {
  check: Precheck;
  configured: Resolution;
  onUseResolution: (r: Resolution) => void;
}) {
  if (check.kind === "ok") return null;
  return (
    <div
      role="status"
      className="flex items-start gap-2 rounded-md bg-[#f5a524]/12 px-2.5 py-2 text-sm text-foreground"
    >
      <TriangleAlertIcon
        aria-hidden
        className="mt-0.5 size-4 shrink-0 text-[#a86f00] dark:text-[#f5a524]"
      />
      <div className="flex flex-1 flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
        {check.kind === "resolution" ? (
          <>
            <p>
              Your browser reports {fmt(check.detected)} but this device is
              set to {fmt(configured)}. Measuring depends on it.
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onUseResolution(check.detected)}
            >
              Use {fmt(check.detected)}
            </Button>
          </>
        ) : check.kind === "resolution-unsure" ? (
          <p>
            Your browser reports about {fmt(check.reported)}, which
            doesn&rsquo;t match this device&rsquo;s {fmt(configured)}. If
            the page is zoomed, press Ctrl+0 (⌘0 on Mac); otherwise check
            your screen&rsquo;s resolution in your display settings, since
            measuring depends on it.
          </p>
        ) : (
          <p>
            Browser zoom is about {check.pct}%. Press Ctrl+0 (⌘0 on Mac)
            to reset it.
          </p>
        )}
      </div>
    </div>
  );
}
