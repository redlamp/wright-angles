"use client";

import { useMemo, useState } from "react";
import {
  EyeIcon,
  EyeOffIcon,
  LayoutGridIcon,
  ScanTextIcon,
  Trash2Icon,
  TriangleAlertIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ACUITY,
  apparentWidthRatio,
  boxMetricsOnDevice,
  contentPxToArcmin,
  deviceAngles,
  formatDistance,
  physicalSizeCm,
  strokesSubAcuity,
} from "@/lib/display-math";
import {
  clearCurrentKeyframeScan,
  detectTextForItem,
} from "@/lib/scan-actions";
import { boxInCrop, effectiveCropFor } from "@/lib/media-crop";
import { activeKeyframe } from "@/lib/scan-keyframes";
import { isAnimatedItem } from "@/lib/playback-engine";
import { usePlaybackStore } from "@/stores/playback-store";
import { ConfirmButton } from "@/components/ui/confirm-button";
import type { Device, MediaItem } from "@/lib/types";
import { useDeviceStore } from "@/stores/device-store";
import { useMediaStore } from "@/stores/media-store";
import { useSettingsStore } from "@/stores/settings-store";
import { useAnnotationStore } from "@/stores/annotation-store";
import { useUiStore } from "@/stores/ui-store";
import { CornerDownRightIcon } from "lucide-react";
import { NumberStepper } from "@/components/number-stepper";
import { Button } from "@/components/ui/button";
import { SplitGrid } from "./split-grid";

/**
 * The product's thesis, in words: what fits comfortably on the screen
 * you're designing at will read very differently everywhere else.
 *
 * Miller columns (plan 6.x, layout per Taylor 14:58): column 1 carries
 * the DEVICE DETAILS — All Devices, My Device (blessed), and every
 * project device including hidden ones, each entry showing its
 * comparison summary and, when selected, its full specs. Column 2 shows
 * the SCANNED TEXT for the active media with per-device verdicts, plus
 * the probe.
 */

/** ISO 16′/20′ verdict band color for an arcmin value. */
const bandColor = (arcmin: number) =>
  arcmin >= ACUITY.comfortableTextArcmin
    ? "#46a758"
    : arcmin >= ACUITY.minCriticalTextArcmin
      ? "#f5a524"
      : "#e5484d";

function LegibilityDot({ arcmin }: { arcmin: number }) {
  return (
    <span
      className="inline-block size-2 rounded-full"
      style={{ background: bandColor(arcmin) }}
    />
  );
}

function ratioNote(r: number): string {
  if (r > 1.03)
    return "designs will feel roomier there; check overwhelm at close range.";
  if (r < 0.5)
    return "half your working size or less — treat small text as invisible.";
  if (r < 0.97)
    return "everything shrinks; padding and hit targets tighten first.";
  return "a near-1:1 reference for this setup.";
}

/** Full spec lines, shown inside the selected column-1 entry. */
function SpecLines({ d }: { d: Device }) {
  const unit = useSettingsStore((s) => s.unit);
  const size = physicalSizeCm(d.diagonalIn, d.aspect);
  const a = deviceAngles(d);
  return (
    <div className="mt-1 border-t border-border pt-1 font-mono leading-5 text-muted-foreground">
      <div>
        {d.diagonalIn}″ · {d.resolution.w}×{d.resolution.h}
        {d.curvatureR ? ` · ${d.curvatureR}R` : ""}
      </div>
      <div>
        {size.widthCm.toFixed(1)} × {size.heightCm.toFixed(1)} cm panel
      </div>
      <div>viewed at {formatDistance(d.distanceCm, unit)}</div>
      <div>
        {a.horizontalDeg.toFixed(0)}° × {a.verticalDeg.toFixed(0)}° ·{" "}
        {a.ppd.toFixed(0)} PPD
      </div>
    </div>
  );
}

/** One text entry for column 2 (measure box or keyframe line). */
interface TextEntry {
  id: string;
  label: string;
  /** Full-image normalized height used for verdicts (group-corrected). */
  h: number;
  srcH: number;
  /** Keyframe timestamp for video lines; null = plain measure box. */
  kfTime: number | null;
  /** Removable only for real measure boxes. */
  removable: boolean;
  /** Full-image box rect, for per-device crop visibility. */
  box: { x: number; y: number; w: number; h: number };
}

const fmtKfTime = (t: number) => {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
};

