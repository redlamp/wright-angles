"use client";

import { useEffect, useRef, useState } from "react";
import {
  DownloadIcon,
  RulerIcon,
  SettingsIcon,
  ShieldCheckIcon,
  SparklesIcon,
  UploadIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSettingsStore } from "@/stores/settings-store";
import { useDeviceStore } from "@/stores/device-store";
import { useMediaStore } from "@/stores/media-store";
import { useUiStore } from "@/stores/ui-store";
import { downloadSetup, importSetupFile } from "@/lib/setup-io";
import { CalibrationDialog } from "@/components/calibration-dialog";
import { FloatingPanel } from "./floating-panel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import type { LengthUnit } from "@/lib/types";

export function SegmentedToggle<T extends string>({
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
            "h-full flex-1 rounded-[6px] text-sm transition-colors",
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

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <span className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </span>
      {children}
    </div>
  );
}

function StorageUsage() {
  const [usage, setUsage] = useState<{ used: number; quota: number } | null>(
    null,
  );
  useEffect(() => {
    let alive = true;
    navigator.storage
      ?.estimate?.()
      .then((e) => {
        if (alive && e.usage !== undefined && e.quota !== undefined) {
          setUsage({ used: e.usage, quota: e.quota });
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  if (!usage) return null;
  const mb = (n: number) => (n / 1048576).toFixed(1);
  const pct = usage.quota > 0 ? (usage.used / usage.quota) * 100 : 0;
  return (
    <div className="panel-inset space-y-1 rounded-md px-2.5 py-2">
      <div className="flex justify-between font-mono text-sm text-muted-foreground">
        <span>{mb(usage.used)} MB used</span>
        <span>{mb(usage.quota)} MB available</span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-foreground/50"
          style={{ width: `${Math.max(1, Math.min(100, pct))}%` }}
        />
      </div>
    </div>
  );
}

export function SettingsPanel() {
  const unit = useSettingsStore((s) => s.unit);
  const setUnit = useSettingsStore((s) => s.setUnit);
  const theme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const sceneTheme = useSettingsStore((s) => s.sceneTheme);
  const setSceneTheme = useSettingsStore((s) => s.setSceneTheme);
  const showBands = useSettingsStore((s) => s.showLegibilityBands);
  const setShowBands = useSettingsStore((s) => s.setShowLegibilityBands);
  const setOnboarded = useSettingsStore((s) => s.setOnboarded);
  const resetDevices = useDeviceStore((s) => s.resetAll);
  const wipeMedia = useMediaStore((s) => s.wipeAll);
  const [confirmingWipe, setConfirmingWipe] = useState(false);
  const [calibrating, setCalibrating] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  const wipeEverything = async () => {
    await wipeMedia();
    resetDevices();
    try {
      for (const k of [
        "wright-angles:devices",
        "wright-angles:settings",
        "wright-angles:ui",
        "wright-angles:viewer",
      ]) {
        localStorage.removeItem(k);
      }
    } catch {
      // localStorage unavailable — in-memory stores were reset anyway.
    }
    useUiStore.persist.rehydrate();
    setConfirmingWipe(false);
  };

  return (
    <FloatingPanel
      id="settings"
      title="Settings"
      icon={SettingsIcon}
      width={300}
    >
      <div className="max-h-[calc(100vh-8rem)] space-y-3 overflow-y-auto p-3">
        <Section label="Setup">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-full justify-start text-sm text-muted-foreground hover:text-foreground"
            onClick={() => setOnboarded(false)}
          >
            <SparklesIcon className="size-3.5" /> Run setup assistant again
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-full justify-start text-sm text-muted-foreground hover:text-foreground"
            onClick={() => setCalibrating(true)}
          >
            <RulerIcon className="size-3.5" /> Calibrate screen size…
          </Button>
        </Section>

        <Section label="Units">
          <SegmentedToggle<LengthUnit>
            value={unit}
            options={[
              { value: "cm", label: "Centimeters" },
              { value: "in", label: "Inches" },
            ]}
            onChange={setUnit}
          />
        </Section>

        <Section label="Theme">
          <SegmentedToggle
            value={theme}
            options={[
              { value: "system", label: "System" },
              { value: "dark", label: "Dark" },
              { value: "light", label: "Light" },
            ]}
            onChange={setTheme}
          />
        </Section>

        <Section label="3D scene">
          <SegmentedToggle
            value={sceneTheme}
            options={[
              { value: "follow", label: "Match UI" },
              { value: "dark", label: "Dark" },
              { value: "light", label: "Light" },
            ]}
            onChange={setSceneTheme}
          />
        </Section>

        <Section label="Readouts">
          <label className="flex h-8 items-center justify-between text-sm">
            Legibility bands (ISO 16′ / 20′)
            <Switch checked={showBands} onCheckedChange={setShowBands} />
          </label>
        </Section>

        <Section label="Storage">
          <StorageUsage />
        </Section>

        <div className="panel-inset flex items-start gap-2 rounded-md px-2.5 py-2 text-sm leading-4 text-muted-foreground">
          <ShieldCheckIcon className="mt-0.5 size-3.5 shrink-0" />
          <span>
            Wright Angles has no server. Devices, settings, and images live
            only in this browser — nothing is uploaded or tracked.
          </span>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <Button
            variant="secondary"
            size="sm"
            className="h-8 text-sm"
            onClick={downloadSetup}
          >
            <DownloadIcon className="size-3.5" /> Export
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="h-8 text-sm"
            onClick={() => importRef.current?.click()}
          >
            <UploadIcon className="size-3.5" /> Import
          </Button>
        </div>
        <input
          ref={importRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            void importSetupFile(f).then(setImportError);
          }}
        />
        {importError ? (
          <p className="text-sm text-destructive">{importError}</p>
        ) : null}

        <button
          type="button"
          className="h-8 w-full rounded-md border border-destructive/40 text-sm text-destructive transition-colors hover:bg-destructive/10"
          onClick={() => setConfirmingWipe(true)}
        >
          Wipe local data…
        </button>
      </div>
      <Dialog open={confirmingWipe} onOpenChange={setConfirmingWipe}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Wipe local data?</DialogTitle>
            <DialogDescription>
              Removes every device, setting, and imported image from this
              browser. There is no server copy — this cannot be undone.
              Export a setup file first if you want a backup.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setConfirmingWipe(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => void wipeEverything()}
            >
              Wipe everything
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <CalibrationDialog open={calibrating} onOpenChange={setCalibrating} />
    </FloatingPanel>
  );
}
