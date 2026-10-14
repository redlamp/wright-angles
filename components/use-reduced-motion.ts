"use client";

import { useSyncExternalStore } from "react";
import { REDUCED_MOTION_QUERY } from "@/lib/motion";

const query = () =>
  typeof window === "undefined" || !window.matchMedia
    ? null
    : window.matchMedia(REDUCED_MOTION_QUERY);

const subscribe = (cb: () => void) => {
  const mq = query();
  mq?.addEventListener("change", cb);
  return () => mq?.removeEventListener("change", cb);
};

/**
 * Live `prefers-reduced-motion: reduce`. JS tweens (camera flights, pose
 * and height tweens) jump to their end state when true; CSS transitions
 * and animations are cut globally in app/globals.css.
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => query()?.matches ?? false,
    () => false,
  );
}
