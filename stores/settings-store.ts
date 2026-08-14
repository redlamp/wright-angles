"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { LengthUnit } from "@/lib/types";

export type ThemeMode = "dark" | "light";
/** How device rects render when no image is shown in them. */
export type DisplayFill = "black" | "device-color";

interface SettingsState {
  unit: LengthUnit;
  theme: ThemeMode;
  displayFill: DisplayFill;
  /** Show ISO/AVIXA arcmin legibility bands in readouts. */
  showLegibilityBands: boolean;
  /** Onboarding completed (or explicitly skipped). */
  onboarded: boolean;
  setUnit: (unit: LengthUnit) => void;
  setTheme: (theme: ThemeMode) => void;
  setDisplayFill: (fill: DisplayFill) => void;
  setShowLegibilityBands: (v: boolean) => void;
  setOnboarded: (v: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      unit: "cm",
      theme: "dark",
      displayFill: "black",
      showLegibilityBands: true,
      onboarded: false,
      setUnit: (unit) => set({ unit }),
      setTheme: (theme) => set({ theme }),
      setDisplayFill: (displayFill) => set({ displayFill }),
      setShowLegibilityBands: (showLegibilityBands) =>
        set({ showLegibilityBands }),
      setOnboarded: (onboarded) => set({ onboarded }),
    }),
    { name: "wright-angles:settings" },
  ),
);
