"use client";

import { useMemo, useState } from "react";
import { DownloadIcon, Table2Icon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Device } from "@/lib/types";
import {
  CM_PER_IN,
  apparentWidthRatio,
  deviceAngles,
} from "@/lib/display-math";
import { useDeviceStore } from "@/stores/device-store";
import { useSettingsStore } from "@/stores/settings-store";
import { useUiStore } from "@/stores/ui-store";
import { FloatingPanel } from "./floating-panel";
import { Button } from "@/components/ui/button";

/**
 * The live version of the arc-minute spreadsheet: every device's angular
 * numbers side by side, sortable, exportable. Sub-retina PPD (<60, the
 * acuity saturation point — see wiki/research/visual-acuity-and-ppd.md)
 * is flagged in place.
 */

interface Row {
  device: Device;
  isThis: boolean;
  sizeIn: number;
  distCm: number;
  res: string;
  hDeg: number;
  vDeg: number;
  ppd: number;
  arcminPerPx: number;
  ppi: number;
  /** Apparent width vs This Device (1 = same). */
  ratio: number;
}

type SortKey =
  | "label"
  | "sizeIn"
  | "distCm"
  | "hDeg"
  | "vDeg"
  | "ppd"
  | "arcminPerPx"
  | "ppi"
  | "ratio";

const COLUMNS: { key: SortKey; label: string; title?: string }[] = [
  { key: "label", label: "Device" },
  { key: "sizeIn", label: "Size" },
  { key: "distCm", label: "Dist" },
  { key: "hDeg", label: "H°" },
  { key: "vDeg", label: "V°" },
  { key: "ppd", label: "PPD", title: "Pixels per degree; <60 is sub-retina" },
  { key: "arcminPerPx", label: "′/px" },
  { key: "ppi", label: "PPI" },
  { key: "ratio", label: "vs This", title: "Apparent width vs This Device" },
];

function ppdClass(ppd: number): string {
  if (ppd < 45) return "text-[#e5484d]";
  if (ppd < 60) return "text-[#f5a524]";
  return "";
}

