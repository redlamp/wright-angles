/**
 * High-level screen groups for picking This Device: the categories a
 * person names their screen by, not the app's internal ones. Projectors
 * sit with TVs (the living-room screens); phones and tablets sit with
 * handhelds (things you hold). Generic presets appear under All only.
 */

import type { DeviceCategory, DevicePreset } from "./types";

export type PresetGroupId = "all" | "tv" | "monitor" | "laptop" | "handheld";

export const PRESET_GROUPS: {
  id: PresetGroupId;
  label: string;
  categories: DeviceCategory[];
}[] = [
  { id: "all", label: "All", categories: [] },
  { id: "tv", label: "TV", categories: ["tv", "projector"] },
  { id: "monitor", label: "Monitors", categories: ["monitor"] },
  { id: "laptop", label: "Laptop", categories: ["laptop"] },
  { id: "handheld", label: "Handheld", categories: ["handheld", "phone", "tablet"] },
];

const NAMED = PRESET_GROUPS.filter((g) => g.id !== "all");

/** The presets in one group; "all" keeps every preset. */
export function presetsInGroup(
  presets: DevicePreset[],
  group: PresetGroupId,
): DevicePreset[] {
  if (group === "all") return presets;
  const cats = PRESET_GROUPS.find((g) => g.id === group)?.categories ?? [];
  return presets.filter((p) => cats.includes(p.category));
}

/** Presets split into labeled sections, in group order, for "All". */
export function presetSections(
  presets: DevicePreset[],
): { label: string; presets: DevicePreset[] }[] {
  const sections = NAMED.map((g) => ({
    label: g.label,
    presets: presets.filter((p) => g.categories.includes(p.category)),
  }));
  const grouped = new Set(NAMED.flatMap((g) => g.categories));
  sections.push({
    label: "Generic",
    presets: presets.filter((p) => !grouped.has(p.category)),
  });
  return sections.filter((s) => s.presets.length > 0);
}
