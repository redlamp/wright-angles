import { describe, expect, test } from "bun:test";
import { precheckCalibration } from "./calibration-precheck";

const retina = { w: 2880, h: 1800 };

describe("precheckCalibration", () => {
  test("matching resolution at 100% zoom is ok", () => {
    expect(
      precheckCalibration(
        { screenW: 1440, screenH: 900, dpr: 2, zoomHint: 1 },
        retina,
      ),
    ).toEqual({ kind: "ok" });
  });

  test("a confident, different panel is offered", () => {
    expect(
      precheckCalibration(
        { screenW: 1440, screenH: 900, dpr: 2, zoomHint: 1 },
        { w: 2560, h: 1440 },
      ),
    ).toEqual({ kind: "resolution", detected: retina });
  });

  test("an evenly scaled, unconfident mismatch reads as zoom", () => {
    // MacBook at 125% zoom: dpr 2.5 → 3600×2250, which snaps to nothing.
    expect(
      precheckCalibration(
        { screenW: 1440, screenH: 900, dpr: 2.5, zoomHint: 1.25 },
        retina,
      ),
    ).toEqual({ kind: "zoom", pct: 125 });
  });

  test("zoom that happens to snap to a real panel still reads as zoom", () => {
    // 1440p at 150% → "3840×2160", but the window hint says zoomed.
    expect(
      precheckCalibration(
        { screenW: 2560, screenH: 1440, dpr: 1.5, zoomHint: 1.5 },
        { w: 2560, h: 1440 },
      ),
    ).toEqual({ kind: "zoom", pct: 150 });
  });

  test("an unconfident mismatch of a different shape is only suggested", () => {
    expect(
      precheckCalibration(
        { screenW: 1000, screenH: 700, dpr: 1.1, zoomHint: null },
        { w: 2560, h: 1440 },
      ),
    ).toEqual({ kind: "resolution-unsure", reported: { w: 1100, h: 770 } });
  });

  test("agreeing resolutions with a zoomed window hint warn about zoom", () => {
    expect(
      precheckCalibration(
        { screenW: 1440, screenH: 900, dpr: 2, zoomHint: 1.25 },
        retina,
      ),
    ).toEqual({ kind: "zoom", pct: 125 });
  });

  test("unusable readings don't warn", () => {
    expect(
      precheckCalibration(
        { screenW: 0, screenH: 0, dpr: 1, zoomHint: null },
        retina,
      ),
    ).toEqual({ kind: "ok" });
  });
});
