"use client";

import { useEffect } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import { setBodyCursor } from "./device-rect-helpers";

/**
 * DeviceRect's floor-node drag: pointer handlers that drag the viewing
 * distance along the floor (null without onDistanceDrag), plus the
 * unmount cleanup for the body cursor they set.
 */
export function useDistanceDrag(
  onDistanceDrag: ((distanceCm: number) => void) | undefined,
  onDragState: ((dragging: boolean) => void) | undefined,
) {
  // setBodyCursor writes to document.body, outside this component's own
  // DOM — if it unmounts (device removed, media changes the tree) mid
  // hover/drag, nothing else clears that cursor back to normal.
  useEffect(() => {
    return () => setBodyCursor("");
  }, []);

  // Shared by the node's hit sphere AND the distance text, so both drag
  // the viewing distance and both advertise it: open hand on hover,
  // closed fist while dragging. The grab cursor is a promise — anything
  // showing it must actually drag.
  const dragHandlers = onDistanceDrag
    ? {
        onPointerOver: (e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          setBodyCursor("grab");
        },
        onPointerOut: (e: ThreeEvent<PointerEvent>) => {
          // Keep the fist while a captured drag passes outside the target.
          if (!(e.target as Element).hasPointerCapture?.(e.pointerId)) {
            setBodyCursor("");
          }
        },
        onPointerDown: (e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          (e.target as Element).setPointerCapture(e.pointerId);
          onDragState?.(true);
          setBodyCursor("grabbing");
        },
        onPointerMove: (e: ThreeEvent<PointerEvent>) => {
          if (!(e.target as Element).hasPointerCapture?.(e.pointerId)) {
            return;
          }
          // Project the pointer ray onto the floor plane (y = 0);
          // its world z IS the new viewing distance.
          const t = -e.ray.origin.y / e.ray.direction.y;
          if (t > 0) {
            const z = e.ray.origin.z + e.ray.direction.z * t;
            onDistanceDrag(Math.round(Math.min(9999, Math.max(10, z))));
          }
        },
        onPointerUp: (e: ThreeEvent<PointerEvent>) => {
          (e.target as Element).releasePointerCapture?.(e.pointerId);
          onDragState?.(false);
          // Back to the open hand; if the pointer ended off-target, the
          // pointerout that follows the release clears it entirely.
          setBodyCursor("grab");
        },
        onClick: (e: ThreeEvent<MouseEvent>) => e.stopPropagation(),
      }
    : null;
  return dragHandlers;
}

export type DistanceDragHandlers = ReturnType<typeof useDistanceDrag>;
