import { describe, expect, test } from "bun:test";
import {
  changedFields,
  describeDeviceChange,
  sameDeviceSnapshot,
  type DeviceSnapshot,
} from "./device-history";
import type { Device } from "./types";

const dev = (id: string, patch: Partial<Device> = {}): Device => ({
  id,
  label: id.toUpperCase(),
  category: "monitor",
  diagonalIn: 27,
  distanceCm: 70,
  resolution: { w: 2560, h: 1440 },
  aspect: { w: 16, h: 9 },
  color: "#fff",
  visible: true,
  ...patch,
});

const snap = (devices: Device[], thisDevice = dev("me")): DeviceSnapshot => ({
  thisDevice,
  devices,
  colorCursor: devices.length,
});

const a = dev("a");
const b = dev("b");
const base = snap([a, b]);

describe("describeDeviceChange", () => {
  test("no change → null", () => {
    expect(describeDeviceChange(base, base)).toBeNull();
    expect(describeDeviceChange(base, { ...base, colorCursor: 9 })).toBeNull();
  });

  test("a new array with identical devices is no change", () => {
    expect(describeDeviceChange(base, snap([{ ...a }, b]))).toBeNull();
  });

  test("add / remove name the device", () => {
    expect(describeDeviceChange(base, snap([a, b, dev("c")]))).toEqual({
      label: "Add C",
    });
    expect(describeDeviceChange(base, snap([b]))).toEqual({ label: "Remove A" });
  });

  test("reorder", () => {
    expect(describeDeviceChange(base, snap([b, a]))?.label).toBe(
      "Reorder devices",
    );
  });

  test("continuous field edits coalesce per device and field", () => {
    const c = describeDeviceChange(base, snap([dev("a", { distanceCm: 90 }), b]));
    expect(c).toEqual({ label: "Distance (A)", key: "device:a:distanceCm" });
    const s = describeDeviceChange(base, snap([a, dev("b", { diagonalIn: 32 })]));
    expect(s?.key).toBe("device:b:diagonalIn");
    expect(s?.label).toBe("Size (B)");
  });

  test("nested objects compare by value", () => {
    const c = describeDeviceChange(
      base,
      snap([dev("a", { tilt: { desk: 10 } }), b]),
    );
    expect(c?.label).toBe("Tilt (A)");
    const same = describeDeviceChange(
      base,
      snap([dev("a", { resolution: { w: 2560, h: 1440 } }), b]),
    );
    expect(same).toBeNull();
  });

  test("toggles don't coalesce (two quick clicks are two steps)", () => {
    const c = describeDeviceChange(base, snap([dev("a", { visible: false }), b]));
    expect(c).toEqual({ label: "Visibility (A)", key: undefined });
    expect(
      describeDeviceChange(base, snap([dev("a", { fit: "stretch" }), b]))?.key,
    ).toBeUndefined();
  });

  test("renaming labels with the new name and coalesces typing", () => {
    const c = describeDeviceChange(base, snap([dev("a", { label: "Desk" }), b]));
    expect(c).toEqual({ label: "Name (Desk)", key: "device:a:label" });
  });

  test("This Device edits are covered", () => {
    const c = describeDeviceChange(
      base,
      snap([a, b], dev("me", { distanceCm: 50 })),
    );
    expect(c?.key).toBe("device:me:distanceCm");
  });

  test("several fields at once: generic label, key over the field set", () => {
    const c = describeDeviceChange(
      base,
      snap([dev("a", { resolution: { w: 1920, h: 1080 }, aspect: { w: 16, h: 10 } }), b]),
    );
    expect(c).toEqual({ label: "Edit device (A)", key: "device:a:aspect,resolution" });
  });

  test("several devices at once (reset, setup import) is one step", () => {
    expect(
      describeDeviceChange(
        base,
        snap([dev("a", { distanceCm: 1 }), dev("b", { distanceCm: 2 })]),
      ),
    ).toEqual({ label: "Change devices" });
    expect(describeDeviceChange(base, snap([dev("x"), dev("y")]))?.label).toBe(
      "Change devices",
    );
  });
});

describe("helpers", () => {
  test("changedFields lists differing keys, including added/removed ones", () => {
    expect(changedFields(a, dev("a", { curvatureR: 1000, distanceCm: 1 }))).toEqual([
      "curvatureR",
      "distanceCm",
    ]);
  });

  test("sameDeviceSnapshot is deep", () => {
    expect(sameDeviceSnapshot(base, snap([{ ...a }, { ...b }]))).toBe(true);
    expect(sameDeviceSnapshot(base, snap([b, a]))).toBe(false);
  });
});
