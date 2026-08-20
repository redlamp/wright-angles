import { describe, expect, test } from "bun:test";
import {
  ASPECT_PRESETS,
  aspectCrop,
  boxInCrop,
  cropDims,
  cropOf,
  cropsEqual,
  dragCrop,
  effectiveDims,
  isFullFrame,
  viewBoxStyle,
} from "./media-crop";
import type { MediaCrop } from "./types";

describe("effectiveDims", () => {
  test("no crop → intrinsic dims", () => {
    expect(effectiveDims({ width: 1920, height: 1112 })).toEqual({
      width: 1920,
      height: 1112,
    });
  });

  test("chrome-trim case: 1920×1112 to 16:9 → 1920×1080", () => {
    const crop = aspectCrop(16 / 9, 1920, 1112);
    expect(effectiveDims({ width: 1920, height: 1112, crop })).toEqual({
      width: 1920,
      height: 1080,
    });
  });
});

describe("cropDims", () => {
  const mediaCrop: MediaCrop = { x: 0, y: 0.1, w: 1, h: 0.8 };
  const item = { width: 1920, height: 1080, crop: mediaCrop };

  test("sizes an arbitrary window in pixels", () => {
    expect(cropDims(item, { x: 0.25, y: 0, w: 0.5, h: 1 })).toEqual({
      width: 960,
      height: 1080,
    });
    // effectiveDims stays the media-crop path.
    expect(effectiveDims(item)).toEqual({ width: 1920, height: 864 });
  });
});

describe("aspectCrop", () => {
  test("wider image than target: full height, centered horizontally", () => {
    const c = aspectCrop(16 / 9, 3440, 1440);
    expect(c.h).toBe(1);
    expect(c.y).toBe(0);
    expect(c.w * 3440).toBeCloseTo(2560, 6);
    expect(c.x).toBeCloseTo((1 - c.w) / 2, 10);
  });

  test("taller image than target: full width, centered vertically", () => {
    const c = aspectCrop(16 / 9, 1920, 1112);
    expect(c.w).toBe(1);
    expect(c.x).toBe(0);
    expect(c.h * 1112).toBeCloseTo(1080, 6);
    expect(c.y).toBeCloseTo((1 - c.h) / 2, 10);
  });

  test("exact-aspect image yields the full frame → treated as None", () => {
    const c = aspectCrop(16 / 9, 1920, 1080);
    expect(isFullFrame(c)).toBe(true);
    expect(cropsEqual(c, { x: 0, y: 0, w: 1, h: 1 })).toBe(true);
  });

  test("every preset window matches its target aspect in pixels", () => {
    for (const { ratio } of ASPECT_PRESETS) {
      const c = aspectCrop(ratio, 2560, 1440);
      expect(((c.w * 2560) / (c.h * 1440)) - ratio).toBeCloseTo(0, 6);
      expect(c.x).toBeGreaterThanOrEqual(0);
      expect(c.y).toBeGreaterThanOrEqual(0);
      expect(c.x + c.w).toBeLessThanOrEqual(1 + 1e-10);
      expect(c.y + c.h).toBeLessThanOrEqual(1 + 1e-10);
    }
  });

  test("32:9 on a 16:9 image keeps full width, half height", () => {
    const c = aspectCrop(32 / 9, 1920, 1080);
    expect(c.w).toBe(1);
    expect(c.h).toBeCloseTo(0.5, 10);
    expect(c.y).toBeCloseTo(0.25, 10);
  });
});

describe("boxInCrop", () => {
  const crop: MediaCrop = { x: 0, y: 0.25, w: 1, h: 0.75 };

  test("box inside the crop maps into crop space", () => {
    const b = boxInCrop({ x: 0.5, y: 0.5, w: 0.1, h: 0.15 }, crop)!;
    expect(b.x).toBeCloseTo(0.5, 10);
    expect(b.y).toBeCloseTo((0.5 - 0.25) / 0.75, 10);
    expect(b.w).toBeCloseTo(0.1, 10);
    expect(b.h).toBeCloseTo(0.15 / 0.75, 10);
  });

  test("box fully outside the crop is hidden", () => {
    expect(boxInCrop({ x: 0.1, y: 0, w: 0.3, h: 0.2 }, crop)).toBeNull();
  });

  test("straddling box is clipped to the window", () => {
    const b = boxInCrop({ x: 0, y: 0.2, w: 0.2, h: 0.1 }, crop)!;
    expect(b.y).toBe(0);
    expect(b.h).toBeCloseTo(0.05 / 0.75, 10);
  });

  test("identity under the full-frame crop", () => {
    const b = boxInCrop({ x: 0.2, y: 0.3, w: 0.4, h: 0.1 }, cropOf({}))!;
    expect(b.x).toBeCloseTo(0.2, 10);
    expect(b.y).toBeCloseTo(0.3, 10);
    expect(b.w).toBeCloseTo(0.4, 10);
    expect(b.h).toBeCloseTo(0.1, 10);
  });
});

describe("viewBoxStyle", () => {
  test("no crop → empty style (zero-diff path)", () => {
    expect(viewBoxStyle({ width: 100, height: 100 })).toEqual({});
  });

  test("insets are top/right/bottom/left percentages", () => {
    const style = viewBoxStyle({
      width: 1920,
      height: 1112,
      crop: { x: 0, y: 0.5, w: 1, h: 0.5 },
    });
    expect(style.objectViewBox).toBe(
      "inset(50.0000% 0.0000% 0.0000% 0.0000%)",
    );
  });
});

describe("dragCrop", () => {
  const base: MediaCrop = { x: 0.25, y: 0.25, w: 0.5, h: 0.5 };

  test("move clamps to the frame", () => {
    const c = dragCrop(base, "move", 1, -1, null);
    expect(c).toEqual({ x: 0.5, y: 0, w: 0.5, h: 0.5 });
  });

  test("free se resize", () => {
    const c = dragCrop(base, "se", 0.1, 0.2, null);
    expect(c.w).toBeCloseTo(0.6, 10);
    expect(c.h).toBeCloseTo(0.7, 10);
    expect(c.x).toBe(0.25);
    expect(c.y).toBe(0.25);
  });

  test("aspect-locked corner anchors the opposite corner", () => {
    // Square image, 16:9 lock → wPerH = 16/9.
    const c = dragCrop(base, "se", 0.2, 0, 16 / 9);
    expect(c.x).toBe(0.25);
    expect(c.y).toBe(0.25);
    expect(c.w / c.h).toBeCloseTo(16 / 9, 10);
    // Height space (to the bottom edge) limits the locked width.
    expect(c.y + c.h).toBeLessThanOrEqual(1 + 1e-10);
    expect(c.x + c.w).toBeLessThanOrEqual(1 + 1e-10);
  });

  test("full-frame detection", () => {
    expect(isFullFrame({ x: 0, y: 0, w: 1, h: 1 })).toBe(true);
    expect(isFullFrame({ x: 0, y: 0.1, w: 1, h: 0.9 })).toBe(false);
  });
});
