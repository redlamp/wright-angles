"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Device, DevicePreset } from "@/lib/types";
import { DEVICE_COLORS, DEVICE_PRESETS } from "@/lib/presets";
import { eyeLevelForScenario } from "@/lib/viewing-geometry";
import type { Scenario } from "@/stores/viewer-store";

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

const defaultThisDevice: Device = {
  id: "this-device",
  label: "My Monitor",
  category: "monitor",
  diagonalIn: 27,
  distanceCm: 70,
  resolution: { w: 2560, h: 1440 },
  aspect: { w: 16, h: 9 },
  color: "#46a758",
  visible: true,
};

const specFromPreset = (p: DevicePreset): Omit<Device, "id" | "color" | "visible"> => ({
  label: p.label,
  deviceName: p.deviceName,
  category: p.category,
  diagonalIn: p.diagonalIn,
  distanceCm: p.distanceCm,
  resolution: { ...p.resolution },
  aspect: { ...p.aspect },
  curvatureR: p.curvatureR,
});

const seedDevice = (presetId: string, color: string): Device => {
  const p = DEVICE_PRESETS.find((x) => x.presetId === presetId)!;
  return { ...specFromPreset(p), id: newId(), color, visible: true };
};

interface DeviceState {
  thisDevice: Device;
  devices: Device[];
  colorCursor: number;
  updateThisDevice: (patch: Partial<Device>) => void;
  addFromPreset: (preset: DevicePreset) => void;
  updateDevice: (id: string, patch: Partial<Device>) => void;
  removeDevice: (id: string) => void;
  /** Move a device to a new index in the list (drag reorder). */
  moveDevice: (id: string, toIndex: number) => void;
  /**
   * Clone a device (same specs, next auto color) — the way to test one
   * display at several distances side by side.
   */
  duplicateDevice: (id: string) => void;
  toggleVisible: (id: string) => void;
  resetAll: () => void;
}

export const useDeviceStore = create<DeviceState>()(
  persist(
    (set) => ({
      thisDevice: defaultThisDevice,
      // Starter set (Taylor 2026-08-19): a spread from handheld to
      // projector so the first launch demonstrates the range; freely
      // deletable. Green is skipped — it's This Device's key color.
      devices: [
        seedDevice("switch-2", DEVICE_COLORS[0]),
        { ...seedDevice("steam-deck", DEVICE_COLORS[1]), distanceCm: 36 },
        seedDevice("monitor-27-1440", DEVICE_COLORS[3]),
        seedDevice("tv-49-4k", DEVICE_COLORS[4]),
        seedDevice("projector-120", DEVICE_COLORS[5]),
      ],
      colorCursor: 6,
      updateThisDevice: (patch) =>
        set((s) => ({ thisDevice: { ...s.thisDevice, ...patch } })),
      addFromPreset: (preset) =>
        set((s) => ({
          devices: [
            ...s.devices,
            {
              ...specFromPreset(preset),
              id: newId(),
              color: DEVICE_COLORS[s.colorCursor % DEVICE_COLORS.length],
              visible: true,
            },
          ],
          colorCursor: s.colorCursor + 1,
        })),
      updateDevice: (id, patch) =>
        set((s) => ({
          devices: s.devices.map((d) => (d.id === id ? { ...d, ...patch } : d)),
        })),
      // Nothing to clean up elsewhere: fit lives ON the device, so it
      // leaves with it (no per-media override matrix to prune).
      removeDevice: (id) =>
        set((s) => ({ devices: s.devices.filter((d) => d.id !== id) })),
      moveDevice: (id, toIndex) =>
        set((s) => {
          const from = s.devices.findIndex((d) => d.id === id);
          if (from < 0) return {};
          const devices = [...s.devices];
          const [moved] = devices.splice(from, 1);
          devices.splice(
            Math.min(Math.max(0, toIndex), devices.length),
            0,
            moved,
          );
          return { devices };
        }),
      duplicateDevice: (id) =>
        set((s) => {
          const src =
            s.devices.find((d) => d.id === id) ??
            (s.thisDevice.id === id ? s.thisDevice : undefined);
          if (!src) return {};
          const idx = s.devices.findIndex((d) => d.id === id);
          const copy: Device = {
            ...src,
            resolution: { ...src.resolution },
            aspect: { ...src.aspect },
            heightOffsetCm: src.heightOffsetCm
              ? { ...src.heightOffsetCm }
              : undefined,
            tilt: src.tilt ? { ...src.tilt } : undefined,
            autoOrient: src.autoOrient ? { ...src.autoOrient } : undefined,
            id: newId(),
            label: `${src.label} (2)`,
            color: DEVICE_COLORS[s.colorCursor % DEVICE_COLORS.length],
          };
          const devices = [...s.devices];
          devices.splice(idx >= 0 ? idx + 1 : devices.length, 0, copy);
          return { devices, colorCursor: s.colorCursor + 1 };
        }),
      toggleVisible: (id) =>
        set((s) => ({
          devices: s.devices.map((d) =>
            d.id === id ? { ...d, visible: !d.visible } : d,
          ),
        })),
      resetAll: () =>
        set(() => ({
          thisDevice: defaultThisDevice,
          devices: [],
          colorCursor: 0,
        })),
    }),
    {
      name: "wright-angles:devices",
      version: 1,
      migrate: migrateDevices,
    },
  ),
);

