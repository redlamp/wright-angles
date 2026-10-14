"use client";

import { useState } from "react";
import { RULER_LENGTHS, diagonalFromLengthPx } from "@/lib/calibration";
import { CM_PER_IN } from "@/lib/display-math";
import type { Resolution } from "@/lib/types";
import { useSettingsStore } from "@/stores/settings-store";
import { cn } from "@/lib/utils";
import { FOCUS_RING, GUIDE_COLOR, STAGE_PAD_PX } from "./constants";
import { FineAdjust } from "./fine-adjust";
import { RulerIllustration } from "./illustrations";
import { MeasureFrame } from "./measure-frame";
import { stageViewport, useMeasure } from "./use-measure";

const PAD = STAGE_PAD_PX;
const STAGE_H = 150;
/** Bar geometry, top to bottom: numbers, ticks, the bar itself. */
const BAR_Y = 70;
const BAR_H = 6;

/**
 * Ruler mode: a bar whose 0 sits at a fixed left anchor. The user lays
 * a ruler along it and drags the end handle to the chosen mark. Ticks
 * are drawn at the current scale, so a correct match lines up along the
 * whole ruler, not just at the end.
 */
export function RulerStep({
  seedPxPerMm,
  dpr,
  resolution,
  notice,
  onBack,
  onDone,
}: {
  seedPxPerMm: number;
  dpr: number;
  resolution: Resolution;
  notice: React.ReactNode;
  onBack: () => void;
  onDone: (diagonalIn: number) => void;
}) {
  const unit = useSettingsStore((s) => s.unit);
  const lengths = RULER_LENGTHS[unit];
  const [choice, setChoice] = useState(lengths.length - 1);
  const length = lengths[Math.min(choice, lengths.length - 1)];
  const lengthMm = length.cm * 10;
  const m = useMeasure({ seedPxPerMm, lengthMm });

  const [canvas] = useState(() => {
    const longestMm = Math.max(
      ...Object.values(RULER_LENGTHS).flatMap((ls) => ls.map((l) => l.cm * 10)),
    );
    const w = PAD + m.maxPxPerMm * longestMm + PAD + 24;
    const viewport = stageViewport(w, STAGE_H);
    // A bar is only ever as long as the ruler, so show room for a
    // generous overshoot of the seeded length and scroll past that,
    // rather than a dialog as wide as the whole drag range.
    const roomy = PAD + seedPxPerMm * longestMm * 1.6 + PAD + 24;
    return { w, viewport: { ...viewport, w: Math.min(viewport.w, Math.max(480, roomy)) } };
  });

  const implied = diagonalFromLengthPx(m.px, length.cm, dpr, resolution);
  const rounded = Math.round(implied * 10) / 10;

  // Major ticks per whole unit, minor at halves.
  const unitMm = unit === "cm" ? 10 : CM_PER_IN * 10;
  const halves = Math.round((lengthMm / unitMm) * 2);
  const ticks = Array.from({ length: halves + 1 }, (_, i) => ({
    x: PAD + (i / 2) * unitMm * m.pxPerMm,
    major: i % 2 === 0,
    n: i / 2,
  }));

  const stage = (
    <div
      className="panel-inset overflow-x-auto overflow-y-hidden rounded-md ring-1 ring-foreground/10"
      style={{ width: canvas.viewport.w, height: STAGE_H }}
    >
      <div className="relative touch-none select-none" style={{ width: canvas.w, height: STAGE_H }}>
        {ticks.map((t) => (
          <div key={t.n} aria-hidden>
            <div
              className={t.n === 0 ? `absolute ${GUIDE_COLOR} bg-current` : "absolute bg-foreground/70"}
              style={{
                left: t.x - (t.n === 0 ? 1.5 : 0.5),
                top: t.n === 0 ? BAR_Y - 34 : BAR_Y - (t.major ? 16 : 9),
                width: t.n === 0 ? 3 : 1,
                height: t.n === 0 ? 34 + BAR_H + 34 : t.major ? 16 : 9,
              }}
            />
            {t.major && t.n > 0 && t.n < halves / 2 ? (
              <span
                className="absolute -translate-x-1/2 font-mono text-sm text-muted-foreground"
                style={{ left: t.x, top: BAR_Y - 36 }}
              >
                {t.n}
              </span>
            ) : null}
          </div>
        ))}
        <span
          aria-hidden
          className={`absolute font-mono text-sm font-medium ${GUIDE_COLOR}`}
          style={{ left: PAD + 6, top: BAR_Y + BAR_H + 10 }}
        >
          0
        </span>
        <div
          aria-hidden
          className="absolute rounded-r-full bg-foreground"
          style={{ left: PAD, top: BAR_Y, width: m.px, height: BAR_H }}
        />
        <span
          aria-hidden
          className="absolute -translate-x-1/2 font-mono text-sm font-medium whitespace-nowrap text-foreground"
          style={{ left: PAD + m.px, top: BAR_Y - 56 }}
        >
          {length.label}
        </span>
        {/* The end handle: a hairline at the exact end plus a grip. */}
        <div
          role="slider"
          tabIndex={0}
          aria-label={`End of the bar, to line up with the ${length.label} mark`}
          aria-orientation="horizontal"
          aria-valuemin={Math.round(m.minPx)}
          aria-valuemax={Math.round(m.maxPx)}
          aria-valuenow={Math.round(m.px * 10) / 10}
          aria-valuetext={`${m.px.toFixed(1)} pixels long, screen about ${rounded.toFixed(1)} inches`}
          className={`absolute cursor-ew-resize rounded-md ${FOCUS_RING}`}
          style={{ left: PAD + m.px - 12, top: BAR_Y - 36, width: 24, height: 36 + BAR_H + 44 }}
          onPointerDown={m.startDrag((start, dx) => start + dx)}
          onPointerMove={m.onPointerMove}
          onPointerUp={m.onPointerUp}
          onPointerCancel={m.onPointerUp}
          onKeyDown={m.onKeyDown}
        >
          <div className="absolute top-0 bottom-0 left-1/2 w-px -translate-x-1/2 bg-foreground" />
          <div className="absolute bottom-1 left-1/2 size-5 -translate-x-1/2 rounded-full bg-background ring-2 ring-foreground/60" />
        </div>
      </div>
    </div>
  );

  return (
    <MeasureFrame
      width={canvas.viewport.w}
      title="Measure with a ruler"
      description={`Lay a ruler just under the bar with its 0 on the left mark, then drag the end handle to the ${length.label} mark.`}
      illustration={<RulerIllustration className="h-20 w-30 shrink-0" />}
      notice={notice}
      stage={stage}
      controls={
        <div className="grid gap-3">
          <div className="flex items-center gap-2">
            <span id="ruler-length-label" className="text-sm text-muted-foreground">
              Measure to
            </span>
            <div
              role="group"
              aria-labelledby="ruler-length-label"
              className="panel-inset flex h-8 items-center gap-0.5 rounded-md p-0.5"
            >
              {lengths.map((l, i) => (
                <button
                  key={l.label}
                  type="button"
                  aria-pressed={i === choice}
                  className={cn(
                    "h-full rounded-[6px] px-3 text-sm motion-safe:transition-colors",
                    FOCUS_RING,
                    i === choice
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  onClick={() => setChoice(i)}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>
          <FineAdjust what="bar" nudge={m.nudge} impliedIn={implied} />
        </div>
      }
      onBack={onBack}
      onNext={() => onDone(implied)}
    />
  );
}
