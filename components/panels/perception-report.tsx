"use client";

import { useMemo, useState } from "react";
import { GaugeIcon, Trash2Icon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ACUITY,
  apparentWidthRatio,
  boxMetricsOnDevice,
  contentPxToArcmin,
  deviceAngles,
  formatDistance,
  physicalSizeCm,
} from "@/lib/display-math";
import type { Device } from "@/lib/types";
import { useDeviceStore } from "@/stores/device-store";
import { useMediaStore } from "@/stores/media-store";
import { useSettingsStore } from "@/stores/settings-store";
import { useAnnotationStore } from "@/stores/annotation-store";
import { FloatingPanel } from "./floating-panel";
import { NumberStepper } from "@/components/number-stepper";

/**
 * The product's thesis, in words: what fits comfortably on the screen
 * you're designing at will read very differently everywhere else.
 *
 * Miller-columns layout (plan 6.x): column 1 lists All Devices
 * (default), My Device (blessed — the foundation of the vision model),
 * and every project device INCLUDING ones hidden from the 2D/3D views;
 * selecting narrows column 2 to that device, shown beside This Device.
 */

function LegibilityDot({ arcmin }: { arcmin: number }) {
  const color =
    arcmin >= ACUITY.comfortableTextArcmin
      ? "bg-[#46a758]"
      : arcmin >= ACUITY.minCriticalTextArcmin
        ? "bg-[#f5a524]"
        : "bg-[#e5484d]";
  return <span className={cn("inline-block size-2 rounded-full", color)} />;
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

/** Compact spec card for one device (the blessed one gets a tag). */
function SpecCard({ d, blessed }: { d: Device; blessed?: boolean }) {
  const unit = useSettingsStore((s) => s.unit);
  const size = physicalSizeCm(d.diagonalIn, d.aspect);
  const a = deviceAngles(d);
  return (
    <div className="panel-inset min-w-0 space-y-1 rounded-md px-2.5 py-2 text-xs">
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate font-medium" style={{ color: d.color }}>
          {d.label}
        </span>
        {blessed ? (
          <span className="shrink-0 text-xs text-muted-foreground">
            This Device
          </span>
        ) : !d.visible ? (
          <span className="shrink-0 text-xs text-muted-foreground">hidden</span>
        ) : null}
      </div>
      <div className="font-mono leading-5 text-muted-foreground">
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
    </div>
  );
}

/** The apparent-size comparison sentence + probe verdict for one device. */
function CompareBody({
  d,
  thisDevice,
  fontPx,
  refH,
  showBands,
}: {
  d: Device;
  thisDevice: Device;
  fontPx: number;
  refH: number;
  showBands: boolean;
}) {
  const r = apparentWidthRatio(d, thisDevice);
  const pct = Math.round(r * 100);
  const arcmin = contentPxToArcmin(fontPx, refH, d);
  return (
    <>
      <p className="mt-0.5 leading-4.5 text-muted-foreground">
        {r > 1.03 ? (
          <>
            Appears{" "}
            <span className="text-foreground">{r.toFixed(1)}× larger</span>{" "}
            than on your screen
          </>
        ) : r < 0.97 ? (
          <>
            Appears <span className="text-foreground">{pct}%</span> of the
            size on your screen
          </>
        ) : (
          <>Appears about the same size as on your screen</>
        )}
        {" — "}
        {ratioNote(r)}
      </p>
      {showBands ? (
        <p className="mt-1 flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
          <LegibilityDot arcmin={arcmin} />
          {fontPx}px @ {refH}p text ⇒ {arcmin.toFixed(0)}′{" "}
          {arcmin >= ACUITY.comfortableTextArcmin
            ? "(comfortable)"
            : arcmin >= ACUITY.minCriticalTextArcmin
              ? "(marginal)"
              : "(too small)"}
        </p>
      ) : null}
    </>
  );
}

export function PerceptionReportPanel() {
  const thisDevice = useDeviceStore((s) => s.thisDevice);
  const devices = useDeviceStore((s) => s.devices);
  const showBands = useSettingsStore((s) => s.showLegibilityBands);
  const unit = useSettingsStore((s) => s.unit);
  const [fontPx, setFontPx] = useState(24);
  const [refH, setRefH] = useState(1080);
  const items = useMediaStore((s) => s.items);
  const activeId = useMediaStore((s) => s.activeId);
  const removeBox = useMediaStore((s) => s.removeBox);
  const selectedBoxId = useAnnotationStore((s) => s.selectedBoxId);
  const selectBox = useAnnotationStore((s) => s.selectBox);
  const activeItem = items.find((i) => i.id === activeId) ?? null;

  // Miller column 1 selection: "all" (default) · "mine" · a device id.
  const [column, setColumn] = useState<"all" | "mine" | string>("all");
  const pickedDevice =
    column !== "all" && column !== "mine"
      ? (devices.find((d) => d.id === column) ?? null)
      : null;
  const mode = pickedDevice ? "device" : column === "mine" ? "mine" : "all";

  const hostArcmin = useMemo(
    () => contentPxToArcmin(fontPx, refH, thisDevice),
    [fontPx, refH, thisDevice],
  );

  /** Which devices annotate each measured box's verdict row. */
  const boxDevices =
    mode === "device" && pickedDevice
      ? [pickedDevice]
      : mode === "mine"
        ? [thisDevice]
        : [
            ...(thisDevice.visible ? [thisDevice] : []),
            ...devices.filter((d) => d.visible),
          ];

  const colItem = (
    key: "all" | "mine" | string,
    label: string,
    color?: string,
    hidden?: boolean,
  ) => (
    <button
      key={key}
      type="button"
      className={cn(
        "flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs transition-colors",
        column === key
          ? "panel-inset ring-1 ring-ring ring-inset"
          : "hover:bg-muted/50",
      )}
      onClick={() => setColumn(key)}
    >
      {color ? (
        <span
          className="size-2 shrink-0 rounded-full"
          style={{ background: color }}
        />
      ) : null}
      <span className="min-w-0 flex-1 truncate" style={{ color }}>
        {label}
      </span>
      {hidden ? (
        <span className="shrink-0 text-xs text-muted-foreground/70">
          hidden
        </span>
      ) : null}
    </button>
  );

  return (
    <FloatingPanel
      id="report"
      title="Perception Report"
      icon={GaugeIcon}
      defaultPosition={{ x: 760, y: 16 }}
      width={560}
      maxWidth="none"
      resizableHeight
    >
      <div
        className="grid h-full max-h-[calc(100vh-8rem)]"
        style={{ gridTemplateColumns: "150px minmax(0, 1fr)" }}
      >
        {/* Miller column 1: All Devices · My Device · every project
            device, hidden ones included (plan 6.2/6.3). */}
        <div className="min-h-0 space-y-0.5 overflow-y-auto border-r border-border p-1.5">
          {colItem("all", "All Devices")}
          {colItem("mine", "My Device", thisDevice.color)}
          <div className="mx-2 my-1 border-t border-border" />
          {devices.map((d) => colItem(d.id, d.label, d.color, !d.visible))}
        </div>

        {/* Column 2 narrows to the selection. */}
        <div className="min-h-0 space-y-2.5 overflow-y-auto p-2.5">
          {mode === "all" ? (
            <>
              <p className="text-xs leading-4.5 text-muted-foreground">
                What you see on{" "}
                <span className="text-foreground">{thisDevice.label}</span> at{" "}
                {formatDistance(thisDevice.distanceCm, unit)} is not what
                people see elsewhere. Relative to your view:
              </p>
              {devices.length === 0 ? (
                <p className="panel-inset rounded-md px-2.5 py-2 text-xs text-muted-foreground">
                  No test devices yet. Add some in the Device Manager.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {devices.map((d) => (
                    <li
                      key={d.id}
                      className="panel-inset cursor-pointer rounded-md px-2.5 py-2 text-xs"
                      onClick={() => setColumn(d.id)}
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span
                          className="truncate font-medium"
                          style={{ color: d.color }}
                        >
                          {d.label}
                          {!d.visible ? (
                            <span className="ml-1.5 font-normal text-muted-foreground/70">
                              hidden
                            </span>
                          ) : null}
                        </span>
                        <span className="shrink-0 font-mono text-xs text-muted-foreground">
                          {formatDistance(d.distanceCm, unit)}
                        </span>
                      </div>
                      <CompareBody
                        d={d}
                        thisDevice={thisDevice}
                        fontPx={fontPx}
                        refH={refH}
                        showBands={showBands}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : mode === "mine" ? (
            <>
              <SpecCard d={thisDevice} blessed />
              <p className="text-xs leading-4.5 text-muted-foreground">
                This Device anchors the vision model: every comparison and
                arc-minute verdict is computed relative to how content
                subtends from here.
              </p>
              {showBands ? (
                <p className="font-mono text-xs text-muted-foreground">
                  Probe text here: {hostArcmin.toFixed(0)}′.
                </p>
              ) : null}
            </>
          ) : pickedDevice ? (
            <>
              {/* The selected device's details NEXT TO the blessed
                  baseline (plan 6.5). */}
              <div className="grid grid-cols-2 gap-1.5">
                <SpecCard d={thisDevice} blessed />
                <SpecCard d={pickedDevice} />
              </div>
              <div className="panel-inset rounded-md px-2.5 py-2 text-xs">
                <CompareBody
                  d={pickedDevice}
                  thisDevice={thisDevice}
                  fontPx={fontPx}
                  refH={refH}
                  showBands={showBands}
                />
              </div>
            </>
          ) : null}

          {activeItem && (activeItem.boxes?.length ?? 0) > 0 ? (
            <div className="space-y-1.5">
              <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Measured boxes · {activeItem.name}
              </span>
              <ul className="space-y-1.5">
                {activeItem.boxes!.map((b, idx) => {
                  const srcW = Math.round(b.w * activeItem.width);
                  const srcH = Math.round(b.h * activeItem.height);
                  const refPx = Math.round(b.h * activeItem.referenceHeight);
                  return (
                    <li
                      key={b.id}
                      className={cn(
                        "panel-inset cursor-pointer rounded-md px-2.5 py-1.5 text-xs transition-shadow",
                        b.id === selectedBoxId && "ring-1 ring-ring",
                      )}
                      onClick={() =>
                        selectBox(b.id === selectedBoxId ? null : b.id)
                      }
                    >
                      <div className="flex items-center justify-between gap-2">
                        {/* OCR-sourced boxes are named by what they say
                            (plan 6.4); hand-drawn ones stay "Box N". */}
                        <span
                          className="min-w-0 flex-1 truncate font-medium"
                          title={b.label}
                        >
                          {b.label?.trim() || `Box ${idx + 1}`}
                        </span>
                        <span className="font-mono text-xs text-muted-foreground">
                          {srcW}×{srcH}px src
                          {activeItem.referenceHeight !== activeItem.height
                            ? ` · ${refPx}px @ ${activeItem.referenceHeight}p`
                            : ""}
                        </span>
                        <button
                          type="button"
                          aria-label={`Remove box ${idx + 1}`}
                          className="text-muted-foreground transition-colors hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeBox(activeItem.id, b.id);
                            if (b.id === selectedBoxId) selectBox(null);
                          }}
                        >
                          <Trash2Icon className="size-3" />
                        </button>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                        {boxDevices.map((d) => {
                          const m = boxMetricsOnDevice(b.h, activeItem, d);
                          return (
                            <span
                              key={d.id}
                              className="flex items-center gap-1 font-mono text-xs text-muted-foreground"
                              title={`${d.label}: ${m.mm.toFixed(1)}mm tall, ${Math.round(m.devicePx)}px`}
                            >
                              <LegibilityDot arcmin={m.arcmin} />
                              <span
                                className="max-w-20 truncate"
                                style={{ color: d.color }}
                              >
                                {d.label}
                              </span>
                              {m.arcmin.toFixed(0)}′
                            </span>
                          );
                        })}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}

          {showBands ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
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
                  <span className="text-xs text-muted-foreground">px @</span>
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
                  <span className="text-xs text-muted-foreground">p</span>
                </div>
              </div>
              <p className="font-mono text-xs text-muted-foreground">
                On your screen: {hostArcmin.toFixed(0)}′. Bands per ISO
                9241-303 (cap height): ≥16′ minimum, ≥20′ comfortable.
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </FloatingPanel>
  );
}
