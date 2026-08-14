"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { LengthUnit } from "@/lib/types";

export type ThemeMode = "dark" | "light";

interface SettingsState {
  unit: LengthUnit;
  theme: ThemeMode;
  setUnit: (unit: LengthUnit) => void;
  setTheme: (theme: ThemeMode) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      unit: "cm",
      theme: "dark",
      setUnit: (unit) => set({ unit }),
      setTheme: (theme) => set({ theme }),
    }),
    { name: "wright-angles:settings" },
  ),
);
