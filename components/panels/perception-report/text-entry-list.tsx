"use client";

import {
  CornerDownRightIcon,
  Trash2Icon,
  TriangleAlertIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { strokesSubAcuity } from "@/lib/display-math";
import { legibilityColor } from "@/lib/legibility";
import { formatTimecode } from "@/lib/units";
import { fitLabel, fitModeOf } from "@/lib/fit";
import type { TextEntry } from "@/lib/perception-report";
import type { MediaItem } from "@/lib/types";
import { useMediaStore } from "@/stores/media-store";
import { useAnnotationStore } from "@/stores/annotation-store";
import { useUiStore } from "@/stores/ui-store";
import type { EntryVerdict } from "./use-entry-verdicts";

/**
 * Column 2's body: the active media's text entries, each with its
 * per-device verdict row — or the no-media / nothing-measured notes.
 */
export function TextEntryList({
  activeItem,
  textEntries,
  entryVerdicts,
}: {
  activeItem: MediaItem | null;
  textEntries: TextEntry[];
  entryVerdicts: Map<string, Array<EntryVerdict>>;
}) {
  const removeBox = useMediaStore((s) => s.removeBox);
  const selectedBoxId = useAnnotationStore((s) => s.selectedBoxId);
  const selectBox = useAnnotationStore((s) => s.selectBox);
  const openWorkbenchTab = useUiStore((s) => s.openWorkbenchTab);

  return !activeItem ? (
    <p className="panel-inset flex items-center gap-1 rounded-md px-2.5 py-2 text-sm text-muted-foreground">
      No active media.
      <button
        type="button"
        className="inline-flex items-center gap-1 text-foreground underline-offset-2 hover:underline"
        onClick={() => openWorkbenchTab("media")}
      >
        <CornerDownRightIcon className="size-3.5" />
        Media Library
      </button>
    </p>
  ) : textEntries.length === 0 ? (
    <p className="panel-inset rounded-md px-2.5 py-2 text-sm text-muted-foreground">
      Nothing measured yet — run Detect Text Size or draw measure
      boxes in the 2D view.
    </p>
  ) : (
    <ul className="space-y-1.5">
      {textEntries.map((e) => (
        <li
          key={e.id}
          className={cn(
            "panel-inset cursor-pointer rounded-md px-2.5 py-1.5 text-sm transition-shadow",
            e.id === selectedBoxId && "ring-1 ring-ring",
          )}
          onClick={() =>
            selectBox(e.id === selectedBoxId ? null : e.id)
          }
        >
          <div className="flex items-center justify-between gap-2">
            <span
              className="min-w-0 flex-1 truncate font-medium"
              title={e.label}
            >
              {e.label}
            </span>
            <span className="shrink-0 font-mono text-sm text-muted-foreground">
              {e.kfTime !== null ? `@ ${formatTimecode(e.kfTime)} · ` : ""}
              {e.srcH} px
            </span>
            {e.removable && activeItem ? (
              <button
                type="button"
                aria-label={`Remove ${e.label}`}
                className="text-muted-foreground transition-colors hover:text-destructive"
                onClick={(ev) => {
                  ev.stopPropagation();
                  removeBox(activeItem.id, e.id);
                  if (e.id === selectedBoxId) selectBox(null);
                }}
              >
                <Trash2Icon className="size-3" />
              </button>
            ) : null}
          </div>
          {/* Row 2 (Taylor 2026-08-18): compact dot·arcmin
              pairs — the dot is the device's key color, the
              arcmin number wears the verdict band, the hover
              title names the device with mm/px. */}
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
            {(entryVerdicts.get(e.id) ?? []).map((row) => {
              const d = row.device;
              // Fit modes crop: a box the device's fit trims
              // away isn't on that screen at all — show a muted
              // dash instead of a verdict. Measuring through the
              // device's actual rendered crop (not the intrinsic
              // image) also means a cropped-in box reads its
              // true, bigger size on that screen.
              if (row.kind === "cropped") {
                return (
                  <span
                    key={d.id}
                    className="flex items-center gap-1.5 font-mono text-sm"
                    title={`${d.label}: cropped out by "${fitLabel(fitModeOf(d))}" — not shown on this screen`}
                  >
                    <span
                      className="inline-block size-2 rounded-full opacity-35"
                      style={{ background: d.color }}
                    />
                    <span className="text-muted-foreground/60">—</span>
                  </span>
                );
              }
              // A stretched panel distorts: the figure is the
              // HEIGHT one, and the chip says so on hover.
              const { m, stretch } = row;
              return (
                <span
                  key={d.id}
                  className="flex items-center gap-1.5 font-mono text-sm"
                  title={`${d.label}: ${m.arcmin.toFixed(1)}′ · ${m.mm.toFixed(1)} mm tall · ${Math.round(m.devicePx)} px${stretch ? ` — ${stretch}` : ""}`}
                >
                  <span
                    className="inline-block size-2 rounded-full"
                    style={{ background: d.color }}
                  />
                  <span style={{ color: legibilityColor(m.arcmin) }}>
                    {m.arcmin.toFixed(0)}′
                  </span>
                  {strokesSubAcuity(m.arcmin) ? (
                    <TriangleAlertIcon
                      className="size-3 text-[#e5484d]"
                      aria-label="Sub-acuity strokes"
                    />
                  ) : null}
                </span>
              );
            })}
          </div>
        </li>
      ))}
    </ul>
  );
}
