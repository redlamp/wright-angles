"use client";

import { create } from "zustand";

/** How scan visuals are colored, everywhere they render (panel, 2D, 3D). */
export type ScanColorMode = "group" | "rating";

/** Text box hovered in a view, with everything the hover card shows. */
export interface HoverBox {
  id: string;
  label?: string;
  /** Source pixel height (group-corrected where available). */
  srcPx: number;
  /** Full-image normalized measure height, for boxMetricsOnDevice. */
  hFull: number;
  groupId?: number;
  /** Screen bounds (client px) — the card positions OUTSIDE these. */
  bounds: { left: number; top: number; right: number; bottom: number };
}

export interface DeviceHover {
  deviceId: string;
  /** null = the device itself is hovered, no specific box. */
  box: HoverBox | null;
}

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
  /** Debug overlays (plan topic 10) — session tools, global parity. */
  showSafeAreas: boolean;
  showContrast: boolean;
  loupeOn: boolean;
  /** 3D hover: which device (and optionally which text box) is under
   * the cursor — feeds the inspector's live details + full alpha. */
  deviceHover: DeviceHover | null;
  setDeviceHover: (h: DeviceHover | null) => void;
  setDrawMode: (v: boolean) => void;
  selectBox: (id: string | null) => void;
  setScanColorMode: (m: ScanColorMode) => void;
  setShowTextBoxes: (v: boolean) => void;
  setShowSafeAreas: (v: boolean) => void;
  setShowContrast: (v: boolean) => void;
  setLoupeOn: (v: boolean) => void;
}

export const useAnnotationStore = create<AnnotationState>()((set) => ({
  drawMode: false,
  selectedBoxId: null,
  scanColorMode: "group",
  showTextBoxes: true,
  showSafeAreas: false,
  showContrast: false,
  loupeOn: false,
  deviceHover: null,
  setDeviceHover: (deviceHover) => set({ deviceHover }),
  setDrawMode: (drawMode) =>
    set((s) => ({ drawMode, selectedBoxId: drawMode ? s.selectedBoxId : null })),
  selectBox: (selectedBoxId) => set({ selectedBoxId }),
  setScanColorMode: (scanColorMode) => set({ scanColorMode }),
  setShowTextBoxes: (showTextBoxes) => set({ showTextBoxes }),
  setShowSafeAreas: (showSafeAreas) => set({ showSafeAreas }),
  setShowContrast: (showContrast) => set({ showContrast }),
  setLoupeOn: (loupeOn) => set({ loupeOn }),
}));
