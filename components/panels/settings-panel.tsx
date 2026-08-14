"use client";

import { useState } from "react";
import { SettingsIcon, ShieldCheckIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSettingsStore } from "@/stores/settings-store";
import { useDeviceStore } from "@/stores/device-store";
import { useMediaStore } from "@/stores/media-store";
import { useUiStore } from "@/stores/ui-store";
import { FloatingPanel } from "./floating-panel";
import type { LengthUnit } from "@/lib/types";

function SegmentedToggle<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="panel-inset flex h-8 items-center gap-0.5 rounded-md p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={cn(
            "h-full flex-1 rounded-[6px] text-xs transition-colors",
            o.value === value
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:text-foreground",
          )}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function SettingsPanel() {
  const unit = useSettingsStore((s) => s.unit);
  const setUnit = useSettingsStore((s) => s.setUnit);
  const theme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const resetDevices = useDeviceStore((s) => s.resetAll);
  const wipeMedia = useMediaStore((s) => s.wipeAll);
  const [armed, setArmed] = useState(false);

  const wipeEverything = async () => {
    await wipeMedia();
    resetDevices();
    try {
      localStorage.removeItem("wright-angles:devices");
      localStorage.removeItem("wright-angles:settings");
      localStorage.removeItem("wright-angles:ui");
    } catch {
      // localStorage unavailable — stores were reset in memory anyway.
    }
    useUiStore.persist.rehydrate();
    setArmed(false);
  };

  return (
    <FloatingPanel
      id="settings"
      title="Settings"
      icon={SettingsIcon}
      defaultPosition={{ x: 64, y: 420 }}
      width={280}
    >
      <div className="space-y-3 p-3">
        <div className="space-y-1">
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Units
          </span>
          <SegmentedToggle<LengthUnit>
            value={unit}
            options={[
              { value: "cm", label: "Centimeters" },
              { value: "in", label: "Inches" },
            ]}
            onChange={setUnit}
          />
        </div>

        <div className="space-y-1">
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Theme
          </span>
          <SegmentedToggle
            value={theme}
            options={[
              { value: "dark", label: "Dark" },
              { value: "light", label: "Light" },
            ]}
            onChange={setTheme}
          />
        </div>

        <div className="panel-inset flex items-start gap-2 rounded-md px-2.5 py-2 text-[11px] leading-4 text-muted-foreground">
          <ShieldCheckIcon className="mt-0.5 size-3.5 shrink-0" />
          <span>
            Wright Angles has no server. Devices, settings, and images live
            only in this browser — nothing is uploaded or tracked.
          </span>
        </div>

        {armed ? (
          <div className="flex gap-2">
            <button
              type="button"
              className="h-8 flex-1 rounded-md bg-destructive text-xs text-white transition-opacity hover:opacity-90"
              onClick={() => void wipeEverything()}
            >
              Really wipe everything
            </button>
            <button
              type="button"
              className="ctl-quiet h-8 flex-1 text-xs"
              onClick={() => setArmed(false)}
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="h-8 w-full rounded-md border border-destructive/40 text-xs text-destructive transition-colors hover:bg-destructive/10"
            onClick={() => setArmed(true)}
          >
            Wipe local data…
          </button>
        )}
      </div>
    </FloatingPanel>
  );
}
