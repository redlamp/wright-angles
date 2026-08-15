"use client";

import { cn } from "@/lib/utils";
import { SCENARIOS, useViewerStore } from "@/stores/viewer-store";
import { Slider } from "@/components/ui/slider";

/** Compact scenario + viewer-height controls overlaid on the 3D scene. */
export default function SceneHud() {
  const scenario = useViewerStore((s) => s.scenario);
  const setScenario = useViewerStore((s) => s.setScenario);
  const heightCm = useViewerStore((s) => s.heightCm);
  const setHeightCm = useViewerStore((s) => s.setHeightCm);

  return (
    <div className="panel-frame absolute bottom-3 left-1/2 z-10 w-72 -translate-x-1/2 rounded-lg border border-border p-2 text-xs">
      <div className="panel-inset flex h-7 items-center gap-0.5 rounded-md p-0.5">
        {SCENARIOS.map((o) => (
          <button
            key={o.id}
            type="button"
            className={cn(
              "h-full flex-1 rounded-[5px] text-[11px] transition-colors",
              o.id === scenario
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => setScenario(o.id)}
          >
            {o.label}
          </button>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-2 px-1 pb-0.5">
        <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Height
        </span>
        <Slider
          value={heightCm}
          min={120}
          max={220}
          step={1}
          onValueChange={(v) => setHeightCm(Array.isArray(v) ? v[0] : v)}
        />
        <span className="w-11 shrink-0 text-right font-mono text-[11px]">
          {Math.round(heightCm)} cm
        </span>
      </div>
    </div>
  );
}
