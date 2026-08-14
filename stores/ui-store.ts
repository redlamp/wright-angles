"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type PanelId = "devices" | "media" | "report" | "info" | "settings";
export type ViewMode = "2d" | "3d";

interface UiState {
  openPanels: Record<PanelId, boolean>;
  /** Panel drag positions in px from the viewport's top-left. */
  panelPositions: Partial<Record<PanelId, { x: number; y: number }>>;
  viewMode: ViewMode;
  togglePanel: (id: PanelId) => void;
  setPanelPosition: (id: PanelId, pos: { x: number; y: number }) => void;
  setViewMode: (mode: ViewMode) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      openPanels: {
        devices: true,
        media: false,
        report: false,
        info: false,
        settings: false,
      },
      panelPositions: {},
      viewMode: "2d",
      togglePanel: (id) =>
        set((s) => ({
          openPanels: { ...s.openPanels, [id]: !s.openPanels[id] },
        })),
      setPanelPosition: (id, pos) =>
        set((s) => ({
          panelPositions: { ...s.panelPositions, [id]: pos },
        })),
      setViewMode: (viewMode) => set({ viewMode }),
    }),
    { name: "wright-angles:ui" },
  ),
);
