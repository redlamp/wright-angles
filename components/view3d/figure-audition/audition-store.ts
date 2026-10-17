"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Candidate } from "./candidates";
import type { SeatOffset } from "./figure-seat";

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
  setCandidate: (id: string) => void;
  setLook: (look: FigureLook) => void;
  setOutfit: (id: string) => void;
  setShowRig: (showRig: boolean) => void;
  setEyeOffset: (id: string, offset: EyeOffset) => void;
  setSeat: (seat: SeatOffset | null) => void;
  setLocal: (local: Candidate[]) => void;
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
      setCandidate: (candidate) => set({ candidate }),
      setLook: (look) => set({ look }),
      setOutfit: (outfit) => set({ outfit }),
      setShowRig: (showRig) => set({ showRig }),
      setEyeOffset: (id, offset) => set((s) => ({ eyeOffsets: { ...s.eyeOffsets, [id]: offset } })),
      setSeat: (seat) => set({ seat }),
      setLocal: (local) => set({ local }),
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
      }),
      // v1 stored `gray: boolean`, v2 an `anchor`; the defaults cover both.
      migrate: (state) => state as AuditionState,
    },
  ),
);

/** Span the rigged figure writes its eye readout into (~4Hz). */
export const AUDITION_READOUT_ID = "figure-audition-readout";
