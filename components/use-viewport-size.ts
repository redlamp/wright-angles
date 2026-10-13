"use client";

import { useSyncExternalStore } from "react";
import type { Viewport } from "@/lib/panel-geometry";

function subscribe(cb: () => void) {
  window.addEventListener("resize", cb);
  return () => window.removeEventListener("resize", cb);
}

// Cached so the snapshot is referentially stable between resizes
// (useSyncExternalStore re-renders whenever the snapshot changes).
let cached: Viewport = { width: 0, height: 0 };
function getSnapshot(): Viewport {
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (w !== cached.width || h !== cached.height) {
    cached = { width: w, height: h };
  }
  return cached;
}

const SERVER: Viewport = { width: 1440, height: 900 };

/** The CSS viewport size (shrinks with browser zoom), live on resize. */
export function useViewportSize(): Viewport {
  return useSyncExternalStore(subscribe, getSnapshot, () => SERVER);
}
