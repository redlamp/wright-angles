import { expect, test } from "bun:test";
import {
  LEGIBILITY_COLORS,
  legibilityColor,
  legibilityVerdict,
} from "./legibility";

test("verdict bands follow ISO 9241-303 (16′ minimum, 20′ comfortable)", () => {
  expect(legibilityVerdict(25)).toBe("pass");
  expect(legibilityVerdict(20)).toBe("pass");
  expect(legibilityVerdict(19.99)).toBe("tight");
  expect(legibilityVerdict(16)).toBe("tight");
  expect(legibilityVerdict(15.99)).toBe("fail");
  expect(legibilityVerdict(0)).toBe("fail");
});

test("verdict and color agree on every band", () => {
  const colorOf = {
    pass: LEGIBILITY_COLORS.good,
    tight: LEGIBILITY_COLORS.warn,
    fail: LEGIBILITY_COLORS.bad,
  };
  for (const a of [5, 15.9, 16, 18, 19.9, 20, 40])
    expect(legibilityColor(a)).toBe(colorOf[legibilityVerdict(a)]);
  expect(legibilityColor(null)).toBe(LEGIBILITY_COLORS.none);
});
