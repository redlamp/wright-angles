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
import {
  CM_PER_IN,
  aspectFromResolution,
  deviceAngles,
} from "@/lib/display-math";
import { useDeviceStore } from "@/stores/device-store";
import { useSettingsStore } from "@/stores/settings-store";
import { eyeHeightCm, useViewerStore } from "@/stores/viewer-store";
import { FloatingPanel } from "./floating-panel";
import { NumberStepper } from "@/components/number-stepper";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
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

const DIST_MIN_CM = 10;
const DIST_MAX_CM = 400;

/**
 * Shared row grid so every slider is exactly the same width no matter
 * how long the device name is: eye | name | slider | stepper | chevron.
 */
const ROW_GRID =
  "grid grid-cols-[1.5rem_6.25rem_minmax(0,1fr)_5.75rem_1.5rem] items-center gap-1.5";

function Microlabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
      {children}
    </span>
  );
}

/** Distance stepper in the display unit; canonical value stays cm. */
function DistanceStepper({
  distanceCm,
  onChange,
}: {
  distanceCm: number;
  onChange: (cm: number) => void;
}) {
  const unit = useSettingsStore((s) => s.unit);
  const inches = unit === "in";
  return (
    <NumberStepper
      ariaLabel="viewing distance"
      value={inches ? distanceCm / CM_PER_IN : distanceCm}
      onChange={(v) => onChange(inches ? v * CM_PER_IN : v)}
      step={inches ? 0.5 : 1}
      bigStep={inches ? 5 : 10}
      min={inches ? DIST_MIN_CM / CM_PER_IN : DIST_MIN_CM}
      max={inches ? DIST_MAX_CM / CM_PER_IN : DIST_MAX_CM}
      decimals={inches ? 1 : 0}
    />
  );
}

