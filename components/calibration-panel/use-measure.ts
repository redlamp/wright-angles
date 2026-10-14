import { useRef, useState } from "react";
import { fineStepPx } from "@/lib/calibration";
import {
  DIALOG_MARGIN_PX,
  MIN_STAGE_VIEWPORT_PX,
  RANGE_MAX,
  RANGE_MIN,
  RESERVED_CHROME_PX,
} from "./constants";

type Drag = {
  startX: number;
  startY: number;
  startPx: number;
  project: (startPx: number, dx: number, dy: number) => number;
};

/**
 * One measured length on the stage (the card's width, the ruler bar),
 * held as CSS px per real millimetre so switching the ruler between
 * 10 and 15 cm keeps the user's scale. Owns the drag, the keyboard
 * pattern of the `role="slider"` handle, and the ±0.1 mm fine adjust.
 */
export function useMeasure({
  seedPxPerMm,
  lengthMm,
}: {
  seedPxPerMm: number;
  lengthMm: number;
}) {
  const [range] = useState(() => ({
    min: seedPxPerMm * RANGE_MIN,
    max: seedPxPerMm * RANGE_MAX,
  }));
  const clamp = (v: number) => Math.min(Math.max(v, range.min), range.max);
  const [pxPerMm, setPxPerMm] = useState(() => clamp(seedPxPerMm));
  const px = pxPerMm * lengthMm;
  const setPx = (next: number) => setPxPerMm(clamp(next / lengthMm));

  const drag = useRef<Drag | null>(null);

  /** Pointer-down for a handle; `project` maps the pointer's offset
   * from where the drag began to the new length in px. */
  const startDrag =
    (project: Drag["project"]) => (e: React.PointerEvent) => {
      drag.current = { startX: e.clientX, startY: e.clientY, startPx: px, project };
      e.currentTarget.setPointerCapture(e.pointerId);
      e.preventDefault();
    };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    setPx(d.project(d.startPx, e.clientX - d.startX, e.clientY - d.startY));
  };
  const onPointerUp = () => {
    drag.current = null;
  };

  /** Grow (positive) or shrink by `mm` of real length. */
  const nudge = (mm: number) =>
    setPxPerMm((v) => clamp(v + fineStepPx(v * lengthMm, lengthMm, mm) / lengthMm));

  /**
   * Slider keyboard pattern: Right/Up grow by 0.1 mm, Left/Down shrink,
   * Shift for 1 mm, PageUp/PageDown 5 mm, Home/End the range ends.
   */
  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 1 : 0.1;
    switch (e.key) {
      case "ArrowRight":
      case "ArrowUp":
        nudge(step);
        break;
      case "ArrowLeft":
      case "ArrowDown":
        nudge(-step);
        break;
      case "PageUp":
        nudge(5);
        break;
      case "PageDown":
        nudge(-5);
        break;
      case "Home":
        setPxPerMm(range.min);
        break;
      case "End":
        setPxPerMm(range.max);
        break;
      default:
        return;
    }
    e.preventDefault();
  };

  return {
    pxPerMm,
    px,
    minPx: range.min * lengthMm,
    maxPx: range.max * lengthMm,
    maxPxPerMm: range.max,
    startDrag,
    onPointerMove,
    onPointerUp,
    nudge,
    onKeyDown,
  };
}

/** The visible stage window for a canvas: capped so the dialog fits,
 * scrollable (by the caller) so an oversized shape stays reachable. */
export function stageViewport(canvasW: number, canvasH: number) {
  return {
    w: Math.min(canvasW, Math.max(280, window.innerWidth - DIALOG_MARGIN_PX)),
    h: Math.min(
      canvasH,
      Math.max(MIN_STAGE_VIEWPORT_PX, window.innerHeight - RESERVED_CHROME_PX),
    ),
  };
}
