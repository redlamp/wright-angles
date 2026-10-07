import { useEffect, useRef, useState } from "react";
import { zoomWarningPct } from "@/lib/browser-zoom";
import {
  cardWidthCssPx,
  heightFromWidthPx,
  widthFromDiagonalPx,
  widthFromHeightPx,
} from "@/lib/calibration";
import {
  boxFromCorner,
  draggedCorner,
  growthDir,
  pinnedCorner,
  type Box,
  type Corner,
  type Edge,
} from "@/lib/calibration-drag";
import type { Aspect, Resolution } from "@/lib/types";
import {
  DIALOG_MARGIN_PX,
  MIN_STAGE_VIEWPORT_PX,
  RESERVED_CHROME_PX,
  STAGE_PAD_PX,
} from "./constants";

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
 * The calibration card's size and position on the stage canvas, plus
 * the pointer, keyboard and slider handlers that resize it.
 */
export function useCardBox({
  aspect,
  resolution,
  diagonalIn,
}: {
  aspect: Aspect;
  resolution: Resolution;
  diagonalIn: number;
}) {
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
    // Same check as the display-area chip; see lib/browser-zoom.
    const zoomSuspect =
      zoomWarningPct(window.screen.width, dpr, resolution.w) !== null;
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

  return {
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
  };
}
