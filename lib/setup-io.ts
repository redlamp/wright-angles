"use client";

import type { Device } from "./types";
import { useDeviceStore } from "@/stores/device-store";
import { useSettingsStore } from "@/stores/settings-store";
import { useViewerStore } from "@/stores/viewer-store";

/**
 * Versioned save-file for the whole rig: devices, settings, viewer.
 * Local-only like everything else — exported as a plain JSON download,
 * imported from a file picker.
 */

export const SETUP_SCHEMA = 1;

export interface SetupFile {
  app: "wright-angles";
  schema: number;
  exportedAt: string;
  thisDevice: Device;
  devices: Device[];
  settings: {
    unit: "in" | "cm";
    theme: "system" | "dark" | "light";
    displayFill: "black" | "device-color";
    showLegibilityBands: boolean;
  };
  viewer: { scenario: "standing" | "desk" | "couch"; heightCm: number };
}

export function buildSetup(): SetupFile {
  const d = useDeviceStore.getState();
  const s = useSettingsStore.getState();
  const v = useViewerStore.getState();
  return {
    app: "wright-angles",
    schema: SETUP_SCHEMA,
    exportedAt: new Date().toISOString(),
    thisDevice: d.thisDevice,
    devices: d.devices,
    settings: {
      unit: s.unit,
      theme: s.theme,
      displayFill: s.displayFill,
      showLegibilityBands: s.showLegibilityBands,
    },
    viewer: { scenario: v.scenario, heightCm: v.heightCm },
  };
}

export function downloadSetup() {
  const blob = new Blob([JSON.stringify(buildSetup(), null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `wright-angles-setup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function isDevice(x: unknown): x is Device {
  if (typeof x !== "object" || x === null) return false;
  const d = x as Record<string, unknown>;
  return (
    typeof d.id === "string" &&
    typeof d.label === "string" &&
    typeof d.diagonalIn === "number" &&
    d.diagonalIn > 0 &&
    typeof d.distanceCm === "number" &&
    d.distanceCm > 0 &&
    typeof d.resolution === "object" &&
    d.resolution !== null &&
    typeof d.aspect === "object" &&
    d.aspect !== null &&
    typeof d.color === "string" &&
    typeof d.visible === "boolean"
  );
}

/** Apply a parsed setup file. Returns null on success, else an error. */
export function applySetup(raw: unknown): string | null {
  if (typeof raw !== "object" || raw === null) return "Not a setup file.";
  const f = raw as Partial<SetupFile>;
  if (f.app !== "wright-angles") return "Not a Wright Angles setup file.";
  if (f.schema !== SETUP_SCHEMA)
    return `Unsupported schema version ${String(f.schema)} (expected ${SETUP_SCHEMA}).`;
  if (!isDevice(f.thisDevice)) return "Invalid This Device entry.";
  if (!Array.isArray(f.devices) || !f.devices.every(isDevice))
    return "Invalid device list.";

  useDeviceStore.setState({
    thisDevice: f.thisDevice,
    devices: f.devices,
  });
  if (f.settings) {
    const s = f.settings;
    useSettingsStore.setState({
      ...(s.unit === "in" || s.unit === "cm" ? { unit: s.unit } : {}),
      ...(s.theme === "system" || s.theme === "dark" || s.theme === "light"
        ? { theme: s.theme }
        : {}),
      ...(s.displayFill === "black" || s.displayFill === "device-color"
        ? { displayFill: s.displayFill }
        : {}),
      ...(typeof s.showLegibilityBands === "boolean"
        ? { showLegibilityBands: s.showLegibilityBands }
        : {}),
    });
  }
  if (
    f.viewer &&
    (f.viewer.scenario === "standing" ||
      f.viewer.scenario === "desk" ||
      f.viewer.scenario === "couch") &&
    typeof f.viewer.heightCm === "number"
  ) {
    useViewerStore.setState({
      scenario: f.viewer.scenario,
      heightCm: f.viewer.heightCm,
    });
  }
  return null;
}

export async function importSetupFile(file: File): Promise<string | null> {
  try {
    return applySetup(JSON.parse(await file.text()));
  } catch {
    return "Could not parse the file as JSON.";
  }
}
