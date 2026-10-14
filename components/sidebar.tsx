"use client";

import {
  GaugeIcon,
  ImageIcon,
  InfoIcon,
  MonitorIcon,
  SettingsIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useUiStore, type PanelId, type ViewMode } from "@/stores/ui-store";

/** "Name · K" tooltip body; the key renders muted beside the name. */
function TipBody({ label, shortcut }: { label: string; shortcut?: string }) {
  return (
    <>
      {label}
      {shortcut ? (
        <span className="opacity-60">· {shortcut}</span>
      ) : null}
    </>
  );
}

/**
 * Toolbar button: icon always, a short text label from 1720px up
 * (narrower, the labeled toolbar runs into the 2D view's top-right
 * actions), and an instant tooltip with the full name and hotkey (also
 * shown on keyboard focus, so the shortcut is discoverable without a
 * mouse).
 */
function RailButton({
  label,
  short,
  shortcut,
  active,
  onClick,
  children,
}: {
  label: string;
  /** Text shown next to the icon on wide screens. */
  short: string;
  shortcut?: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        delay={0}
        aria-label={label}
        aria-pressed={active}
        aria-keyshortcuts={shortcut}
        className={cn(
          "flex h-8 min-w-8 items-center justify-center gap-1.5 rounded-md text-sm transition-colors min-[1720px]:px-2",
          active
            ? "bg-foreground text-background"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
        onClick={onClick}
      >
        {children}
        <span className="hidden min-[1720px]:inline">{short}</span>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <TipBody label={label} shortcut={shortcut} />
      </TooltipContent>
    </Tooltip>
  );
}

const VIEWS: { id: ViewMode; label: string }[] = [
  { id: "2d", label: "2D" },
  { id: "3d", label: "3D" },
];

/**
 * The 2D | 3D segmented control — the app's primary mode switch, so it
 * leads the toolbar and reads differently from the panel buttons (inset
 * track, labeled segments). `data-tour` anchors an onboarding coach mark.
 */
function ViewToggle() {
  const viewMode = useUiStore((s) => s.viewMode);
  const setViewMode = useUiStore((s) => s.setViewMode);
  return (
    <div
      role="group"
      aria-label="View"
      data-tour="view-toggle"
      className="panel-inset flex h-8 items-center gap-0.5 rounded-md p-0.5"
    >
      {VIEWS.map((v) => (
        <Tooltip key={v.id}>
          <TooltipTrigger
            delay={0}
            aria-pressed={viewMode === v.id}
            aria-keyshortcuts="V"
            className={cn(
              "h-full w-10 rounded-[5px] font-mono text-sm font-medium transition-colors",
              viewMode === v.id
                ? "bg-foreground text-background shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => setViewMode(v.id)}
          >
            {v.label}
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <TipBody label={`${v.label} view`} shortcut="V" />
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}

export function Sidebar() {
  const openPanels = useUiStore((s) => s.openPanels);
  const togglePanel = useUiStore((s) => s.togglePanel);
  const workbenchTab = useUiStore((s) => s.workbenchTab);
  const toggleWorkbenchTab = useUiStore((s) => s.toggleWorkbenchTab);

  const panelButton = (
    id: PanelId,
    label: string,
    short: string,
    shortcut: string | undefined,
    icon: React.ReactNode,
  ) => (
    <RailButton
      label={label}
      short={short}
      shortcut={shortcut}
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
    short: string,
    shortcut: string,
    icon: React.ReactNode,
  ) => (
    <RailButton
      label={label}
      short={short}
      shortcut={shortcut}
      active={openPanels.workbench && workbenchTab === tab}
      onClick={() => toggleWorkbenchTab(tab)}
    >
      {icon}
    </RailButton>
  );

  return (
    // Top-center horizontal rail (Taylor 2026-08-18). The comparison
    // table opens from the Device Manager list instead of here. Order
    // follows the workflow and the D/M/P hotkeys: view, then devices →
    // media → report, then the app-level info/settings.
    <TooltipProvider>
      <div
        role="toolbar"
        aria-label="Main"
        className="panel-frame fixed top-2 left-1/2 z-30 flex -translate-x-1/2 max-2xl:left-2 max-2xl:translate-x-0 items-center gap-1 rounded-lg border border-border p-1"
      >
        <ViewToggle />
        <div className="mx-1 h-6 w-px bg-border" />
        {tabButton("devices", "Devices", "Devices", "D", <MonitorIcon className="size-4" />)}
        {tabButton("media", "Media", "Media", "M", <ImageIcon className="size-4" />)}
        {tabButton("report", "Perception report", "Report", "P", <GaugeIcon className="size-4" />)}
        <div className="mx-0.5 h-6 w-px bg-border" />
        {panelButton("info", "About arc minutes", "About", undefined, <InfoIcon className="size-4" />)}
        {panelButton("settings", "Settings", "Settings", "S", <SettingsIcon className="size-4" />)}
      </div>
    </TooltipProvider>
  );
}
