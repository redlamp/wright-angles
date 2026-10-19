import { describe, expect, test } from "bun:test";
import { contrastSwatchRows, pitchTileRects, PITCH_WIDTHS } from "./legibility-card";

describe("contrastSwatchRows", () => {
  const rows = contrastSwatchRows();

  test("light on dark, grey on grey, dark on light, as in Figma", () => {
    expect(rows.map((r) => r[0].bg)).toEqual([32, 128, 232]);
    expect(rows.map((r) => r.map((s) => s.fg))).toEqual([
      [170, 135, 106, 80, 62],
      [0, 23, 55, 81, 99],
      [76, 104, 133, 165, 191],
    ]);
  });

  test("labels carry the achieved ratio; mid gray tops out below 7:1", () => {
    expect(rows[0].map((s) => s.label)).toEqual([
      "7.01:1 AAA", "4.54:1 AA", "3.01:1 AA large", "2.02:1 fails", "1.52:1 fails",
    ]);
    expect(rows[1][0].label).toBe("5.32:1 max");
    expect(rows[2][4].label).toBe("1.50:1 fails");
  });
});

describe("pitchTileRects", () => {
  for (const w of PITCH_WIDTHS) {
    test(`${w}px: every rect inside the 128px tile and on whole pixels`, () => {
      for (const [x, y, rw, rh] of pitchTileRects(w)) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(x + rw).toBeLessThanOrEqual(128);
        expect(y + rh).toBeLessThanOrEqual(128);
        for (const v of [x, y, rw, rh]) expect(Number.isInteger(v)).toBe(true);
      }
    });
  }

  test("lines never cross a quadrant edge", () => {
    for (const w of [1, 2, 4]) {
      for (const [x, y, rw, rh] of pitchTileRects(w)) {
        expect(Math.floor(x / 64)).toBe(Math.floor((x + rw - 1) / 64));
        expect(Math.floor(y / 64)).toBe(Math.floor((y + rh - 1) / 64));
      }
    }
  });

  test("3px tile: 63px quadrants in a border black on top and left", () => {
    const rects = pitchTileRects(3);
    expect(rects.slice(0, 2)).toEqual([[0, 0, 128, 1], [0, 0, 1, 127]]);
    // First black stripe of the top-left quadrant is the second 3px line.
    expect(rects[2]).toEqual([1, 4, 63, 3]);
  });
});
