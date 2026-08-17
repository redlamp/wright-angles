"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/ui-store";

/**
 * The workbench two-column layout: a fixed-width first column, a drag
 * divider, and a fluid second column. All three tabs share ONE persisted
 * split width, so adjusting it anywhere adjusts it everywhere — parity
 * across tabs, like the rest of the workbench state.
 */
export function SplitGrid({
  left,
  right,
  className,
}: {
  left: React.ReactNode;
  right: React.ReactNode;
  className?: string;
}) {
  const splitPx = useUiStore((s) => s.workbenchSplitPx);
  const setSplitPx = useUiStore((s) => s.setWorkbenchSplitPx);
  const hostRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={hostRef}
      className={cn("grid h-full min-h-0 overflow-x-clip", className)}
      style={{ gridTemplateColumns: `${splitPx}px 5px minmax(0, 1fr)` }}
    >
      {left}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize columns"
        className="cursor-col-resize touch-none border-x border-border bg-transparent transition-colors hover:bg-ring/40"
        onPointerDown={(e) => {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!(e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId))
            return;
          const host = hostRef.current;
          if (!host) return;
          const r = host.getBoundingClientRect();
          // Store clamp holds the floor; keep a usable second column too.
          setSplitPx(Math.min(e.clientX - r.left, r.width - 200));
        }}
      />
      {right}
    </div>
  );
}