export function ComparisonTablePanel() {
  const thisDevice = useDeviceStore((s) => s.thisDevice);
  const devices = useDeviceStore((s) => s.devices);
  const unit = useSettingsStore((s) => s.unit);
  const sizeUnit = useSettingsStore((s) => s.sizeUnit);
  const selectedDeviceId = useUiStore((s) => s.selectedDeviceId);
  const selectDevice = useUiStore((s) => s.selectDevice);
  const [sortKey, setSortKey] = useState<SortKey>("distCm");
  const [sortDir, setSortDir] = useState<1 | -1>(1);

  const rows = useMemo<Row[]>(() => {
    const make = (d: Device, isThis: boolean): Row => {
      const a = deviceAngles(d);
      return {
        device: d,
        isThis,
        sizeIn: d.diagonalIn,
        distCm: d.distanceCm,
        res: `${d.resolution.w}×${d.resolution.h}`,
        hDeg: a.horizontalDeg,
        vDeg: a.verticalDeg,
        ppd: a.ppd,
        arcminPerPx: a.arcminPerPx,
        ppi: a.ppi,
        ratio: apparentWidthRatio(d, thisDevice),
      };
    };
    const all = [make(thisDevice, true), ...devices.map((d) => make(d, false))];
    all.sort((a, b) => {
      if (sortKey === "label") {
        return a.device.label.localeCompare(b.device.label) * sortDir;
      }
      return (a[sortKey] - b[sortKey]) * sortDir;
    });
    return all;
  }, [thisDevice, devices, sortKey, sortDir]);

  const onSort = (key: SortKey) => {
    if (key === sortKey) setSortDir((d) => (d === 1 ? -1 : 1));
    else {
      setSortKey(key);
      setSortDir(1);
    }
  };

  const fmtSize = (v: number) =>
    sizeUnit === "in" ? `${v.toFixed(1)}″` : `${Math.round(v * CM_PER_IN)}cm`;
  const fmtDist = (cm: number) =>
    unit === "in" ? `${(cm / CM_PER_IN).toFixed(1)}″` : `${Math.round(cm)}cm`;

  const exportCsv = () => {
    const header = [
      "label",
      "device_name",
      "visible",
      "size_in",
      "distance_cm",
      "resolution",
      "curvature_r",
      "horizontal_deg",
      "vertical_deg",
      "ppd",
      "arcmin_per_px",
      "ppi",
      "apparent_width_vs_this",
    ];
    const esc = (v: string) =>
      /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
    const lines = rows.map((r) =>
      [
        esc(r.device.label),
        esc(r.device.deviceName ?? ""),
        String(r.device.visible),
        r.sizeIn.toFixed(2),
        r.distCm.toFixed(1),
        r.res,
        String(r.device.curvatureR ?? 0),
        r.hDeg.toFixed(2),
        r.vDeg.toFixed(2),
        r.ppd.toFixed(2),
        r.arcminPerPx.toFixed(4),
        r.ppi.toFixed(1),
        r.ratio.toFixed(4),
      ].join(","),
    );
    const blob = new Blob([[header.join(","), ...lines].join("\n")], {
      type: "text/csv",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `wright-angles-devices-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <FloatingPanel
      id="table"
      title="Comparison Table"
      icon={Table2Icon}
      defaultPosition={{ x: 420, y: 380 }}
      width={620}
    >
      <div className="max-h-[calc(100vh-8rem)] overflow-auto p-2.5">
        <table className="w-full border-collapse font-mono text-xs">
          <thead>
            <tr className="text-left text-muted-foreground">
              {COLUMNS.map((c) => (
                <th
                  key={c.key}
                  title={c.title}
                  className="cursor-pointer border-b border-border px-1.5 py-1.5 font-medium whitespace-nowrap select-none hover:text-foreground"
                  onClick={() => onSort(c.key)}
                >
                  {c.label}
                  {/* Constant-width slot for the sort arrow: every sortable
                      header reserves it whether sorted or not, so column
                      widths never shift when the arrow appears or moves. */}
                  <span
                    aria-hidden
                    className="inline-block w-3.5 text-center"
                  >
                    {sortKey === c.key ? (sortDir === 1 ? "↑" : "↓") : ""}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.device.id}
                className={cn(
                  "cursor-pointer border-b border-border/50 hover:bg-accent/40",
                  !r.device.visible && !r.isThis && "opacity-45",
                  r.device.id === selectedDeviceId && "bg-accent",
                )}
                onClick={() =>
                  selectDevice(
                    r.device.id === selectedDeviceId ? null : r.device.id,
                  )
                }
              >
                <td className="max-w-36 px-1.5 py-1.5">
                  <span className="flex items-center gap-1.5">
                    <span
                      className="size-2 shrink-0 rounded-[3px]"
                      style={{ background: r.device.color }}
                    />
                    <span
                      className="truncate font-sans"
                      title={r.device.deviceName || r.device.label}
                    >
                      {r.device.label}
                      {r.isThis ? " ·this" : ""}
                    </span>
                  </span>
                </td>
                <td className="px-1.5 py-1.5 whitespace-nowrap">
                  {fmtSize(r.sizeIn)}
                </td>
                <td className="px-1.5 py-1.5 whitespace-nowrap">
                  {fmtDist(r.distCm)}
                </td>
                <td className="px-1.5 py-1.5">{r.hDeg.toFixed(1)}</td>
                <td className="px-1.5 py-1.5">{r.vDeg.toFixed(1)}</td>
                <td
                  className={cn("px-1.5 py-1.5", ppdClass(r.ppd))}
                  title={
                    r.ppd < 60
                      ? "Below the ~60 PPD retina threshold — pixels are resolvable at this distance"
                      : undefined
                  }
                >
                  {r.ppd.toFixed(1)}
                  {r.ppd < 60 ? "*" : ""}
                </td>
                <td className="px-1.5 py-1.5">{r.arcminPerPx.toFixed(2)}</td>
                <td className="px-1.5 py-1.5">{Math.round(r.ppi)}</td>
                <td className="px-1.5 py-1.5 whitespace-nowrap">
                  {r.isThis ? "—" : `${Math.round(r.ratio * 100)}%`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">
            * sub-retina: under 60 PPD, individual pixels are visible.
          </span>
          <Button variant="secondary" size="sm" onClick={exportCsv}>
            <DownloadIcon className="size-4" /> CSV
          </Button>
        </div>
      </div>
    </FloatingPanel>
  );
}
