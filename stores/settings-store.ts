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
/**
 * Where the composition centers in viewport mode: on the physical
 * screen's center ("screen") or on the browser window's center
 * ("window"). A manual pan offset applies on top of either.
 */
export type DisplayCenter = "screen" | "window";
/**
 * Color-vision-deficiency simulation applied to the 2D and 3D views
 * (Machado et al. 2009 matrices at full severity; achromatopsia is the
 * Rec. 709 luminance). "none" = no filter.
 */
export type CvdMode =
  | "none"
  | "protanopia"
  | "deuteranopia"
  | "tritanopia"
  | "achromatopsia";

interface SettingsState {
  unit: LengthUnit;
  theme: ThemeMode;
  sceneTheme: SceneTheme;
  displayFill: DisplayFill;
  displayMode: DisplayMode;
  displayCenter: DisplayCenter;
  /** Display-size fields shown in inches or centimeters. */
  sizeUnit: LengthUnit;
  /** Show ISO/AVIXA arcmin legibility bands in readouts. */
  showLegibilityBands: boolean;
  /** Onboarding completed (or explicitly skipped). */
  onboarded: boolean;
  /** Color-vision simulation over the views (debug overlay, plan 10.5). */
  cvdMode: CvdMode;
  setCvdMode: (mode: CvdMode) => void;
  setUnit: (unit: LengthUnit) => void;
  setTheme: (theme: ThemeMode) => void;
  setSceneTheme: (theme: SceneTheme) => void;
  setDisplayFill: (fill: DisplayFill) => void;
  setDisplayMode: (mode: DisplayMode) => void;
  setDisplayCenter: (center: DisplayCenter) => void;
  setSizeUnit: (unit: LengthUnit) => void;
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
      // Default: content centered in the window; "screen" (locked to the
      // physical display's center) is the opt-in, remembered choice.
      displayCenter: "window",
      sizeUnit: "in",
      showLegibilityBands: true,
      onboarded: false,
      // Simulation is a session tool, but remembering it across reloads
      // matches every other view setting here.
      cvdMode: "none",
      setCvdMode: (cvdMode) => set({ cvdMode }),
      setUnit: (unit) => set({ unit }),
      setTheme: (theme) => set({ theme }),
      setSceneTheme: (sceneTheme) => set({ sceneTheme }),
      setDisplayFill: (displayFill) => set({ displayFill }),
      setDisplayMode: (displayMode) => set({ displayMode }),
      setDisplayCenter: (displayCenter) => set({ displayCenter }),
      setSizeUnit: (sizeUnit) => set({ sizeUnit }),
      setShowLegibilityBands: (showLegibilityBands) =>
        set({ showLegibilityBands }),
      setOnboarded: (onboarded) => set({ onboarded }),
    }),
    { name: "wright-angles:settings" },
  ),
);
