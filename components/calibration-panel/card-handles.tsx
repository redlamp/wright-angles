"use client";

import { cn } from "@/lib/utils";
import {
  draggedCorner,
  type Box,
  type Corner,
  type Edge,
} from "@/lib/calibration-drag";

/** The four edge resize handles straddling the calibration card. */
export function EdgeHandles({
  box,
  heightPx,
  roundedImplied,
  rangeLow,
  rangeHigh,
  onEdgeDown,
  onHandleMove,
  onHandleUp,
  onEdgeKeyDown,
}: {
  box: Box;
  heightPx: number;
  roundedImplied: number;
  rangeLow: number;
  rangeHigh: number;
  onHandleMove: (e: React.PointerEvent) => void;
  onHandleUp: () => void;
  onEdgeDown: (edge: Edge) => (e: React.PointerEvent) => void;
  onEdgeKeyDown: (edge: Edge) => (e: React.KeyboardEvent) => void;
}) {
  return (
    <>
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
    </>
  );
}

/** The four corner resize handles on the calibration card. */
export function CornerHandles({
  box,
  heightPx,
  roundedImplied,
  rangeLow,
  rangeHigh,
  onCornerDown,
  onHandleMove,
  onHandleUp,
  onCornerKeyDown,
}: {
  box: Box;
  heightPx: number;
  roundedImplied: number;
  rangeLow: number;
  rangeHigh: number;
  onHandleMove: (e: React.PointerEvent) => void;
  onHandleUp: () => void;
  onCornerDown: (corner: Corner) => (e: React.PointerEvent) => void;
  onCornerKeyDown: (corner: Corner) => (e: React.KeyboardEvent) => void;
}) {
  return (
    <>
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
    </>
  );
}
