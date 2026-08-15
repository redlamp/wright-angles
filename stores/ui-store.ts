"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type PanelId =
  | "devices"
  | "media"
  | "report"
  | "table"
  | "info"
  | "settings";
export type ViewMode = "2d" | "3d";

interface UiState {
  openPanels: Record<PanelId, boolean>;
  /** Panel drag positions in px from the viewport's top-left. */
  panelPositions: Partial<Record<PanelId, { x: number; y: number }>>;
  /** User-resized panel widths in px. */
  panelWidths: Partial<Record<PanelId, number>>;
  viewMode: ViewMode;
  togglePanel: (id: PanelId) => void;
  setPanelPosition: (id: PanelId, pos: { x: number; y: number }) => void;
  setPanelWidth: (id: PanelId, width: number) => void;
  setViewMode: (mode: ViewMode) => void;
  /** Manual 2D pan (CSS px), applied on top of the center mode. */
  panOffset: { x: number; y: number };
  setPanOffset: (offset: { x: number; y: number }) => void;
  /** Media Library two-column split, left column percent (25–75). */
  mediaSplitPct: number;
  setMediaSplitPct: (pct: number) => void;
  /** Device whose detail flyout is open beside the Device Manager. */
  openDetailId: string | null;
  /** Pinned device-detail windows and their positions. */
  pinnedDetails: Record<string, { x: number; y: number }>;
  openDetail: (id: string | null) => void;
  pinDetail: (id: string, pos: { x: number; y: number }) => void;
  unpinDetail: (id: string) => void;
  moveDetail: (id: string, pos: { x: number; y: number }) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      openPanels: {
        devices: true,
        media: false,
        report: false,
        table: false,
        info: false,
        settings: false,
      },
      panelPositions: {},
      panelWidths: {},
      viewMode: "2d",
      togglePanel: (id) =>
        set((s) => ({
          openPanels: { ...s.openPanels, [id]: !s.openPanels[id] },
        })),
      setPanelPosition: (id, pos) =>
        set((s) => ({
          panelPositions: { ...s.panelPositions, [id]: pos },
        })),
      setPanelWidth: (id, width) =>
        set((s) => ({
          panelWidths: { ...s.panelWidths, [id]: width },
        })),
      setViewMode: (viewMode) => set({ viewMode }),
      panOffset: { x: 0, y: 0 },
      setPanOffset: (panOffset) => set({ panOffset }),
      mediaSplitPct: 50,
      setMediaSplitPct: (pct) =>
        set({ mediaSplitPct: Math.min(75, Math.max(25, pct)) }),
      openDetailId: null,
      pinnedDetails: {},
      openDetail: (openDetailId) => set({ openDetailId }),
      pinDetail: (id, pos) =>
        set((s) => ({
          pinnedDetails: { ...s.pinnedDetails, [id]: pos },
          openDetailId: s.openDetailId === id ? null : s.openDetailId,
        })),
      unpinDetail: (id) =>
        set((s) => {
          const pinnedDetails = { ...s.pinnedDetails };
          delete pinnedDetails[id];
          return { pinnedDetails };
        }),
      moveDetail: (id, pos) =>
        set((s) => ({
          pinnedDetails: { ...s.pinnedDetails, [id]: pos },
        })),
    }),
    { name: "wright-angles:ui" },
  ),
);
