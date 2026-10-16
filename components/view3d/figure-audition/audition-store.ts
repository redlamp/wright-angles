"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Candidate } from "./candidates";

export type FigureLook = "own" | "gray" | "outfit";

/**
 * Dev-only figure audition state. "current" keeps the capsule figure.
 * `anchor` picks what the candidate lines up with: its body on the
 * floor/seat (honest proportions) or its estimated eyes on the eye point
 * the camera uses (honest sight line). `look` is the material: the glTF's
 * own, the scene's figure gray, or per-bone outfit colors. `local` holds
 * the candidates read from the gitignored manifest; not persisted.
 */
interface AuditionState {
  candidate: string;
  look: FigureLook;
  outfit: string;
  anchor: "body" | "eyes";
  /** Draw the skeleton and the hand targets over the figure. */
  showRig: boolean;
  local: Candidate[];
  setCandidate: (id: string) => void;
  setLook: (look: FigureLook) => void;
  setOutfit: (id: string) => void;
  setAnchor: (anchor: "body" | "eyes") => void;
  setShowRig: (showRig: boolean) => void;
  setLocal: (local: Candidate[]) => void;
}

export const useAuditionStore = create<AuditionState>()(
  persist(
    (set) => ({
      candidate: "current",
      look: "own",
      outfit: "casual",
      anchor: "body",
      showRig: false,
      local: [],
      setCandidate: (candidate) => set({ candidate }),
      setLook: (look) => set({ look }),
      setOutfit: (outfit) => set({ outfit }),
      setAnchor: (anchor) => set({ anchor }),
      setShowRig: (showRig) => set({ showRig }),
      setLocal: (local) => set({ local }),
    }),
    {
      name: "wright-angles:figure-audition",
      version: 2,
      partialize: (s) => ({
        candidate: s.candidate,
        look: s.look,
        outfit: s.outfit,
        anchor: s.anchor,
        showRig: s.showRig,
      }),
      // v1 stored `gray: boolean`; the defaults cover it.
      migrate: (state) => state as AuditionState,
    },
  ),
);

/** Span the rigged figure writes its eye readout into (~4Hz). */
export const AUDITION_READOUT_ID = "figure-audition-readout";
