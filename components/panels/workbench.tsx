"use client";

import { GaugeIcon, ImageIcon, MonitorIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUiStore, type WorkbenchTab } from "@/stores/ui-store";
import { FloatingPanel } from "./floating-panel";
import { DeviceManagerContent } from "./device-manager";
import { MediaLibraryContent } from "./media-library";
import { PerceptionReportContent } from "./perception-report";

/**
 * The unified content panel (Taylor 2026-08-17): Device Manager, Media
 * Library, and Perception Report as tabs of ONE popup, so cross-links
 * between them are tab switches instead of window juggling. All three
 * tabs stay mounted (hidden via CSS) so scroll positions, flyouts, and
 * in-flight scans survive tab flips.
 */

const TABS: { id: WorkbenchTab; label: string; icon: typeof MonitorIcon }[] = [
  { id: "media", label: "Media Library", icon: ImageIcon },
  { id: "report", label: "Perception Report", icon: GaugeIcon },
  { id: "devices", label: "Device Manager", icon: MonitorIcon },
];

export function WorkbenchPanel() {
  const tab = useUiStore((s) => s.workbenchTab);
  const openWorkbenchTab = useUiStore((s) => s.openWorkbenchTab);
  const active = TABS.find((t) => t.id === tab) ?? TABS[0];

  return (
    <FloatingPanel
      id="workbench"
      title={active.label}
      icon={active.icon}
      width={640}
      maxWidth="none"
      resizableHeight
      headerNote={
        tab === "media"
          ? "Media is stored on your computer only — never uploaded."
          : undefined
      }
    >
      <div className="flex h-full max-h-[calc(100vh-8rem)] flex-col">
        <div className="flex shrink-0 gap-0.5 border-b border-border p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={t.id === tab}
              className={cn(
                "flex h-7 flex-1 items-center justify-center gap-1.5 rounded-md text-sm transition-colors",
                t.id === tab
                  ? "panel-inset text-foreground ring-1 ring-ring ring-inset"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
              )}
              onClick={() => openWorkbenchTab(t.id)}
            >
              <t.icon className="size-3.5" />
              {t.label}
            </button>
          ))}
        </div>
        <div className="min-h-0 flex-1">
          <div className={cn("h-full", tab !== "media" && "hidden")}>
            <MediaLibraryContent />
          </div>
          <div className={cn("h-full", tab !== "report" && "hidden")}>
            <PerceptionReportContent />
          </div>
          <div className={cn("h-full", tab !== "devices" && "hidden")}>
            <DeviceManagerContent />
          </div>
        </div>
      </div>
    </FloatingPanel>
  );
}
