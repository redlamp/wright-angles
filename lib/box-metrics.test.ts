import { describe, expect, test } from "bun:test";
import { boxMetricsInCrop, boxRenderCrop } from "./box-metrics";
import { boxMetricsOnDevice } from "./display-math";
import type { Device, MediaItem } from "./types";

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

describe("boxMetricsInCrop", () => {
  test("uncropped contain device matches the old direct boxMetricsOnDevice call", () => {
    const item: Pick<MediaItem, "width" | "height" | "crop"> = { ...img };
    const d = device();
    const box = { x: 0.1, y: 0.1, w: 0.2, h: 0.1 };

    const direct = boxMetricsOnDevice(box.h, item, d);
    const viaHelper = boxMetricsInCrop(box, box.h, item, d);

    expect(viaHelper).not.toBeNull();
    expect(viaHelper!.devicePx).toBeCloseTo(direct.devicePx, 10);
    expect(viaHelper!.arcmin).toBeCloseTo(direct.arcmin, 10);
    expect(viaHelper!.mm).toBeCloseTo(direct.mm, 10);
  });

  test("a centre-half source crop doubles the arcmin versus the naive intrinsic call", () => {
    const croppedItem: Pick<MediaItem, "width" | "height" | "crop"> = {
      ...img,
      crop: { x: 0.25, y: 0.25, w: 0.5, h: 0.5 },
    };
    const d = device();
    const box = { x: 0.4, y: 0.4, w: 0.1, h: 0.1 };

    // The bug this helper fixes: measuring straight off the intrinsic
    // item, ignoring the crop entirely.
    const naive = boxMetricsOnDevice(box.h, croppedItem, d);
    const fixed = boxMetricsInCrop(box, box.h, croppedItem, d);

    expect(fixed).not.toBeNull();
    expect(fixed!.devicePx).toBeCloseTo(naive.devicePx * 2, 6);
    expect(fixed!.arcmin / naive.arcmin).toBeCloseTo(2, 1);
  });

  test("a fill-width device whose crop excludes the box returns null", () => {
    const item: Pick<MediaItem, "width" | "height" | "crop"> = { ...img };
    // 32:9 ultrawide fill-width device crops a 16:9 source to its
    // vertical middle half (top/bottom quarters trimmed).
    const d = device({ fit: "fill-width", aspect: { w: 32, h: 9 } });
    const fullFrameBox = { x: 0, y: 0, w: 1, h: 1 };
    const crop = boxRenderCrop(fullFrameBox, item, d);
    expect(crop).toEqual({ x: 0, y: 0.25, w: 1, h: 0.5 }); // sanity

    // A box sitting entirely in the trimmed top strip.
    const box = { x: 0.1, y: 0, w: 0.1, h: 0.05 };
    expect(boxRenderCrop(box, item, d)).toBeNull();
    expect(boxMetricsInCrop(box, box.h, item, d)).toBeNull();
  });
});
