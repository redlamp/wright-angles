"use client";

import { useMemo, useRef, useState } from "react";
import {
  ChevronRightIcon,
  CopyIcon,
  CornerDownRightIcon,
  EyeIcon,
  EyeOffIcon,
  PinIcon,
  PlusIcon,
  ProportionsIcon,
  RotateCwSquareIcon,
  RulerDimensionLineIcon,
  Trash2Icon,
  TriangleAlertIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  FEATURE_3D_DEVICE_BODY,
  FEATURE_PINNED_DEVICES,
} from "@/lib/flags";
import type { Device, FitMode } from "@/lib/types";
import { FIT_MODES, fitLabel, fitModeOf, fitStretchNote } from "@/lib/fit";
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
import { useMediaStore } from "@/stores/media-store";
import { useSettingsStore } from "@/stores/settings-store";
import { useUiStore } from "@/stores/ui-store";
import { SCENARIOS, useViewerStore } from "@/stores/viewer-store";
import {
  TILT_LIMIT_DEG,
  autoOrientDefaultFor,
  autoOrientOf,
} from "@/lib/viewing-geometry";
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

/** Shared collapsed-row grid: eye | name (in the device's key color). */
const ROW_GRID =
  "grid grid-cols-[1.75rem_minmax(0,1fr)] items-center gap-1.5";

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

/**
 * Fold-away section, closed on mount. Local state, deliberately not
 * persisted — but React keeps the instance alive as you move between
 * devices, so an open section stays open while you compare them, and
 * only a fresh editor starts folded. That is the behaviour you want
 * here: nobody opens Offsets to look at exactly one device.
 */
function Collapsible({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-1 text-muted-foreground hover:text-foreground"
      >
        <ChevronRightIcon
          className={cn(
            "size-3.5 transition-transform",
            open && "rotate-90",
          )}
        />
        <Microlabel>{label}</Microlabel>
      </button>
      {open ? <div className="space-y-3 pl-4.5">{children}</div> : null}
    </div>
  );
}

