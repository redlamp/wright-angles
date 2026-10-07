import type { Device } from "@/lib/types";

/** One device rect in the 2D stack, in CSS px (DisplayArea's `rects`). */
export interface DeviceRect {
  device: Device & { isThis?: boolean };
  w: number;
  h: number;
}

/** A point in the display container's client coordinates. */
export interface Point {
  x: number;
  y: number;
}
