import { describe, expect, test } from "bun:test";
import {
  contrastRatio,
  estimateTextContrast,
  grayForContrast,
  relativeLuminance,
} from "./contrast";

/** n RGBA pixels of one solid color. */
const solid = (r: number, g: number, b: number, n: number): number[] => {
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(r, g, b, 255);
  return out;
};

describe("relativeLuminance", () => {
  test("black is 0, white is 1", () => {
    expect(relativeLuminance(0, 0, 0)).toBe(0);
    expect(relativeLuminance(255, 255, 255)).toBeCloseTo(1, 6);
  });

  test("green dominates the weighting", () => {
    expect(relativeLuminance(0, 255, 0)).toBeGreaterThan(
      relativeLuminance(255, 0, 0),
    );
  });
});

describe("contrastRatio", () => {
  test("white on black is 21:1", () => {
    expect(contrastRatio(0, 1)).toBeCloseTo(21, 5);
  });

  test("order does not matter", () => {
    expect(contrastRatio(0.2, 0.8)).toBeCloseTo(contrastRatio(0.8, 0.2), 10);
  });

  test("equal luminances give 1:1", () => {
    expect(contrastRatio(0.5, 0.5)).toBe(1);
  });
});

describe("estimateTextContrast", () => {
  test("half black, half white → 21:1", () => {
    const px = [...solid(0, 0, 0, 100), ...solid(255, 255, 255, 100)];
    const est = estimateTextContrast(px);
    expect(est).not.toBeNull();
    expect(est!.ratio).toBeCloseTo(21, 3);
  });

  test("minority dark text on light background still splits", () => {
    // ~10% dark pixels, like thin glyph strokes on a page.
    const px = [...solid(20, 20, 20, 20), ...solid(240, 240, 240, 180)];
    const est = estimateTextContrast(px)!;
    expect(est.ratio).toBeGreaterThan(10);
  });

  test("low-contrast gray-on-gray reads low", () => {
    const px = [...solid(120, 120, 120, 100), ...solid(150, 150, 150, 100)];
    const est = estimateTextContrast(px)!;
    expect(est.ratio).toBeLessThan(2);
  });

  test("flat sample → null", () => {
    expect(estimateTextContrast(solid(128, 128, 128, 200))).toBeNull();
  });

  test("too few pixels → null", () => {
    expect(estimateTextContrast(solid(0, 0, 0, 4))).toBeNull();
  });
});

describe("grayForContrast", () => {
  const lum = (v: number) => relativeLuminance(v, v, v);
  test("lands at or just above the ratio on the lighter side", () => {
    const bg = lum(32);
    for (const ratio of [7, 4.5, 3, 2, 1.5]) {
      const v = grayForContrast(bg, ratio)!;
      expect(v).toBeGreaterThan(32);
      expect(contrastRatio(lum(v), bg)).toBeGreaterThanOrEqual(ratio);
      expect(contrastRatio(lum(v - 1), bg)).toBeLessThan(ratio);
    }
  });

  test("falls back to the darker side on a light background", () => {
    const bg = lum(232);
    const v = grayForContrast(bg, 4.5)!;
    expect(v).toBeLessThan(232);
    expect(contrastRatio(lum(v), bg)).toBeGreaterThanOrEqual(4.5);
  });

  test("null when no gray reaches the ratio", () => {
    expect(grayForContrast(lum(128), 21)).toBeNull();
  });
});

describe("grayForContrast side", () => {
  const lum = (v: number) => relativeLuminance(v, v, v);
  test("darker pins the side even when a lighter gray would do", () => {
    expect(grayForContrast(lum(128), 3)).toBe(225);
    expect(grayForContrast(lum(128), 3, "darker")).toBe(55);
  });
  test("lighter returns null when only a darker gray reaches it", () => {
    expect(grayForContrast(lum(128), 4.5, "lighter")).toBeNull();
    expect(grayForContrast(lum(128), 4.5, "darker")).toBe(23);
  });
});
