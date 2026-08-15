"use client";

import { cn } from "@/lib/utils";
import { SCENARIOS, useViewerStore } from "@/stores/viewer-store";
import { Slider } from "@/components/ui/slider";

/** The FPS span; scene-view's FpsProbe writes its textContent at ~2Hz. */
export const FPS_NODE_ID = "scene-fps-readout";

/**
 * Compact scenario + viewer-height controls overlaid on the 3D scene, plus
 * a tiny FPS readout updated imperatively from inside the canvas — no
 * per-frame React state. `onExport` (from scene-view, which owns the GL
 * canvas) captures the current framing as a PNG download.
 */
export default function SceneHud({ onExport }: { onExport?: () => void }) {
  const scenario = useViewerStore((s) => s.scenario);
  const setScenario = useViewerStore((s) => s.setScenario);
  const heightCm = useViewerStore((s) => s.heightCm);
  const setHeightCm = useViewerStore((s) => s.setHeightCm);
  const showProjection = useViewerStore((s) => s.showProjectionLines);
  const setShowProjection = useViewerStore((s) => s.setShowProjectionLines);

  return (
    <>
      <div className="pointer-events-none absolute bottom-3 right-3 z-10 select-none font-mono text-[10px] tabular-nums text-muted-foreground">
        <span id={FPS_NODE_ID} /> fps
      </div>
      {onExport ? (
        <button
          type="button"
          className="panel-frame absolute right-3 top-3 z-10 select-none rounded-md border border-border px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground"
          onClick={onExport}
        >
          Export view
        </button>
      ) : null}
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
        <button
          type="button"
          aria-pressed={showProjection}
          title="Lines from the eye to every display's corners — the cone of vision. Click a display to highlight its own."
          className={cn(
            "mt-1.5 h-7 w-full rounded-md text-[11px] transition-colors",
            showProjection
              ? "bg-foreground text-background"
              : "panel-inset text-muted-foreground hover:text-foreground",
          )}
          onClick={() => setShowProjection(!showProjection)}
        >
          Corner projection lines
        </button>
      </div>
    </>
  );
}
