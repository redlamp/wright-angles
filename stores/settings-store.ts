"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { LengthUnit } from "@/lib/types";

export type ThemeMode = "system" | "dark" | "light";
/** 3D scene palette: follow the resolved UI theme, or set independently. */
export type SceneTheme = "follow" | "dark" | "light";
/** How device rects render when no image is shown in them. */
export type DisplayFill = "black" | "device-color";
/**
 * How the 2D composition maps to the browser window: "viewport" treats
 * the window as a true-scale window into This Device's physical screen
 * (tracking the window's on-screen position); "fit" shrinks the whole
 * composition to fit the window.
 */
export type DisplayMode = "viewport" | "fit";

interface SettingsState {
  unit: LengthUnit;
  theme: ThemeMode;
  sceneTheme: SceneTheme;
  displayFill: DisplayFill;
  displayMode: DisplayMode;
  /** Show ISO/AVIXA arcmin legibility bands in readouts. */
  showLegibilityBands: boolean;
  /** Onboarding completed (or explicitly skipped). */
  onboarded: boolean;
  setUnit: (unit: LengthUnit) => void;
  setTheme: (theme: ThemeMode) => void;
  setSceneTheme: (theme: SceneTheme) => void;
  setDisplayFill: (fill: DisplayFill) => void;
  setDisplayMode: (mode: DisplayMode) => void;
  setShowLegibilityBands: (v: boolean) => void;
  setOnboarded: (v: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      unit: "cm",
      theme: "system",
      sceneTheme: "follow",
      displayFill: "black",
      displayMode: "viewport",
      showLegibilityBands: true,
      onboarded: false,
      setUnit: (unit) => set({ unit }),
      setTheme: (theme) => set({ theme }),
      setSceneTheme: (sceneTheme) => set({ sceneTheme }),
      setDisplayFill: (displayFill) => set({ displayFill }),
      setDisplayMode: (displayMode) => set({ displayMode }),
      setShowLegibilityBands: (showLegibilityBands) =>
        set({ showLegibilityBands }),
      setOnboarded: (onboarded) => set({ onboarded }),
    }),
    { name: "wright-angles:settings" },
  ),
);
