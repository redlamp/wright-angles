"use client";

import { useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import type { Vector3 } from "three";

/** Centimeters between figures in a row, and between rows (one row per pack, stacked like shelves). */
export const SPACING = 90;
export const ROW_H = 250;

type OrthoCam = {
  zoom: number;
  position: Vector3;
  updateProjectionMatrix: () => void;
};

/** Point the orthographic camera and the pan controls at (cx, cy) with the given zoom. */
function aim(
  cam: OrthoCam,
  controls: { target: Vector3; update: () => void },
  cx: number,
  cy: number,
  zoom: number,
) {
  cam.zoom = zoom;
  cam.position.set(cx, cy, 3000);
  cam.updateProjectionMatrix();
  controls.target.set(cx, cy, 0);
  controls.update();
}

/**
 * Frames every shown row on mount and whenever Fit is pressed or the packs
 * change, and never otherwise: zoom and pan stay wherever you leave them.
 */
export function Framer({
  fit,
  rows,
  widest,
}: {
  fit: number;
  rows: number;
  widest: number;
}) {
  const get = useThree((s) => s.get);
  const controls = useThree((s) => s.controls) as {
    target: Vector3;
    update: () => void;
  } | null;
  const layout = useRef({ rows, widest });
  useEffect(() => {
    layout.current = { rows, widest };
  });
  useEffect(() => {
    if (!controls) return;
    const { camera, size, invalidate } = get();
    if (!size.width || !size.height) return;
    const { rows: rn, widest: wd } = layout.current;
    const n = Math.max(1, rn);
    const w = (wd + 3) * SPACING;
    const h = n * ROW_H + 60;
    const cx = ((wd - 1) * SPACING) / 2 - SPACING / 2;
    const cy = -((n - 1) * ROW_H) / 2 + 90;
    aim(
      camera as unknown as OrthoCam,
      controls,
      cx,
      cy,
      Math.min(size.width / w, size.height / h),
    );
    invalidate();
  }, [fit, controls, get]);
  return null;
}

/**
 * Ctrl + wheel scrolls the view (up and down; with Shift, sideways) instead
 * of zooming. Caught in the capture phase on the canvas's container, ahead
 * of the orbit controls and of the browser's own Ctrl-wheel page zoom.
 */
export function CtrlScroll() {
  const get = useThree((s) => s.get);
  useEffect(() => {
    const el = get().gl.domElement.parentElement;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      e.stopPropagation();
      const { camera, controls, invalidate } = get();
      const cam = camera as unknown as OrthoCam;
      const ctl = controls as unknown as {
        target: Vector3;
        update: () => void;
      } | null;
      const step = (e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY) / cam.zoom;
      const dx = e.shiftKey ? step : 0;
      const dy = e.shiftKey ? 0 : -step;
      cam.position.x += dx;
      cam.position.y += dy;
      if (ctl) {
        ctl.target.x += dx;
        ctl.target.y += dy;
        ctl.update();
      }
      invalidate();
    };
    el.addEventListener("wheel", onWheel, { capture: true, passive: false });
    return () => el.removeEventListener("wheel", onWheel, { capture: true });
  }, [get]);
  return null;
}
