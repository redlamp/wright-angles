"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { aspectFromResolution } from "@/lib/display-math";
import { detectNativeResolution, zoomHintFromWindow } from "@/lib/screen-detect";
import type { Device } from "@/lib/types";
import { defaultThisDevice, useDeviceStore } from "@/stores/device-store";
import { useSettingsStore } from "@/stores/settings-store";
import { useUiStore } from "@/stores/ui-store";
import { SCENARIOS, useViewerStore } from "@/stores/viewer-store";
import { CalibrationPanel } from "@/components/calibration-panel";
import { SegmentedToggle } from "@/components/panels/settings-panel";
import { PasteImport, importAndActivate } from "@/components/paste-import";
import { ViewToggleCoach } from "@/components/view-toggle-coach";
import { ScreenStep } from "@/components/onboarding/screen-step";
import { ScreenshotStep } from "@/components/onboarding/screenshot-step";
import { ViewsStep } from "@/components/onboarding/views-step";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** Index of the last step ("Bring a screenshot"). */
const LAST_STEP = 4;

/**
 * This Device still holds the shipped default panel spec, i.e. the user
 * has never set it, so a browser-detected resolution may stand in.
 */
function isUnsetDevice(d: Device): boolean {
  return (
    d.label === defaultThisDevice.label &&
    d.diagonalIn === defaultThisDevice.diagonalIn &&
    d.resolution.w === defaultThisDevice.resolution.w &&
    d.resolution.h === defaultThisDevice.resolution.h
  );
}

interface Opening {
  draft: Device;
  /** Resolution read from the browser, if any; prefilled only when
   * `confident`, otherwise offered as a suggestion. */
  detected: { w: number; h: number; confident: boolean } | null;
}

/**
 * The draft the dialog opens with: the current This Device, with the
 * resolution prefilled from the browser when the user hasn't set one
 * and the detection is confident (page zoom can skew it).
 */
function openingDraft(device: Device): Opening {
  if (!isUnsetDevice(device)) return { draft: device, detected: null };
  const found = detectNativeResolution(
    window.screen.width,
    window.screen.height,
    window.devicePixelRatio,
    zoomHintFromWindow(window.outerWidth, window.innerWidth),
  );
  if (!found) return { draft: device, detected: null };
  const resolution = { w: found.w, h: found.h };
  const detected = { ...resolution, confident: found.confident };
  if (!found.confident) return { draft: device, detected };
  return {
    draft: { ...device, resolution, aspect: aspectFromResolution(resolution) },
    detected,
  };
}

/**
 * First-run setup: calibrate This Device (the tool is meaningless until
 * it matches the real panel in front of the user), explain the two
 * views, then end on the user's own screenshot. Re-launchable from
 * Settings ("Run setup assistant again"). Also hosts the app-wide
 * paste-to-import listener and the post-setup 2D/3D coach mark.
 */
export function Onboarding() {
  const onboarded = useSettingsStore((s) => s.onboarded);
  const setOnboarded = useSettingsStore((s) => s.setOnboarded);
  const thisDevice = useDeviceStore((s) => s.thisDevice);
  const updateThisDevice = useDeviceStore((s) => s.updateThisDevice);
  const scenario = useViewerStore((s) => s.scenario);
  const setScenario = useViewerStore((s) => s.setScenario);

  const [step, setStep] = useState(0);
  const [{ draft, detected }, setOpening] = useState<Opening>(() =>
    onboarded ? { draft: thisDevice, detected: null } : openingDraft(thisDevice),
  );
  const setDraft = (update: (d: Device) => Device) =>
    setOpening((o) => ({ ...o, draft: update(o.draft) }));
  // Playtesting churned here: a user who doesn't know their monitor's
  // diagonal and has no ruler. This drops into the card-calibration
  // flow without nesting a second Dialog inside the onboarding one.
  const [calibrating, setCalibrating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  // Set when the dialog closes this session; the coach mark waits on it.
  const [coachArmed, setCoachArmed] = useState(false);

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
    if (!onboarded) setOpening(openingDraft(thisDevice));
  }

  const close = (nextDraft: Device) => {
    setOnboarded(true);
    setStep(0);
    setOpening({ draft: nextDraft, detected: null });
    setImportError(null);
    setCoachArmed(true);
  };

  const finish = () => {
    const merged: Device = {
      ...draft,
      id: thisDevice.id,
      visible: thisDevice.visible,
      color: thisDevice.color,
    };
    updateThisDevice(merged);
    close(merged);
  };

  const skip = () => close(thisDevice);

  /** Land on the verdict for the user's own image: 2D plus the report. */
  const finishWithImport = () => {
    finish();
    const ui = useUiStore.getState();
    ui.setViewMode("2d");
    ui.openWorkbenchTab("report");
  };

  const importScreenshot = async (files: File[]) => {
    setImporting(true);
    setImportError(null);
    try {
      const ids = await importAndActivate(files);
      if (ids.length > 0) finishWithImport();
      else {
        setImportError(
          "Couldn't read that file. Try a PNG, JPEG or WebP screenshot.",
        );
      }
    } finally {
      setImporting(false);
    }
  };

  const onLastStep = !onboarded && !calibrating && step === LAST_STEP;

  return (
    <>
      {/* Paste is app-wide, but while setup is open only its last step
          takes one, and a paste there completes setup. */}
      <PasteImport
        enabled={onboarded || onLastStep}
        onImported={onLastStep ? finishWithImport : undefined}
      />
      <ViewToggleCoach armed={coachArmed} />
      <Dialog
        open={!onboarded}
        onOpenChange={(open) => {
          if (!open && !importing) skip();
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
              resolution={draft.resolution}
              diagonalIn={draft.diagonalIn}
              cancelLabel="Back"
              onCancel={() => setCalibrating(false)}
              onApply={(diagonalIn, resolution) => {
                setDraft((d) =>
                  resolution.w === d.resolution.w &&
                  resolution.h === d.resolution.h
                    ? { ...d, diagonalIn }
                    : {
                        ...d,
                        diagonalIn,
                        resolution,
                        aspect: aspectFromResolution(resolution),
                      },
                );
                setCalibrating(false);
              }}
            />
          ) : step === 0 ? (
            <>
              <DialogHeader>
                <DialogTitle>Welcome to Wright Angles</DialogTitle>
                <DialogDescription className="leading-5">
                  This tool shows how your work really looks on other
                  screens — a Switch in someone&apos;s hands, a TV across
                  their room — by rendering everything at true angular size
                  on the screen in front of you.
                </DialogDescription>
              </DialogHeader>
              <p className="text-sm leading-4.5 text-muted-foreground">
                For that to be honest, it needs to know one thing first:
                what screen you&apos;re sitting at, and how far away it is.
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
            <ScreenStep
              draft={draft}
              setDraft={setDraft}
              detected={detected}
              onCalibrate={() => setCalibrating(true)}
              onBack={() => setStep(0)}
              onNext={() => setStep(2)}
            />
          ) : step === 2 ? (
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
              <div className="flex justify-between pt-1">
                <Button variant="ghost" size="sm" onClick={() => setStep(1)}>
                  Back
                </Button>
                <Button size="sm" onClick={() => setStep(3)}>
                  Next
                </Button>
              </div>
            </>
          ) : step === 3 ? (
            <ViewsStep onBack={() => setStep(2)} onNext={() => setStep(4)} />
          ) : (
            <ScreenshotStep
              importing={importing}
              error={importError}
              onFiles={(files) => void importScreenshot(files)}
              onUseSample={finish}
              onBack={() => setStep(3)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
