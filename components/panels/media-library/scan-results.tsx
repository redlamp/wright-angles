"use client";

import { useEffect, useRef, useState } from "react";
import { TriangleAlertIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Device, MediaItem } from "@/lib/types";
import { strokesSubAcuity } from "@/lib/display-math";
import { boxMetricsInCrop } from "@/lib/box-metrics";
import { legibilityColor } from "@/lib/legibility";
import { AA_LARGE, AA_NORMAL, type ContrastEstimate } from "@/lib/contrast";
import { useContrastMap } from "@/components/use-contrast-map";
import { useDeviceStore } from "@/stores/device-store";
import { useMediaStore } from "@/stores/media-store";
import { groupColor } from "@/lib/text-groups";
import {
  useAnnotationStore,
  type ScanColorMode,
} from "@/stores/annotation-store";

/**
 * Fully local OCR (vendored Tesseract, see public/ocr/README.md): each
 * detected text line becomes a regular HighlightBox, so it flows into the
 * 2D overlay and the Perception Report like a hand-drawn one. Keyed by
 * item id via DetailCard, so the last-run state resets on switch.
 */
export interface ScanLine {
  id: string;
  text: string;
  confidence: number;
  box: { x: number; y: number; w: number; h: number };
  /** Text block (lib/text-groups); drives the shared size + tint. */
  groupId?: number;
  /** Descender-aware group font-size estimate in source px. */
  sizePx?: number;
}

/**
 * The useful data behind an OCR run: the image with each detected line
 * outlined and numbered, plus a per-line table (text, px height,
 * confidence, arcmin on This Device). Rows select their measure box.
 */
const scanLineColor = (
  line: ScanLine,
  mode: ScanColorMode,
  item: MediaItem,
  thisDevice: Device,
): string => {
  if (mode === "group") return groupColor(line.groupId);
  const hNorm = line.sizePx ? line.sizePx / item.height : line.box.h;
  const m = boxMetricsInCrop(line.box, hNorm, item, thisDevice);
  return legibilityColor(m ? m.arcmin : null);
};

/**
 * Detected-line outlines drawn over the top media display, in full-frame
 * coordinates (rendered inside CropOverlayFrame's intrinsic-aspect host —
 * per Taylor, no second image area). Clicking an outline selects its
 * measure box, same as a list row.
 */
export function ScanBoxesOverlay({
  lines,
  item,
}: {
  lines: ScanLine[];
  item: MediaItem;
}) {
  const colorMode = useAnnotationStore((s) => s.scanColorMode);
  const thisDevice = useDeviceStore((s) => s.thisDevice);
  const selectedBoxId = useAnnotationStore((s) => s.selectedBoxId);
  const selectBox = useAnnotationStore((s) => s.selectBox);
  return (
    <>
      {lines.map((line, i) => (
        <button
          key={line.id}
          type="button"
          aria-label={`Select detected line ${i + 1}`}
          className={cn(
            "absolute border hover:border-white/80",
            line.id === selectedBoxId && "z-10 border-2",
          )}
          style={{
            left: `${line.box.x * 100}%`,
            top: `${line.box.y * 100}%`,
            width: `${line.box.w * 100}%`,
            height: `${line.box.h * 100}%`,
            borderColor:
              line.id === selectedBoxId
                ? "#ffffff"
                : scanLineColor(line, colorMode, item, thisDevice),
          }}
          onClick={(e) => {
            e.stopPropagation();
            selectBox(line.id === selectedBoxId ? null : line.id);
          }}
        />
      ))}
    </>
  );
}

/**
 * WCAG contrast estimate badge (plan 10.1). undefined = still sampling
 * or unavailable (video keyframes); null = flat sample.
 */
function ContrastBadge({ est }: { est?: ContrastEstimate | null }) {
  if (est === undefined || est === null) {
    return (
      <span
        className="shrink-0 font-mono text-sm text-muted-foreground/50"
        title={
          est === null
            ? "No text/background split found in this box"
            : "Contrast estimate unavailable (video frames aren't sampled)"
        }
      >
        –:1
      </span>
    );
  }
  const color =
    est.ratio >= AA_NORMAL
      ? "#46a758"
      : est.ratio >= AA_LARGE
        ? "#f5a524"
        : "#e5484d";
  return (
    <span
      className="shrink-0 font-mono text-sm"
      style={{ color }}
      title="Estimated text/background contrast (WCAG): AA needs 4.5:1, or 3:1 for large text"
    >
      {est.ratio.toFixed(1)}:1
    </span>
  );
}

