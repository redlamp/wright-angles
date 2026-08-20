"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { displayLength } from "@/lib/units";
import {
  CARD_H_MM,
  CARD_W_MM,
  COMMON_DIAGONALS_IN,
  cardWidthCssPx,
  diagonalFromCardPx,
  heightFromWidthPx,
  widthFromHeightPx,
} from "@/lib/calibration";
import type { Aspect, LengthUnit, Resolution } from "@/lib/types";
import { useSettingsStore } from "@/stores/settings-store";
import { Button } from "@/components/ui/button";
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** Real ID-1 cards have a 3.18mm corner radius; scale it with the card. */
const CORNER_R_RATIO = 3.18 / CARD_W_MM;

/** Generous breathing room around the card so every edge handle stays
 * grabbable and there's room to grow before hitting the dialog wall. */
const STAGE_PAD_PX = 56;

type Edge = "left" | "right" | "top" | "bottom";

/**
 * Credit-card screen calibration body (test plan 11.2): hold a real
 * ID-1 bank card against the screen, resize the shape by dragging any
 * of its four edges until they match, and the card's known 85.60mm
 * width measures the panel's true pixels-per-cm — hence its true
 * diagonal.
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
  const globalUnit = useSettingsStore((s) => s.unit);
  const [unit, setUnit] = useState<LengthUnit>(globalUnit);

  // Snapshot the environment once per mount. dpr changes mid-session
  // (zooming, moving the window across monitors) invalidate the whole
  // exercise anyway, and the zoom warning covers that case.
  const [env] = useState(() => {
    const dpr = window.devicePixelRatio || 1;
    const initial = cardWidthCssPx(diagonalIn, aspect, resolution.w, dpr);
    // Wide adjustment range, capped so the stage still fits the
    // viewport — bounded generously rather than tightly, per "room to
    // scale" (a card that doesn't fit on screen can't be calibrated
    // against anyway).
    const minPx = initial * 0.4;
    const maxPx = Math.min(
      initial * 3,
      Math.max(360, window.innerWidth - 2 * STAGE_PAD_PX - 96),
    );
    // screen.width stays in zoom-independent CSS px while dpr scales
    // with page zoom, so their product against the native width reads
    // the zoom factor (same trick as the display-area chip, 11.1).
    const zoomSuspect =
      Math.abs((dpr * window.screen.width) / resolution.w - 1) > 0.02;
    return { dpr, initial, minPx, maxPx, zoomSuspect };
  });

  const clampWidth = (v: number) => Math.min(Math.max(v, env.minPx), env.maxPx);

  // The stage is sized to the card's MAX extent plus padding, fixed for
  // the session, so growing the card never crowds the handles against
  // the dialog wall.
  const stageW = env.maxPx + 2 * STAGE_PAD_PX;
  const stageH = heightFromWidthPx(env.maxPx) + 2 * STAGE_PAD_PX;

  // Box position is tracked independently of width so each edge can pin
  // its opposite number: dragging left grows the card leftward while
  // the right edge stays put, and so on for all four edges.
  const [box, setBox] = useState(() => {
    const width = clampWidth(env.initial);
    const height = heightFromWidthPx(width);
    return {
      width,
      left: (stageW - width) / 2,
      top: (stageH - height) / 2,
    };
  });
  const heightPx = heightFromWidthPx(box.width);

  const drag = useRef<{
    edge: Edge;
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
    startLeft: number;
    startTop: number;
  } | null>(null);

  const onEdgeDown = (edge: Edge) => (e: React.PointerEvent) => {
    drag.current = {
      edge,
      startX: e.clientX,
      startY: e.clientY,
      startWidth: box.width,
      startHeight: heightPx,
      startLeft: box.left,
      startTop: box.top,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onEdgeMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    if (d.edge === "right" || d.edge === "left") {
      const dx = e.clientX - d.startX;
      const width = clampWidth(d.startWidth + (d.edge === "right" ? dx : -dx));
      const height = heightFromWidthPx(width);
      const left =
        d.edge === "right" ? d.startLeft : d.startLeft + d.startWidth - width;
      // Cross-axis stays centred on where the drag started.
      const top = d.startTop + (d.startHeight - height) / 2;
      setBox({ width, left, top });
    } else {
      const dy = e.clientY - d.startY;
      const rawHeight = d.startHeight + (d.edge === "bottom" ? dy : -dy);
      const width = clampWidth(widthFromHeightPx(rawHeight));
      const height = heightFromWidthPx(width);
      const top =
        d.edge === "bottom" ? d.startTop : d.startTop + d.startHeight - height;
      const centerX = d.startLeft + d.startWidth / 2;
      setBox({ width, left: centerX - width / 2, top });
    }
  };

  const onEdgeUp = () => {
    drag.current = null;
  };

  /**
   * Resize by keyboard. The slider this panel used to carry was the only
   * way in without a pointer, and `role="slider"` on the handles is a
   * promise that arrows work — so the arrow that points along a handle's
   * axis grows or shrinks the card by a pixel, or ten with Shift.
   */
  const onEdgeKeyDown = (edge: Edge) => (e: React.KeyboardEvent) => {
    const grow =
      e.key === (edge === "left" || edge === "top" ? "ArrowUp" : "ArrowDown") ||
      e.key ===
        (edge === "left" || edge === "top" ? "ArrowLeft" : "ArrowRight");
    const shrink =
      e.key === (edge === "left" || edge === "top" ? "ArrowDown" : "ArrowUp") ||
      e.key ===
        (edge === "left" || edge === "top" ? "ArrowRight" : "ArrowLeft");
    if (!grow && !shrink) return;
    e.preventDefault();

    const step = (e.shiftKey ? 10 : 1) * (grow ? 1 : -1);
    const width = clampWidth(box.width + step);
    const height = heightFromWidthPx(width);
    // Same pinning as the drag: the edge you are on moves, its opposite
    // number stays put, and the cross-axis holds its centre.
    const left =
      edge === "left"
        ? box.left + box.width - width
        : edge === "right"
          ? box.left
          : box.left + (box.width - width) / 2;
    const top =
      edge === "top"
        ? box.top + heightPx - height
        : edge === "bottom"
          ? box.top
          : box.top + (heightPx - height) / 2;
    setBox({ width, left, top });
  };

  // Inverted on purpose: a SMALLER card on screen means a BIGGER panel,
  // so the widest the card can go is the LOW end of the diagonal range.
  const rangeLow = diagonalFromCardPx(env.maxPx, env.dpr, resolution);
  const rangeHigh = diagonalFromCardPx(env.minPx, env.dpr, resolution);

  const implied = diagonalFromCardPx(box.width, env.dpr, resolution);
  const roundedImplied = Math.round(implied * 10) / 10;

  // Card dims for the in-card label, in whichever unit is toggled —
  // same displayLength() edge conversion every other unit toggle uses,
  // just formatted to 2dp since the card itself is small.
  const wCm = CARD_W_MM / 10;
  const hCm = CARD_H_MM / 10;
  const shownW = (unit === "cm" ? wCm : displayLength(wCm, "cm", "in")).toFixed(2);
  const shownH = (unit === "cm" ? hCm : displayLength(hCm, "cm", "in")).toFixed(2);

  // Legible-at-every-scale: fade out the finer text first, then the
  // whole label, rather than clipping or overflowing a shrinking card.
  const showDims = box.width >= 130;
  const showLabel = box.width >= 88;
  const nameSize = Math.min(13, Math.max(9, box.width / 15));
  const dimsSize = Math.min(11, Math.max(8, box.width / 19));

  return (
    <>
      <DialogHeader>
        <DialogTitle>Calibrate screen size</DialogTitle>
        <DialogDescription>
          Hold any bank card flat against the screen over the shape, then
          drag any of its edges until the shape matches the card exactly.
          Browser zoom must be at 100%.
        </DialogDescription>
      </DialogHeader>

      {env.zoomSuspect ? (
        <p className="rounded-md bg-[#f5a524]/15 px-2.5 py-1.5 text-sm text-[#b97e0c] dark:text-[#f5a524]">
          Browser zoom isn&rsquo;t 100% (or This Device&rsquo;s resolution
          doesn&rsquo;t match this screen) — calibration will be unreliable
          until that&rsquo;s fixed.
        </p>
      ) : null}

      <div
        className="relative mx-auto select-none"
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
            <div className="flex flex-col items-center gap-0.5 px-1 text-center leading-tight text-background">
              <span
                className="font-medium"
                style={{ fontSize: nameSize }}
              >
                Standard Bank Card
              </span>
              <span
                className="text-background/70"
                style={{ fontSize: nameSize }}
              >
                dimensions
              </span>
              {showDims ? (
                <div
                  className="mt-1 flex items-center gap-1 font-mono"
                  style={{ fontSize: dimsSize }}
                >
                  <span>
                    {shownW} × {shownH} {unit}
                  </span>
                  <div className="flex overflow-hidden rounded-sm border border-background/40">
                    {(["cm", "in"] as const).map((u) => (
                      <button
                        key={u}
                        type="button"
                        onClick={() => setUnit(u)}
                        className={cn(
                          "px-1 transition-colors",
                          u === unit
                            ? "bg-background/30"
                            : "text-background/60 hover:text-background",
                        )}
                      >
                        {u}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {(["left", "right", "top", "bottom"] as const).map((edge) => {
          const horizontal = edge === "left" || edge === "right";
          const style = horizontal
            ? {
                left:
                  (edge === "right" ? box.left + box.width : box.left) - 8,
                top: box.top - 8,
                width: 16,
                height: heightPx + 16,
                cursor: "ew-resize" as const,
              }
            : {
                left: box.left - 8,
                top: (edge === "bottom" ? box.top + heightPx : box.top) - 8,
                width: box.width + 16,
                height: 16,
                cursor: "ns-resize" as const,
              };
          return (
            <div
              key={edge}
              role="slider"
              tabIndex={0}
              aria-label={`${edge} edge of calibration card`}
              aria-valuenow={roundedImplied}
              aria-valuemin={Math.round(rangeLow * 10) / 10}
              aria-valuemax={Math.round(rangeHigh * 10) / 10}
              aria-valuetext={`${roundedImplied.toFixed(1)} inch diagonal`}
              className="absolute touch-none rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
              style={style}
              onPointerDown={onEdgeDown(edge)}
              onPointerMove={onEdgeMove}
              onPointerUp={onEdgeUp}
              onKeyDown={onEdgeKeyDown(edge)}
            >
              {/* bg-background + ring, not bg-foreground/40: the grip mark
                  has to read against BOTH the page and the now-solid
                  (opaque) card fill it straddles. */}
              <div
                className={cn(
                  "absolute rounded-full bg-background ring-1 ring-foreground/30",
                  horizontal
                    ? "inset-y-2 left-1/2 w-1 -translate-x-1/2"
                    : "inset-x-2 top-1/2 h-1 -translate-y-1/2",
                )}
              />
            </div>
          );
        })}
      </div>

      <p className="font-mono text-sm text-muted-foreground">
        implies {implied.toFixed(1)}″ — configured {diagonalIn.toFixed(1)}″
      </p>

      <div className="space-y-1.5 border-t border-border pt-2.5">
        <span className="text-sm text-muted-foreground">
          I think the display is:
        </span>
        <div className="flex flex-wrap gap-1">
          {COMMON_DIAGONALS_IN.map((size) => (
            <button
              key={size}
              type="button"
              onClick={() => onApply(size)}
              className="rounded-full border border-border px-2 py-0.5 text-sm text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground"
            >
              {size}″
            </button>
          ))}
        </div>
      </div>

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
