/**
 * Persisted device-store migrations, kept pure so they can be tested
 * without a browser. The store supplies anything it reads from
 * storage (the viewer's body height) as an argument.
 */

import type { Device } from "./types";
import { eyeLevelForScenario } from "./viewing-geometry";
import type { Scenario } from "@/stores/viewer-store";

type LegacyDevice = Device & { elevation?: Record<string, number> };

/**
 * v0 → v1: `elevation` held an ABSOLUTE screen-centre height from the
 * floor; `heightOffsetCm` holds the offset from the viewer's eye line.
 *
 * Converting needs the eye height the old value was chosen against —
 * `bodyCm`, which the store reads from the viewer store's persisted
 * blob (falling back to the 175cm default a new session starts at).
 *
 * Reinterpreting the old numbers in place was the alternative and would
 * have been silent data loss: a TV at 164cm from the floor would have
 * become a TV 164cm ABOVE the gaze, out through the ceiling.
 */
export function migrateDevices(
  state: unknown,
  from: number,
  bodyCm: number,
): unknown {
  if (from >= 1 || !state || typeof state !== "object") return state;
  const convert = (d: LegacyDevice) => {
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
  const s = state as { devices?: LegacyDevice[]; thisDevice?: LegacyDevice };
  return {
    ...s,
    devices: Array.isArray(s.devices) ? s.devices.map(convert) : s.devices,
    thisDevice: s.thisDevice ? convert(s.thisDevice) : s.thisDevice,
  };
}
