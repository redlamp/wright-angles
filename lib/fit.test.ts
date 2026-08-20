import { describe, expect, test } from "bun:test";
import {
  aspectsDisagree,
  containFit,
  deviceFitCrop,
  fitCrop,
  fitModeOf,
  fitScale,
} from "./fit";
import { boxInCrop, cropDims, isFullFrame } from "./media-crop";
import { boxMetricsOnDevice } from "./display-math";
import type { Device, MediaCrop } from "./types";

const FULL: MediaCrop = { x: 0, y: 0, w: 1, h: 1 };

/** 16:9 source, the everyday screenshot. */
const img = { width: 1920, height: 1080 };

const device = (over: Partial<Device> = {}): Device => ({
  id: "d",
  label: "D",
  category: "monitor",
  diagonalIn: 24,
  distanceCm: 70,
  resolution: { w: 1920, h: 1080 },
  aspect: { w: 16, h: 9 },
  color: "#fff",
  visible: true,
  ...over,
});

describe("containFit", () => {
  test("wider content letterboxes vertically", () => {
    const f = containFit(32, 9, 16, 9);
    expect(f.w).toBe(16);
    expect(f.h).toBeCloseTo(4.5, 10);
    expect(f.y).toBeCloseTo(2.25, 10);
  });

  test("degenerate inputs collapse to zero", () => {
    expect(containFit(0, 9, 16, 9)).toEqual({ x: 0, y: 0, w: 0, h: 0 });
  });
});

describe("fitModeOf", () => {
  test("absent fit is contain — the default that keeps scenes unchanged", () => {
    expect(fitModeOf({})).toBe("contain");
    expect(fitModeOf({ fit: "fill-height" })).toBe("fill-height");
  });
});

describe("fitCrop", () => {
  test("contain returns the source crop untouched", () => {
    const src: MediaCrop = { x: 0.1, y: 0.2, w: 0.8, h: 0.5 };
    expect(fitCrop("contain", src, img.width, img.height, 4 / 3)).toBe(src);
  });

  test("fill-width on a 4:3 panel crops top and bottom, centred", () => {
    // 1920×1080 into 4:3: width stays, height becomes 1920/(4/3) = 1440
    // — more than the image has, so nothing is trimmed. Use 21:9 instead
    // for the real trim: 1920/(21/9) = 823 px tall.
    const c = fitCrop("fill-width", FULL, img.width, img.height, 21 / 9);
    expect(c.x).toBe(0);
    expect(c.w).toBe(1);
    expect(c.h * img.height).toBeCloseTo((1920 * 9) / 21, 6);
    // Equal bites off top and bottom.
    expect(c.y).toBeCloseTo((1 - c.h) / 2, 12);
    expect(c.y + c.h).toBeCloseTo(1 - c.y, 12);
    // The window now matches the panel's shape.
    expect((c.w * img.width) / (c.h * img.height)).toBeCloseTo(21 / 9, 10);
  });

  test("fill-height on a 4:3 panel crops the sides, centred", () => {
    const c = fitCrop("fill-height", FULL, img.width, img.height, 4 / 3);
    expect(c.y).toBe(0);
    expect(c.h).toBe(1);
    expect(c.w * img.width).toBeCloseTo(1080 * (4 / 3), 6);
    expect(c.x).toBeCloseTo((1 - c.w) / 2, 12);
    expect((c.w * img.width) / (c.h * img.height)).toBeCloseTo(4 / 3, 10);
  });

  test("a fill mode with no work to do trims nothing (never extrapolates)", () => {
    // fill-width onto a 4:3 panel would need MORE height than exists;
    // clamp to the frame and letterbox instead of inventing pixels.
    const c = fitCrop("fill-width", FULL, img.width, img.height, 4 / 3);
    expect(isFullFrame(c)).toBe(true);
    // Same the other way: fill-height onto 21:9 needs more width.
    const d = fitCrop("fill-height", FULL, img.width, img.height, 21 / 9);
    expect(isFullFrame(d)).toBe(true);
  });

  test("matching aspects are a no-op in every mode", () => {
    for (const mode of ["contain", "fill-width", "fill-height"] as const) {
      const c = fitCrop(mode, FULL, img.width, img.height, 16 / 9);
      expect(isFullFrame(c)).toBe(true);
    }
  });

  test("composes with the source crop: source first, fit reframes what remains", () => {
    // Trim browser chrome off the top, then fill-height onto a 1:1 panel.
    const src: MediaCrop = { x: 0, y: 0.2, w: 1, h: 0.8 }; // 1920×864
    const c = fitCrop("fill-height", src, img.width, img.height, 1);
    // Height untouched — still the source window.
    expect(c.y).toBeCloseTo(0.2, 12);
    expect(c.h).toBeCloseTo(0.8, 12);
    // Width trimmed to the 864px square, centred inside the SOURCE window.
    expect(c.w * img.width).toBeCloseTo(864, 6);
    expect(c.x).toBeCloseTo(src.x + (src.w - c.w) / 2, 12);
    // Still normalized to the FULL intrinsic image.
    expect(c.x).toBeGreaterThanOrEqual(0);
    expect(c.x + c.w).toBeLessThanOrEqual(1 + 1e-12);
  });

  test("fit crop stays inside the source crop in both modes", () => {
    const src: MediaCrop = { x: 0.15, y: 0.1, w: 0.6, h: 0.7 };
    for (const [mode, ratio] of [
      ["fill-width", 32 / 9],
      ["fill-height", 1 / 2],
    ] as const) {
      const c = fitCrop(mode, src, img.width, img.height, ratio);
      expect(c.x).toBeGreaterThanOrEqual(src.x - 1e-12);
      expect(c.y).toBeGreaterThanOrEqual(src.y - 1e-12);
      expect(c.x + c.w).toBeLessThanOrEqual(src.x + src.w + 1e-12);
      expect(c.y + c.h).toBeLessThanOrEqual(src.y + src.h + 1e-12);
    }
  });

  test("degenerate inputs fall back to the source crop", () => {
    const src: MediaCrop = { x: 0, y: 0, w: 1, h: 1 };
    expect(fitCrop("fill-width", src, 0, 1080, 16 / 9)).toBe(src);
    expect(fitCrop("fill-height", src, 1920, 1080, 0)).toBe(src);
  });
});

