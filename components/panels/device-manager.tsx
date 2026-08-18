"use client";

import { useMemo, useRef, useState } from "react";
import {
  CopyIcon,
  CornerDownRightIcon,
  EllipsisVerticalIcon,
  EyeIcon,
  EyeOffIcon,
  PinIcon,
  PlusIcon,
  RotateCwSquareIcon,
  Trash2Icon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Device } from "@/lib/types";
import {
  COMMON_ASPECTS,
  COMMON_RESOLUTIONS,
  DEVICE_PRESETS,
  HANDHELD_BODIES,
} from "@/lib/presets";
import {
  CM_PER_IN,
  aspectFromResolution,
  deviceAngles,
  distToSlider,
  sliderToDist,
} from "@/lib/display-math";
import { useDeviceStore } from "@/stores/device-store";
import { useSettingsStore } from "@/stores/settings-store";
import { useUiStore } from "@/stores/ui-store";
import { SCENARIOS, useViewerStore } from "@/stores/viewer-store";
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
import { SplitGrid } from "./split-grid";

const DIST_MIN_CM = 10;
const DIST_MAX_CM = 9999;
const DIST_SLIDER_MAX_CM = 400;

/**
 * Shared collapsed-row grid so every stepper is aligned no matter how
 * long the device name is: eye | color | name | distance | chevron.
 */
const ROW_GRID =
  "grid grid-cols-[1.75rem_1.5rem_minmax(0,1fr)_6rem_1.75rem] items-center gap-1.5";

function Microlabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
      {children}
    </span>
  );
}

/**
 * Distance in the global unit, 4-character budget: integers from 100 up
 * (to 9999cm), one decimal below.
 */
function DistanceStepper({
  distanceCm,
  onChange,
}: {
  distanceCm: number;
  onChange: (cm: number) => void;
}) {
  const unit = useSettingsStore((s) => s.unit);
  const inches = unit === "in";
  const shown = inches ? distanceCm / CM_PER_IN : distanceCm;
  return (
    <NumberStepper
      ariaLabel="viewing distance"
      value={shown}
      onChange={(v) => onChange(inches ? v * CM_PER_IN : v)}
      step={inches ? 0.5 : 1}
      bigStep={inches ? 5 : 10}
      min={inches ? DIST_MIN_CM / CM_PER_IN : DIST_MIN_CM}
      max={inches ? DIST_MAX_CM / CM_PER_IN : DIST_MAX_CM}
      decimals={shown >= 100 ? 0 : 1}
      className="h-7"
    />
  );
}

/** Inline flip for the global distance unit. */
function DistanceUnitFlip() {
  const unit = useSettingsStore((s) => s.unit);
  const setUnit = useSettingsStore((s) => s.setUnit);
  return <UnitFlip value={unit} onChange={setUnit} />;
}

/** Tiny in/cm switcher inline with a section label. */
function UnitFlip({
  value,
  onChange,
}: {
  value: "in" | "cm";
  onChange: (u: "in" | "cm") => void;
}) {
  return (
    <span className="flex items-center gap-0.5">
      {(["in", "cm"] as const).map((u) => (
        <button
          key={u}
          type="button"
          className={cn(
            "rounded px-1.5 py-0.5 text-sm transition-colors",
            u === value
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:text-foreground",
          )}
          onClick={() => onChange(u)}
        >
          {u}
        </button>
      ))}
    </span>
  );
}

