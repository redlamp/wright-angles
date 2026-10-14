"use client";

import { CornerDownRightIcon, Trash2Icon } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatTimecode } from "@/lib/units";
import type { TextEntry } from "@/lib/perception-report";
import type { Device, MediaItem } from "@/lib/types";
import { useMediaStore } from "@/stores/media-store";
import { useAnnotationStore } from "@/stores/annotation-store";
import { useUiStore } from "@/stores/ui-store";
import { DeviceSwatch } from "@/components/legibility-ui";
import type { EntryVerdict } from "./use-entry-verdicts";
import { LineThumb } from "./line-thumb";
import { VerdictCell } from "./verdict-cell";

/**
 * Column 2's body: the active media's text entries as a verdict
 * matrix — one row per text line (thumbnail of the real pixels, the
 * OCR'd label, its source size), one column per device NAMED in the
 * header — or the no-media / nothing-measured notes. The matrix
 * scrolls sideways inside its own box; the line column stays pinned.
 */
export function TextEntryList({
  activeItem,
  textEntries,
  entryVerdicts,
  devices,
}: {
  activeItem: MediaItem | null;
  textEntries: TextEntry[];
  entryVerdicts: Map<string, Array<EntryVerdict>>;
  /** The matrix columns, in the same order as each verdict row. */
  devices: Device[];
}) {
  const removeBox = useMediaStore((s) => s.removeBox);
  const selectedBoxId = useAnnotationStore((s) => s.selectedBoxId);
  const selectBox = useAnnotationStore((s) => s.selectBox);
  const openWorkbenchTab = useUiStore((s) => s.openWorkbenchTab);

  if (!activeItem)
    return (
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
    );
  if (textEntries.length === 0)
    return (
      <p className="panel-inset rounded-md px-2.5 py-2 text-sm text-muted-foreground">
        Nothing measured yet — run Detect Text Size or draw measure
        boxes in the 2D view.
      </p>
    );

  const anyRemovable = textEntries.some((e) => e.removable);
  return (
    <div className="panel-inset overflow-x-auto rounded-md">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">
          Legibility of each scanned text line on each device: readable
          (20′ or more), tight (16–20′) or too small (under 16′).
        </caption>
        <thead>
          <tr className="border-b border-border text-left text-muted-foreground">
            <th
              scope="col"
              className="sticky left-0 z-10 bg-surface-inset px-2.5 py-1.5 font-medium"
            >
              Text line
            </th>
            {devices.map((d) => (
              <th
                key={d.id}
                scope="col"
                className="px-2 py-1.5 font-medium"
                title={d.deviceName || d.label}
              >
                <span className="flex max-w-28 items-center gap-1.5">
                  <DeviceSwatch color={d.color} />
                  <span className="truncate text-foreground">{d.label}</span>
                </span>
              </th>
            ))}
            {anyRemovable ? (
              <th scope="col" className="w-7 px-1">
                <span className="sr-only">Remove</span>
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {textEntries.map((e) => {
            const selected = e.id === selectedBoxId;
            const rows = entryVerdicts.get(e.id) ?? [];
            return (
              <tr
                key={e.id}
                className={cn(
                  "group cursor-pointer border-b border-border/60 last:border-b-0",
                  selected ? "bg-muted" : "hover:bg-muted/50",
                )}
                onClick={() => selectBox(selected ? null : e.id)}
              >
                <th
                  scope="row"
                  className={cn(
                    "sticky left-0 z-10 max-w-56 min-w-36 px-2.5 py-1.5 text-left font-normal",
                    selected ? "bg-muted" : "bg-surface-inset group-hover:bg-muted",
                  )}
                >
                  <button
                    type="button"
                    aria-pressed={selected}
                    className="block w-full min-w-0 rounded-sm text-left focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
                    onClick={(ev) => {
                      ev.stopPropagation();
                      selectBox(selected ? null : e.id);
                    }}
                  >
                    <span
                      className="block truncate font-medium"
                      title={e.label}
                    >
                      {e.label}
                    </span>
                    {/* The real pixels beside the OCR'd label: a misread
                        ("47" for "17") shows at a glance. */}
                    <span className="mt-0.5 flex items-center gap-2 font-mono text-muted-foreground">
                      <LineThumb
                        item={activeItem}
                        box={e.box}
                        isKeyframe={e.kfTime !== null}
                      />
                      <span className="shrink-0">
                        {e.kfTime !== null
                          ? `@ ${formatTimecode(e.kfTime)} · `
                          : ""}
                        {e.srcH} px
                      </span>
                    </span>
                  </button>
                </th>
                {devices.map((d, i) => (
                  <VerdictCell key={d.id} row={rows[i]} />
                ))}
                {anyRemovable ? (
                  <td className="px-1 py-1.5">
                    {e.removable ? (
                      <button
                        type="button"
                        aria-label={`Remove ${e.label}`}
                        className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-destructive"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          removeBox(activeItem.id, e.id);
                          if (selected) selectBox(null);
                        }}
                      >
                        <Trash2Icon className="size-3.5" />
                      </button>
                    ) : null}
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