describe("deviceFitCrop", () => {
  test("contain devices render the plain source crop (shared-texture path)", () => {
    const item = { ...img, crop: { x: 0, y: 0.1, w: 1, h: 0.8 } };
    expect(deviceFitCrop(item, device())).toEqual(item.crop);
    expect(deviceFitCrop(item, device({ fit: "contain" }))).toEqual(item.crop);
  });

  test("a 16:9 image on a fill-height 4:3 panel loses its sides", () => {
    const item = { ...img };
    const c = deviceFitCrop(
      item,
      device({ fit: "fill-height", aspect: { w: 4, h: 3 } }),
    );
    expect(cropDims(item, c)).toEqual({ width: 1440, height: 1080 });
  });

  test("a box outside the fill window drops off that screen", () => {
    const item = { ...img };
    const c = deviceFitCrop(
      item,
      device({ fit: "fill-height", aspect: { w: 4, h: 3 } }),
    );
    // Far-left HUD corner: inside the frame, outside the 4:3 window.
    expect(boxInCrop({ x: 0.02, y: 0.5, w: 0.05, h: 0.03 }, c)).toBeNull();
    // Centre stays.
    expect(boxInCrop({ x: 0.45, y: 0.5, w: 0.05, h: 0.03 }, c)).not.toBeNull();
  });
});

describe("fitScale", () => {
  test("contain takes the smaller ratio", () => {
    expect(fitScale("contain", 1920, 1080, 1920, 1440)).toBeCloseTo(1, 12);
  });

  test("fill-width matches widths, fill-height matches heights", () => {
    expect(fitScale("fill-width", 1920, 1080, 1440, 1080)).toBeCloseTo(0.75, 12);
    expect(fitScale("fill-height", 1920, 1080, 1440, 1080)).toBeCloseTo(1, 12);
  });

  test("fill is not Math.max: it can be the SMALLER ratio", () => {
    // 16:9 content on a 4:3 panel — fill-width is the one that shrinks.
    const naiveMax = Math.max(1440 / 1920, 1080 / 1080);
    expect(fitScale("fill-width", 1920, 1080, 1440, 1080)).not.toBe(naiveMax);
  });
});

describe("boxMetricsOnDevice honours the device's fit", () => {
  // A 16:9 capture with 40px-tall text, shown on a 4:3 1440×1080 panel.
  const media = { width: 1920, height: 1080 };
  const nh = 40 / 1080;
  const panel = (fit?: Device["fit"]) =>
    device({
      fit,
      aspect: { w: 4, h: 3 },
      resolution: { w: 1440, h: 1080 },
    });

  test("contain letterboxes: 40 source px → 30 device px", () => {
    expect(boxMetricsOnDevice(nh, media, panel()).devicePx).toBeCloseTo(30, 10);
  });

  test("fill-width matches contain here (width is the tight axis)", () => {
    expect(
      boxMetricsOnDevice(nh, media, panel("fill-width")).devicePx,
    ).toBeCloseTo(30, 10);
  });

  test("fill-height blows the content up: 40 source px → 40 device px", () => {
    expect(
      boxMetricsOnDevice(nh, media, panel("fill-height")).devicePx,
    ).toBeCloseTo(40, 10);
  });

  test("bigger on the panel means more arc minutes", () => {
    const a = boxMetricsOnDevice(nh, media, panel()).arcmin;
    const b = boxMetricsOnDevice(nh, media, panel("fill-height")).arcmin;
    expect(b).toBeGreaterThan(a);
  });

  test("source-cropped or fit-cropped dims give the same answer", () => {
    // A fill mode never touches the axis its own scale depends on.
    const item = { ...media };
    const d = panel("fill-height");
    const c = deviceFitCrop(item, d);
    const fitDims = cropDims(item, c);
    expect(
      boxMetricsOnDevice(nh / c.h, fitDims, d).devicePx,
    ).toBeCloseTo(boxMetricsOnDevice(nh, media, d).devicePx, 8);
  });
});

describe("aspectsDisagree", () => {
  test("16:9 media on a 16:9 panel agrees", () => {
    expect(aspectsDisagree(img, device())).toBe(false);
  });

  test("16:9 media on a 4:3 panel disagrees", () => {
    expect(aspectsDisagree(img, device({ aspect: { w: 4, h: 3 } }))).toBe(true);
  });

  test("the SOURCE-cropped shape is what counts", () => {
    // 1920×1112 browser capture trimmed to 16:9 agrees with a 16:9 panel.
    const item = {
      width: 1920,
      height: 1112,
      crop: { x: 0, y: (1112 - 1080) / 2 / 1112, w: 1, h: 1080 / 1112 },
    };
    expect(aspectsDisagree(item, device())).toBe(false);
    expect(aspectsDisagree({ width: 1920, height: 1112 }, device())).toBe(true);
  });
});
