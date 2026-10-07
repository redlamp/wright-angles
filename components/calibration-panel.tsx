"use client";

import { cn } from "@/lib/utils";
import { displayLength } from "@/lib/units";
import {
  CARD_H_MM,
  CARD_W_MM,
  COMMON_DIAGONALS_IN,
  diagonalFromCardPx,
} from "@/lib/calibration";
import type { Aspect, Resolution } from "@/lib/types";
import { useSettingsStore } from "@/stores/settings-store";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { SegmentedToggle } from "@/components/panels/settings-panel";
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CORNER_R_RATIO, LABEL_MIN_PX } from "./calibration-panel/constants";
import { useCardBox } from "./calibration-panel/use-card-box";
import { CornerHandles, EdgeHandles } from "./calibration-panel/card-handles";

/**
 * Credit-card screen calibration body (test plan 11.2): hold a real
 * ID-1 bank card against the screen, resize the shape by dragging any
 * of its four edges or four corners until it matches, and the card's
 * known 85.60mm width measures the panel's true pixels-per-cm — hence
 * its true diagonal.
 *
 * Deliberately just the panel body (header/warning/card/readout/footer),
 * no DialogContent wrapper, so it can be dropped into the standalone
 * `CalibrationDialog` (from Settings) and into an onboarding sub-step
 * without nesting a second Dialog inside the first.
 */
