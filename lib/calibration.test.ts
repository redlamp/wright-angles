import { describe, expect, test } from "bun:test";
import {
  CARD_ASPECT,
  CARD_H_MM,
  CARD_W_MM,
  COMMON_DIAGONALS_IN,
  cardWidthCssPx,
  diagonalFromCardPx,
  heightFromWidthPx,
  widthFromHeightPx,
} from "./calibration";

const aspect169 = { w: 16, h: 9 };
const res1440 = { w: 2560, h: 1440 };

describe("card constants", () => {
  test("ISO/IEC 7810 ID-1", () => {
    expect(CARD_W_MM).toBe(85.6);
    expect(CARD_H_MM).toBe(53.98);
  });
});

describe("cardWidthCssPx", () => {
  test('27" 16:9 2560×1440 @ dpr 1 → ~366.6 CSS px', () => {
    // widthCm = 59.7727 → 42.829 native px/cm; × 8.56cm = 366.6.
    // Cross-check: 42.829 px/cm × 2.54 = the sheet's 108.79 PPI.
    expect(cardWidthCssPx(27, aspect169, 2560, 1)).toBeCloseTo(366.62, 1);
  });

  test("dpr 2 halves the CSS span (same physical size)", () => {
    const at1 = cardWidthCssPx(13.3, aspect169, 2560, 1);
    const at2 = cardWidthCssPx(13.3, aspect169, 2560, 2);
    expect(at2).toBeCloseTo(at1 / 2, 6);
  });
});

describe("diagonalFromCardPx", () => {
  test("round-trips cardWidthCssPx at dpr 1", () => {
    const px = cardWidthCssPx(27, aspect169, res1440.w, 1);
    expect(diagonalFromCardPx(px, 1, res1440)).toBeCloseTo(27, 6);
  });

  test("round-trips at dpr 1.5 on a 16:10 panel", () => {
    const aspect1610 = { w: 16, h: 10 };
    const res = { w: 2560, h: 1600 };
    const px = cardWidthCssPx(13.3, aspect1610, res.w, 1.5);
    expect(diagonalFromCardPx(px, 1.5, res)).toBeCloseTo(13.3, 6);
  });

  test("a card drawn too small implies a larger panel", () => {
    const px = cardWidthCssPx(27, aspect169, res1440.w, 1);
    // User dragged wider → more px per cm → panel is denser → smaller
    // true diagonal; and vice versa.
    expect(diagonalFromCardPx(px * 1.1, 1, res1440)).toBeLessThan(27);
    expect(diagonalFromCardPx(px * 0.9, 1, res1440)).toBeGreaterThan(27);
  });
});

describe("heightFromWidthPx / widthFromHeightPx", () => {
  test("width→height matches the card's real ratio", () => {
    expect(heightFromWidthPx(CARD_W_MM)).toBeCloseTo(CARD_H_MM, 6);
  });

  test("round-trip", () => {
    expect(widthFromHeightPx(heightFromWidthPx(366.62))).toBeCloseTo(
      366.62,
      6,
    );
  });

  test("CARD_ASPECT is height/width", () => {
    expect(CARD_ASPECT).toBeCloseTo(CARD_H_MM / CARD_W_MM, 10);
  });
});

describe("COMMON_DIAGONALS_IN", () => {
  test("sorted ascending, laptop through TV", () => {
    const sorted = [...COMMON_DIAGONALS_IN].sort((a, b) => a - b);
    expect(COMMON_DIAGONALS_IN).toEqual(sorted);
    expect(COMMON_DIAGONALS_IN[0]).toBeLessThan(20);
    expect(COMMON_DIAGONALS_IN.at(-1)).toBeGreaterThan(50);
  });
});
