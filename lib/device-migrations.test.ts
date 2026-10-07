import { describe, expect, test } from "bun:test";
import { migrateDevices } from "./device-migrations";
import { eyeLevelForScenario } from "./viewing-geometry";

const base = {
  id: "d1",
  label: "TV",
  category: "tv",
  diagonalIn: 65,
  distanceCm: 300,
  resolution: { w: 3840, h: 2160 },
  aspect: { w: 16, h: 9 },
  color: "#fff",
  visible: true,
};

type Migrated = {
  devices: Record<string, unknown>[];
  thisDevice?: Record<string, unknown>;
};
const run = (state: unknown, from = 0, bodyCm = 175) =>
  migrateDevices(state, from, bodyCm) as Migrated;

describe("migrateDevices v0 → v1", () => {
  test("absolute elevation becomes an offset from the eye line", () => {
    const standingEye = eyeLevelForScenario("standing", 175);
    const out = run({
      devices: [{ ...base, elevation: { standing: standingEye + 40 } }],
    });
    expect(out.devices[0].elevation).toBeUndefined();
    expect(out.devices[0].heightOffsetCm).toEqual({ standing: 40 });
  });

  test("uses the supplied body height, not a fixed default", () => {
    const desk160 = eyeLevelForScenario("desk", 160);
    const out = run(
      { devices: [{ ...base, elevation: { desk: desk160 - 10 } }] },
      0,
      160,
    );
    expect(out.devices[0].heightOffsetCm).toEqual({ desk: -10 });
  });

  test("a height on the eye line migrates to no offset, not a literal 0", () => {
    const out = run({
      devices: [
        { ...base, elevation: { couch: eyeLevelForScenario("couch", 175) } },
      ],
    });
    expect(out.devices[0].heightOffsetCm).toBeUndefined();
    expect("elevation" in out.devices[0]).toBe(false);
  });

  test("ignores non-numeric stance entries and keeps other fields", () => {
    const out = run({
      devices: [
        {
          ...base,
          elevation: { standing: "high", desk: eyeLevelForScenario("desk", 175) + 5 },
        },
      ],
    });
    expect(out.devices[0].heightOffsetCm).toEqual({ desk: 5 });
    expect(out.devices[0].label).toBe("TV");
    expect(out.devices[0].distanceCm).toBe(300);
  });

  test("converts thisDevice too", () => {
    const out = run({
      devices: [],
      thisDevice: { ...base, id: "this-device", elevation: { desk: 200 } },
    });
    expect(out.thisDevice?.elevation).toBeUndefined();
    expect(out.thisDevice?.heightOffsetCm).toEqual({
      desk: Math.round(200 - eyeLevelForScenario("desk", 175)),
    });
  });

  test("devices without elevation pass through untouched", () => {
    const d = { ...base };
    const out = run({ devices: [d] });
    expect(out.devices[0]).toBe(d);
  });

  test("already-v1 state and non-objects are returned as-is", () => {
    const state = { devices: [{ ...base, elevation: { desk: 999 } }] };
    expect(migrateDevices(state, 1, 175)).toBe(state);
    expect(migrateDevices(null, 0, 175)).toBeNull();
    expect(migrateDevices("junk", 0, 175)).toBe("junk");
  });

  test("tolerates a missing or malformed devices array", () => {
    expect(run({}).devices).toBeUndefined();
    expect(run({ devices: "nope" }).devices as unknown).toBe("nope");
  });
});
