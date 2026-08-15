"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Device, DevicePreset } from "@/lib/types";
import { DEVICE_COLORS, DEVICE_PRESETS } from "@/lib/presets";

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
  toggleVisible: (id: string) => void;
  resetAll: () => void;
}

export const useDeviceStore = create<DeviceState>()(
  persist(
    (set) => ({
      thisDevice: defaultThisDevice,
      // A small starter set so the first launch already demonstrates the
      // idea; freely deletable.
      devices: [
        seedDevice("switch-oled", DEVICE_COLORS[1]),
        seedDevice("switch-2", DEVICE_COLORS[0]),
        seedDevice("tv-49-4k", DEVICE_COLORS[3]),
      ],
      colorCursor: 4,
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
