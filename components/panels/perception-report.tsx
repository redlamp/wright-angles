"use client";

import { useMemo, useState } from "react";
import { GaugeIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Device } from "@/lib/types";
import {
  ACUITY,
  apparentWidthRatio,
  contentPxToArcmin,
} from "@/lib/display-math";
import { useDeviceStore } from "@/stores/device-store";
import { useSettingsStore } from "@/stores/settings-store";
import { FloatingPanel } from "./floating-panel";
import { NumberStepper } from "@/components/number-stepper";

/**
 * The product's thesis, in words: what fits comfortably on the screen
 * you're designing at will read very differently everywhere else.
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

export function PerceptionReportPanel() {
  const thisDevice = useDeviceStore((s) => s.thisDevice);
  const devices = useDeviceStore((s) => s.devices);
  const showBands = useSettingsStore((s) => s.showLegibilityBands);
  const [fontPx, setFontPx] = useState(24);
  const [refH, setRefH] = useState(1080);

  const visible = devices.filter((d) => d.visible);
  const hostArcmin = useMemo(
    () => contentPxToArcmin(fontPx, refH, thisDevice),
    [fontPx, refH, thisDevice],
  );

  return (
    <FloatingPanel
      id="report"
      title="Perception Report"
      icon={GaugeIcon}
      defaultPosition={{ x: 760, y: 16 }}
      width={340}
    >
      <div className="max-h-[calc(100vh-8rem)] space-y-2.5 overflow-y-auto p-2.5">
        <p className="text-xs leading-4.5 text-muted-foreground">
          What you see on{" "}
          <span className="text-foreground">{thisDevice.label}</span> at{" "}
          {Math.round(thisDevice.distanceCm)} cm is not what people see
          elsewhere. Relative to your view:
        </p>

        {visible.length === 0 ? (
          <p className="panel-inset rounded-md px-2.5 py-2 text-xs text-muted-foreground">
            No visible test devices. Toggle some on in the Device Manager.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {visible.map((d) => {
              const r = apparentWidthRatio(d, thisDevice);
              const pct = Math.round(r * 100);
              const arcmin = contentPxToArcmin(fontPx, refH, d);
              return (
                <li
                  key={d.id}
                  className="panel-inset rounded-md px-2.5 py-2 text-xs"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span
                      className="truncate font-medium"
                      style={{ color: d.color }}
                    >
                      {d.label}
                    </span>
                    <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                      {Math.round(d.distanceCm)} cm
                    </span>
                  </div>
                  <p className="mt-0.5 leading-4.5 text-muted-foreground">
                    {r > 1.03 ? (
                      <>
                        Appears{" "}
                        <span className="text-foreground">
                          {r.toFixed(1)}× larger
                        </span>{" "}
                        than on your screen
                      </>
                    ) : r < 0.97 ? (
                      <>
                        Appears{" "}
                        <span className="text-foreground">{pct}%</span> of the
                        size on your screen
                      </>
                    ) : (
                      <>Appears about the same size as on your screen</>
                    )}
                    {" — "}
                    {ratioNote(r)}
                  </p>
                  {showBands ? (
                    <p className="mt-1 flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
                      <LegibilityDot arcmin={arcmin} />
                      {fontPx}px @ {refH}p text ⇒ {arcmin.toFixed(0)}′{" "}
                      {arcmin >= ACUITY.comfortableTextArcmin
                        ? "(comfortable)"
                        : arcmin >= ACUITY.minCriticalTextArcmin
                          ? "(marginal)"
                          : "(too small)"}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}

        {showBands ? (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
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
                <span className="text-[10px] text-muted-foreground">px @</span>
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
                <span className="text-[10px] text-muted-foreground">p</span>
              </div>
            </div>
            <p className="font-mono text-[10px] text-muted-foreground">
              On your screen: {hostArcmin.toFixed(0)}′. Bands per ISO
              9241-303: ≥16′ minimum, ≥20′ comfortable.
            </p>
          </div>
        ) : null}
      </div>
    </FloatingPanel>
  );
}

function ratioNote(r: number): string {
  if (r > 1.03)
    return "designs will feel roomier there; check overwhelm at close range.";
  if (r < 0.5)
    return "less than half your apparent size; small text will not survive.";
  if (r < 0.97)
    return "fine details you can read here may vanish there.";
  return "a rare case where your screen tells the truth.";
}
