"use client";

import { useSyncExternalStore } from "react";
import { useSettingsStore } from "@/stores/settings-store";

const query = "(prefers-color-scheme: dark)";

function subscribe(cb: () => void) {
  const mq = window.matchMedia(query);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

/** UI theme with "system" resolved against prefers-color-scheme. */
export function useResolvedTheme(): "dark" | "light" {
  const theme = useSettingsStore((s) => s.theme);
  const systemDark = useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => true,
  );
  if (theme === "system") return systemDark ? "dark" : "light";
  return theme;
}

/** 3D scene palette: follows the UI theme unless set independently. */
export function useSceneTheme(): "dark" | "light" {
  const sceneTheme = useSettingsStore((s) => s.sceneTheme);
  const ui = useResolvedTheme();
  return sceneTheme === "follow" ? ui : sceneTheme;
}