export function ScanResults({
  item,
  lines,
}: {
  item: MediaItem;
  lines: ScanLine[];
}) {
  const colorMode = useAnnotationStore((s) => s.scanColorMode);
  const thisDevice = useDeviceStore((s) => s.thisDevice);
  const selectedBoxId = useAnnotationStore((s) => s.selectedBoxId);
  const selectBox = useAnnotationStore((s) => s.selectBox);
  const showContrast = useAnnotationStore((s) => s.showContrast);
  const objectUrl = useMediaStore((s) => s.objectUrls[item.id]);
  // Contrast sampling needs stable pixels — static images only; video
  // keyframe lines would need a seek+capture per row.
  const contrastMap = useContrastMap(
    item.id,
    objectUrl,
    item,
    lines,
    showContrast && item.kind === "image",
  );
  // User-adjustable list height (session-local).
  const [listH, setListH] = useState(160);
  const resize = useRef<{ startY: number; base: number } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Selecting a box (on the media, in a view) reveals its row: the
  // list is short, so the selection is often scrolled out of sight.
  useEffect(() => {
    if (!selectedBoxId) return;
    listRef.current
      ?.querySelector(`[data-box-id="${CSS.escape(selectedBoxId)}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [selectedBoxId]);

  const rows = lines
    .map((line, i) => {
      // Group-corrected height when available (descender-aware, plan
      // 7.2), else the raw ink box. Measured through This Device's
      // actual rendered crop (source crop, then its fit mode) — a fill
      // mode's crop can exclude a line the source crop alone wouldn't.
      const hNorm = line.sizePx ? line.sizePx / item.height : line.box.h;
      const metrics = boxMetricsInCrop(line.box, hNorm, item, thisDevice);
      const shownPx = Math.round(line.sizePx ?? line.box.h * item.height);
      return { line, i, metrics, shownPx };
    })
    .filter(
      (r): r is typeof r & { metrics: NonNullable<typeof r.metrics> } =>
        r.metrics !== null,
    );

  return (
    <div className="space-y-1">
      <div
        ref={listRef}
        className="space-y-0.5 overflow-y-auto"
        style={{ height: listH }}
      >
        {rows.map(({ line, i, metrics, shownPx }) => (
          <button
            key={line.id}
            data-box-id={line.id}
            type="button"
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left transition-colors",
              line.id === selectedBoxId
                ? "panel-inset ring-1 ring-ring ring-inset"
                : "hover:bg-muted/50",
            )}
            onClick={() =>
              selectBox(line.id === selectedBoxId ? null : line.id)
            }
          >
            {/* Dot follows the color mode: block tint (7.3) or the
                legibility verdict band. */}
            <span
              className="size-2 shrink-0 rounded-full"
              title={
                colorMode === "group"
                  ? line.groupId !== undefined
                    ? `Text group ${line.groupId + 1} — size shared across the block`
                    : undefined
                  : "Legibility on This Device (ISO 16′ / 20′ bands)"
              }
              style={{
                background:
                  colorMode === "group"
                    ? groupColor(line.groupId)
                    : legibilityColor(metrics.arcmin),
              }}
            />
            <span className="w-5 shrink-0 font-mono text-sm text-muted-foreground">
              {i + 1}
            </span>
            <span
              className="min-w-0 flex-1 truncate text-base"
              title={line.text}
            >
              {line.text}
            </span>
            <span
              className="shrink-0 font-mono text-sm text-muted-foreground"
              title={
                line.sizePx
                  ? "Group-corrected font size (raw ink box may be shorter)"
                  : undefined
              }
            >
              {shownPx} px · {Math.round(line.confidence)}%
            </span>
            {showContrast ? (
              <ContrastBadge est={contrastMap.get(line.id)} />
            ) : null}
            <span
              className="shrink-0 font-mono text-sm"
              style={{ color: legibilityColor(metrics.arcmin) }}
              title="Arc minutes on This Device (cap height, ISO bands 16'/20')"
            >
              {metrics.arcmin.toFixed(0)}′
            </span>
            {strokesSubAcuity(metrics.arcmin) ? (
              <span
                className="shrink-0"
                title="Strokes render below 1′ on This Device — letterforms lose their detail at this distance"
              >
                <TriangleAlertIcon className="size-3 text-[#e5484d]" />
              </span>
            ) : null}
          </button>
        ))}
      </div>
      {/* Height grip: drag to grow/shrink the list (plan: adjustable). */}
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize detected text list"
        className="mx-auto h-1.5 w-16 cursor-ns-resize touch-none rounded-full bg-border transition-colors hover:bg-ring/60"
        onPointerDown={(e) => {
          resize.current = { startY: e.clientY, base: listH };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const r = resize.current;
          if (!r || !e.currentTarget.hasPointerCapture(e.pointerId)) return;
          setListH(
            Math.min(480, Math.max(80, r.base + (e.clientY - r.startY))),
          );
        }}
        onPointerUp={() => {
          resize.current = null;
        }}
      />
    </div>
  );
}