/** Live angular readout — the arcmin rosetta stone, plus px guidance. */
function AngleReadout({ device }: { device: Device }) {
  const showBands = useSettingsStore((s) => s.showLegibilityBands);
  const a = useMemo(() => deviceAngles(device), [device]);
  const pxFor = (arcmin: number) =>
    a.arcminPerPx > 0 ? Math.ceil(arcmin / a.arcminPerPx) : 0;
  return (
    <div className="panel-inset space-y-0.5 rounded-md px-2.5 py-2 font-mono text-sm leading-5 text-muted-foreground">
      <div>
        {a.horizontalArcmin.toFixed(0)}′ × {a.verticalArcmin.toFixed(0)}′ (
        {a.horizontalDeg.toFixed(1)}° × {a.verticalDeg.toFixed(1)}°)
      </div>
      <div>
        {a.ppd.toFixed(1)} px/° · {a.arcminPerPx.toFixed(2)}′/px ·{" "}
        {a.ppi.toFixed(0)} ppi
        {a.ppd < 60 ? (
          <span
            className="text-[#f5a524]"
            title="Below the ~60 PPD retina threshold — pixels are resolvable at this distance"
          >
            {" "}
            · sub-retina
          </span>
        ) : null}
      </div>
      {showBands ? (
        <div className="border-t border-border pt-1">
          text: ≥{pxFor(16)}px min (16′) · ≥{pxFor(20)}px comfy (20′)
        </div>
      ) : null}
    </div>
  );
}

