"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Candidate, Palette } from "./candidates";
import type { SeatOffset } from "./figure-seat";
import type { HandFit, SideFits } from "./hand-graft";

export type FigureLook = "own" | "gray" | "outfit";

/**
 * Dev-only figure audition state. "current" keeps the capsule figure.
 * Candidates always hang from the eye point the camera uses (the device
 * distances are measured from it). `look` is the material: the glTF's
 * own, the scene's figure gray, or per-bone outfit colors. `local` holds
 * the candidates read from the gitignored manifest; not persisted.
 */
/** Nudges to a model's measured eye point, world cm: up and forward. */
export interface EyeOffset {
  up: number;
  fwd: number;
}
export const NO_EYE_OFFSET: EyeOffset = { up: 0, fwd: 0 };

interface AuditionState {
  candidate: string;
  look: FigureLook;
  outfit: string;
  /** Draw the skeleton and the hand targets over the figure. */
  showRig: boolean;
  /** Per-candidate eye point nudges, persisted; dialed in with the rig shown. */
  eyeOffsets: Record<string, EyeOffset>;
  /** Where the seated rig's seat is, so the chair and sofa can follow; null for the capsule. */
  seat: SeatOffset | null;
  local: Candidate[];
  /** Palette variants the local manifest offers; not persisted. */
  palettes: Palette[];
  /** Chosen palette id; empty for the candidate's own texture. Persisted. */
  palette: string;
  /** Wear the five-fingered hands on models that allow it. Persisted. */
  swapHands: boolean;
  /** Per-candidate, per-hand fits (size, flare, slide, rotation), persisted; dialed in from T-pose. Older entries hold one shared fit; normalizeFits reads both. */
  handFits: Record<string, SideFits | HandFit>;
  /** Show the rest pose (arms out) with the grafts attached, for fitting hands. Not persisted. */
  tPose: boolean;
  /** The hand fit dials unfolded in the picker. Persisted. */
  handDials: boolean;
  /** Show the figure's own hand as a see-through ghost behind a grafted one. Persisted. */
  showGhost: boolean;
  /** Bumped to snap the camera onto a wrist (focusSide picks which). Not persisted. */
  focusWrist: number;
  focusSide: 1 | -1;
  setCandidate: (id: string) => void;
  setLook: (look: FigureLook) => void;
  setOutfit: (id: string) => void;
  setShowRig: (showRig: boolean) => void;
  setEyeOffset: (id: string, offset: EyeOffset) => void;
  setSeat: (seat: SeatOffset | null) => void;
  setLocal: (local: Candidate[]) => void;
  setPalettes: (palettes: Palette[]) => void;
  setPalette: (palette: string) => void;
  setSwapHands: (swapHands: boolean) => void;
  setHandFits: (id: string, fits: SideFits) => void;
  setTPose: (tPose: boolean) => void;
  setHandDials: (handDials: boolean) => void;
  setShowGhost: (showGhost: boolean) => void;
  requestFocusWrist: (side: 1 | -1) => void;
}

export const useAuditionStore = create<AuditionState>()(
  persist(
    (set) => ({
      candidate: "current",
      look: "own",
      outfit: "casual",
      showRig: false,
      eyeOffsets: {},
      seat: null,
      local: [],
      palettes: [],
      palette: "",
      swapHands: true,
      handFits: {},
      tPose: false,
      handDials: true,
      showGhost: false,
      focusWrist: 0,
      focusSide: 1,
      setCandidate: (candidate) => set({ candidate }),
      setLook: (look) => set({ look }),
      setOutfit: (outfit) => set({ outfit }),
      setShowRig: (showRig) => set({ showRig }),
      setEyeOffset: (id, offset) => set((s) => ({ eyeOffsets: { ...s.eyeOffsets, [id]: offset } })),
      setSeat: (seat) => set({ seat }),
      setLocal: (local) => set({ local }),
      setPalettes: (palettes) => set({ palettes }),
      setPalette: (palette) => set({ palette }),
      setSwapHands: (swapHands) => set({ swapHands }),
      setHandFits: (id, fits) => set((s) => ({ handFits: { ...s.handFits, [id]: fits } })),
      setTPose: (tPose) => set({ tPose }),
      setHandDials: (handDials) => set({ handDials }),
      setShowGhost: (showGhost) => set({ showGhost }),
      requestFocusWrist: (side) => set((s) => ({ focusWrist: s.focusWrist + 1, focusSide: side })),
    }),
    {
      name: "wright-angles:figure-audition",
      version: 2,
      partialize: (s) => ({
        candidate: s.candidate,
        look: s.look,
        outfit: s.outfit,
        showRig: s.showRig,
        eyeOffsets: s.eyeOffsets,
        palette: s.palette,
        swapHands: s.swapHands,
        handFits: s.handFits,
        handDials: s.handDials,
        showGhost: s.showGhost,
      }),
      // v1 stored `gray: boolean`, v2 an `anchor`; the defaults cover both.
      migrate: (state) => state as AuditionState,
    },
  ),
);

/** Span the rigged figure writes its eye readout into (~4Hz). */
export const AUDITION_READOUT_ID = "figure-audition-readout";
