"use client";

import { useState } from "react";
import { EyeIcon, EyeOffIcon, ScanTextIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  clearCurrentKeyframeScan,
  detectTextForItem,
} from "@/lib/scan-actions";
import { activeKeyframe } from "@/lib/scan-keyframes";
import { isAnimatedItem } from "@/lib/playback-engine";
import type { MediaItem } from "@/lib/types";
import { usePlaybackStore } from "@/stores/playback-store";
import { useMediaStore } from "@/stores/media-store";
import { useAnnotationStore } from "@/stores/annotation-store";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Button } from "@/components/ui/button";

/**
 * Column 2's header row: the global text-box eye, the column title,
 * and the Clear / Detect Text Size actions, plus the detect-failure
 * note beneath it.
 */
export function ScanToolbar({ activeItem }: { activeItem: MediaItem | null }) {
  const clearDetection = useMediaStore((s) => s.clearDetection);
  const showTextBoxes = useAnnotationStore((s) => s.showTextBoxes);
  const setShowTextBoxes = useAnnotationStore((s) => s.setShowTextBoxes);

  const [detecting, setDetecting] = useState(false);
  const [detectFailed, setDetectFailed] = useState(false);

  // Clear-button state mirrors the Media Library's Text Detection row.
  const animatedActive = activeItem ? isAnimatedItem(activeItem) : false;
  const timeSec = usePlaybackStore((s) => (animatedActive ? s.timeSec : 0));
  const activeKf =
    animatedActive && activeItem?.scanKeyframes
      ? activeKeyframe(activeItem.scanKeyframes, timeSec)
      : null;
  const hasAnyDetection =
    !!activeItem &&
    ((activeItem.boxes?.length ?? 0) > 0 ||
      (activeItem.scanKeyframes?.length ?? 0) > 0 ||
      !!activeItem.scan);

  const detect = async () => {
    if (!activeItem || detecting) return;
    setDetecting(true);
    setDetectFailed(false);
    try {
      await detectTextForItem(activeItem.id);
    } catch (err) {
      console.warn("Text detection failed:", err);
      setDetectFailed(true);
    } finally {
      setDetecting(false);
    }
  };

  return (
    <>
      <div className="flex h-6 items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5">
          {/* Same global eye as the Media Library — hiding boxes
              here hides them in 2D and 3D too. */}
          <button
            type="button"
            aria-pressed={showTextBoxes}
            title={
              showTextBoxes
                ? "Hide text boxes everywhere (2D, 3D, previews)"
                : "Show text boxes everywhere (2D, 3D, previews)"
            }
            className={cn(
              "panel-inset flex size-6 shrink-0 items-center justify-center rounded-md transition-colors",
              showTextBoxes
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => setShowTextBoxes(!showTextBoxes)}
          >
            {showTextBoxes ? (
              <EyeIcon className="size-3.5" />
            ) : (
              <EyeOffIcon className="size-3.5" />
            )}
          </button>
          <span className="min-w-0 truncate text-sm font-medium tracking-wide text-muted-foreground uppercase">
            Scanned text{activeItem ? ` · ${activeItem.name}` : ""}
          </span>
        </span>
        {activeItem ? (
          <span className="flex shrink-0 items-center gap-1">
            {hasAnyDetection ? (
              <ConfirmButton
                label="Clear All"
                title="Remove EVERY box and keyframe on this media — including ones from older sessions"
                onConfirm={() => clearDetection(activeItem.id)}
              />
            ) : null}
            {animatedActive && activeKf?.lines ? (
              <ConfirmButton
                label="Clear Current"
                title="Clear the scan on the current keyframe (the marker stays)"
                onConfirm={() => clearCurrentKeyframeScan(activeItem.id)}
              />
            ) : null}
            <Button
              variant="secondary"
              size="sm"
              className="h-6 px-1.5 text-sm"
              disabled={detecting}
              title={
                animatedActive
                  ? "Pause and scan the current frame (adds an OCR keyframe)"
                  : "Find text lines with local OCR"
              }
              onClick={() => void detect()}
            >
              <ScanTextIcon className="size-3.5" />
              {detecting ? "Detecting…" : "Detect Text Size"}
            </Button>
          </span>
        ) : null}
      </div>
      {detectFailed ? (
        <p className="text-sm text-muted-foreground">
          Couldn&apos;t detect text — see console.
        </p>
      ) : null}
</>
  );
}