export function DeviceEditor({
  device,
  onPatch,
  onRemove,
  onDuplicate,
}: {
  device: Device;
  onPatch: (patch: Partial<Device>) => void;
  onRemove?: () => void;
  onDuplicate?: () => void;
}) {
  const sizeUnit = useSettingsStore((s) => s.sizeUnit);
  const setSizeUnit = useSettingsStore((s) => s.setSizeUnit);
  const scenario = useViewerStore((s) => s.scenario);
  const heightCm = useViewerStore((s) => s.heightCm);
  const sizeInches = sizeUnit === "in";
  // Show the conventional name for the ratio (within tolerance — phone
  // panels like 2622×1206 are a hair off exact 19.5:9), else the ratio
  // itself, never raw pixel pairs.
  const ratio = device.aspect.w / device.aspect.h;
  const aspectMatch = COMMON_ASPECTS.find(
    (a) => Math.abs(a.w / a.h - ratio) < 0.01,
  );
  const aspectLabel = aspectMatch
    ? aspectMatch.label
    : `${ratio.toFixed(2)}:1`;
  const scenarioLabel =
    SCENARIOS.find((s) => s.id === scenario)?.label ?? scenario;
  const elevation = device.elevation?.[scenario];
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _hc = heightCm; // keeps the editor reactive to height changes
  const sizeShown = sizeInches
    ? device.diagonalIn
    : device.diagonalIn * CM_PER_IN;

  return (
    <div className="space-y-3 px-2.5 pt-2 pb-3">
      {/* Name and Label stack on their own lines (Taylor 2026-08-17). */}
      <div className="grid grid-cols-1 gap-2">
        <label className="min-w-0 space-y-1">
          <Microlabel>Device name</Microlabel>
          <Input
            className="w-full min-w-0"
            placeholder="e.g. LG C3"
            value={device.deviceName ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              // Mirror into the label until the label is customized.
              const mirrored =
                !device.label || device.label === device.deviceName;
              onPatch({
                deviceName: v,
                ...(mirrored ? { label: v } : {}),
              });
            }}
          />
        </label>
        <label className="min-w-0 space-y-1">
          <Microlabel>Label</Microlabel>
          <Input
            className="w-full min-w-0"
            value={device.label}
            onChange={(e) => onPatch({ label: e.target.value })}
          />
        </label>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Microlabel>Display size · diagonal</Microlabel>
          <UnitFlip value={sizeUnit} onChange={setSizeUnit} />
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_6rem] items-center gap-2">
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
            value={sizeShown}
            onChange={(v) =>
              onPatch({ diagonalIn: sizeInches ? v : v / CM_PER_IN })
            }
            step={sizeInches ? 0.1 : 0.5}
            bigStep={sizeInches ? 1 : 5}
            min={1}
            max={sizeInches ? 300 : 999}
            decimals={sizeShown >= 100 ? 0 : 1}
            className="h-7"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Microlabel>Viewing distance</Microlabel>
          <DistanceUnitFlip />
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_6rem] items-center gap-2">
          {/* Log-spaced track: handheld/desk distances get as much
              travel as TV/projector ones. Distances past the slider
              max (stepper goes to 9999) pin the thumb at 1. */}
          <Slider
            min={0}
            max={1}
            step={0.001}
            value={distToSlider(
              device.distanceCm,
              DIST_MIN_CM,
              DIST_SLIDER_MAX_CM,
            )}
            onValueChange={(v) =>
              onPatch({
                distanceCm: Math.round(
                  sliderToDist(
                    Array.isArray(v) ? v[0] : v,
                    DIST_MIN_CM,
                    DIST_SLIDER_MAX_CM,
                  ),
                ),
              })
            }
          />
          <DistanceStepper
            distanceCm={device.distanceCm}
            onChange={(distanceCm) => onPatch({ distanceCm })}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Microlabel>Dimensions</Microlabel>
        <div className="flex items-center gap-1.5">
          <Select
            value={aspectLabel}
            onValueChange={(v) => {
              const found = COMMON_ASPECTS.find((a) => a.label === v);
              if (found) onPatch({ aspect: { w: found.w, h: found.h } });
            }}
          >
            <SelectTrigger className="w-22 shrink-0">
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
            className="min-w-0 flex-1 text-right font-mono"
            type="number"
            aria-label="Width px"
            value={device.resolution.w}
            onChange={(e) => {
              const w = Number(e.target.value);
              if (!Number.isInteger(w) || w <= 0) return;
              onPatch({ resolution: { ...device.resolution, w } });
            }}
          />
          <span className="text-base text-muted-foreground">×</span>
          <Input
            className="min-w-0 flex-1 text-right font-mono"
            type="number"
            aria-label="Height px"
            value={device.resolution.h}
            onChange={(e) => {
              const h = Number(e.target.value);
              if (!Number.isInteger(h) || h <= 0) return;
              onPatch({ resolution: { ...device.resolution, h } });
            }}
          />
          <Button
            variant="ghost"
            size="xs"
            className="shrink-0"
            title="Rotate 90° — swap the panel orientation"
            aria-label="Rotate the display 90 degrees"
            onClick={() =>
              onPatch({
                resolution: {
                  w: device.resolution.h,
                  h: device.resolution.w,
                },
                aspect: { w: device.aspect.h, h: device.aspect.w },
              })
            }
          >
            <RotateCwSquareIcon className="size-4" />
          </Button>
        </div>
        {COMMON_RESOLUTIONS[aspectLabel] ? (
          <div className="flex flex-wrap gap-1 pt-0.5">
            {COMMON_RESOLUTIONS[aspectLabel].map((r) => (
              <button
                key={`${r.w}x${r.h}`}
                type="button"
                className={cn(
                  "rounded-md px-2 py-1 font-mono text-sm transition-colors",
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

      <div className="flex items-center justify-between gap-2">
        <Microlabel>Curve</Microlabel>
        <Select
          value={String(device.curvatureR ?? 0)}
          onValueChange={(v) => onPatch({ curvatureR: Number(v) || undefined })}
        >
          <SelectTrigger className="w-28">
            <SelectValue>
              {device.curvatureR ? `${device.curvatureR}R` : "Flat"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0">Flat</SelectItem>
            {[800, 1000, 1500, 1800, 2300, 3000].map((r) => (
              <SelectItem key={r} value={String(r)}>
                {r}R
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Microlabel>Screen height · {scenarioLabel.toLowerCase()}</Microlabel>
          <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
            Eye level
            <Switch
              checked={elevation === undefined}
              onCheckedChange={(on) =>
                onPatch({
                  elevation: {
                    ...device.elevation,
                    [scenario]: on
                      ? undefined
                      : Math.round(
                          // Start the override at the current eye height.
                          useViewerStore
                            .getState()
                            .heightCm && device.distanceCm
                            ? eyeLevelNow()
                            : 120,
                        ),
                  },
                })
              }
            />
          </label>
        </div>
        {elevation !== undefined ? (
          <div className="grid grid-cols-[minmax(0,1fr)_6rem] items-center gap-2">
            <Slider
              min={0}
              max={250}
              step={1}
              value={elevation}
              onValueChange={(v) =>
                onPatch({
                  elevation: {
                    ...device.elevation,
                    [scenario]: Array.isArray(v) ? v[0] : v,
                  },
                })
              }
            />
            <NumberStepper
              ariaLabel="screen height from floor"
              value={elevation}
              onChange={(v) =>
                onPatch({
                  elevation: { ...device.elevation, [scenario]: v },
                })
              }
              step={1}
              bigStep={10}
              min={0}
              max={300}
              className="h-7"
            />
          </div>
        ) : null}
      </div>

      {device.deviceName && HANDHELD_BODIES[device.deviceName] ? (
        <label className="flex h-8 items-center justify-between text-base">
          <span className="text-muted-foreground">3D device body</span>
          <Switch
            checked={device.show3dBody !== false}
            onCheckedChange={(on) =>
              onPatch({ show3dBody: on ? undefined : false })
            }
          />
        </label>
      ) : null}

      <div className="flex items-center justify-between">
        {onDuplicate ? (
          <Button
            variant="ghost"
            size="sm"
            title="Duplicate this device — the way to test one display at several distances"
            className="text-muted-foreground hover:text-foreground"
            onClick={onDuplicate}
          >
            <CopyIcon className="size-4" /> Duplicate
          </Button>
        ) : (
          <span />
        )}
        {onRemove ? (
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={onRemove}
          >
            <Trash2Icon className="size-4" /> Delete
          </Button>
        ) : null}
      </div>

      <AngleReadout device={device} />
    </div>
  );
}

function eyeLevelNow(): number {
  const { scenario, heightCm } = useViewerStore.getState();
  // Local import cycle avoidance: mirror eyeHeightCm's constants.
  switch (scenario) {
    case "standing":
      return heightCm * 0.936;
    case "desk":
      return heightCm * 0.45 + 45;
    case "couch":
      return heightCm * 0.45 + 40;
  }
}

interface ReorderHooks {
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  markerTop: boolean;
  markerBottom: boolean;
}

function DeviceRow({
  device,
  onPatch,
  onToggleVisible,
  reorder,
}: {
  device: Device;
  onPatch: (patch: Partial<Device>) => void;
  onToggleVisible: () => void;
  /** Present only for reorderable (test) devices. */
  reorder?: ReorderHooks;
}) {
  const openDetailId = useUiStore((s) => s.openDetailId);
  const pinned = useUiStore((s) => s.pinnedDetails[device.id]);
  const openDetail = useUiStore((s) => s.openDetail);
  const detailOpen = openDetailId === device.id || Boolean(pinned);
  const toggleDetail = () =>
    openDetail(openDetailId === device.id ? null : device.id);
  const [dragging, setDragging] = useState(false);

  return (
    <div
      className={cn("relative", dragging && "opacity-40")}
      onDragOver={reorder?.onDragOver}
      onDrop={reorder?.onDrop}
    >
      {/* Insert markers: where the dragged device lands on release. */}
      {reorder?.markerTop ? (
        <div className="absolute -top-px right-2 left-2 z-10 h-0.5 rounded-full bg-ring" />
      ) : null}
      {reorder?.markerBottom ? (
        <div className="absolute right-2 -bottom-px left-2 z-10 h-0.5 rounded-full bg-ring" />
      ) : null}
      <div
        className={cn(
          ROW_GRID,
          "h-10 pr-1.5 pl-2",
          detailOpen && "bg-muted/40",
        )}
      >
        <Button
          variant="ghost"
          size="icon"
          aria-label={device.visible ? "Hide device" : "Show device"}
          className="size-7 text-muted-foreground hover:text-foreground"
          onClick={onToggleVisible}
        >
          {device.visible ? (
            <EyeIcon className="size-4" />
          ) : (
            <EyeOffIcon className="size-4 opacity-50" />
          )}
        </Button>
        {/* Key color: compact swatch, native picker on click. */}
        <label
          className="relative block h-5 w-5 cursor-pointer overflow-hidden rounded-[6px] border border-border"
          title="Key color"
          style={{ background: device.color }}
        >
          <input
            type="color"
            className="absolute inset-0 cursor-pointer opacity-0"
            value={device.color}
            onChange={(e) => onPatch({ color: e.target.value })}
          />
        </label>
        <button
          type="button"
          draggable={Boolean(reorder)}
          onDragStart={
            reorder
              ? (e) => {
                  e.dataTransfer.setData(
                    "application/x-wa-device",
                    device.id,
                  );
                  e.dataTransfer.effectAllowed = "move";
                  setDragging(true);
                }
              : undefined
          }
          onDragEnd={
            reorder
              ? () => {
                  setDragging(false);
                  reorder.onDragEnd();
                }
              : undefined
          }
          className={cn(
            "min-w-0 truncate text-left text-base",
            !device.visible && "text-muted-foreground",
            reorder && "cursor-grab active:cursor-grabbing",
          )}
          onClick={toggleDetail}
          title={device.deviceName || device.label}
        >
          {device.label}
        </button>
        <DistanceStepper
          distanceCm={device.distanceCm}
          onChange={(distanceCm) => onPatch({ distanceCm })}
        />
        <Button
          variant="ghost"
          size="icon"
          aria-label={detailOpen ? "Close details" : "Open details"}
          className={cn(
            "size-7 text-muted-foreground hover:text-foreground",
            detailOpen && "text-foreground",
          )}
          onClick={toggleDetail}
        >
          <EllipsisVerticalIcon className="size-4" />
        </Button>
      </div>
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
          <Button variant="secondary" size="sm" className="w-full">
            <PlusIcon className="size-4" /> Add device
          </Button>
        }
      />
      <DropdownMenuContent className="max-h-96 w-60 overflow-y-auto">
        {groups.map((g, i) => (
          <DropdownMenuGroup key={g.cat}>
            {i > 0 ? <DropdownMenuSeparator /> : null}
            <DropdownMenuLabel className="text-sm tracking-wide text-muted-foreground uppercase">
              {CATEGORY_LABELS[g.cat]}
            </DropdownMenuLabel>
            {g.presets.map((p) => (
              <DropdownMenuItem
                key={p.presetId}
                onClick={() => addFromPreset(p)}
              >
                <span className="flex-1">{p.label}</span>
                <span className="font-mono text-sm text-muted-foreground">
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

/**
 * Selector fallback MUST be a stable module constant: an inline `?? {...}`
 * returns a fresh object every getSnapshot call, which React treats as a
 * changed store snapshot → infinite re-render loop. It only bites when the
 * stored position is unset — i.e. every brand-new visitor — which is
 * exactly how it shipped: dev machines all had stored positions, and
 * v0.3.0 crashed on load for fresh-state users (React #185).
 */
const DEFAULT_DEVICES_PANEL_POS = { x: 64, y: 16 };

/**
 * Column 2 of the Device Manager tab: the editor for the selected row
 * (This Device by default), pinnable into its own window — the old
 * floating flyout, embedded (Taylor 2026-08-17: two columns like the
 * Media Library and Perception Report).
 */
function EditorColumn() {
  const openDetailId = useUiStore((s) => s.openDetailId);
  const pinDetail = useUiStore((s) => s.pinDetail);
  const panelPos = useUiStore(
    (s) => s.panelPositions.workbench ?? DEFAULT_DEVICES_PANEL_POS,
  );
  const panelWidth = useUiStore((s) => s.panelWidths.workbench ?? 640);
  const thisDevice = useDeviceStore((s) => s.thisDevice);
  const devices = useDeviceStore((s) => s.devices);
  const updateThisDevice = useDeviceStore((s) => s.updateThisDevice);
  const updateDevice = useDeviceStore((s) => s.updateDevice);
  const removeDevice = useDeviceStore((s) => s.removeDevice);
  const duplicateDevice = useDeviceStore((s) => s.duplicateDevice);
  const openDetail = useUiStore((s) => s.openDetail);

  const device =
    (openDetailId && thisDevice.id !== openDetailId
      ? devices.find((d) => d.id === openDetailId)
      : thisDevice) ?? thisDevice;
  const isThis = device.id === thisDevice.id;

  return (
    <div className="flex min-h-0 flex-col">
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border px-2.5">
        <span
          className="size-2.5 shrink-0 rounded-full"
          style={{ background: device.color }}
        />
        <span className="min-w-0 flex-1 truncate text-base font-medium">
          {device.label}
          {isThis ? (
            <span className="ml-1.5 font-normal text-muted-foreground">
              This Device
            </span>
          ) : null}
        </span>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Pin details as a window"
          title="Pin — keep these details open and inspect another device"
          className="size-7 text-muted-foreground hover:text-foreground"
          onClick={() =>
            pinDetail(device.id, {
              x: panelPos.x + panelWidth + 8,
              y: panelPos.y,
            })
          }
        >
          <PinIcon className="size-4" />
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-x-clip overflow-y-scroll">
        <DeviceEditor
          device={device}
          onPatch={(patch) =>
            isThis ? updateThisDevice(patch) : updateDevice(device.id, patch)
          }
          onRemove={
            isThis
              ? undefined
              : () => {
                  removeDevice(device.id);
                  openDetail(null);
                }
          }
          onDuplicate={() => duplicateDevice(device.id)}
        />
      </div>
    </div>
  );
}

/** Device Manager tab content (hosted by the workbench panel). */
export function DeviceManagerContent() {
  const thisDevice = useDeviceStore((s) => s.thisDevice);
  const devices = useDeviceStore((s) => s.devices);
  const openPanel = useUiStore((s) => s.openPanel);
  const updateThisDevice = useDeviceStore((s) => s.updateThisDevice);
  const updateDevice = useDeviceStore((s) => s.updateDevice);
  const moveDevice = useDeviceStore((s) => s.moveDevice);
  const toggleVisible = useDeviceStore((s) => s.toggleVisible);
  const listRef = useRef<HTMLDivElement>(null);
  /** Where a dragged device will land on release (0..devices.length). */
  const [insertIdx, setInsertIdx] = useState<number | null>(null);

  const rowDragOver = (index: number) => (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes("application/x-wa-device")) return;
    e.preventDefault();
    const r = e.currentTarget.getBoundingClientRect();
    setInsertIdx(e.clientY < r.top + r.height / 2 ? index : index + 1);
  };
  const rowDrop = (e: React.DragEvent) => {
    const id = e.dataTransfer.getData("application/x-wa-device");
    if (id && insertIdx !== null) {
      e.preventDefault();
      const from = devices.findIndex((d) => d.id === id);
      if (from >= 0) {
        moveDevice(id, insertIdx > from ? insertIdx - 1 : insertIdx);
      }
    }
    setInsertIdx(null);
  };
  const clearMarker = () => setInsertIdx(null);

  return (
    <SplitGrid
      left={
      <div className="flex min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-x-clip overflow-y-scroll">
        <div className="px-2.5 pt-2 pb-1">
          <Microlabel>This device</Microlabel>
        </div>
        <DeviceRow
          device={thisDevice}
          onPatch={updateThisDevice}
          onToggleVisible={() =>
            updateThisDevice({ visible: !thisDevice.visible })
          }
        />
        <div className="mt-1 border-t border-border px-2.5 pt-2 pb-1">
          <Microlabel>Test devices</Microlabel>
        </div>
        <div
          ref={listRef}
          className="divide-y divide-border/50"
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
              clearMarker();
            }
          }}
        >
          {devices.map((d, i) => (
            <DeviceRow
              key={d.id}
              device={d}
              onPatch={(patch) => updateDevice(d.id, patch)}
              onToggleVisible={() => toggleVisible(d.id)}
              reorder={{
                onDragOver: rowDragOver(i),
                onDrop: rowDrop,
                onDragEnd: clearMarker,
                markerTop: insertIdx === i,
                markerBottom: i === devices.length - 1 && insertIdx === devices.length,
              }}
            />
          ))}
        </div>
      </div>
      {/* Pinned to the bottom of the column, like the report's spec
          strip: add-device plus the comparison-table link (which
          opens from here now, not the rail). */}
      <div className="shrink-0 space-y-1.5 border-t border-border p-2.5">
        <AddDeviceMenu />
        <Button
          variant="secondary"
          size="sm"
          className="w-full"
          onClick={() => openPanel("table")}
        >
          <CornerDownRightIcon className="size-4" /> Comparison Table
        </Button>
      </div>
      </div>
      }
      right={<EditorColumn />}
    />
  );
}
