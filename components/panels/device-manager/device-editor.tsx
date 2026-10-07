"use client";

import {
  CopyIcon,
  ProportionsIcon,
  RotateCwSquareIcon,
  RulerDimensionLineIcon,
  Trash2Icon,
  TriangleAlertIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FEATURE_3D_DEVICE_BODY } from "@/lib/flags";
import type { Device, FitMode } from "@/lib/types";
import { FIT_MODES, fitLabel, fitModeOf, fitStretchNote } from "@/lib/fit";
import {
  COMMON_ASPECTS,
  COMMON_RESOLUTIONS,
  HANDHELD_BODIES,
} from "@/lib/presets";
import {
  CM_PER_IN,
  aspectFromResolution,
  distToSlider,
  formatDistance,
  sliderToDist,
} from "@/lib/display-math";
import { useMediaStore } from "@/stores/media-store";
import { useSettingsStore } from "@/stores/settings-store";
import { useViewerStore } from "@/stores/viewer-store";
import { NumberStepper } from "@/components/number-stepper";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AngleReadout,
  DIST_MIN_CM,
  DIST_SLIDER_MAX_CM,
  DistanceStepper,
  DistanceUnitFlip,
  Microlabel,
  UnitFlip,
} from "./controls";
import { OffsetsSection } from "./offsets-section";

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
  const distanceUnit = useSettingsStore((s) => s.unit);
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
            thumbLabel="Viewing distance"
            thumbValueText={(t) =>
              formatDistance(
                sliderToDist(t, DIST_MIN_CM, DIST_SLIDER_MAX_CM),
                distanceUnit,
              )
            }
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
            thumbLabel="Display size, diagonal"
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
        {/* Prefabs ride the header row (Taylor 2026-08-20) — they're
            shortcuts to the controls below, not a section of their own,
            and the editor was a row taller for no reason. */}
        <div className="flex items-center justify-between gap-2">
          <Microlabel>Dimensions</Microlabel>
          {COMMON_RESOLUTIONS[aspectLabel] ? (
            <div className="flex flex-wrap justify-end gap-1">
              {COMMON_RESOLUTIONS[aspectLabel].map((r) => (
                <button
                  key={`${r.w}x${r.h}`}
                  type="button"
                  className={cn(
                    "rounded-md px-1.5 py-0.5 font-mono text-sm transition-colors",
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
        <div className="flex items-center gap-1.5">
          <Select
            value={aspectLabel}
            onValueChange={(v) => {
              const found = COMMON_ASPECTS.find((a) => a.label === v);
              if (found) onPatch({ aspect: { w: found.w, h: found.h } });
            }}
          >
            <SelectTrigger className="w-22 shrink-0" aria-label="Aspect ratio">
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
      </div>

      {/* Curve and Fit share a row, both triggers the same width with
          their labels beside them (Taylor 2026-08-20). w-36 is the
          popup's own min-width, so the open menu is exactly as wide as
          the closed trigger and the selected string reads identically
          in both — which is also why the fit modes carry short labels
          and put the explanation in a title. */}
      <div className="grid grid-cols-2 gap-2">
        <div className="flex items-center justify-between gap-1.5">
          <Microlabel>Curve</Microlabel>
          <Select
            value={String(device.curvatureR ?? 0)}
            onValueChange={(v) =>
              onPatch({ curvatureR: Number(v) || undefined })
            }
          >
            <SelectTrigger className="w-36 shrink-0" aria-label="Screen curvature">
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

        {/* What this panel does when the media's shape disagrees with
            its own (decision-media-crop-vs-device-fit). Contain persists
            as UNDEFINED so devices saved before fit modes existed — and
            every device that never leaves the default — stay
            byte-identical. */}
        <div className="flex items-center justify-between gap-1.5">
          <Microlabel>Fit</Microlabel>
          <Select
            value={fitModeOf(device)}
            onValueChange={(v) =>
              onPatch({ fit: v === "contain" ? undefined : (v as FitMode) })
            }
          >
            <SelectTrigger className="w-36 shrink-0" aria-label="Content fit">
              <SelectValue>{fitLabel(fitModeOf(device))}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {FIT_MODES.map((m) => (
                <SelectItem key={m.id} value={m.id} title={m.hint}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stretch is the one mode with non-square pixels — say by how
          much, and that the reported arc minutes are the height. Its own
          row now that Fit shares one with Curve. */}
      {stretchNote ? (
        <span className="inline-flex items-center gap-1 self-start rounded-md bg-[#f5a524]/15 px-1.5 py-0.5 font-mono text-sm text-[#f5a524]">
          <TriangleAlertIcon className="size-3 shrink-0" />
          {stretchNote}
        </span>
      ) : null}

      {/* Height and pitch are scene-dressing next to size and distance,
          so they fold away by default (Taylor 2026-08-20). Both are
          shown for every stance at once: the same monitor is met at a
          different height and angle from a desk chair than from a
          couch, and comparing the three is the point. The active stance
          is the only one in full contrast. */}
      <OffsetsSection
        device={device}
        onPatch={onPatch}
        scenario={scenario}
        heightCm={heightCm}
      />

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
