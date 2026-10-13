/**
 * Undo labels for device-store changes. The store records every change
 * as a before/after snapshot (lib/history.ts); this names the change
 * from the diff alone, so no action has to label itself, and picks a
 * coalescing key for the continuous edits (sliders, steppers, typing).
 */
import type { Device } from "@/lib/types";

/** The persisted slice of the device store — what undo restores. */
export interface DeviceSnapshot {
  thisDevice: Device;
  devices: Device[];
  colorCursor: number;
}

export interface DeviceChange {
  label: string;
  key?: string;
}

/** Field → label. Continuous fields coalesce; toggles don't. */
const FIELDS: Record<string, { label: string; continuous: boolean }> = {
  distanceCm: { label: "Distance", continuous: true },
  diagonalIn: { label: "Size", continuous: true },
  resolution: { label: "Resolution", continuous: true },
  aspect: { label: "Aspect", continuous: true },
  curvatureR: { label: "Curvature", continuous: true },
  heightOffsetCm: { label: "Height offset", continuous: true },
  tilt: { label: "Tilt", continuous: true },
  label: { label: "Name", continuous: true },
  deviceName: { label: "Device name", continuous: true },
  color: { label: "Color", continuous: true },
  autoOrient: { label: "Auto-orient", continuous: false },
  fit: { label: "Fit", continuous: false },
  visible: { label: "Visibility", continuous: false },
  category: { label: "Category", continuous: false },
};

const same = (a: unknown, b: unknown) =>
  a === b || JSON.stringify(a) === JSON.stringify(b);

/** Fields whose values differ between two versions of one device. */
export function changedFields(a: Device, b: Device): string[] {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys]
    .filter((k) => !same(a[k as keyof Device], b[k as keyof Device]))
    .sort();
}

/** Deep equality of two snapshots (devices are small, plain data). */
export const sameDeviceSnapshot = (a: DeviceSnapshot, b: DeviceSnapshot) =>
  a.thisDevice === b.thisDevice &&
  a.devices === b.devices &&
  a.colorCursor === b.colorCursor
    ? true
    : same(a, b);

/**
 * Name a change, or null when nothing undo-worthy changed (a no-op set,
 * or only the color cursor moving).
 */
export function describeDeviceChange(
  before: DeviceSnapshot,
  after: DeviceSnapshot,
): DeviceChange | null {
  const ids = (s: DeviceSnapshot) => s.devices.map((d) => d.id);
  const a = ids(before);
  const b = ids(after);
  if (b.length > a.length) {
    const added = after.devices.filter((d) => !a.includes(d.id));
    return added.length === 1
      ? { label: `Add ${added[0].label}` }
      : { label: "Add devices" };
  }
  if (b.length < a.length) {
    const gone = before.devices.filter((d) => !b.includes(d.id));
    return gone.length === 1 && b.every((id) => a.includes(id))
      ? { label: `Remove ${gone[0].label}` }
      : { label: "Change devices" };
  }
  if (a.some((id, i) => id !== b[i])) {
    const sameSet = a.every((id) => b.includes(id));
    return { label: sameSet ? "Reorder devices" : "Change devices" };
  }
  const pairs: [Device, Device][] = [[before.thisDevice, after.thisDevice]];
  before.devices.forEach((d, i) => pairs.push([d, after.devices[i]]));
  const changed = pairs
    .filter(([x, y]) => x !== y)
    .map(([x, y]) => ({ id: y.id, name: y.label, fields: changedFields(x, y) }))
    .filter((c) => c.fields.length > 0);
  if (changed.length === 0) return null;
  if (changed.length > 1) return { label: "Change devices" };
  const { id, name, fields } = changed[0];
  const known = fields.map((f) => FIELDS[f]);
  const label =
    known.length === 1 && known[0] ? known[0].label : "Edit device";
  const continuous = known.every((f) => f?.continuous);
  return {
    label: `${label} (${name})`,
    key: continuous ? `device:${id}:${fields.join(",")}` : undefined,
  };
}
