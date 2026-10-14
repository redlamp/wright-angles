import { describe, expect, test } from "bun:test";
import {
  detectNativeResolution,
  hintsZoom,
  zoomHintFromWindow,
} from "./screen-detect";

describe("detectNativeResolution", () => {
  test("1x 1440p reads as-is", () => {
    expect(detectNativeResolution(2560, 1440, 1)).toEqual({
      w: 2560,
      h: 1440,
      snapped: true,
      confident: true,
    });
  });
  test("retina doubles CSS px", () => {
    expect(detectNativeResolution(1920, 1080, 2)).toEqual({
      w: 3840,
      h: 2160,
      snapped: true,
      confident: true,
    });
  });
  test("fractional scaling rounds, then snaps to the panel size", () => {
    // 1706.67 × 1.5 = 2560.005; a 1707-wide report lands at 2560.5.
    expect(detectNativeResolution(1707, 960, 1.5)).toEqual({
      w: 2560,
      h: 1440,
      snapped: true,
      confident: true,
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
      confident: true,
    });
  });
  test("portrait panels snap with their orientation kept", () => {
    expect(detectNativeResolution(1080, 1921, 1)).toEqual({
      w: 1080,
      h: 1920,
      snapped: true,
      confident: true,
    });
  });
  test("unknown sizes pass through unsnapped", () => {
    expect(detectNativeResolution(1000, 700, 1.1)).toEqual({
      w: 1100,
      h: 770,
      snapped: false,
      confident: false,
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

describe("detection confidence (page zoom skews screen × dpr)", () => {
  test("a non-OS dpr (1x panel at 110% zoom) is never confident", () => {
    // 1745 × 1.1 ≈ 1920: it snaps, but the 1.1 dpr is a zoom tell.
    const d = detectNativeResolution(1745, 982, 1.1);
    expect(d?.snapped).toBe(true);
    expect(d?.confident).toBe(false);
  });
  test("1440p at 150% zoom snaps to 4K but the window hint catches it", () => {
    const d = detectNativeResolution(2560, 1440, 1.5, 1.5);
    expect(d).toMatchObject({ w: 3840, h: 2160, snapped: true });
    expect(d?.confident).toBe(false);
  });
  test("an unzoomed window hint keeps a snapped result confident", () => {
    expect(detectNativeResolution(1440, 900, 2, 1.01)?.confident).toBe(true);
  });
});

describe("zoomHintFromWindow / hintsZoom", () => {
  test("ratio of outer to inner width", () => {
    expect(zoomHintFromWindow(1500, 1200)).toBeCloseTo(1.25, 6);
  });
  test("unusable sizes give null (headless, minimised)", () => {
    expect(zoomHintFromWindow(0, 1200)).toBeNull();
    expect(zoomHintFromWindow(1200, 0)).toBeNull();
  });
  test("only beyond ±5% counts as zoomed", () => {
    expect(hintsZoom(null)).toBe(false);
    expect(hintsZoom(1.03)).toBe(false);
    expect(hintsZoom(1.25)).toBe(true);
    expect(hintsZoom(0.9)).toBe(true);
  });
});