/** Live angular readout — the arcmin rosetta stone, plus px guidance. */
function AngleReadout({ device }: { device: Device }) {
  const showBands = useSettingsStore((s) => s.showLegibilityBands);
  const a = useMemo(() => deviceAngles(device), [device]);
  const pxFor = (arcmin: number) =>
    a.arcminPerPx > 0 ? Math.ceil(arcmin / a.arcminPerPx) : 0;
  return (
    <div className="panel-inset space-y-0.5 rounded-md px-2.5 py-1.5 font-mono text-[10px] leading-4 text-muted-foreground">
      <div>
        {a.horizontalArcmin.toFixed(0)}′ × {a.verticalArcmin.toFixed(0)}′ (
        {a.horizontalDeg.toFixed(1)}° × {a.verticalDeg.toFixed(1)}°)
      </div>
      <div>
        {a.ppd.toFixed(1)} px/° · {a.arcminPerPx.toFixed(2)}′/px ·{" "}
        {a.ppi.toFixed(0)} ppi
      </div>
      {showBands ? (
        <div className="border-t border-border pt-0.5">
          text: ≥{pxFor(16)}px min (16′) · ≥{pxFor(20)}px comfy (20′)
        </div>
      ) : null}
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
  const scenario = useViewerStore((s) => s.scenario);
  const heightCm = useViewerStore((s) => s.heightCm);
  const inches = unit === "in";
  const aspectLabel = `${device.aspect.w}:${device.aspect.h}`;
  const eyeCm = eyeHeightCm(scenario, heightCm);

  return (
    <div className="space-y-2.5 px-2.5 pt-1.5 pb-2.5">
      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1">
          <Microlabel>Label</Microlabel>
          <Input
            className="h-8 text-sm"
            value={device.label}
            onChange={(e) => onPatch({ label: e.target.value })}
          />
        </label>
        <label className="space-y-1">
          <Microlabel>Device name</Microlabel>
          <Input
            className="h-8 text-sm"
            placeholder="e.g. LG C3"
            value={device.deviceName ?? ""}
            onChange={(e) => onPatch({ deviceName: e.target.value })}
          />
        </label>
      </div>

      <div className="space-y-1">
        <Microlabel>Display size · diagonal {unit}</Microlabel>
        <div className="grid grid-cols-[minmax(0,1fr)_5.75rem] items-center gap-1.5">
          <Slider
            min={3}
            max={150}
            step={0.1}
            value={device.diagonalIn}
            onValueChange={(v) =>
              onPatch({ diagonalIn: Array.isArray(v) ? v[0] : v })
            }
          />
          <NumberStepper
            ariaLabel="display size"
            value={inches ? device.diagonalIn : device.diagonalIn * CM_PER_IN}
            onChange={(v) =>
              onPatch({ diagonalIn: inches ? v : v / CM_PER_IN })
            }
            step={inches ? 0.1 : 0.5}
            bigStep={inches ? 1 : 5}
            min={1}
            max={inches ? 200 : 500}
            decimals={1}
          />
        </div>
      </div>

      <div className="space-y-1">
        <Microlabel>Dimensions</Microlabel>
        <div className="flex items-center gap-1.5">
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
            className="h-8 flex-1 text-right font-mono text-xs"
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
            className="h-8 flex-1 text-right font-mono text-xs"
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

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Microlabel>Screen height · floor to center</Microlabel>
          <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            Eye level
            <Switch
              checked={device.elevationCm === undefined}
              onCheckedChange={(on) =>
                onPatch({
                  elevationCm: on ? undefined : Math.round(eyeCm),
                })
              }
            />
          </label>
        </div>
        {device.elevationCm !== undefined ? (
          <div className="grid grid-cols-[minmax(0,1fr)_5.75rem] items-center gap-1.5">
            <Slider
              min={0}
              max={250}
              step={1}
              value={device.elevationCm}
              onValueChange={(v) =>
                onPatch({ elevationCm: Array.isArray(v) ? v[0] : v })
              }
            />
            <NumberStepper
              ariaLabel="screen height from floor"
              value={device.elevationCm}
              onChange={(v) => onPatch({ elevationCm: v })}
              step={1}
              bigStep={10}
              min={0}
              max={300}
            />
          </div>
        ) : (
          <p className="text-[10px] text-muted-foreground">
            Follows the viewer&apos;s eye height ({Math.round(eyeCm)} cm) in
            the 3D scene.
          </p>
        )}
      </div>

      <div className="flex items-end justify-between gap-2">
        <label className="space-y-1">
          <Microlabel>Key color</Microlabel>
          <input
            type="color"
            className="block h-8 w-12 cursor-pointer rounded-md border border-input bg-transparent p-0.5"
            value={device.color}
            onChange={(e) => onPatch({ color: e.target.value })}
          />
        </label>
        {onRemove ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={onRemove}
          >
            <Trash2Icon className="size-3.5" /> Delete
          </Button>
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
      <div
        className="absolute top-1.5 bottom-1.5 left-0 w-0.5 rounded-full"
        style={{ background: device.color }}
      />
      <div className={cn(ROW_GRID, "h-9 pr-1.5 pl-2")}>
        <Button
          variant="ghost"
          size="icon"
          aria-label={device.visible ? "Hide device" : "Show device"}
          className="size-6 text-muted-foreground hover:text-foreground"
          onClick={onToggleVisible}
        >
          {device.visible ? (
            <EyeIcon className="size-3.5" />
          ) : (
            <EyeOffIcon className="size-3.5 opacity-50" />
          )}
        </Button>
        <button
          type="button"
          className={cn(
            "min-w-0 truncate text-left text-sm",
            !device.visible && "text-muted-foreground",
          )}
          onClick={() => setExpanded((v) => !v)}
          title={device.deviceName || device.label}
        >
          {device.label}
        </button>
        <Slider
          min={DIST_MIN_CM}
          max={DIST_MAX_CM}
          step={1}
          value={device.distanceCm}
          onValueChange={(v) =>
            onPatch({ distanceCm: Array.isArray(v) ? v[0] : v })
          }
        />
        <DistanceStepper
          distanceCm={device.distanceCm}
          onChange={(distanceCm) => onPatch({ distanceCm })}
        />
        <Button
          variant="ghost"
          size="icon"
          aria-label={expanded ? "Collapse" : "Expand"}
          className="size-6 text-muted-foreground hover:text-foreground"
          onClick={() => setExpanded((v) => !v)}
        >
          <ChevronDownIcon
            className={cn(
              "size-3.5 transition-transform",
              expanded && "rotate-180",
            )}
          />
        </Button>
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
      <DropdownMenuTrigger
        render={
          <Button variant="secondary" size="sm" className="h-8 w-full text-xs">
            <PlusIcon className="size-3.5" /> Add device
          </Button>
        }
      />
      <DropdownMenuContent className="max-h-96 w-56 overflow-y-auto">
        {groups.map((g, i) => (
          <DropdownMenuGroup key={g.cat}>
            {i > 0 ? <DropdownMenuSeparator /> : null}
            <DropdownMenuLabel className="text-[10px] tracking-wide text-muted-foreground uppercase">
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
      width={360}
    >
      <div className="max-h-[calc(100vh-8rem)] overflow-y-auto">
        <div className="px-2.5 pt-2 pb-1">
          <Microlabel>This device</Microlabel>
        </div>
        <DeviceRow
          device={thisDevice}
          isThisDevice
          onPatch={updateThisDevice}
          onToggleVisible={() =>
            updateThisDevice({ visible: !thisDevice.visible })
          }
        />
        <div className="mt-1 border-t border-border px-2.5 pt-2 pb-1">
          <Microlabel>Test devices</Microlabel>
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
