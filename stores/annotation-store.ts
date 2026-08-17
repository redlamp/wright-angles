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
  /**
   * Global visibility for text/measure boxes — ONE eye state shared by
   * the Media Library, Perception Report, 2D view, and 3D view.
   */
  showTextBoxes: boolean;
  setDrawMode: (v: boolean) => void;
  selectBox: (id: string | null) => void;
  setScanColorMode: (m: ScanColorMode) => void;
  setShowTextBoxes: (v: boolean) => void;
}

export const useAnnotationStore = create<AnnotationState>()((set) => ({
  drawMode: false,
  selectedBoxId: null,
  scanColorMode: "group",
  showTextBoxes: true,
  setDrawMode: (drawMode) =>
    set((s) => ({ drawMode, selectedBoxId: drawMode ? s.selectedBoxId : null })),
  selectBox: (selectedBoxId) => set({ selectedBoxId }),
  setScanColorMode: (scanColorMode) => set({ scanColorMode }),
  setShowTextBoxes: (showTextBoxes) => set({ showTextBoxes }),
}));
