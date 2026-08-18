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
 * The natural stance ↔ input pairing (the two option rows align by
 * column on purpose): standing-handheld, couch-gamepad, desk-keyboard.
 * The HUD's link toggle locks the rows through this map.
 */
export const PAIRED_INPUT: Record<Scenario, InputType> = {
  standing: "handheld",
  couch: "gamepad",
  desk: "keyboard",
};

export const PAIRED_SCENARIO: Record<InputType, Scenario> = {
  handheld: "standing",
  gamepad: "couch",
  keyboard: "desk",
};

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
  /** Figma-style lock: stance and input change together as a pair. */
  linkInput: boolean;
  /** Full body height in cm. */
  heightCm: number;
  /** Eye-to-corner projection lines for every visible display (3D). */
  showProjectionLines: boolean;
  setScenario: (s: Scenario) => void;
  setInputType: (t: InputType) => void;
  setLinkInput: (v: boolean) => void;
  setHeightCm: (h: number) => void;
  setShowProjectionLines: (v: boolean) => void;
}

export const useViewerStore = create<ViewerState>()(
  persist(
    (set) => ({
      // Defaults per Taylor 2026-08-19: couch, handheld, unlinked.
      scenario: "couch",
      inputType: "handheld",
      linkInput: false,
      heightCm: 175,
      showProjectionLines: false,
      setShowProjectionLines: (showProjectionLines) =>
        set({ showProjectionLines }),
      setScenario: (scenario) =>
        set((s) =>
          s.linkInput
            ? { scenario, inputType: PAIRED_INPUT[scenario] }
            : { scenario },
        ),
      setInputType: (inputType) =>
        set((s) =>
          s.linkInput
            ? { inputType, scenario: PAIRED_SCENARIO[inputType] }
            : { inputType },
        ),
      // Engaging the lock snaps the input to the current stance's pair
      // (like Figma's ratio lock adopting the current proportions).
      setLinkInput: (linkInput) =>
        set((s) =>
          linkInput
            ? { linkInput, inputType: PAIRED_INPUT[s.scenario] }
            : { linkInput },
        ),
      setHeightCm: (heightCm) =>
        set({ heightCm: Math.min(220, Math.max(120, heightCm)) }),
    }),
    { name: "wright-angles:viewer" },
  ),
);
