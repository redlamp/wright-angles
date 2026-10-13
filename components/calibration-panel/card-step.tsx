"use client";

import { useState } from "react";
import {
  CARD_ASPECT,
  CARD_DIAGONAL_RATIO,
  CARD_H_MM,
  CARD_W_MM,
  diagonalFromLengthPx,
  widthFromDiagonalPx,
} from "@/lib/calibration";
import { growthDir } from "@/lib/calibration-drag";
import type { Resolution } from "@/lib/types";
import { useSettingsStore } from "@/stores/settings-store";
import {
  CORNER_R_RATIO,
  FOCUS_RING,
  GUIDE_COLOR,
  LABEL_MIN_PX,
  STAGE_PAD_PX,
} from "./constants";
import { FineAdjust } from "./fine-adjust";
import { CardIllustration } from "./illustrations";
import { MeasureFrame } from "./measure-frame";
import { stageViewport, useMeasure } from "./use-measure";

const PAD = STAGE_PAD_PX;
/** Corner guide: arm length and stroke, drawn just outside the card. */
const ARM = 44;
const STROKE = 4;
const GAP = 2;

/**
 * Card mode: a fixed L-shaped guide anchors the card's top-left corner,
 * and the shape grows from there. One primary control (the right edge,
 * with the bottom-right corner as a second grip on the same size), plus
 * fine adjust and the slider keyboard pattern.
 */
export function CardStep({
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
  const m = useMeasure({ seedPxPerMm, lengthMm: CARD_W_MM });
  const [canvas] = useState(() => {
    const w = PAD + m.maxPx + PAD;
    const h = PAD + m.maxPx * CARD_ASPECT + PAD;
    return { w, h, viewport: stageViewport(w, h) };
  });

  const width = m.px;
  const height = width * CARD_ASPECT;
  const implied = diagonalFromLengthPx(width, CARD_W_MM / 10, dpr, resolution);
  const rounded = Math.round(implied * 10) / 10;
  const dims =
    unit === "cm"
      ? `${CARD_W_MM.toFixed(1)} × ${CARD_H_MM.toFixed(1)} mm`
      : `${(CARD_W_MM / 25.4).toFixed(2)} × ${(CARD_H_MM / 25.4).toFixed(2)} in`;

  const edgeDrag = m.startDrag((start, dx) => start + dx);
  // The corner scales along the card's own diagonal from the anchored
  // top-left: project the pointer's travel onto that direction.
  const cornerDrag = m.startDrag((start, dx, dy) => {
    const dir = growthDir("br");
    return widthFromDiagonalPx(start * CARD_DIAGONAL_RATIO + dx * dir.x + dy * dir.y);
  });

  const stage = (
    <div
      className="panel-inset overflow-auto rounded-md ring-1 ring-foreground/10"
      style={{ width: canvas.viewport.w, height: canvas.viewport.h }}
    >
      <div
        className="relative touch-none select-none"
        style={{ width: canvas.w, height: canvas.h }}
      >
        {/* Fixed corner guide: the card's top-left corner goes here. */}
        <div
          aria-hidden
          className={`absolute ${GUIDE_COLOR}`}
          style={{ left: PAD - GAP - STROKE, top: PAD - GAP - STROKE }}
        >
          <div
            className="absolute rounded-full bg-current"
            style={{ left: 0, top: 0, width: ARM + STROKE, height: STROKE }}
          />
          <div
            className="absolute rounded-full bg-current"
            style={{ left: 0, top: 0, width: STROKE, height: ARM + STROKE }}
          />
        </div>
        {/* Solid fill, not an outline: one unambiguous edge to match. */}
        <div
          className="absolute flex items-center justify-center overflow-hidden bg-foreground"
          style={{
            left: PAD,
            top: PAD,
            width,
            height,
            borderRadius: width * CORNER_R_RATIO,
          }}
        >
          {width >= LABEL_MIN_PX ? (
            <div className="flex flex-col items-center gap-0.5 text-center text-background">
              <span className="text-base font-medium">Your card goes here</span>
              <span className="font-mono text-sm">{dims}</span>
            </div>
          ) : null}
        </div>
        {/* Primary handle: the right edge. */}
        <div
          role="slider"
          tabIndex={0}
          aria-label="Right edge of the card shape"
          aria-orientation="horizontal"
          aria-valuemin={Math.round(m.minPx)}
          aria-valuemax={Math.round(m.maxPx)}
          aria-valuenow={Math.round(width * 10) / 10}
          aria-valuetext={`${width.toFixed(1)} pixels wide, screen about ${rounded.toFixed(1)} inches`}
          className={`absolute cursor-ew-resize rounded-full ${FOCUS_RING}`}
          style={{ left: PAD + width - 10, top: PAD - 6, width: 20, height: height + 12 }}
          onPointerDown={edgeDrag}
          onPointerMove={m.onPointerMove}
          onPointerUp={m.onPointerUp}
          onPointerCancel={m.onPointerUp}
          onKeyDown={m.onKeyDown}
        >
          <div className="absolute inset-y-6 left-1/2 w-1.5 -translate-x-1/2 rounded-full bg-background ring-1 ring-foreground/40" />
        </div>
        {/* Second grip on the same size: pointer-only, so keyboard users
            meet one control, not two that do the same thing. */}
        <div
          aria-hidden
          data-handle="corner"
          className="absolute cursor-nwse-resize rounded-full"
          style={{ left: PAD + width - 12, top: PAD + height - 12, width: 24, height: 24 }}
          onPointerDown={cornerDrag}
          onPointerMove={m.onPointerMove}
          onPointerUp={m.onPointerUp}
          onPointerCancel={m.onPointerUp}
        >
          <div className="absolute inset-1 rounded-full bg-background ring-2 ring-foreground/50" />
        </div>
      </div>
    </div>
  );

  return (
    <MeasureFrame
      width={canvas.viewport.w}
      title="Measure with a card"
      description="Push the card's top-left corner into the guide, then drag the right edge until it lines up with the card."
      illustration={<CardIllustration className="h-20 w-30 shrink-0" />}
      notice={notice}
      stage={stage}
      controls={<FineAdjust what="card" nudge={m.nudge} impliedIn={implied} />}
      onBack={onBack}
      onNext={() => onDone(implied)}
    />
  );
}
