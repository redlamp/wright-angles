"use client";

import { useMemo, useState } from "react";
import {
  ChevronDownIcon,
  EyeIcon,
  EyeOffIcon,
  MonitorIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Device } from "@/lib/types";
import {
  COMMON_ASPECTS,
  COMMON_RESOLUTIONS,
  DEVICE_PRESETS,
} from "@/lib/presets";
import { aspectFromResolution, deviceAngles } from "@/lib/display-math";
import { displayLength } from "@/lib/units";
import { CM_PER_IN } from "@/lib/display-math";
import { useDeviceStore } from "@/stores/device-store";
import { useSettingsStore } from "@/stores/settings-store";
import { FloatingPanel } from "./floating-panel";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** Distance slider bounds (cm). */
const DIST_MIN = 10;
const DIST_MAX = 400;

function DistanceControl({
  device,
  onChange,
}: {
  device: Device;
  onChange: (distanceCm: number) => void;
}) {
  const unit = useSettingsStore((s) => s.unit);
  const shown =
    unit === "cm"
      ? Math.round(device.distanceCm)
      : Math.round((device.distanceCm / CM_PER_IN) * 10) / 10;
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <Slider
        className="min-w-10 flex-1"
        min={DIST_MIN}
        max={DIST_MAX}
        step={1}
        value={device.distanceCm}
        onValueChange={(v) => onChange(Array.isArray(v) ? v[0] : v)}
      />
      <span className="w-14 shrink-0 text-right font-mono text-xs text-muted-foreground">
        {shown} {unit}
      </span>
    </div>
  );
}

/** Arcmin/PPD readout — the rosetta stone, always visible while editing. */
function AngleReadout({ device }: { device: Device }) {
  const a = useMemo(() => deviceAngles(device), [device]);
  return (
    <div className="panel-inset rounded-md px-2.5 py-1.5 font-mono text-[10px] leading-4 text-muted-foreground">
      <div>
        {a.horizontalArcmin.toFixed(0)}′ × {a.verticalArcmin.toFixed(0)}′ (
        {a.horizontalDeg.toFixed(1)}° × {a.verticalDeg.toFixed(1)}°)
      </div>
      <div>
        {a.ppd.toFixed(1)} px/° · {a.arcminPerPx.toFixed(2)}′/px ·{" "}
        {a.ppi.toFixed(0)} ppi
      </div>
    </div>
  );
}

