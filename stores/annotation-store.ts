"use client";

import { create } from "zustand";

/** Session-only annotation UI state (deliberately not persisted). */
interface AnnotationState {
  drawMode: boolean;
  selectedBoxId: string | null;
  setDrawMode: (v: boolean) => void;
  selectBox: (id: string | null) => void;
}

export const useAnnotationStore = create<AnnotationState>()((set) => ({
  drawMode: false,
  selectedBoxId: null,
  setDrawMode: (drawMode) =>
    set((s) => ({ drawMode, selectedBoxId: drawMode ? s.selectedBoxId : null })),
  selectBox: (selectedBoxId) => set({ selectedBoxId }),
}));
