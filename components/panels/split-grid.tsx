"use client";

import { useRef } from "react";
import { PanelLeftCloseIcon, PanelLeftOpenIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/ui-store";

/**
 * The workbench two-column layout: a fixed-width first column, a drag
 * divider, and a fluid second column. All three tabs share ONE persisted
 * split width and collapse state, so adjusting either anywhere adjusts
 * it everywhere — parity across tabs, like the rest of the workbench
 * state. The divider carries a collapse toggle that folds the first
 * column away entirely.
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
  const collapsed = useUiStore((s) => s.workbenchLeftCollapsed);
  const toggleCollapsed = useUiStore((s) => s.toggleWorkbenchLeft);
  const hostRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={hostRef}
      className={cn("grid h-full min-h-0 overflow-x-clip", className)}
      style={{
        gridTemplateColumns: `${collapsed ? 0 : splitPx}px 5px minmax(0, 1fr)`,
      }}
    >
      {/* Single-cell grid so the tab's own column root stretches to the
          full panel height (flex/scroll chains depend on it). */}
      <div
        className={cn(
          "grid min-h-0 min-w-0 grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)] overflow-hidden",
          collapsed && "invisible",
        )}
      >
        {left}
      </div>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize columns"
        className={cn(
          "relative touch-none border-x border-border bg-transparent transition-colors",
          !collapsed && "cursor-col-resize hover:bg-ring/40",
        )}
        onPointerDown={(e) => {
          if (collapsed) return;
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
      >
        <button
          type="button"
          aria-label={collapsed ? "Show first column" : "Hide first column"}
          title={collapsed ? "Show first column" : "Hide first column"}
          className="panel-frame absolute top-1.5 left-1/2 z-10 flex size-5 -translate-x-1/2 cursor-pointer items-center justify-center rounded border border-border text-muted-foreground transition-colors hover:text-foreground"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={toggleCollapsed}
        >
          {collapsed ? (
            <PanelLeftOpenIcon className="size-3.5" />
          ) : (
            <PanelLeftCloseIcon className="size-3.5" />
          )}
        </button>
      </div>
      {right}
    </div>
  );
}
