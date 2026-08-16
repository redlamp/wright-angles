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
  { id: "couch", label: "On a couch" },
  { id: "desk", label: "At a desk" },
];

/**
 * What the viewer is holding/using, independent of where they sit: drives
 * the figure's arms and, for keyboard-while-standing, a standing desk.
 */
export type InputType = "handheld" | "gamepad" | "keyboard";

export const INPUT_TYPES: { id: InputType; label: string }[] = [
  { id: "handheld", label: "Handheld" },
  { id: "gamepad", label: "Gamepad" },
  { id: "keyboard", label: "Mouse & KB" },
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
  inputType: InputType;
  /** Full body height in cm. */
  heightCm: number;
  /** Eye-to-corner projection lines for every visible display (3D). */
  showProjectionLines: boolean;
  setScenario: (s: Scenario) => void;
  setInputType: (t: InputType) => void;
  setHeightCm: (h: number) => void;
  setShowProjectionLines: (v: boolean) => void;
}

export const useViewerStore = create<ViewerState>()(
  persist(
    (set) => ({
      scenario: "desk",
      inputType: "handheld",
      heightCm: 175,
      showProjectionLines: false,
      setShowProjectionLines: (showProjectionLines) =>
        set({ showProjectionLines }),
      setScenario: (scenario) => set({ scenario }),
      setInputType: (inputType) => set({ inputType }),
      setHeightCm: (heightCm) =>
        set({ heightCm: Math.min(220, Math.max(120, heightCm)) }),
    }),
    { name: "wright-angles:viewer" },
  ),
);