/**
 * v0 → v1: `elevation` held an ABSOLUTE screen-centre height from the
 * floor; `heightOffsetCm` holds the offset from the viewer's eye line.
 *
 * Converting needs the eye height the old value was chosen against, so
 * this reads the persisted body height out of the viewer store's own
 * key rather than importing it (that store hydrates independently, and
 * a migration must not depend on the order). A missing or unreadable
 * value falls back to the same 175cm default a new session starts at,
 * which is exactly what the old number was measured against anyway.
 *
 * Reinterpreting the old numbers in place was the alternative and would
 * have been silent data loss: a TV at 164cm from the floor would have
 * become a TV 164cm ABOVE the gaze, out through the ceiling.
 */
function migrateDevices(state: unknown, from: number): unknown {
  if (from >= 1 || !state || typeof state !== "object") return state;
  const bodyCm = persistedBodyHeightCm();
  const convert = (d: Device & { elevation?: Record<string, number> }) => {
    if (!d?.elevation) return d;
    const offsets: Record<string, number> = {};
    for (const s of ["standing", "desk", "couch"] as Scenario[]) {
      const abs = d.elevation[s];
      if (typeof abs !== "number") continue;
      const off = Math.round(abs - eyeLevelForScenario(s, bodyCm));
      // A height that WAS the eye line becomes level, which is the
      // absence of an offset — storing a literal 0 would leave the
      // eye-level switch reading as off for a screen that is dead on
      // the gaze. (Most v0 values are exactly this: the old control
      // seeded overrides at the current eye height.)
      if (off !== 0) offsets[s] = off;
    }
    const rest = { ...d };
    delete rest.elevation;
    return {
      ...rest,
      heightOffsetCm: Object.keys(offsets).length ? offsets : undefined,
    };
  };
  const s = state as {
    devices?: (Device & { elevation?: Record<string, number> })[];
    thisDevice?: Device & { elevation?: Record<string, number> };
  };
  return {
    ...s,
    devices: Array.isArray(s.devices) ? s.devices.map(convert) : s.devices,
    thisDevice: s.thisDevice ? convert(s.thisDevice) : s.thisDevice,
  };
}

/** Body height from the viewer store's persisted blob; 175cm default. */
function persistedBodyHeightCm(): number {
  try {
    const raw = globalThis.localStorage?.getItem("wright-angles:viewer");
    if (!raw) return 175;
    const h = JSON.parse(raw)?.state?.heightCm;
    return typeof h === "number" && h > 0 ? h : 175;
  } catch {
    return 175;
  }
}
