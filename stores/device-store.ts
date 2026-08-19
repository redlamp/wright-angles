"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Device, DevicePreset } from "@/lib/types";
import { DEVICE_COLORS, DEVICE_PRESETS } from "@/lib/presets";
import { useMediaStore } from "@/stores/media-store";

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
      removeDevice: (id) => {
        set((s) => ({ devices: s.devices.filter((d) => d.id !== id) }));
        // A deleted device's per-media crop overrides go with it.
        useMediaStore.getState().pruneDeviceCrops(id);
      },
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
            elevation: src.elevation ? { ...src.elevation } : undefined,
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
    { name: "wright-angles:devices" },
  ),
);
