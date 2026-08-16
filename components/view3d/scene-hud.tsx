"use client";

import { Link2Icon, Unlink2Icon } from "lucide-react";
import { cn } from "@/lib/utils";
import { INPUT_TYPES, SCENARIOS, useViewerStore } from "@/stores/viewer-store";
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
  const inputType = useViewerStore((s) => s.inputType);
  const setInputType = useViewerStore((s) => s.setInputType);
  const linkInput = useViewerStore((s) => s.linkInput);
  const setLinkInput = useViewerStore((s) => s.setLinkInput);
  const heightCm = useViewerStore((s) => s.heightCm);
  const setHeightCm = useViewerStore((s) => s.setHeightCm);

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
        {/* The two option rows align by column (standing-handheld,
            couch-gamepad, desk-keyboard); the chain toggle on the right
            locks them through that pairing, Figma ratio-lock style. */}
        <div className="flex items-stretch gap-1">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
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
            <div className="panel-inset flex h-7 items-center gap-0.5 rounded-md p-0.5">
              {INPUT_TYPES.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  className={cn(
                    "h-full flex-1 rounded-[5px] text-[11px] transition-colors",
                    o.id === inputType
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  onClick={() => setInputType(o.id)}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            title={
              linkInput
                ? "Unlink setting from input type"
                : "Link setting with input type"
            }
            aria-pressed={linkInput}
            className={cn(
              "panel-inset flex w-7 items-center justify-center rounded-md transition-colors",
              linkInput
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => setLinkInput(!linkInput)}
          >
            {linkInput ? (
              <Link2Icon className="h-3.5 w-3.5" />
            ) : (
              <Unlink2Icon className="h-3.5 w-3.5" />
            )}
          </button>
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
    </>
  );
}
