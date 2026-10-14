"use client";

import { useEffect, useRef, useState } from "react";
import { cssPxPerCm } from "@/lib/calibration";
import { precheckCalibration } from "@/lib/calibration-precheck";
import type { Resolution } from "@/lib/types";
import { CardStep } from "./calibration-panel/card-step";
import { KnownStep } from "./calibration-panel/known-step";
import { MethodStep, type Method } from "./calibration-panel/method-step";
import { PrecheckNotice } from "./calibration-panel/precheck-notice";
import { ResultStep } from "./calibration-panel/result-step";
import { RulerStep } from "./calibration-panel/ruler-step";
import { useScreenReadings } from "./calibration-panel/use-screen-readings";

type Step = "method" | Method | "result";

/**
 * Screen-size calibration (test plan 11.2), one method per screen:
 * choose how (card, ruler, or "I know my screen size"), measure, then
 * a plain-language result. Both measuring methods turn a known physical
 * length into px per cm, which with the native resolution gives the
 * true diagonal, so a pre-check names a resolution or zoom problem
 * before any measuring starts.
 *
 * Deliberately just the panel body, no DialogContent wrapper, so it
 * drops into the standalone `CalibrationDialog` (from Settings) and
 * into onboarding without nesting a second Dialog inside the first.
 * `onApply` hands back the resolution too: the pre-check can correct
 * it, and the diagonal was measured against it.
 */
export function CalibrationPanel({
  resolution: initialResolution,
  diagonalIn,
  onApply,
  onCancel,
  cancelLabel = "Cancel",
}: {
  resolution: Resolution;
  diagonalIn: number;
  onApply: (diagonalIn: number, resolution: Resolution) => void;
  onCancel: () => void;
  cancelLabel?: string;
}) {
  const [step, setStep] = useState<Step>("method");
  const [resolution, setResolution] = useState(initialResolution);
  const [measured, setMeasured] = useState<{ from: Method; diagonalIn: number } | null>(
    null,
  );
  const readings = useScreenReadings();
  const check = precheckCalibration(readings, resolution);
  const notice = (
    <PrecheckNotice
      check={check}
      configured={resolution}
      onUseResolution={setResolution}
    />
  );

  // Each step replaces the last, so the control that had focus is gone:
  // move focus to the new step's heading so keyboard and screen-reader
  // users land at its start rather than on the dialog body.
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const heading = root.current?.querySelector<HTMLElement>("h2");
    if (!heading) return;
    heading.tabIndex = -1;
    heading.style.outline = "none";
    heading.focus();
  }, [step]);

  // Seed each measuring step at the scale the current spec implies (or
  // the last measurement, coming Back from the result), so a correct
  // spec lines up at once and a round trip keeps the user's match.
  const seedPxPerMm =
    cssPxPerCm(measured?.diagonalIn ?? diagonalIn, resolution, readings.dpr) / 10;
  const done = (from: Method) => (d: number) => {
    setMeasured({ from, diagonalIn: d });
    setStep("result");
  };
  // A corrected resolution changes the seed and the stage: remount.
  const resKey = `${resolution.w}x${resolution.h}`;
  const measureProps = {
    seedPxPerMm,
    dpr: readings.dpr,
    resolution,
    notice,
    onBack: () => setStep("method"),
  };

  return (
    <div ref={root} className="contents">
      {step === "method" ? (
        <MethodStep
          notice={notice}
          cancelLabel={cancelLabel}
          onCancel={onCancel}
          onChoose={(m) => {
            setMeasured(null);
            setStep(m);
          }}
        />
      ) : step === "card" ? (
        <CardStep key={resKey} {...measureProps} onDone={done("card")} />
      ) : step === "ruler" ? (
        <RulerStep key={resKey} {...measureProps} onDone={done("ruler")} />
      ) : step === "known" ? (
        <KnownStep
          diagonalIn={diagonalIn}
          resolution={resolution}
          onBack={() => setStep("method")}
          onApply={(d) => onApply(d, resolution)}
        />
      ) : measured ? (
        <ResultStep
          measuredIn={measured.diagonalIn}
          resolution={resolution}
          dpr={readings.dpr}
          onBack={() => setStep(measured.from)}
          onApply={(d) => onApply(d, resolution)}
        />
      ) : null}
    </div>
  );
}