function DeviceEditor({
  device,
  onPatch,
  onRemove,
}: {
  device: Device;
  onPatch: (patch: Partial<Device>) => void;
  onRemove?: () => void;
}) {
  const unit = useSettingsStore((s) => s.unit);
  const aspectLabel = `${device.aspect.w}:${device.aspect.h}`;
  const sizeShown =
    Math.round(displayLength(device.diagonalIn, "in", unit) * 10) / 10;

  return (
    <div className="space-y-2 px-2.5 pt-1 pb-2.5">
      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
            Label
          </span>
          <Input
            className="h-7 text-sm"
            value={device.label}
            onChange={(e) => onPatch({ label: e.target.value })}
          />
        </label>
        <label className="space-y-1">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
            Device name
          </span>
          <Input
            className="h-7 text-sm"
            placeholder="e.g. LG C3"
            value={device.deviceName ?? ""}
            onChange={(e) => onPatch({ deviceName: e.target.value })}
          />
        </label>
      </div>

      <div className="space-y-1">
        <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
          Display size ({unit === "in" ? "diagonal in" : "diagonal cm"})
        </span>
        <div className="flex items-center gap-2">
          <Slider
            className="flex-1"
            min={3}
            max={150}
            step={0.1}
            value={device.diagonalIn}
            onValueChange={(v) =>
              onPatch({ diagonalIn: Array.isArray(v) ? v[0] : v })
            }
          />
          <Input
            className="h-7 w-16 text-right font-mono text-xs"
            type="number"
            step={0.1}
            value={sizeShown}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (!Number.isFinite(n) || n <= 0) return;
              onPatch({ diagonalIn: unit === "in" ? n : n / CM_PER_IN });
            }}
          />
        </div>
      </div>

      <div className="space-y-1">
        <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
          Dimensions
        </span>
        <div className="flex items-center gap-2">
          <Select
            value={aspectLabel}
            onValueChange={(v) => {
              const found = COMMON_ASPECTS.find((a) => a.label === v);
              if (found) onPatch({ aspect: { w: found.w, h: found.h } });
            }}
          >
            <SelectTrigger size="sm" className="w-20 shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COMMON_ASPECTS.map((a) => (
                <SelectItem key={a.label} value={a.label}>
                  {a.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            className="h-7 flex-1 text-right font-mono text-xs"
            type="number"
            aria-label="Width px"
            value={device.resolution.w}
            onChange={(e) => {
              const w = Number(e.target.value);
              if (!Number.isInteger(w) || w <= 0) return;
              onPatch({ resolution: { ...device.resolution, w } });
            }}
          />
          <span className="text-xs text-muted-foreground">×</span>
          <Input
            className="h-7 flex-1 text-right font-mono text-xs"
            type="number"
            aria-label="Height px"
            value={device.resolution.h}
            onChange={(e) => {
              const h = Number(e.target.value);
              if (!Number.isInteger(h) || h <= 0) return;
              onPatch({ resolution: { ...device.resolution, h } });
            }}
          />
        </div>
        {COMMON_RESOLUTIONS[aspectLabel] ? (
          <div className="flex flex-wrap gap-1 pt-0.5">
            {COMMON_RESOLUTIONS[aspectLabel].map((r) => (
              <button
                key={`${r.w}x${r.h}`}
                type="button"
                className={cn(
                  "rounded-md px-1.5 py-0.5 font-mono text-[10px] transition-colors",
                  r.w === device.resolution.w && r.h === device.resolution.h
                    ? "bg-foreground text-background"
                    : "bg-muted text-muted-foreground hover:text-foreground",
                )}
                onClick={() =>
                  onPatch({
                    resolution: { w: r.w, h: r.h },
                    aspect: aspectFromResolution({ w: r.w, h: r.h }),
                  })
                }
              >
                {r.w}×{r.h}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="flex items-end justify-between gap-2">
        <label className="space-y-1">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
            Key color
          </span>
          <input
            type="color"
            className="block h-7 w-12 cursor-pointer rounded-md border border-input bg-transparent p-0.5"
            value={device.color}
            onChange={(e) => onPatch({ color: e.target.value })}
          />
        </label>
        {onRemove ? (
          <button
            type="button"
            className="flex h-7 items-center gap-1.5 rounded-md px-2 text-xs text-destructive transition-colors hover:bg-destructive/10"
            onClick={onRemove}
          >
            <Trash2Icon className="size-3.5" /> Delete
          </button>
        ) : null}
      </div>

      <AngleReadout device={device} />
    </div>
  );
}

function DeviceRow({
  device,
  isThisDevice,
  onPatch,
  onRemove,
  onToggleVisible,
}: {
  device: Device;
  isThisDevice?: boolean;
  onPatch: (patch: Partial<Device>) => void;
  onRemove?: () => void;
  onToggleVisible: () => void;
}) {
  const [expanded, setExpanded] = useState(isThisDevice ?? false);

  return (
    <div className="relative">
      {/* Key-color keyline, Photoshop-layers style. */}
      <div
        className="absolute top-1 bottom-1 left-0 w-0.5 rounded-full"
        style={{ background: device.color }}
      />
      <div className="flex h-8 items-center gap-1.5 pr-1.5 pl-2">
        <button
          type="button"
          aria-label={device.visible ? "Hide device" : "Show device"}
          className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          onClick={onToggleVisible}
        >
          {device.visible ? (
            <EyeIcon className="size-3.5" />
          ) : (
            <EyeOffIcon className="size-3.5 opacity-50" />
          )}
        </button>
        <button
          type="button"
          className={cn(
            "min-w-0 shrink-0 truncate text-left text-sm",
            !device.visible && "text-muted-foreground",
          )}
          style={{ maxWidth: "9rem" }}
          onClick={() => setExpanded((v) => !v)}
          title={device.deviceName || device.label}
        >
          {device.label}
        </button>
        <DistanceControl
          device={device}
          onChange={(distanceCm) => onPatch({ distanceCm })}
        />
        <button
          type="button"
          aria-label={expanded ? "Collapse" : "Expand"}
          className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          onClick={() => setExpanded((v) => !v)}
        >
          <ChevronDownIcon
            className={cn(
              "size-3.5 transition-transform",
              expanded && "rotate-180",
            )}
          />
        </button>
      </div>
      {expanded ? (
        <DeviceEditor device={device} onPatch={onPatch} onRemove={onRemove} />
      ) : null}
    </div>
  );
}

const CATEGORY_LABELS: Record<string, string> = {
  handheld: "Handhelds",
  phone: "Phones",
  tablet: "Tablets",
  monitor: "Monitors",
  tv: "TVs",
  projector: "Projectors",
  custom: "Generic",
};

function AddDeviceMenu() {
  const addFromPreset = useDeviceStore((s) => s.addFromPreset);
  const groups = useMemo(() => {
    const order = [
      "handheld",
      "phone",
      "tablet",
      "monitor",
      "tv",
      "projector",
      "custom",
    ];
    return order
      .map((cat) => ({
        cat,
        presets: DEVICE_PRESETS.filter((p) => p.category === cat),
      }))
      .filter((g) => g.presets.length > 0);
  }, []);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="ctl-quiet flex w-full items-center justify-center gap-1.5 text-xs">
        <PlusIcon className="size-3.5" /> Add device
      </DropdownMenuTrigger>
      <DropdownMenuContent className="max-h-96 w-56 overflow-y-auto">
        {groups.map((g, i) => (
          <DropdownMenuGroup key={g.cat}>
            {i > 0 ? <DropdownMenuSeparator /> : null}
            <DropdownMenuLabel className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {CATEGORY_LABELS[g.cat]}
            </DropdownMenuLabel>
            {g.presets.map((p) => (
              <DropdownMenuItem
                key={p.presetId}
                onClick={() => addFromPreset(p)}
              >
                <span className="flex-1">{p.label}</span>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {p.resolution.w}×{p.resolution.h}
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function DeviceManagerPanel() {
  const thisDevice = useDeviceStore((s) => s.thisDevice);
  const devices = useDeviceStore((s) => s.devices);
  const updateThisDevice = useDeviceStore((s) => s.updateThisDevice);
  const updateDevice = useDeviceStore((s) => s.updateDevice);
  const removeDevice = useDeviceStore((s) => s.removeDevice);
  const toggleVisible = useDeviceStore((s) => s.toggleVisible);

  return (
    <FloatingPanel
      id="devices"
      title="Device Manager"
      icon={MonitorIcon}
      defaultPosition={{ x: 64, y: 16 }}
      width={340}
    >
      <div className="max-h-[calc(100vh-8rem)] overflow-y-auto">
        <div className="px-2.5 pt-2 pb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          This device
        </div>
        <DeviceRow
          device={thisDevice}
          isThisDevice
          onPatch={updateThisDevice}
          onToggleVisible={() =>
            updateThisDevice({ visible: !thisDevice.visible })
          }
        />
        <div className="mt-1 border-t border-border px-2.5 pt-2 pb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Test devices
        </div>
        <div className="divide-y divide-border/50">
          {devices.map((d) => (
            <DeviceRow
              key={d.id}
              device={d}
              onPatch={(patch) => updateDevice(d.id, patch)}
              onRemove={() => removeDevice(d.id)}
              onToggleVisible={() => toggleVisible(d.id)}
            />
          ))}
        </div>
        <div className="p-2.5">
          <AddDeviceMenu />
        </div>
      </div>
    </FloatingPanel>
  );
}
