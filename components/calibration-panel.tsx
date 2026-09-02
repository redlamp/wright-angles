"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { displayLength } from "@/lib/units";
import {
  CARD_ASPECT,
  CARD_DIAGONAL_RATIO,
  CARD_H_MM,
  CARD_W_MM,
  COMMON_DIAGONALS_IN,
  cardWidthCssPx,
  diagonalFromCardPx,
  heightFromWidthPx,
  widthFromDiagonalPx,
  widthFromHeightPx,
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

/** Real ID-1 cards have a 3.18mm corner radius; scale it with the card. */
const CORNER_R_RATIO = 3.18 / CARD_W_MM;

/** Generous breathing room around the card so every edge/corner handle
 * stays grabbable and there's room to grow before hitting the dialog
 * wall. */
const STAGE_PAD_PX = 56;

/** Margin kept between the dialog and the viewport edge, on top of the
 * dialog's own padding — used both to cap how wide the card's drag
 * range is allowed to get and to cap the visible stage window. */
const DIALOG_MARGIN_PX = 96;

/**
 * Non-stage chrome inside the dialog when calibrating: header + optional
 * zoom warning + "I think the display is…" row + slider + the
 * implies/configured readout line + footer, plus the grid gaps and
 * padding between them. Kept as a single named budget rather than
 * measuring live, so this is a rough reservation, not exact — the
 * outer DialogContent's own max-height is the hard guarantee that the
 * dialog never exceeds the viewport even if this estimate runs short.
 */
const RESERVED_CHROME_PX = 380;
const MIN_STAGE_VIEWPORT_PX = 200;

/**
 * Below this width the full in-card label — name, "dimensions", the
 * measurements, and the cm/in toggle — can't fit at the app's normal
 * type size without wrapping into the card's own edges, so the whole
 * label drops rather than shrinking illegibly. That does mean the unit
 * toggle becomes unreachable below this width; the card being that
 * small means the user is already mid-drag toward a bigger one, so it
 * isn't the moment they'd reach for the toggle anyway.
 */
const LABEL_MIN_PX = 190;

type Edge = "left" | "right" | "top" | "bottom";
type Corner = "tl" | "tr" | "bl" | "br";

type Box = { width: number; left: number; top: number };

/** The corner OPPOSITE the one being dragged — it pins, exactly like an
 * edge drag pins its opposite edge. */
function pinnedCorner(corner: Corner, box: Box, heightPx: number) {
  switch (corner) {
    case "br":
      return { x: box.left, y: box.top };
    case "tl":
      return { x: box.left + box.width, y: box.top + heightPx };
    case "tr":
      return { x: box.left, y: box.top + heightPx };
    case "bl":
      return { x: box.left + box.width, y: box.top };
  }
}

/** The corner actually being dragged, same coordinate space. */
function draggedCorner(corner: Corner, box: Box, heightPx: number) {
  switch (corner) {
    case "br":
      return { x: box.left + box.width, y: box.top + heightPx };
    case "tl":
      return { x: box.left, y: box.top };
    case "tr":
      return { x: box.left + box.width, y: box.top };
    case "bl":
      return { x: box.left, y: box.top + heightPx };
  }
}

/** Unit vector, in canvas coordinates, pointing from a corner's pin
 * toward where dragging that corner GROWS the card — along the card's
 * own diagonal, not necessarily 45°, since the card isn't square. */
function growthDir(corner: Corner) {
  const x = 1 / CARD_DIAGONAL_RATIO;
  const y = CARD_ASPECT / CARD_DIAGONAL_RATIO;
  switch (corner) {
    case "br":
      return { x, y };
    case "tl":
      return { x: -x, y: -y };
    case "tr":
      return { x, y: -y };
    case "bl":
      return { x: -x, y };
  }
}

/** Box position for a corner drag: pin stays put, the card fills the
 * rectangle from the pin to (width, height) in the corner's quadrant. */
function boxFromCorner(
  corner: Corner,
  pin: { x: number; y: number },
  width: number,
  height: number,
): Box {
  switch (corner) {
    case "br":
      return { width, left: pin.x, top: pin.y };
    case "tl":
      return { width, left: pin.x - width, top: pin.y - height };
    case "tr":
      return { width, left: pin.x, top: pin.y - height };
    case "bl":
      return { width, left: pin.x - width, top: pin.y };
  }
}

type DragState =
  | {
      kind: "edge";
      edge: Edge;
      startX: number;
      startY: number;
      startWidth: number;
      startHeight: number;
      startLeft: number;
      startTop: number;
    }
  | {
      kind: "corner";
      corner: Corner;
      startX: number;
      startY: number;
      pin: { x: number; y: number };
      startCorner: { x: number; y: number };
    };

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

  // Snapshot the environment once per mount. dpr changes mid-session
  // (zooming, moving the window across monitors) invalidate the whole
  // exercise anyway, and the zoom warning covers that case.
  const [env] = useState(() => {
    const dpr = window.devicePixelRatio || 1;
    const initial = cardWidthCssPx(diagonalIn, aspect, resolution.w, dpr);
    // The drag range is about the card's PHYSICAL size, not the
    // viewport: a badly-wrong seed still has to be correctable, and a
    // small window must not quietly put the true size out of reach.
    // Fitting the dialog on screen is a separate, purely visual concern
    // — see stageW/H vs viewportW/H below.
    const minPx = initial * 0.4;
    const maxPx = initial * 3;
    // screen.width stays in zoom-independent CSS px while dpr scales
    // with page zoom, so their product against the native width reads
    // the zoom factor (same trick as the display-area chip, 11.1).
    const zoomSuspect =
      Math.abs((dpr * window.screen.width) / resolution.w - 1) > 0.02;
    // The stage CANVAS is fixed for the session so growing the card
    // never crowds the handles against its own wall. Dragging one edge
    // (or corner) pins the OPPOSITE one and leaves the box's starting
    // position otherwise untouched, so a single-direction drag from the
    // centred starting box can walk that edge up to maxPx away from
    // where it started — the canvas needs maxPx of room on BOTH sides
    // of centre (2×maxPx), not maxPx total, or a max-extent drag would
    // run past its own declared bounds. The visible stage VIEWPORT is a
    // capped, scrollable window onto that canvas — capped so the dialog
    // always fits, scrollable so the far edges of an oversized card
    // stay reachable rather than clipped.
    const canvasW = 2 * maxPx + 2 * STAGE_PAD_PX;
    const canvasH = heightFromWidthPx(2 * maxPx) + 2 * STAGE_PAD_PX;
    const viewportW = Math.min(
      canvasW,
      Math.max(280, window.innerWidth - DIALOG_MARGIN_PX),
    );
    const viewportH = Math.min(
      canvasH,
      Math.max(MIN_STAGE_VIEWPORT_PX, window.innerHeight - RESERVED_CHROME_PX),
    );
    return {
      dpr,
      initial,
      minPx,
      maxPx,
      zoomSuspect,
      canvasW,
      canvasH,
      viewportW,
      viewportH,
    };
  });

  const clampWidth = (v: number) => Math.min(Math.max(v, env.minPx), env.maxPx);
  const stageW = env.canvasW;
  const stageH = env.canvasH;

  // Box position is tracked independently of width so each edge/corner
  // can pin its opposite number: dragging left grows the card leftward
  // while the right edge stays put, dragging the bottom-right corner
  // grows it away from a fixed top-left corner, and so on.
  const [box, setBox] = useState<Box>(() => {
    const width = clampWidth(env.initial);
    const height = heightFromWidthPx(width);
    return {
      width,
      left: (stageW - width) / 2,
      top: (stageH - height) / 2,
    };
  });
  const heightPx = heightFromWidthPx(box.width);

  // When the canvas is bigger than the visible viewport, open scrolled
  // to the card rather than to the canvas's top-left corner.
  const viewportRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    el.scrollLeft = box.left + box.width / 2 - el.clientWidth / 2;
    el.scrollTop = box.top + heightPx / 2 - el.clientHeight / 2;
    // Only on mount — once the user has scrolled or dragged, their
    // position shouldn't get silently overridden by a re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const drag = useRef<DragState | null>(null);

  const onEdgeDown = (edge: Edge) => (e: React.PointerEvent) => {
    drag.current = {
      kind: "edge",
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

  const onCornerDown = (corner: Corner) => (e: React.PointerEvent) => {
    drag.current = {
      kind: "corner",
      corner,
      startX: e.clientX,
      startY: e.clientY,
      pin: pinnedCorner(corner, box, heightPx),
      startCorner: draggedCorner(corner, box, heightPx),
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onHandleMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    if (d.kind === "edge") {
      if (d.edge === "right" || d.edge === "left") {
        const dx = e.clientX - d.startX;
        const width = clampWidth(
          d.startWidth + (d.edge === "right" ? dx : -dx),
        );
        const height = heightFromWidthPx(width);
        const left =
          d.edge === "right"
            ? d.startLeft
            : d.startLeft + d.startWidth - width;
        // Cross-axis stays centred on where the drag started.
        const top = d.startTop + (d.startHeight - height) / 2;
        setBox({ width, left, top });
      } else {
        const dy = e.clientY - d.startY;
        const rawHeight = d.startHeight + (d.edge === "bottom" ? dy : -dy);
        const width = clampWidth(widthFromHeightPx(rawHeight));
        const height = heightFromWidthPx(width);
        const top =
          d.edge === "bottom"
            ? d.startTop
            : d.startTop + d.startHeight - height;
        const centerX = d.startLeft + d.startWidth / 2;
        setBox({ width, left: centerX - width / 2, top });
      }
    } else {
      // Corner: project the pointer's movement onto the card's own
      // diagonal direction, away from the fixed pin — that projected
      // distance IS the new diagonal length, which converts back to a
      // width the rest of the math already understands.
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      const cornerX = d.startCorner.x + dx;
      const cornerY = d.startCorner.y + dy;
      const dir = growthDir(d.corner);
      const diagonalPx =
        (cornerX - d.pin.x) * dir.x + (cornerY - d.pin.y) * dir.y;
      const width = clampWidth(widthFromDiagonalPx(diagonalPx));
      const height = heightFromWidthPx(width);
      setBox(boxFromCorner(d.corner, d.pin, width, height));
    }
  };

  const onHandleUp = () => {
    drag.current = null;
  };

  /**
   * Resize by keyboard. `role="slider"` on the handles is a promise
   * that arrows work, so the arrow that points along a handle's own
   * growth direction grows the card by a pixel, or ten with Shift — the
   * opposite edge/corner pins exactly as the pointer drag does.
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

  const onCornerKeyDown = (corner: Corner) => (e: React.KeyboardEvent) => {
    const dir = growthDir(corner);
    const signX = Math.sign(dir.x);
    const signY = Math.sign(dir.y);
    const grow =
      (e.key === "ArrowRight" && signX > 0) ||
      (e.key === "ArrowLeft" && signX < 0) ||
      (e.key === "ArrowDown" && signY > 0) ||
      (e.key === "ArrowUp" && signY < 0);
    const shrink =
      (e.key === "ArrowRight" && signX < 0) ||
      (e.key === "ArrowLeft" && signX > 0) ||
      (e.key === "ArrowDown" && signY < 0) ||
      (e.key === "ArrowUp" && signY > 0);
    if (!grow && !shrink) return;
    e.preventDefault();

    const step = (e.shiftKey ? 10 : 1) * (grow ? 1 : -1);
    const width = clampWidth(box.width + step);
    const height = heightFromWidthPx(width);
    setBox(boxFromCorner(corner, pinnedCorner(corner, box, heightPx), width, height));
  };

  // Coarse control: scales from the card's CURRENT centre rather than
  // pinning any one edge, since the slider isn't attached to a side.
  const onSliderChange = (v: number | readonly number[]) => {
    const width = clampWidth(Array.isArray(v) ? v[0] : v);
    const height = heightFromWidthPx(width);
    const centerX = box.left + box.width / 2;
    const centerY = box.top + heightPx / 2;
    setBox({ width, left: centerX - width / 2, top: centerY - height / 2 });
  };

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
                  top:
                    (edge === "bottom" ? box.top + heightPx : box.top) - 8,
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
                onPointerMove={onHandleMove}
                onPointerUp={onHandleUp}
                onPointerCancel={onHandleUp}
                onKeyDown={onEdgeKeyDown(edge)}
              >
                {/* bg-background + ring, not bg-foreground/40: the grip
                    mark has to read against BOTH the page and the
                    now-solid (opaque) card fill it straddles. */}
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

          {(["tl", "tr", "bl", "br"] as const).map((corner) => {
            const point = draggedCorner(corner, box, heightPx);
            const cursor =
              corner === "tl" || corner === "br" ? "nwse-resize" : "nesw-resize";
            return (
              <div
                key={corner}
                role="slider"
                tabIndex={0}
                aria-label={`${corner === "tl" ? "top-left" : corner === "tr" ? "top-right" : corner === "bl" ? "bottom-left" : "bottom-right"} corner of calibration card`}
                aria-valuenow={roundedImplied}
                aria-valuemin={Math.round(rangeLow * 10) / 10}
                aria-valuemax={Math.round(rangeHigh * 10) / 10}
                aria-valuetext={`${roundedImplied.toFixed(1)} inch diagonal`}
                className="absolute touch-none rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
                style={{
                  left: point.x - 9,
                  top: point.y - 9,
                  width: 18,
                  height: 18,
                  cursor,
                }}
                onPointerDown={onCornerDown(corner)}
                onPointerMove={onHandleMove}
                onPointerUp={onHandleUp}
                onPointerCancel={onHandleUp}
                onKeyDown={onCornerKeyDown(corner)}
              >
                <div className="absolute inset-1 rounded-full bg-background ring-1 ring-foreground/30" />
              </div>
            );
          })}
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
