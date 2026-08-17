"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type PanelId =
  | "devices"
  | "media"
  | "report"
  | "workbench"
  | "table"
  | "info"
  | "settings";
export type ViewMode = "2d" | "3d";

/** Tabs of the unified workbench panel (Taylor 2026-08-17). */
export type WorkbenchTab = "devices" | "media" | "report";

interface UiState {
  openPanels: Record<PanelId, boolean>;
  /** Panel drag positions in px from the viewport's top-left. */
  panelPositions: Partial<Record<PanelId, { x: number; y: number }>>;
  /** User-resized panel widths in px. */
  panelWidths: Partial<Record<PanelId, number>>;
  /** User-resized panel content heights in px (height-resizable panels). */
  panelHeights: Partial<Record<PanelId, number>>;
  setPanelHeight: (id: PanelId, height: number) => void;
  viewMode: ViewMode;
  togglePanel: (id: PanelId) => void;
  /** Open (never close) a panel — deep links from other panels. */
  openPanel: (id: PanelId) => void;
  /** Active workbench tab (Device Manager / Media Library / Report). */
  workbenchTab: WorkbenchTab;
  /** Deep link: open the workbench on a tab (never closes). */
  openWorkbenchTab: (tab: WorkbenchTab) => void;
  /** Hotkey/sidebar semantics: same tab toggles the panel, another
   * tab switches to it (opening if needed). */
  toggleWorkbenchTab: (tab: WorkbenchTab) => void;
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
  /**
   * Device selected app-wide (table row, 2D rect, 3D rect). Session-only:
   * excluded from persistence via `partialize` below.
   */
  selectedDeviceId: string | null;
  selectDevice: (id: string | null) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      openPanels: {
        devices: false,
        media: false,
        report: false,
        workbench: true,
        table: false,
        info: false,
        settings: false,
      },
      workbenchTab: "devices",
      openWorkbenchTab: (tab) =>
        set((s) => ({
          workbenchTab: tab,
          openPanels: { ...s.openPanels, workbench: true },
        })),
      toggleWorkbenchTab: (tab) =>
        set((s) => {
          if (s.openPanels.workbench && s.workbenchTab === tab) {
            return { openPanels: { ...s.openPanels, workbench: false } };
          }
          return {
            workbenchTab: tab,
            openPanels: { ...s.openPanels, workbench: true },
          };
        }),
      panelPositions: {},
      panelWidths: {},
      viewMode: "2d",
      togglePanel: (id) =>
        set((s) => ({
          openPanels: { ...s.openPanels, [id]: !s.openPanels[id] },
        })),
      openPanel: (id) =>
        set((s) => ({
          openPanels: { ...s.openPanels, [id]: true },
        })),
      setPanelPosition: (id, pos) =>
        set((s) => ({
          panelPositions: { ...s.panelPositions, [id]: pos },
        })),
      setPanelWidth: (id, width) =>
        set((s) => ({
          panelWidths: { ...s.panelWidths, [id]: width },
        })),
      panelHeights: {},
      setPanelHeight: (id, height) =>
        set((s) => ({
          panelHeights: { ...s.panelHeights, [id]: height },
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
      selectedDeviceId: null,
      selectDevice: (selectedDeviceId) => set({ selectedDeviceId }),
    }),
    {
      name: "wright-angles:ui",
      version: 2,
      // v2: the three content panels merged into the workbench — carry
      // legacy state over so an open panel becomes the open workbench.
      migrate: (persisted) => {
        const s = persisted as {
          openPanels?: Record<string, boolean>;
          workbenchTab?: WorkbenchTab;
        };
        if (s?.openPanels && s.openPanels.workbench === undefined) {
          s.openPanels.workbench =
            !!s.openPanels.devices ||
            !!s.openPanels.media ||
            !!s.openPanels.report;
          s.workbenchTab = s.openPanels.media
            ? "media"
            : s.openPanels.report
              ? "report"
              : "devices";
        }
        return s;
      },
      // Selection is per-session; everything else persists as before.
      partialize: (s) =>
        Object.fromEntries(
          Object.entries(s).filter(([key]) => key !== "selectedDeviceId"),
        ),
    },
  ),
);
