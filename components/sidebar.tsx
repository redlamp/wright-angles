"use client";

import {
  BoxIcon,
  GaugeIcon,
  ImageIcon,
  InfoIcon,
  MonitorIcon,
  SettingsIcon,
  SquareIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUiStore, type PanelId } from "@/stores/ui-store";

function RailButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "flex size-8 items-center justify-center rounded-md transition-colors",
        active
          ? "bg-foreground text-background"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function Sidebar() {
  const openPanels = useUiStore((s) => s.openPanels);
  const togglePanel = useUiStore((s) => s.togglePanel);
  const workbenchTab = useUiStore((s) => s.workbenchTab);
  const toggleWorkbenchTab = useUiStore((s) => s.toggleWorkbenchTab);
  const viewMode = useUiStore((s) => s.viewMode);
  const setViewMode = useUiStore((s) => s.setViewMode);

  const panelButton = (
    id: PanelId,
    label: string,
    icon: React.ReactNode,
  ) => (
    <RailButton
      label={label}
      active={openPanels[id]}
      onClick={() => togglePanel(id)}
    >
      {icon}
    </RailButton>
  );

  /** Workbench tabs: lit when the workbench shows that tab. */
  const tabButton = (
    tab: "devices" | "media" | "report",
    label: string,
    icon: React.ReactNode,
  ) => (
    <RailButton
      label={label}
      active={openPanels.workbench && workbenchTab === tab}
      onClick={() => toggleWorkbenchTab(tab)}
    >
      {icon}
    </RailButton>
  );

  return (
    // Top-center horizontal rail (Taylor 2026-08-18). The comparison
    // table opens from the Device Manager list instead of here.
    <div className="panel-frame fixed top-2 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1 rounded-lg border border-border p-1">
      {tabButton("media", "Media Library", <ImageIcon className="size-4" />)}
      {tabButton("report", "Perception Report", <GaugeIcon className="size-4" />)}
      {tabButton("devices", "Device Manager", <MonitorIcon className="size-4" />)}
      <div className="mx-0.5 h-6 w-px bg-border" />
      {/* One toggle: shows the view you're in, click flips it (Tab). */}
      <RailButton
        label={viewMode === "2d" ? "Switch to 3D view" : "Switch to 2D view"}
        onClick={() => setViewMode(viewMode === "2d" ? "3d" : "2d")}
      >
        {viewMode === "2d" ? (
          <SquareIcon className="size-4" />
        ) : (
          <BoxIcon className="size-4" />
        )}
      </RailButton>
      <div className="mx-0.5 h-6 w-px bg-border" />
      {panelButton("info", "About arc minutes", <InfoIcon className="size-4" />)}
      {panelButton("settings", "Settings", <SettingsIcon className="size-4" />)}
    </div>
  );
}
