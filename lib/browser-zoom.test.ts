import { describe, expect, test } from "bun:test";
import { estimateZoomPct, zoomWarningPct } from "./browser-zoom";

describe("estimateZoomPct", () => {
  test("unzoomed retina 1440p reads 100%", () => {
    expect(estimateZoomPct(1280, 2, 2560)).toBe(100);
  });
  test("150% zoom on a 1x panel", () => {
    expect(estimateZoomPct(2560, 1.5, 2560)).toBe(150);
  });
  test("67% zoom", () => {
    expect(estimateZoomPct(1920, 0.67, 1920)).toBe(67);
  });
});

describe("zoomWarningPct", () => {
  test("within ±2% is no warning", () => {
    expect(zoomWarningPct(2560, 1, 2560)).toBeNull();
    expect(zoomWarningPct(2560, 1.02, 2560)).toBeNull();
    expect(zoomWarningPct(2560, 0.98, 2560)).toBeNull();
  });
  test("beyond ±2% returns the estimate", () => {
    expect(zoomWarningPct(2560, 1.03, 2560)).toBe(103);
    expect(zoomWarningPct(2560, 1.25, 2560)).toBe(125);
    expect(zoomWarningPct(2560, 0.9, 2560)).toBe(90);
  });
});
