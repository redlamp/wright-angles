import { useEffect, useState } from "react";
import type { ScreenReadings } from "@/lib/calibration-precheck";
import { zoomHintFromWindow } from "@/lib/screen-detect";

function read(): ScreenReadings {
  return {
    screenW: window.screen.width,
    screenH: window.screen.height,
    dpr: window.devicePixelRatio || 1,
    zoomHint: zoomHintFromWindow(window.outerWidth, window.innerWidth),
  };
}

/**
 * What the browser reports about the screen, kept live: page zoom and
 * moving the window to another monitor both fire `resize`, so pressing
 * Ctrl+0 clears the zoom notice without reopening the panel, and the
 * measurement always multiplies by the CURRENT devicePixelRatio.
 */
export function useScreenReadings(): ScreenReadings {
  const [readings, setReadings] = useState(read);
  useEffect(() => {
    const update = () => setReadings(read());
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return readings;
}
