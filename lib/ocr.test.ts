import { describe, expect, test } from "bun:test";
import {
  bboxToFullImage,
  cropRectPx,
  isMeasurableLine,
  largestByArea,
  medianHeightPx,
  type DetectedLine,
} from "./ocr";

const intrinsic = { width: 1920, height: 1080 };

describe("cropRectPx", () => {
  test("no crop → full frame", () => {
    expect(cropRectPx(intrinsic)).toEqual({ x: 0, y: 0, w: 1920, h: 1080 });
  });

  test("bottom 16:9 of a 1920×1112 capture", () => {
    const tall = { width: 1920, height: 1112 };
    const h = 1080 / 1112;
    const rect = cropRectPx(tall, { x: 0, y: 1 - h, w: 1, h });
    expect(rect).toEqual({ x: 0, y: 32, w: 1920, h: 1080 });
  });

  test("rounding never overruns the frame", () => {
    const rect = cropRectPx(intrinsic, { x: 0.5, y: 0.5, w: 0.5001, h: 0.5001 });
    expect(rect.x + rect.w).toBeLessThanOrEqual(1920);
    expect(rect.y + rect.h).toBeLessThanOrEqual(1080);
  });
});

describe("bboxToFullImage", () => {
  test("full-frame rect: plain normalization", () => {
    const box = bboxToFullImage(
      { x0: 192, y0: 108, x1: 384, y1: 135 },
      { x: 0, y: 0, w: 1920, h: 1080 },
      intrinsic,
    );
    expect(box.x).toBeCloseTo(0.1, 10);
    expect(box.y).toBeCloseTo(0.1, 10);
    expect(box.w).toBeCloseTo(0.1, 10);
    expect(box.h).toBeCloseTo(0.025, 10);
  });

  test("cropped rect: offset by the crop origin", () => {
    // A line at the top-left of a crop window starting at (480, 270).
    const box = bboxToFullImage(
      { x0: 0, y0: 0, x1: 100, y1: 20 },
      { x: 480, y: 270, w: 960, h: 540 },
      intrinsic,
    );
    expect(box.x).toBeCloseTo(480 / 1920, 10);
    expect(box.y).toBeCloseTo(270 / 1080, 10);
    expect(box.w).toBeCloseTo(100 / 1920, 10);
    expect(box.h).toBeCloseTo(20 / 1080, 10);
  });
});

describe("isMeasurableLine", () => {
  const bbox = { x0: 0, y0: 0, x1: 100, y1: 20 };

  test("keeps a confident, tall-enough, non-blank line", () => {
    expect(isMeasurableLine({ text: "Menu", confidence: 90, bbox })).toBe(true);
  });

  test("drops low confidence", () => {
    expect(isMeasurableLine({ text: "Menu", confidence: 54.9, bbox })).toBe(
      false,
    );
  });

  test("drops lines under 6px tall", () => {
    expect(
      isMeasurableLine({
        text: "Menu",
        confidence: 90,
        bbox: { x0: 0, y0: 0, x1: 100, y1: 5 },
      }),
    ).toBe(false);
  });

  test("drops whitespace-only text", () => {
    expect(isMeasurableLine({ text: "  \n", confidence: 90, bbox })).toBe(
      false,
    );
  });
});

const line = (x: number, w: number, h: number): DetectedLine => ({
  text: "t",
  confidence: 90,
  box: { x, y: 0, w, h },
});

describe("largestByArea", () => {
  test("returns everything when under the cap", () => {
    const lines = [line(0, 0.1, 0.02), line(0.2, 0.1, 0.02)];
    expect(largestByArea(lines, 24)).toEqual(lines);
  });

  test("keeps the largest, preserving original order", () => {
    const small = line(0, 0.05, 0.01);
    const big = line(0.1, 0.4, 0.05);
    const mid = line(0.2, 0.2, 0.03);
    expect(largestByArea([small, big, mid], 2)).toEqual([big, mid]);
  });
});

describe("medianHeightPx", () => {
  test("empty run → 0", () => {
    expect(medianHeightPx([], intrinsic)).toBe(0);
  });

  test("odd count → middle value in intrinsic pixels", () => {
    const lines = [line(0, 0.1, 10 / 1080), line(0, 0.1, 22 / 1080), line(0, 0.1, 40 / 1080)];
    expect(medianHeightPx(lines, intrinsic)).toBeCloseTo(22, 6);
  });

  test("even count → mean of the middle two", () => {
    const lines = [line(0, 0.1, 10 / 1080), line(0, 0.1, 20 / 1080)];
    expect(medianHeightPx(lines, intrinsic)).toBeCloseTo(15, 6);
  });
});
