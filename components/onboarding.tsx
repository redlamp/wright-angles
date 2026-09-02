"use client";

import { useMemo, useState } from "react";
import { RulerIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { CM_PER_IN, aspectFromResolution, deviceAngles } from "@/lib/display-math";
import { DEVICE_PRESETS } from "@/lib/presets";
import type { Device } from "@/lib/types";
import { useDeviceStore } from "@/stores/device-store";
import { useSettingsStore } from "@/stores/settings-store";
import { SCENARIOS, useViewerStore } from "@/stores/viewer-store";
import { NumberStepper } from "@/components/number-stepper";
import { CalibrationPanel } from "@/components/calibration-panel";
import { SegmentedToggle } from "@/components/panels/settings-panel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * First-run calibration: the tool is meaningless until This Device
 * matches the real panel in front of the user. Re-launchable from
 * Settings ("Run setup assistant again").
 */
export function Onboarding() {
  const onboarded = useSettingsStore((s) => s.onboarded);
  const setOnboarded = useSettingsStore((s) => s.setOnboarded);
  const thisDevice = useDeviceStore((s) => s.thisDevice);
  const updateThisDevice = useDeviceStore((s) => s.updateThisDevice);
  const scenario = useViewerStore((s) => s.scenario);
  const setScenario = useViewerStore((s) => s.setScenario);

  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Device>(thisDevice);
  // Playtesting churned here: a user who doesn't know their monitor's
  // diagonal and has no ruler. This drops into the card-calibration
  // flow without nesting a second Dialog inside the onboarding one.
  const [calibrating, setCalibrating] = useState(false);

  // This component stays mounted all session; Settings re-opens the
  // dialog later via setOnboarded(false), long after This Device may
  // have changed. Re-seed the draft from the CURRENT device every time
  // the dialog opens, not just once at mount — otherwise finishing (or
  // even skipping) the reopened dialog overwrites This Device with
  // whatever it was back when onboarding first mounted. Adjusting
  // state during render (React's "reset state on prop change" pattern)
  // rather than in an effect: it applies before the stale draft ever
  // paints, and only on the open transition, so in-progress edits
  // while the dialog stays open aren't clobbered.
  const [prevOnboarded, setPrevOnboarded] = useState(onboarded);
  if (onboarded !== prevOnboarded) {
    setPrevOnboarded(onboarded);
    if (!onboarded) setDraft(thisDevice);
  }

  const monitorPresets = useMemo(
    () =>
      DEVICE_PRESETS.filter(
        (p) => p.category === "monitor" || p.category === "tv",
      ),
    [],
  );

  const angles = deviceAngles(draft);

  const finish = () => {
    const merged: Device = {
      ...draft,
      id: thisDevice.id,
      visible: thisDevice.visible,
      color: thisDevice.color,
    };
    updateThisDevice(merged);
    setOnboarded(true);
    setStep(0);
    setDraft(merged);
  };

  const skip = () => {
    setOnboarded(true);
    setStep(0);
    setDraft(thisDevice);
  };

  return (
    <Dialog
      open={!onboarded}
      onOpenChange={(open) => {
        if (!open) skip();
      }}
    >
      <DialogContent
        className={cn(
          calibrating
            ? "max-h-[calc(100vh-2rem)] w-auto max-w-none overflow-y-auto sm:max-w-none"
            : "sm:max-w-md",
        )}
        showCloseButton={false}
      >
        {calibrating ? (
          <CalibrationPanel
            aspect={draft.aspect}
            resolution={draft.resolution}
            diagonalIn={draft.diagonalIn}
            cancelLabel="Back"
            onCancel={() => setCalibrating(false)}
            onApply={(diagonalIn) => {
              setDraft((d) => ({ ...d, diagonalIn }));
              setCalibrating(false);
            }}
          />
        ) : step === 0 ? (
          <>
            <DialogHeader>
              <DialogTitle>Welcome to Wright Angles</DialogTitle>
              <DialogDescription className="leading-5">
                This tool shows how your work really looks on other screens —
                a Switch in someone&apos;s hands, a TV across their room — by
                rendering everything at true angular size on the screen in
                front of you.
              </DialogDescription>
            </DialogHeader>
            <p className="text-sm leading-4.5 text-muted-foreground">
              For that to be honest, it needs to know one thing first: what
              screen you&apos;re sitting at, and how far away it is.
            </p>
            <div className="flex justify-between pt-1">
              <Button variant="ghost" size="sm" onClick={skip}>
                Skip for now
              </Button>
              <Button size="sm" onClick={() => setStep(1)}>
                Calibrate my screen
              </Button>
            </div>
          </>
        ) : step === 1 ? (
          <>
            <DialogHeader>
              <DialogTitle>Your screen</DialogTitle>
              <DialogDescription>
                Pick a preset or dial in the panel you&apos;re looking at
                right now.
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
                onClick={() => setCalibrating(true)}
              >
                <RulerIcon className="size-3.5" /> I don&rsquo;t know my screen size
              </Button>

              <Select
                value=""
                onValueChange={(v) => {
                  const p = monitorPresets.find((x) => x.presetId === v);
                  if (p) {
                    setDraft((d) => ({
                      ...d,
                      label: p.label,
                      deviceName: p.deviceName,
                      diagonalIn: p.diagonalIn,
                      resolution: { ...p.resolution },
                      aspect: { ...p.aspect },
                    }));
                  }
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose a preset…" />
                </SelectTrigger>
                <SelectContent>
                  {monitorPresets.map((p) => (
                    <SelectItem key={p.presetId} value={p.presetId}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="grid grid-cols-2 gap-2.5">
                <label className="space-y-1">
                  <span className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
                    Diagonal (in)
                  </span>
                  <NumberStepper
                    ariaLabel="screen diagonal inches"
                    value={draft.diagonalIn}
                    onChange={(v) =>
                      setDraft((d) => ({ ...d, diagonalIn: v }))
                    }
                    step={0.5}
                    bigStep={5}
                    min={5}
                    max={200}
                    decimals={1}
                    className="h-8"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
                    Distance (cm)
                  </span>
                  <NumberStepper
                    ariaLabel="viewing distance cm"
                    value={draft.distanceCm}
                    onChange={(v) =>
                      setDraft((d) => ({ ...d, distanceCm: v }))
                    }
                    step={1}
                    bigStep={10}
                    min={20}
                    max={500}
                    className="h-8"
                  />
                </label>
              </div>

              <div className="space-y-1">
                <span className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
                  Resolution
                </span>
                <div className="flex items-center gap-1.5">
                  <NumberStepper
                    ariaLabel="horizontal resolution"
                    value={draft.resolution.w}
                    onChange={(v) =>
                      setDraft((d) => {
                        const resolution = {
                          ...d.resolution,
                          w: Math.round(v),
                        };
                        return {
                          ...d,
                          resolution,
                          aspect: aspectFromResolution(resolution),
                        };
                      })
                    }
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
                    onChange={(v) =>
                      setDraft((d) => {
                        const resolution = {
                          ...d.resolution,
                          h: Math.round(v),
                        };
                        return {
                          ...d,
                          resolution,
                          aspect: aspectFromResolution(resolution),
                        };
                      })
                    }
                    step={10}
                    bigStep={100}
                    min={240}
                    max={4320}
                    className="h-8 flex-1"
                  />
                </div>
              </div>

              <p className="panel-inset rounded-md px-2.5 py-1.5 font-mono text-sm text-muted-foreground">
                {(draft.diagonalIn * CM_PER_IN).toFixed(0)} cm diagonal ·
                fills {angles.horizontalDeg.toFixed(0)}° of your view ·{" "}
                {angles.ppd.toFixed(0)} px/°
              </p>
            </div>
            <div className="flex justify-between pt-1">
              <Button variant="ghost" size="sm" onClick={() => setStep(0)}>
                Back
              </Button>
              <Button size="sm" onClick={() => setStep(2)}>
                Next
              </Button>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>How you&apos;re sitting</DialogTitle>
              <DialogDescription>
                Sets the viewer in the 3D scene. You can change it anytime.
              </DialogDescription>
            </DialogHeader>
            <SegmentedToggle
              value={scenario}
              options={SCENARIOS.map((s) => ({ value: s.id, label: s.label }))}
              onChange={setScenario}
            />
            <div className={cn("flex justify-between pt-1")}>
              <Button variant="ghost" size="sm" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button size="sm" onClick={finish}>
                Done — start comparing
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
