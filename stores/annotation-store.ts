"use client";

import { create } from "zustand";

/** How scan visuals are colored, everywhere they render (panel, 2D, 3D). */
export type ScanColorMode = "group" | "rating";

/** Session-only annotation UI state (deliberately not persisted). */
interface AnnotationState {
  drawMode: boolean;
  selectedBoxId: string | null;
  /** Global color mode for detected text: block tints vs legibility bands. */
  scanColorMode: ScanColorMode;
  setDrawMode: (v: boolean) => void;
  selectBox: (id: string | null) => void;
  setScanColorMode: (m: ScanColorMode) => void;
}

export const useAnnotationStore = create<AnnotationState>()((set) => ({
  drawMode: false,
  selectedBoxId: null,
  scanColorMode: "group",
  setDrawMode: (drawMode) =>
    set((s) => ({ drawMode, selectedBoxId: drawMode ? s.selectedBoxId : null })),
  selectBox: (selectedBoxId) => set({ selectedBoxId }),
  setScanColorMode: (scanColorMode) => set({ scanColorMode }),
}));
