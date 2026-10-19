import { describe, expect, test } from "bun:test";
import {
  arcminToDevicePx,
  fitRows,
  optotypeRows,
  snellenArcmin,
  textLadderRows,
} from "./acuity-ladder";
import { pixelsToArcmin } from "./display-math";
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
// 27" 1080p at 50 cm: each pixel is ~2.1′, coarser than 20/20 detail.
const closeLowDensity = dev({
  distanceCm: 50,
  resolution: { w: 1920, h: 1080 },
});

describe("arcminToDevicePx", () => {
  test("inverts pixelsToArcmin", () => {
    for (const arcmin of [1, 5, 16, 20, 50]) {
      const px = arcminToDevicePx(arcmin, monitor);
      expect(pixelsToArcmin(px, monitor)).toBeCloseTo(arcmin, 6);
    }
  });

  test("degenerate panel yields 0", () => {
    expect(arcminToDevicePx(20, dev({ resolution: { w: 0, h: 0 } }))).toBe(0);
  });
});

describe("optotypeRows", () => {
  test("20/20 is 5 arcmin and rows scale with the denominator", () => {
    expect(snellenArcmin(20)).toBe(5);
    expect(snellenArcmin(200)).toBe(50);
    const rows = optotypeRows(monitor);
    expect(rows[0].label).toBe("20/200");
    expect(rows.at(-1)!.label).toBe("20/15");
  });

  test("a close low-density panel can't draw the fine rows", () => {
    const rows = optotypeRows(closeLowDensity);
    const r20 = rows.find((r) => r.label === "20/20")!;
    expect(r20.pixelLimited).toBe(true);
    expect(rows[0].pixelLimited).toBe(false);
  });
});

describe("textLadderRows", () => {
  test("verdicts follow the ISO 16/20 band", () => {
    const byArc = Object.fromEntries(
      textLadderRows(monitor).map((r) => [r.arcmin, r.verdict]),
    );
    expect(byArc[20]).toBe("pass");
    expect(byArc[16]).toBe("tight");
    expect(byArc[12]).toBe("fail");
  });

  test("small rungs have sub-1′ strokes", () => {
    const r6 = textLadderRows(monitor).find((r) => r.arcmin === 6)!;
    expect(r6.subAcuityStrokes).toBe(true);
    const r30 = textLadderRows(monitor).find((r) => r.arcmin === 30)!;
    expect(r30.subAcuityStrokes).toBe(false);
  });
});

describe("fitRows", () => {
  const rows = [{ h: 50 }, { h: 30 }, { h: 10 }];
  test("drops the tallest rows first", () => {
    expect(fitRows(rows, (r) => r.h, 45)).toEqual([{ h: 30 }, { h: 10 }]);
  });
  test("keeps everything when it fits, and at least one row", () => {
    expect(fitRows(rows, (r) => r.h, 1000)).toHaveLength(3);
    expect(fitRows(rows, (r) => r.h, 1)).toEqual([{ h: 10 }]);
  });
});
