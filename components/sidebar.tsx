"use client";

import {
  BoxIcon,
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

  return (
    <div className="panel-frame fixed top-1/2 left-2 z-30 flex -translate-y-1/2 flex-col items-center gap-1 rounded-lg border border-border p-1">
      {panelButton("devices", "Device Manager", <MonitorIcon className="size-4" />)}
      {panelButton("media", "Media Library", <ImageIcon className="size-4" />)}
      <div className="my-0.5 h-px w-6 bg-border" />
      <RailButton
        label="2D overlay view"
        active={viewMode === "2d"}
        onClick={() => setViewMode("2d")}
      >
        <SquareIcon className="size-4" />
      </RailButton>
      <RailButton
        label="3D view"
        active={viewMode === "3d"}
        onClick={() => setViewMode("3d")}
      >
        <BoxIcon className="size-4" />
      </RailButton>
      <div className="my-0.5 h-px w-6 bg-border" />
      {panelButton("info", "About arc minutes", <InfoIcon className="size-4" />)}
      {panelButton("settings", "Settings", <SettingsIcon className="size-4" />)}
    </div>
  );
}
