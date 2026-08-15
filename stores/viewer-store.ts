"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Viewing scenarios model how the person is situated, which drives eye
 * height and the 3D environment (desk, couch) around them.
 */
export type Scenario = "standing" | "desk" | "couch";

export const SCENARIOS: { id: Scenario; label: string }[] = [
  { id: "standing", label: "Standing" },
  { id: "desk", label: "At a desk" },
  { id: "couch", label: "On a couch" },
];

/**
 * Eye height from body height + scenario (50th-percentile
 * anthropometrics): standing eye ≈ 0.936·H; seated eye ≈ 0.45·H above
 * the seat; office chair seat ≈ 45cm, couch seat ≈ 40cm.
 */
export const eyeHeightCm = (scenario: Scenario, heightCm: number): number => {
  switch (scenario) {
    case "standing":
      return heightCm * 0.936;
    case "desk":
      return heightCm * 0.45 + 45;
    case "couch":
      return heightCm * 0.45 + 40;
  }
};

interface ViewerState {
  scenario: Scenario;
  /** Full body height in cm. */
  heightCm: number;
  /** Eye-to-corner projection lines for every visible display (3D). */
  showProjectionLines: boolean;
  setScenario: (s: Scenario) => void;
  setHeightCm: (h: number) => void;
  setShowProjectionLines: (v: boolean) => void;
}

export const useViewerStore = create<ViewerState>()(
  persist(
    (set) => ({
      scenario: "desk",
      heightCm: 175,
      showProjectionLines: false,
      setShowProjectionLines: (showProjectionLines) =>
        set({ showProjectionLines }),
      setScenario: (scenario) => set({ scenario }),
      setHeightCm: (heightCm) =>
        set({ heightCm: Math.min(220, Math.max(120, heightCm)) }),
    }),
    { name: "wright-angles:viewer" },
  ),
);
