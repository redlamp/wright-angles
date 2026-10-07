"use client";

import {
  CornerDownRightIcon,
  EyeIcon,
  EyeOffIcon,
  ScanTextIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { MediaItem } from "@/lib/types";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { useAnnotationStore } from "@/stores/annotation-store";
import { useUiStore } from "@/stores/ui-store";
import { Button } from "@/components/ui/button";
import { SectionLabel } from "./shared";
import { type ScanLine, ScanResults } from "./scan-results";

export interface ScanRun {
  lines: ScanLine[];
  medianPx: number;
}

/**
 * Header-row controls + result list for OCR. The scan state lives in
 * DetailCard (which also draws the boxes over the media display); this
 * section is the buttons, status line, and the per-line table.
 */
export function TextDetectionSection({
  item,
  scan,
  running,
  failed,
  showBoxes,
  onToggleBoxes,
  onDetect,
  onClear,
  animated = false,
  unscannedCount = 0,
  onScanAll,
  note,
  onClearAll,
}: {
  item: MediaItem;
  scan: ScanRun | null;
  running: boolean;
  failed: boolean;
  showBoxes: boolean;
  onToggleBoxes: () => void;
  onDetect: () => void;
  /** Timeline media: clears the ACTIVE keyframe's scan (marker stays). */
  onClear: () => void;
  /** Timeline media: scans attach to keyframes instead of the item. */
  animated?: boolean;
  unscannedCount?: number;
  onScanAll?: () => void;
  /** Status line override (keyframe context / batch progress). */
  note?: string | null;
  onClearAll: () => void;
}) {
  const colorMode = useAnnotationStore((s) => s.scanColorMode);
  const setScanColorMode = useAnnotationStore((s) => s.setScanColorMode);
  const canScan = item.kind === "image" || animated;
  const hasLines = !!scan && scan.lines.length > 0;
  const hasAnyDetection =
    hasLines ||
    (item.boxes?.length ?? 0) > 0 ||
    (item.scanKeyframes?.length ?? 0) > 0;

  return (
    <div className="space-y-1.5">
      <div className="flex h-6 items-center justify-between gap-1">
        <span className="flex items-center gap-1.5">
          {/* Eye LEFT of the label, styled as a real button (Taylor). */}
          <button
            type="button"
            aria-pressed={showBoxes}
            title={
              showBoxes
                ? "Hide text boxes everywhere (2D, 3D, previews)"
                : "Show text boxes everywhere (2D, 3D, previews)"
            }
            className={cn(
              "panel-inset flex size-6 items-center justify-center rounded-md transition-colors",
              showBoxes
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
            onClick={onToggleBoxes}
          >
            {showBoxes ? (
              <EyeIcon className="size-3.5" />
            ) : (
              <EyeOffIcon className="size-3.5" />
            )}
          </button>
          <SectionLabel>Text detection</SectionLabel>
        </span>
        {/* Exact order + language per Taylor 2026-08-17 14:30:
            Clear All · Clear Current (timeline only) · Detect Text Size.
            Destructive actions in red. */}
        <span className="flex items-center gap-1">
          {hasAnyDetection ? (
            <ConfirmButton
              label="Clear All"
              title="Remove EVERY box and keyframe on this media — including ones from older sessions"
              onConfirm={onClearAll}
            />
          ) : null}
          {animated && hasLines ? (
            <ConfirmButton
              label="Clear Current"
              title="Clear the scan on the current keyframe (the marker stays)"
              onConfirm={onClear}
            />
          ) : null}
          {animated && unscannedCount > 0 && onScanAll ? (
            <Button
              variant="secondary"
              size="sm"
              className="h-6 px-1.5 text-sm"
              disabled={running}
              title="Scan every unscanned keyframe in order"
              onClick={onScanAll}
            >
              Scan all ({unscannedCount})
            </Button>
          ) : null}
          <Button
            variant="secondary"
            size="sm"
            className="h-6 px-1.5 text-sm"
            disabled={running || !canScan}
            title={
              animated
                ? "Pause here and scan this frame (adds an OCR keyframe at the playhead)"
                : canScan
                  ? "Find text lines with local OCR and add a measure box per line"
                  : "Text detection needs an image or timeline frame"
            }
            onClick={onDetect}
          >
            <ScanTextIcon className="size-3.5" />
            {running ? "Detecting…" : "Detect Text Size"}
          </Button>
        </span>
      </div>
      {failed ? (
        <p className="text-sm text-muted-foreground">
          Couldn&apos;t detect text — see console.
        </p>
      ) : null}
      <div className="flex items-center justify-between gap-2">
        {failed ? null : animated ? (
          note ? (
            <p className="min-w-0 flex-1 text-sm text-muted-foreground">
              {note}
            </p>
          ) : (
            <span className="flex-1" />
          )
        ) : scan ? (
          <p className="min-w-0 flex-1 text-sm text-muted-foreground">
            {scan.lines.length === 0
              ? "No text found."
              : `${scan.lines.length} text line${
                  scan.lines.length === 1 ? "" : "s"
                } → boxes · median ${Math.round(scan.medianPx)} px tall`}
          </p>
        ) : (
          <span className="flex-1" />
        )}
        {hasLines ? (
          <span className="panel-inset flex h-6 shrink-0 items-center gap-0.5 rounded-md p-0.5">
            {(
              [
                { id: "group", label: "Groups" },
                { id: "rating", label: "Sizes" },
              ] as const
            ).map((m) => (
              <button
                key={m.id}
                type="button"
                aria-pressed={colorMode === m.id}
                title={
                  m.id === "group"
                    ? "Color by text block"
                    : "Color by legibility verdict on This Device"
                }
                className={cn(
                  "h-full rounded-[5px] px-1.5 text-sm transition-colors",
                  colorMode === m.id
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setScanColorMode(m.id)}
              >
                {m.label}
              </button>
            ))}
          </span>
        ) : null}
      </div>
      {hasLines ? <ScanResults item={item} lines={scan.lines} /> : null}
      {hasLines ? <ScanFollowThrough /> : null}
    </div>
  );
}

/** Post-scan deep link (plan 5.5): the verdicts live one tab over.
 * CornerDownRight reads as in-app navigation, not an external link. */
function ScanFollowThrough() {
  const openWorkbenchTab = useUiStore((s) => s.openWorkbenchTab);
  return (
    <div className="flex gap-1">
      <Button
        variant="ghost"
        size="sm"
        className="h-6 px-1.5 text-sm text-muted-foreground hover:text-foreground"
        title="Switch to the Perception Report tab — measured text carries its read content"
        onClick={() => openWorkbenchTab("report")}
      >
        <CornerDownRightIcon className="size-3.5" />
        Perception Report
      </Button>
    </div>
  );
}
