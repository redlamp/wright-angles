import { describe, expect, test } from "bun:test";
import { detectNativeResolution } from "./screen-detect";

describe("detectNativeResolution", () => {
  test("1x 1440p reads as-is", () => {
    expect(detectNativeResolution(2560, 1440, 1)).toEqual({
      w: 2560,
      h: 1440,
      snapped: true,
    });
  });
  test("retina doubles CSS px", () => {
    expect(detectNativeResolution(1920, 1080, 2)).toEqual({
      w: 3840,
      h: 2160,
      snapped: true,
    });
  });
  test("fractional scaling rounds, then snaps to the panel size", () => {
    // 1706.67 × 1.5 = 2560.005; a 1707-wide report lands at 2560.5.
    expect(detectNativeResolution(1707, 960, 1.5)).toEqual({
      w: 2560,
      h: 1440,
      snapped: true,
    });
    // 2559 is within 2% of 2560.
    expect(detectNativeResolution(2559, 1439, 1)).toMatchObject({
      w: 2560,
      h: 1440,
    });
  });
  test("125% Windows scaling on a 1080p laptop", () => {
    expect(detectNativeResolution(1536, 864, 1.25)).toEqual({
      w: 1920,
      h: 1080,
      snapped: true,
    });
  });
  test("portrait panels snap with their orientation kept", () => {
    expect(detectNativeResolution(1080, 1921, 1)).toEqual({
      w: 1080,
      h: 1920,
      snapped: true,
    });
  });
  test("unknown sizes pass through unsnapped", () => {
    expect(detectNativeResolution(1000, 700, 1.1)).toEqual({
      w: 1100,
      h: 770,
      snapped: false,
    });
  });
  test("more than 2% off a common size doesn't snap", () => {
    expect(detectNativeResolution(2500, 1440, 1)?.snapped).toBe(false);
  });
  test("unusable inputs give null", () => {
    expect(detectNativeResolution(0, 1080, 1)).toBeNull();
    expect(detectNativeResolution(1920, 1080, 0)).toBeNull();
    expect(detectNativeResolution(NaN, 1080, 1)).toBeNull();
    expect(detectNativeResolution(1920, 1080, Infinity)).toBeNull();
  });
});