/** One labelled row inside Offsets; children fill slider/value/switch. */
function StanceRow({
  label,
  active,
  children,
}: {
  label: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[4.25rem_minmax(0,1fr)_5.5rem_2.25rem] items-center gap-2">
      <span
        className={cn(
          "truncate text-sm",
          active ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {label}
      </span>
      {children}
    </div>
  );
}

/**
 * A signed offset from the eye line, shown in the viewing-distance
 * unit. Zero is dead level, so the slider is centred and the stored
 * value is dropped entirely at 0 — "level with the gaze" is the absence
 * of an offset, not an offset of nothing.
 */
const OFFSET_LIMIT_CM = 150;
function OffsetControls({
  label,
  offsetCm,
  onChange,
}: {
  label: string;
  offsetCm: number | undefined;
  onChange: (cm: number | undefined) => void;
}) {
  const unit = useSettingsStore((s) => s.unit);
  const inches = unit === "in";
  const cm = offsetCm ?? 0;
  const shown = inches ? cm / CM_PER_IN : cm;
  const limit = inches ? OFFSET_LIMIT_CM / CM_PER_IN : OFFSET_LIMIT_CM;
  const set = (v: number) => onChange(v === 0 ? undefined : v);
  return (
    <>
      {/* Not disabled at zero: dragging IS the intent to set an offset,
          so it takes effect rather than making you flip the switch. */}
      <Slider
        min={-OFFSET_LIMIT_CM}
        max={OFFSET_LIMIT_CM}
        step={1}
        value={cm}
        aria-label={`${label} screen height offset`}
        onValueChange={(v) => set(Math.round(Array.isArray(v) ? v[0] : v))}
      />
      <NumberStepper
        ariaLabel={`${label} screen height offset from eye line`}
        value={shown}
        onChange={(v) => set(Math.round(inches ? v * CM_PER_IN : v))}
        step={inches ? 0.5 : 1}
        bigStep={inches ? 5 : 10}
        min={-limit}
        max={limit}
        decimals={inches ? 1 : 0}
        signed
        className="h-7"
      />
      <Switch
        checked={offsetCm === undefined}
        aria-label={`${label} level with the eye line`}
        onCheckedChange={(on) => onChange(on ? undefined : cm || 1)}
      />
    </>
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
          text: ≥{pxFor(16)} px min (16′) · ≥{pxFor(20)} px comfy (20′)
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
  // How far the active media is distorted on this panel — null unless
  // the fit is `stretch` and the shapes actually disagree.
  const items = useMediaStore((s) => s.items);
  const activeId = useMediaStore((s) => s.activeId);
  const activeItem = items.find((i) => i.id === activeId) ?? null;
  const stretchNote = activeItem ? fitStretchNote(activeItem, device) : null;
  // Show the conventional name for the ratio (within tolerance — phone
  // panels like 2622×1206 are a hair off exact 19.5:9), else the ratio
  // itself, never raw pixel pairs. A 90°-pivoted panel reads as the
  // reversed convention: 9:16, not 0.56:1 (Taylor 2026-08-19).
  const ratio = device.aspect.w / device.aspect.h;
  const aspectMatch = COMMON_ASPECTS.find(
    (a) => Math.abs(a.w / a.h - ratio) < 0.01,
  );
  const portraitMatch = aspectMatch
    ? undefined
    : COMMON_ASPECTS.find(
        (a) => ratio > 0 && Math.abs(a.w / a.h - 1 / ratio) < 0.01,
      );
  const aspectLabel = aspectMatch
    ? aspectMatch.label
    : portraitMatch
      ? portraitMatch.label.split(":").reverse().join(":")
      : `${ratio.toFixed(2)}:1`;
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

      {/* Viewing distance above display size (Taylor 2026-08-18). */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <RulerDimensionLineIcon className="size-3.5 text-muted-foreground" />
            <Microlabel>Viewing distance</Microlabel>
          </span>
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
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <ProportionsIcon className="size-3.5 text-muted-foreground" />
            <Microlabel>Display size · diagonal</Microlabel>
          </span>
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
          {/* Steppers rather than bare fields (Taylor 2026-08-20), the
              same − [value] + control the viewing distance uses. Panel
              resolutions are nudged far more often than they are typed
              from scratch, and the plain number inputs also committed
              mid-keystroke — deleting a digit off 2560 briefly patched
              the device to 256. bigStep is a round hundred. */}
          <NumberStepper
            ariaLabel="Width px"
            value={device.resolution.w}
            onChange={(w) =>
              onPatch({ resolution: { ...device.resolution, w } })
            }
            step={1}
            bigStep={100}
            min={1}
            max={16384}
            className="h-7 min-w-0 flex-1"
          />
          <span className="text-base text-muted-foreground">×</span>
          <NumberStepper
            ariaLabel="Height px"
            value={device.resolution.h}
            onChange={(h) =>
              onPatch({ resolution: { ...device.resolution, h } })
            }
            step={1}
            bigStep={100}
            min={1}
            max={16384}
            className="h-7 min-w-0 flex-1"
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

      {/* What this panel does when the media's shape disagrees with its
          own (decision-media-crop-vs-device-fit). Contain persists as
          UNDEFINED so devices saved before fit modes existed — and every
          device that never leaves the default — stay byte-identical. */}
      <div className="space-y-1.5">
        <Microlabel>Fit</Microlabel>
        <Select
          value={fitModeOf(device)}
          onValueChange={(v) =>
            onPatch({ fit: v === "contain" ? undefined : (v as FitMode) })
          }
        >
          <SelectTrigger className="w-full" aria-label="Content fit">
            <SelectValue>{fitLabel(fitModeOf(device))}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {FIT_MODES.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {/* Stretch is the one mode with non-square pixels — say by how
            much, and that the reported arc minutes are the height. */}
        {stretchNote ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-[#f5a524]/15 px-1.5 py-0.5 font-mono text-sm text-[#f5a524]">
            <TriangleAlertIcon className="size-3 shrink-0" />
            {stretchNote}
          </span>
        ) : null}
      </div>

      {/* Height and pitch are scene-dressing next to size and distance,
          so they fold away by default (Taylor 2026-08-20). Both are
          shown for every stance at once: the same monitor is met at a
          different height and angle from a desk chair than from a
          couch, and comparing the three is the point. The active stance
          is the only one in full contrast. */}
      <Collapsible label="Offsets">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Microlabel>Screen height · from eye line</Microlabel>
              <DistanceUnitFlip />
            </span>
            <span className="text-sm text-muted-foreground">Eye level</span>
          </div>
          {SCENARIOS.map((s) => (
            <StanceRow key={s.id} label={s.label} active={s.id === scenario}>
              <OffsetControls
                label={s.label}
                offsetCm={device.heightOffsetCm?.[s.id]}
                onChange={(v) =>
                  onPatch({
                    heightOffsetCm: { ...device.heightOffsetCm, [s.id]: v },
                  })
                }
              />
            </StanceRow>
          ))}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Microlabel>Tilt</Microlabel>
            <span className="text-sm text-muted-foreground">Auto-orient</span>
          </div>
          {SCENARIOS.map((s) => {
            const auto = autoOrientOf(device, s.id);
            const deg = device.tilt?.[s.id] ?? 0;
            const patchTilt = (v: number | undefined) =>
              onPatch({ tilt: { ...device.tilt, [s.id]: v } });
            return (
              <StanceRow key={s.id} label={s.label} active={s.id === scenario}>
                {auto ? (
                  <>
                    <span className="col-span-2 truncate text-sm text-muted-foreground">
                      facing the viewer
                    </span>
                    <span />
                  </>
                ) : (
                  <>
                    <Slider
                      min={-TILT_LIMIT_DEG}
                      max={TILT_LIMIT_DEG}
                      step={1}
                      value={deg}
                      aria-label={`${s.label} screen tilt`}
                      onValueChange={(v) =>
                        patchTilt(Array.isArray(v) ? v[0] : v)
                      }
                    />
                    <NumberStepper
                      ariaLabel={`${s.label} screen tilt in degrees`}
                      value={deg}
                      onChange={patchTilt}
                      step={1}
                      bigStep={5}
                      min={-TILT_LIMIT_DEG}
                      max={TILT_LIMIT_DEG}
                      suffix="°"
                      className="h-7"
                    />
                  </>
                )}
                {/* Per stance, the same shape as eye level above. Stored
                    only when it disagrees with the category, so
                    untouched devices serialize byte-identically. */}
                <Switch
                  checked={auto}
                  aria-label={`${s.label} auto-orient`}
                  onCheckedChange={(on) =>
                    onPatch({
                      autoOrient: {
                        ...device.autoOrient,
                        [s.id]:
                          on === autoOrientDefaultFor(device.category)
                            ? undefined
                            : on,
                      },
                    })
                  }
                />
              </StanceRow>
            );
          })}
        </div>
      </Collapsible>

      {FEATURE_3D_DEVICE_BODY &&
      device.deviceName &&
      HANDHELD_BODIES[device.deviceName] ? (
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


interface ReorderHooks {
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  markerTop: boolean;
  markerBottom: boolean;
}

function DeviceRow({
  device,
  onToggleVisible,
  reorder,
}: {
  device: Device;
  onToggleVisible: () => void;
  /** Present only for reorderable (test) devices. */
  reorder?: ReorderHooks;
}) {
  // Row selection IS the app-wide device selection (Taylor
  // 2026-08-19): clicking a row highlights the device in the 2D/3D
  // views, and clicking a device in a view highlights its row here.
  const selectedDeviceId = useUiStore((s) => s.selectedDeviceId);
  const selectDevice = useUiStore((s) => s.selectDevice);
  const pinned = useUiStore((s) => s.pinnedDetails[device.id]);
  const detailOpen = selectedDeviceId === device.id || Boolean(pinned);
  const toggleDetail = () =>
    selectDevice(selectedDeviceId === device.id ? null : device.id);
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
            // The name wears the device's key color (Taylor 2026-08-19);
            // hidden devices dim rather than losing their identity.
            !device.visible && "opacity-50",
            reorder && "cursor-grab active:cursor-grabbing",
          )}
          style={{ color: device.color }}
          onClick={toggleDetail}
          title={device.deviceName || device.label}
        >
          {device.label}
        </button>
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
  const selectedDeviceId = useUiStore((s) => s.selectedDeviceId);
  const selectDevice = useUiStore((s) => s.selectDevice);
  const pinDetail = useUiStore((s) => s.pinDetail);
  const panelPos = useUiStore(
    (s) => s.panelPositions.workbench ?? DEFAULT_DEVICES_PANEL_POS,
  );
  const panelWidth = useUiStore((s) => s.panelWidths.workbench ?? 860);
  const thisDevice = useDeviceStore((s) => s.thisDevice);
  const devices = useDeviceStore((s) => s.devices);
  const updateThisDevice = useDeviceStore((s) => s.updateThisDevice);
  const updateDevice = useDeviceStore((s) => s.updateDevice);
  const removeDevice = useDeviceStore((s) => s.removeDevice);
  const duplicateDevice = useDeviceStore((s) => s.duplicateDevice);

  const device =
    (selectedDeviceId && thisDevice.id !== selectedDeviceId
      ? devices.find((d) => d.id === selectedDeviceId)
      : thisDevice) ?? thisDevice;
  const isThis = device.id === thisDevice.id;

  return (
    <div className="flex min-h-0 flex-col">
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border px-2.5">
        {/* Key color picker lives on the selected device's title —
            styled as a button so it reads as customizable. */}
        <label
          className="relative block h-6 w-8 shrink-0 cursor-pointer overflow-hidden rounded-md border border-border shadow-sm transition-shadow hover:ring-2 hover:ring-ring"
          title="Change this device's key color"
          style={{ background: device.color }}
        >
          <input
            type="color"
            aria-label="Device key color"
            className="absolute inset-0 cursor-pointer opacity-0"
            value={device.color}
            onChange={(e) =>
              isThis
                ? updateThisDevice({ color: e.target.value })
                : updateDevice(device.id, { color: e.target.value })
            }
          />
        </label>
        <span className="min-w-0 flex-1 truncate text-base font-medium">
          {device.label}
          {isThis ? (
            <span className="ml-1.5 font-normal text-muted-foreground">
              This Device
            </span>
          ) : null}
        </span>
        {FEATURE_PINNED_DEVICES ? (
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
        ) : null}
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
                  selectDevice(null);
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