function buildTextEntries(item: MediaItem): TextEntry[] {
  const entries: TextEntry[] = [];
  (item.boxes ?? []).forEach((b, idx) => {
    entries.push({
      id: b.id,
      label: b.label?.trim() || `Box ${idx + 1}`,
      h: b.h,
      srcH: Math.round(b.h * item.height),
      kfTime: null,
      removable: true,
      box: { x: b.x, y: b.y, w: b.w, h: b.h },
    });
  });
  for (const k of item.scanKeyframes ?? [])
    for (const l of k.lines ?? [])
      entries.push({
        id: l.id,
        label: l.text,
        h: l.sizePx ? l.sizePx / item.height : l.box.h,
        srcH: Math.round(l.sizePx ?? l.box.h * item.height),
        kfTime: k.timeSec,
        removable: false,
        box: l.box,
      });
  return entries;
}

/** Perception Report tab content (hosted by the workbench panel). */
export function PerceptionReportContent() {
  const thisDevice = useDeviceStore((s) => s.thisDevice);
  const devices = useDeviceStore((s) => s.devices);
  const showBands = useSettingsStore((s) => s.showLegibilityBands);
  const unit = useSettingsStore((s) => s.unit);
  const [fontPx, setFontPx] = useState(24);
  const [refH, setRefH] = useState(1080);
  const items = useMediaStore((s) => s.items);
  const activeId = useMediaStore((s) => s.activeId);
  const removeBox = useMediaStore((s) => s.removeBox);
  const clearDetection = useMediaStore((s) => s.clearDetection);
  const selectedBoxId = useAnnotationStore((s) => s.selectedBoxId);
  const selectBox = useAnnotationStore((s) => s.selectBox);
  const showTextBoxes = useAnnotationStore((s) => s.showTextBoxes);
  const setShowTextBoxes = useAnnotationStore((s) => s.setShowTextBoxes);
  const activeItem = items.find((i) => i.id === activeId) ?? null;

  const openWorkbenchTab = useUiStore((s) => s.openWorkbenchTab);
  const [column, setColumn] = useState<"all" | "mine" | string>("all");
  const pickedDevice =
    column !== "all" && column !== "mine"
      ? (devices.find((d) => d.id === column) ?? null)
      : null;
  const mode = pickedDevice ? "device" : column === "mine" ? "mine" : "all";

  const [detecting, setDetecting] = useState(false);
  const [detectFailed, setDetectFailed] = useState(false);

  const hostArcmin = useMemo(
    () => contentPxToArcmin(fontPx, refH, thisDevice),
    [fontPx, refH, thisDevice],
  );

  /** Which devices annotate each text entry's verdict row. */
  const verdictDevices =
    mode === "device" && pickedDevice
      ? [pickedDevice]
      : mode === "mine"
        ? [thisDevice]
        : [thisDevice, ...devices];

  const textEntries = activeItem ? buildTextEntries(activeItem) : [];

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

  /** Column-1 entry: name + comparison summary; full specs when selected. */
  const deviceEntry = (d: Device, blessed: boolean) => {
    const key = blessed ? "mine" : d.id;
    const selected = column === key;
    const r = apparentWidthRatio(d, thisDevice);
    const arcmin = contentPxToArcmin(fontPx, refH, d);
    return (
      <button
        key={key}
        type="button"
        className={cn(
          "w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors",
          selected ? "panel-inset ring-1 ring-ring ring-inset" : "hover:bg-muted/50",
        )}
        title={blessed ? undefined : ratioNote(r)}
        onClick={() => setColumn(key)}
      >
        <div className="flex items-baseline justify-between gap-2">
          <span
            className="min-w-0 flex-1 truncate font-medium"
            style={{ color: d.color }}
          >
            {d.label}
          </span>
          <span className="shrink-0 font-mono text-muted-foreground">
            {formatDistance(d.distanceCm, unit)}
          </span>
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 font-mono text-muted-foreground">
          {blessed ? (
            <>This Device · baseline</>
          ) : (
            <>
              ≈{Math.round(r * 100)}%
              {showBands ? (
                <>
                  {" · "}
                  <LegibilityDot arcmin={arcmin} /> {arcmin.toFixed(0)}′
                </>
              ) : null}
              {!d.visible ? (
                <span className="text-muted-foreground/60">· hidden</span>
              ) : null}
            </>
          )}
        </div>
      </button>
    );
  };

  /** Selection details pin to the BOTTOM of the column — list items
   * keep a constant height (Taylor 17:48). All Devices shows the
   * baseline (This Device) block there too (Taylor 2026-08-18). */
  const detailsDevice =
    mode === "device" ? pickedDevice : thisDevice;

  return (
      <SplitGrid
        // Column 1: device details — All Devices, My Device (in the
        // list, per Taylor), every project device incl. hidden.
        // Selection specs pin to the bottom so rows never resize.
        left={
        <div className="flex min-h-0 flex-col">
          <div className="min-h-0 flex-1 space-y-0.5 overflow-y-scroll p-1.5">
            <button
              type="button"
              className={cn(
                "mb-1 flex h-8 w-full items-center gap-1.5 rounded-md border border-border px-2 text-left text-base font-medium transition-colors",
                column === "all"
                  ? "panel-inset ring-1 ring-ring ring-inset"
                  : "hover:bg-muted/50",
              )}
              onClick={() => setColumn("all")}
            >
              <LayoutGridIcon className="size-3.5 text-muted-foreground" />
              All Devices
            </button>
            {deviceEntry(thisDevice, true)}
            {devices.map((d) => deviceEntry(d, false))}
            {mode === "all" ? (
              <p className="px-2 pt-1 text-sm leading-4.5 text-muted-foreground">
                What you see on {thisDevice.label} at{" "}
                {formatDistance(thisDevice.distanceCm, unit)} is not what
                people see elsewhere — {"select a device to expand it."}
              </p>
            ) : null}
          </div>
          {detailsDevice ? (
            // This Device is the vision model's baseline (6.5): a
            // selected device's specs render BESIDE it, not instead.
            <div
              className={cn(
                "grid shrink-0 border-t border-border text-sm",
                detailsDevice.id !== thisDevice.id &&
                  "grid-cols-2 divide-x divide-border",
              )}
            >
              {detailsDevice.id !== thisDevice.id ? (
                <div className="min-w-0 px-2.5 py-2">
                  <span
                    className="font-medium"
                    style={{ color: thisDevice.color }}
                  >
                    {thisDevice.label}
                  </span>
                  <SpecLines d={thisDevice} />
                </div>
              ) : null}
              <div className="min-w-0 px-2.5 py-2">
                <span
                  className="font-medium"
                  style={{ color: detailsDevice.color }}
                >
                  {detailsDevice.label}
                </span>
                <SpecLines d={detailsDevice} />
              </div>
            </div>
          ) : null}
        </div>
        }
        // Column 2: the scanned text for the active media.
        right={
        <div className="min-h-0 space-y-2.5 overflow-y-scroll p-2.5">
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
          {!activeItem ? (
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
                      {e.kfTime !== null ? `@ ${fmtKfTime(e.kfTime)} · ` : ""}
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
                    {verdictDevices.map((d) => {
                      // Per-device crops: a box outside this device's
                      // effective crop isn't on that screen at all —
                      // show a muted dash instead of a verdict.
                      if (
                        activeItem &&
                        !boxInCrop(
                          e.box,
                          effectiveCropFor(activeItem, d.id),
                        )
                      ) {
                        return (
                          <span
                            key={d.id}
                            className="flex items-center gap-1.5 font-mono text-sm"
                            title={`${d.label}: outside this device's crop — not shown on this screen`}
                          >
                            <span
                              className="inline-block size-2 rounded-full opacity-35"
                              style={{ background: d.color }}
                            />
                            <span className="text-muted-foreground/60">—</span>
                          </span>
                        );
                      }
                      const m = boxMetricsOnDevice(e.h, activeItem!, d);
                      return (
                        <span
                          key={d.id}
                          className="flex items-center gap-1.5 font-mono text-sm"
                          title={`${d.label}: ${m.arcmin.toFixed(1)}′ · ${m.mm.toFixed(1)} mm tall · ${Math.round(m.devicePx)} px`}
                        >
                          <span
                            className="inline-block size-2 rounded-full"
                            style={{ background: d.color }}
                          />
                          <span style={{ color: bandColor(m.arcmin) }}>
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
          )}

          {showBands ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
                  Probe text size
                </span>
                <div className="flex items-center gap-1.5">
                  <NumberStepper
                    ariaLabel="probe font pixels"
                    value={fontPx}
                    onChange={setFontPx}
                    min={6}
                    max={200}
                    className="w-20"
                  />
                  <span className="text-sm text-muted-foreground">px @</span>
                  <NumberStepper
                    ariaLabel="probe reference height"
                    value={refH}
                    onChange={setRefH}
                    step={360}
                    bigStep={360}
                    min={360}
                    max={4320}
                    className="w-24"
                  />
                  <span className="text-sm text-muted-foreground">p</span>
                </div>
              </div>
              <p className="font-mono text-sm text-muted-foreground">
                On your screen: {hostArcmin.toFixed(0)}′. Bands per ISO
                9241-303 (cap height): ≥16′ minimum, ≥20′ comfortable.
              </p>
            </div>
          ) : null}
        </div>
        }
      />
  );
}
