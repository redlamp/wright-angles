"use client";

import {
  AlignCenterVerticalIcon,
  DownloadIcon,
  ImageIcon,
  PencilRulerIcon,
  PictureInPicture2Icon,
  WallpaperIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CvdChip } from "@/components/cvd-filters";
import { OverlaysChip } from "@/components/display-area/overlays";
import type { DisplayCenter, DisplayMode } from "@/stores/settings-store";
import type { MediaItem } from "@/lib/types";
import type { Point } from "@/components/display-area/types";

/** Bottom-right readouts: browser-zoom warning and the scale chip. */
export function ScaleReadouts({
  zoomPct,
  scalePct,
  viewportActive,
}: {
  zoomPct: number | null;
  scalePct: number | null;
  viewportActive: boolean;
}) {
  return (
    <div className="absolute right-2 bottom-2 z-40 flex flex-col items-end gap-1">
      {zoomPct !== null ? (
        <div
          className="rounded-md bg-[#f5a524]/90 px-2 py-1 font-mono text-sm text-black"
          title="Browser zoom (or a This Device resolution that doesn't match this screen) breaks the 1:1 physical-scale promise. Set zoom to 100% — or fix This Device — for true sizes."
        >
          ⚠ browser zoom ≈ {zoomPct}% — sizes are not true
        </div>
      ) : null}
      {scalePct !== null ? (
        <div className="rounded-md bg-black/50 px-2 py-1 font-mono text-sm text-white/60">
          {viewportActive
            ? scalePct >= 99 && scalePct <= 101
              ? "1:1 physical scale · drag to pan"
              : `${scalePct}% — This Device res ≠ this screen's native res`
            : scalePct === 100
              ? "1:1 physical scale"
              : `${scalePct}% scale — viewport mode for 1:1`}
        </div>
      ) : null}
    </div>
  );
}

/** Top-right action buttons: measure, overlays, CVD, centering, mode, export. */
export function ViewActions({
  activeItem,
  drawMode,
  setDrawMode,
  displayCenter,
  setDisplayCenter,
  setPanOffset,
  viewportActive,
  setDisplayMode,
  exportView,
}: {
  activeItem: MediaItem | null;
  drawMode: boolean;
  setDrawMode: (v: boolean) => void;
  displayCenter: DisplayCenter;
  setDisplayCenter: (center: DisplayCenter) => void;
  setPanOffset: (offset: Point) => void;
  viewportActive: boolean;
  setDisplayMode: (mode: DisplayMode) => void;
  exportView: () => Promise<void>;
}) {
  return (
    <div
      data-ui-chrome
      className="absolute top-2 right-2 z-40 flex items-center gap-1.5"
    >
        {activeItem ? (
          <button
            type="button"
            title={
              drawMode
                ? "Done drawing boxes (Esc)"
                : "Draw measurement boxes on the image"
            }
            className={cn(
              "flex h-7 w-28 items-center justify-center gap-1 rounded-md font-mono text-sm transition-colors",
              drawMode
                ? "bg-white/25 text-white"
                : "bg-black/50 text-white/60 hover:text-white",
            )}
            onClick={() => setDrawMode(!drawMode)}
          >
            <PencilRulerIcon className="size-3" />
            {drawMode ? "done" : "measure"}
          </button>
        ) : null}
        <OverlaysChip />
        <CvdChip className="rounded-md border-0 bg-black/50 font-mono text-sm text-white/60 hover:text-white dark:bg-black/50 dark:hover:bg-black/50" />
        <button
          type="button"
          aria-label="Lock content to the monitor's center"
          aria-pressed={displayCenter === "screen"}
          title={
            displayCenter === "screen"
              ? "Locked to your monitor: content anchors to the physical screen's center, so moving the window pans across it. Click to center in the window instead."
              : "Centered in this window. Click to lock the content to your monitor's physical center instead."
          }
          className="flex h-7 w-9 items-center justify-center rounded-md bg-black/50 text-white/60 transition-colors hover:text-white"
          onClick={() => {
            setDisplayCenter(displayCenter === "screen" ? "window" : "screen");
            setPanOffset({ x: 0, y: 0 });
          }}
        >
          {displayCenter === "screen" ? (
            <PictureInPicture2Icon className="size-3.5" />
          ) : (
            <AlignCenterVerticalIcon className="size-3.5" />
          )}
        </button>
        <button
          type="button"
          aria-label="True-scale viewport"
          aria-pressed={viewportActive}
          title={
            viewportActive
              ? "Window is a true-scale viewport into This Device's screen. Click for fit-to-window."
              : "Whole composition shrunk to fit the window. Click for the true-scale viewport."
          }
          className="flex h-7 w-9 items-center justify-center rounded-md bg-black/50 text-white/60 transition-colors hover:text-white"
          onClick={() => setDisplayMode(viewportActive ? "fit" : "viewport")}
        >
          {viewportActive ? (
            <ImageIcon className="size-3.5" />
          ) : (
            <WallpaperIcon className="size-3.5" />
          )}
        </button>
        <button
          type="button"
          title="Export this view as a PNG reference image"
          className="flex h-7 w-32 items-center justify-center gap-1 rounded-md bg-black/50 font-mono text-sm text-white/60 transition-colors hover:text-white"
          onClick={() => void exportView()}
        >
          <DownloadIcon className="size-3" /> export view
        </button>
    </div>
  );
}
