import { describe, expect, test } from "bun:test";
import { contentPxToArcmin, deviceAngles } from "./display-math";
import {
  formatReferenceHeight,
  minPxForArcmin,
  textSizeGuide,
} from "./text-size";
import type { Device } from "./types";

const dev = (d: Partial<Device>): Device => ({
  id: "t",
  label: "t",
  category: "custom",
  diagonalIn: 27,
  distanceCm: 70,
  resolution: { w: 2560, h: 1440 },
  aspect: { w: 16, h: 9 },
  color: "#fff",
  visible: true,
  ...d,
});

const monitor = dev({});
const tv = dev({
  diagonalIn: 49,
  distanceCm: 200,
  resolution: { w: 3840, h: 2160 },
});
const handheld = dev({
  diagonalIn: 7.9,
  distanceCm: 40,
  resolution: { w: 1920, h: 1080 },
});

describe("minPxForArcmin", () => {
  test("is the true minimum: reaches the target, one px less does not", () => {
    for (const d of [monitor, tv, handheld])
      for (const refH of [720, 1080, 1440, 2160])
        for (const arcmin of [16, 20]) {
          const px = minPxForArcmin(arcmin, refH, d);
          expect(px).toBeGreaterThan(0);
          expect(contentPxToArcmin(px, refH, d)).toBeGreaterThanOrEqual(
            arcmin,
          );
          expect(contentPxToArcmin(px - 1, refH, d)).toBeLessThan(arcmin);
        }
  });

  test("matches the device-native readout when authored at panel height", () => {
    // Authoring at the panel's own height is 1:1 device pixels — the
    // old readout's ceil(arcmin / arcminPerPx), up to subtense rounding.
    const a = deviceAngles(handheld);
    const native = Math.ceil(16 / a.arcminPerPx);
    expect(Math.abs(minPxForArcmin(16, 1080, handheld) - native)).toBeLessThanOrEqual(1);
  });

  test("scales with authoring resolution", () => {
    const at1080 = minPxForArcmin(20, 1080, tv);
    const at2160 = minPxForArcmin(20, 2160, tv);
    expect(Math.abs(at2160 - 2 * at1080)).toBeLessThanOrEqual(2);
  });

  test("degenerate input returns 0", () => {
    expect(minPxForArcmin(16, 0, monitor)).toBe(0);
    expect(minPxForArcmin(0, 1080, monitor)).toBe(0);
  });
});

describe("textSizeGuide", () => {
  test("comfortable is never smaller than minimum", () => {
    const g = textSizeGuide(1080, tv);
    expect(g.comfortablePx).toBeGreaterThanOrEqual(g.minPx);
    expect(g.referenceHeight).toBe(1080);
  });

  test("a farther viewer needs bigger text", () => {
    const near = textSizeGuide(1080, tv);
    const far = textSizeGuide(1080, { ...tv, distanceCm: 300 });
    expect(far.minPx).toBeGreaterThan(near.minPx);
  });
});

test("formatReferenceHeight", () => {
  expect(formatReferenceHeight(1080)).toBe("1080p");
  expect(formatReferenceHeight(2160)).toBe("2160p");
});
