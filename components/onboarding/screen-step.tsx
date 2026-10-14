"use client";

import { useMemo, useState } from "react";
import { RulerIcon } from "lucide-react";
import { CM_PER_IN, aspectFromResolution, deviceAngles } from "@/lib/display-math";
import { DEVICE_PRESETS } from "@/lib/presets";
import {
  PRESET_GROUPS,
  presetSections,
  presetsInGroup,
  type PresetGroupId,
} from "@/lib/preset-groups";
import { cn } from "@/lib/utils";
import type { Device } from "@/lib/types";
import { NumberStepper } from "@/components/number-stepper";
import { DistanceUnitFlip, SizeUnitFlip } from "@/components/unit-flip";
import { useSettingsStore } from "@/stores/settings-store";
import { Button } from "@/components/ui/button";
import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const LABEL =
  "text-sm font-medium tracking-wide text-muted-foreground uppercase";

/** Onboarding step 2: the physical panel the user is looking at. */
export function ScreenStep({
  draft,
  setDraft,
  detected,
  onCalibrate,
  onBack,
  onNext,
}: {
  draft: Device;
  setDraft: (update: (d: Device) => Device) => void;
  /** Resolution read from the browser on a fresh setup, if any; only a
   * confident one was prefilled, the rest is offered as a suggestion. */
  detected: { w: number; h: number; confident: boolean } | null;
  onCalibrate: () => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const sizeIn = useSettingsStore((s) => s.sizeUnit) === "in";
  const distIn = useSettingsStore((s) => s.unit) === "in";
  const [group, setGroup] = useState<PresetGroupId>("all");
  const sections = useMemo(
    () =>
      group === "all"
        ? presetSections(DEVICE_PRESETS)
        : [{ label: "", presets: presetsInGroup(DEVICE_PRESETS, group) }],
    [group],
  );
  const angles = deviceAngles(draft);
  // The note only holds while the numbers are still the detected ones.
  const matchesDetected =
    detected !== null &&
    detected.w === draft.resolution.w &&
    detected.h === draft.resolution.h;
  const showDetected = matchesDetected && detected.confident;
  // An unsure reading (page zoom skews it) is offered, never applied.
  const suggestion = detected && !detected.confident && !matchesDetected ? detected : null;

  const setResolution = (axis: "w" | "h", v: number) =>
    setDraft((d) => {
      const resolution = { ...d.resolution, [axis]: Math.round(v) };
      return { ...d, resolution, aspect: aspectFromResolution(resolution) };
    });

  return (
    <>
      <DialogHeader>
        <DialogTitle>Your screen</DialogTitle>
        <DialogDescription>
          Pick a preset or dial in the panel you&apos;re looking at right
          now.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-2.5">
        {/* Offered before the preset select, not after every field
            the user might not be able to fill in — the way out has
            to be visible before the numbers are (Taylor
            2026-08-20). secondary + icon matches how Export/Import
            read as real, standing offers in Settings without
            competing with the dialog's own primary action. */}
        <Button
          variant="secondary"
          size="sm"
          className="h-8 w-full text-sm"
          onClick={onCalibrate}
        >
          <RulerIcon className="size-3.5" /> I don&rsquo;t know my screen size
        </Button>

        <div
          role="group"
          aria-label="Screen type"
          className="panel-inset flex h-8 items-center gap-0.5 rounded-md p-0.5"
        >
          {PRESET_GROUPS.map((g) => (
            <button
              key={g.id}
              type="button"
              aria-pressed={g.id === group}
              onClick={() => setGroup(g.id)}
              className={cn(
                "h-full flex-1 rounded-[6px] px-1.5 text-sm transition-colors",
                g.id === group
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {g.label}
            </button>
          ))}
        </div>

        <Select
          value=""
          onValueChange={(v) => {
            const p = DEVICE_PRESETS.find((x) => x.presetId === v);
            if (p) {
              setDraft((d) => ({
                ...d,
                label: p.label,
                deviceName: p.deviceName,
                category: p.category,
                diagonalIn: p.diagonalIn,
                resolution: { ...p.resolution },
                aspect: { ...p.aspect },
              }));
            }
          }}
        >
          <SelectTrigger className="w-full" aria-label="Screen preset">
            <SelectValue placeholder="Choose a preset…" />
          </SelectTrigger>
          <SelectContent>
            {sections.map((sec) => (
              <SelectGroup key={sec.label || "only"}>
                {sec.label ? <SelectLabel>{sec.label}</SelectLabel> : null}
                {sec.presets.map((p) => (
                  <SelectItem key={p.presetId} value={p.presetId}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>

        <div className="grid grid-cols-2 gap-2.5">
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className={LABEL}>Diagonal</span>
              <SizeUnitFlip />
            </div>
            <NumberStepper
              ariaLabel={`screen diagonal ${sizeIn ? "inches" : "centimeters"}`}
              value={sizeIn ? draft.diagonalIn : draft.diagonalIn * CM_PER_IN}
              onChange={(v) =>
                setDraft((d) => ({
                  ...d,
                  diagonalIn: sizeIn ? v : v / CM_PER_IN,
                }))
              }
              step={sizeIn ? 0.5 : 1}
              bigStep={sizeIn ? 5 : 10}
              min={sizeIn ? 5 : 13}
              max={sizeIn ? 200 : 508}
              decimals={1}
              className="h-8"
            />
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className={LABEL}>Distance</span>
              <DistanceUnitFlip />
            </div>
            <NumberStepper
              ariaLabel={`viewing distance ${distIn ? "inches" : "centimeters"}`}
              value={distIn ? draft.distanceCm / CM_PER_IN : draft.distanceCm}
              onChange={(v) =>
                setDraft((d) => ({
                  ...d,
                  distanceCm: distIn ? v * CM_PER_IN : v,
                }))
              }
              step={distIn ? 0.5 : 1}
              bigStep={distIn ? 5 : 10}
              min={distIn ? 8 : 20}
              max={distIn ? 197 : 500}
              decimals={distIn ? 1 : 0}
              className="h-8"
            />
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className={LABEL}>Resolution</span>
            {showDetected ? (
              <span className="text-sm text-muted-foreground">
                Detected from your browser
              </span>
            ) : suggestion ? (
              <span className="text-sm text-muted-foreground">
                Your browser suggests {suggestion.w}×{suggestion.h}{" "}
                <button
                  type="button"
                  className="rounded-sm text-foreground underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => {
                    setResolution("w", suggestion.w);
                    setResolution("h", suggestion.h);
                  }}
                >
                  Use it
                </button>
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-1.5">
            <NumberStepper
              ariaLabel="horizontal resolution"
              value={draft.resolution.w}
              onChange={(v) => setResolution("w", v)}
              step={10}
              bigStep={100}
              min={320}
              max={7680}
              className="h-8 flex-1"
            />
            <span className="text-sm text-muted-foreground">×</span>
            <NumberStepper
              ariaLabel="vertical resolution"
              value={draft.resolution.h}
              onChange={(v) => setResolution("h", v)}
              step={10}
              bigStep={100}
              min={240}
              max={4320}
              className="h-8 flex-1"
            />
          </div>
        </div>

        <p className="panel-inset rounded-md px-2.5 py-1.5 font-mono text-sm text-muted-foreground">
          {(draft.diagonalIn * CM_PER_IN).toFixed(0)} cm diagonal · fills{" "}
          {angles.horizontalDeg.toFixed(0)}° of your view ·{" "}
          {angles.ppd.toFixed(0)} px/°
        </p>
      </div>
      <div className="flex justify-between pt-1">
        <Button variant="ghost" size="sm" onClick={onBack}>
          Back
        </Button>
        <Button size="sm" onClick={onNext}>
          Next
        </Button>
      </div>
    </>
  );
}
