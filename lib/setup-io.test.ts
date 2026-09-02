import { describe, expect, test } from "bun:test";
import { isDevice } from "./setup-io";

/** A minimally valid device, per isDevice's own requirements. */
const validDevice = {
  id: "d",
  label: "D",
  diagonalIn: 24,
  distanceCm: 70,
  resolution: { w: 1920, h: 1080 },
  aspect: { w: 16, h: 9 },
  color: "#fff",
  visible: true,
};

describe("isDevice", () => {
  test("accepts a well-formed device", () => {
    expect(isDevice(validDevice)).toBe(true);
  });

  test("rejects non-finite diagonalIn", () => {
    expect(isDevice({ ...validDevice, diagonalIn: Infinity })).toBe(false);
    expect(isDevice({ ...validDevice, diagonalIn: NaN })).toBe(false);
  });

  test("rejects non-finite distanceCm", () => {
    expect(isDevice({ ...validDevice, distanceCm: Infinity })).toBe(false);
    expect(isDevice({ ...validDevice, distanceCm: -Infinity })).toBe(false);
  });

  test("rejects a resolution/aspect with non-finite or non-positive w/h", () => {
    expect(
      isDevice({ ...validDevice, resolution: { w: Infinity, h: 1080 } }),
    ).toBe(false);
    expect(
      isDevice({ ...validDevice, resolution: { w: 1920, h: NaN } }),
    ).toBe(false);
    expect(
      isDevice({ ...validDevice, resolution: { w: 0, h: 1080 } }),
    ).toBe(false);
    expect(
      isDevice({ ...validDevice, aspect: { w: -16, h: 9 } }),
    ).toBe(false);
  });

  test("still requires resolution/aspect to be an object at all", () => {
    expect(isDevice({ ...validDevice, resolution: null })).toBe(false);
    expect(isDevice({ ...validDevice, resolution: "1920x1080" })).toBe(false);
  });
});
