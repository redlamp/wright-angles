"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Where the window's client area sits on the physical screen, in CSS px.
 * screenX/screenY are virtual-desktop coordinates; availLeft/availTop
 * (Chromium) locate this monitor in that space. Browser chrome is
 * estimated from the outer/inner delta (borders split left/right, the
 * rest is the title/tab bar). Polled — there is no window-move event.
 */
type ScreenViewport = {
  clientX: number;
  clientY: number;
  screenW: number;
  screenH: number;
} | null;

export function useScreenViewport() {
  const [vp, setVp] = useState<ScreenViewport>(null);
  // Mirrors the last value OUTSIDE React state so "did it move" can be
  // computed synchronously, in plain code — not by reading a variable an
  // updater function assigns as a side effect, which only works when
  // React happens to run that updater eagerly (it isn't a guaranteed
  // contract of setState).
  const vpRef = useRef<ScreenViewport>(null);

  useEffect(() => {
    // Adaptive cadence: idle at 2Hz, but the moment the window moves,
    // poll at ~30fps until it has been still for a beat. There is no
    // window-move event, so change detection IS the drag sensor.
    const IDLE_MS = 500;
    const FAST_MS = 33;
    const SETTLE_MS = 700;
    let timer = 0;
    let lastMoveAt = -Infinity;
    let stopped = false;

    const read = () => {
      if (stopped) return;
      // Resize also calls read; clearing first keeps a single timer chain.
      window.clearTimeout(timer);
      const chromeX = Math.max(0, (window.outerWidth - window.innerWidth) / 2);
      const chromeY = Math.max(
        0,
        window.outerHeight - window.innerHeight - chromeX,
      );
      const s = window.screen as Screen & {
        availLeft?: number;
        availTop?: number;
      };
      const next = {
        clientX: window.screenX + chromeX - (s.availLeft ?? 0),
        clientY: window.screenY + chromeY - (s.availTop ?? 0),
        screenW: s.width,
        screenH: s.height,
      };
      const prev = vpRef.current;
      const unchanged =
        prev &&
        prev.clientX === next.clientX &&
        prev.clientY === next.clientY &&
        prev.screenW === next.screenW &&
        prev.screenH === next.screenH;
      if (!unchanged) {
        const moved = prev !== null;
        vpRef.current = next;
        setVp(next);
        if (moved) lastMoveAt = performance.now();
      }
      const fast = performance.now() - lastMoveAt < SETTLE_MS;
      timer = window.setTimeout(read, fast ? FAST_MS : IDLE_MS);
    };

    read();
    window.addEventListener("resize", read);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      window.removeEventListener("resize", read);
    };
  }, []);

  return vp;
}