export function CalibrationPanel({
  aspect,
  resolution,
  diagonalIn,
  onApply,
  onCancel,
  cancelLabel = "Cancel",
}: {
  aspect: Aspect;
  resolution: Resolution;
  diagonalIn: number;
  onApply: (diagonalIn: number) => void;
  onCancel: () => void;
  cancelLabel?: string;
}) {
  // The unit toggle drives the app's global setting, same as everywhere
  // else it appears — this dialog doesn't get its own private notion of
  // which unit "cm × in" reads in.
  const unit = useSettingsStore((s) => s.unit);
  const setUnit = useSettingsStore((s) => s.setUnit);

  const {
    env,
    stageW,
    stageH,
    box,
    heightPx,
    viewportRef,
    onEdgeDown,
    onCornerDown,
    onHandleMove,
    onHandleUp,
    onEdgeKeyDown,
    onCornerKeyDown,
    onSliderChange,
  } = useCardBox({ aspect, resolution, diagonalIn });

  // Inverted on purpose: a SMALLER card on screen means a BIGGER panel,
  // so the widest the card can go is the LOW end of the diagonal range.
  const rangeLow = diagonalFromCardPx(env.maxPx, env.dpr, resolution);
  const rangeHigh = diagonalFromCardPx(env.minPx, env.dpr, resolution);

  const implied = diagonalFromCardPx(box.width, env.dpr, resolution);
  const roundedImplied = Math.round(implied * 10) / 10;

  // Card dims, in whichever unit the app is currently set to — same
  // displayLength() edge conversion every other unit toggle uses, just
  // formatted to 2dp since the card itself is small.
  const wCm = CARD_W_MM / 10;
  const hCm = CARD_H_MM / 10;
  const shownW = (unit === "cm" ? wCm : displayLength(wCm, "cm", "in")).toFixed(2);
  const shownH = (unit === "cm" ? hCm : displayLength(hCm, "cm", "in")).toFixed(2);

  const showLabel = box.width >= LABEL_MIN_PX;

  return (
    <>
      <DialogHeader>
        <DialogTitle>Calibrate screen size</DialogTitle>
        <DialogDescription>
          Hold any bank card flat against the screen over the shape, then
          drag any of its edges or corners until the shape matches the
          card exactly. Browser zoom must be at 100%.
        </DialogDescription>
      </DialogHeader>

      {env.zoomSuspect ? (
        <p className="rounded-md bg-[#f5a524]/15 px-2.5 py-1.5 text-sm text-[#b97e0c] dark:text-[#f5a524]">
          Browser zoom isn&rsquo;t 100% (or This Device&rsquo;s resolution
          doesn&rsquo;t match this screen) — calibration will be unreliable
          until that&rsquo;s fixed.
        </p>
      ) : null}

      {/* The lazy alternative to measuring, offered before the stage —
          not buried below it — for anyone who'd rather not bother. */}
      <div className="space-y-1.5">
        <span className="text-sm text-muted-foreground">
          I think the display is:
        </span>
        <div className="flex flex-wrap gap-1">
          {COMMON_DIAGONALS_IN.map((size) => (
            <button
              key={size}
              type="button"
              onClick={() => onApply(size)}
              className={cn(
                "rounded-md px-1.5 py-0.5 font-mono text-sm transition-colors",
                size === diagonalIn
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground hover:text-foreground",
              )}
            >
              {size}″
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable VIEWPORT, capped to fit the dialog on screen — the
          CANVAS inside it stays full-extent so the card can still reach
          its true physical size even when that's bigger than the
          window. Most of the time viewportW/H === canvasW/H and there's
          nothing to scroll. */}
      <div
        ref={viewportRef}
        className="panel-inset mx-auto overflow-auto rounded-md"
        style={{ width: env.viewportW, height: env.viewportH }}
      >
        <div
          className="relative select-none"
          style={{ width: stageW, height: stageH }}
        >
          {/* Solid fill, not an outline — a bordered/translucent box left
              people unsure whether to line the card up with the border or
              the fill. A solid shape has one unambiguous edge. */}
          <div
            className="absolute flex items-center justify-center overflow-hidden bg-foreground"
            style={{
              width: box.width,
              height: heightPx,
              left: box.left,
              top: box.top,
              borderRadius: box.width * CORNER_R_RATIO,
            }}
          >
            {showLabel ? (
              <div className="flex flex-col items-center gap-1 px-2 text-center leading-tight text-background">
                <span className="text-base font-medium">
                  Standard Bank Card
                </span>
                <span className="text-sm text-background/70">
                  dimensions
                </span>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <span className="font-mono text-sm">
                    {shownW} × {shownH}
                  </span>
                  <SegmentedToggle
                    onFill
                    value={unit}
                    options={[
                      { value: "cm", label: "cm" },
                      { value: "in", label: "in" },
                    ]}
                    onChange={setUnit}
                  />
                </div>
              </div>
            ) : null}
          </div>

          <EdgeHandles
            box={box}
            heightPx={heightPx}
            roundedImplied={roundedImplied}
            rangeLow={rangeLow}
            rangeHigh={rangeHigh}
            onHandleMove={onHandleMove}
            onHandleUp={onHandleUp}
            onEdgeDown={onEdgeDown}
            onEdgeKeyDown={onEdgeKeyDown}
          />

          <CornerHandles
            box={box}
            heightPx={heightPx}
            roundedImplied={roundedImplied}
            rangeLow={rangeLow}
            rangeHigh={rangeHigh}
            onHandleMove={onHandleMove}
            onHandleUp={onHandleUp}
            onCornerDown={onCornerDown}
            onCornerKeyDown={onCornerKeyDown}
          />
        </div>
      </div>

      {/* Coarse control alongside the edges/corners — a big misjudged
          seed is faster to fix in one slider drag than several. */}
      <Slider
        min={env.minPx}
        max={env.maxPx}
        step={0.25}
        value={box.width}
        aria-label="card size, coarse"
        onValueChange={onSliderChange}
      />

      {/* This readout is about the PANEL (what the drag implies vs
          what's configured), not the card — it stays here regardless
          of where the card's own label lives. */}
      <p className="font-mono text-sm text-muted-foreground">
        implies {implied.toFixed(1)}″ — configured {diagonalIn.toFixed(1)}″
      </p>

      <DialogFooter>
        <Button variant="ghost" onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button onClick={() => onApply(roundedImplied)}>
          Apply {roundedImplied.toFixed(1)}″
        </Button>
      </DialogFooter>
    </>
  );
}
