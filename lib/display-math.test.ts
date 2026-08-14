import { describe, expect, test } from "bun:test";
import {
  aspectFromResolution,
  deviceAngles,
  imageScaleOnHost,
  physicalSizeCm,
  pixelsToArcmin,
  pixelsToMm,
  ppi,
  simulatedSizeOnHostPx,
  sizeForArcmin,
  subtenseArcmin,
} from "./display-math";
import type { Device } from "./types";

/**
 * Ground truth: Taylor's Disco Elysium font-sizing sheet (Figma, "Group 3"
 * on the Reference Image page). Each case pins a row of that sheet.
 */

const dev = (d: Partial<Device>): Device => ({
  id: "t",
  label: "t",
  category: "custom",
  diagonalIn: 27,
  distanceCm: 70,
  resolution: { w: 2560, h: 1440 },
  aspect: { w: 16, h: 9 },
  color: "#fff",
  visible: true,
  ...d,
});

const switchLite = dev({
  diagonalIn: 5.5,
  distanceCm: 36,
  resolution: { w: 1280, h: 720 },
});
const switchStd = dev({
  diagonalIn: 6.2,
  distanceCm: 36,
  resolution: { w: 1280, h: 720 },
});
const pc1080p24 = dev({
  diagonalIn: 24,
  distanceCm: 70,
  resolution: { w: 1920, h: 1080 },
});
const monitor1440 = dev({});

describe("PPI (sheet column G)", () => {
  test("Switch Lite 5.5\" 720p → 267.02", () => {
    expect(ppi(5.5, { w: 1280, h: 720 })).toBeCloseTo(267.02, 1);
  });
  test("Switch 6.2\" 720p → 236.87", () => {
    expect(ppi(6.2, { w: 1280, h: 720 })).toBeCloseTo(236.87, 1);
  });
  test("27\" 1440p → 108.79", () => {
    expect(ppi(27, { w: 2560, h: 1440 })).toBeCloseTo(108.79, 1);
  });
  test("27\" 4K → 163.18", () => {
    expect(ppi(27, { w: 3840, h: 2160 })).toBeCloseTo(163.18, 1);
  });
});

describe("physical font size (sheet columns L/M)", () => {
  test("22px on Switch Lite → 2.093mm / 0.082in", () => {
    expect(pixelsToMm(22, switchLite)).toBeCloseTo(2.093, 2);
  });
  test("22px on Switch → 2.359mm", () => {
    expect(pixelsToMm(22, switchStd)).toBeCloseTo(2.359, 2);
  });
  test("17px on 24\" 1080p PC → 4.704mm", () => {
    expect(pixelsToMm(17, pc1080p24)).toBeCloseTo(4.704, 2);
  });
});

describe("arc minutes (sheet column N — the rosetta stone)", () => {
  test("22px on Switch Lite at 36cm → ~20 arcmin", () => {
    expect(pixelsToArcmin(22, switchLite)).toBeCloseTo(20.0, 0);
  });
  test("22px on Switch at 36cm → ~23 arcmin (sheet rounds 22.5)", () => {
    expect(pixelsToArcmin(22, switchStd)).toBeGreaterThan(22);
    expect(pixelsToArcmin(22, switchStd)).toBeLessThan(23);
  });
  test("17px on 24\" 1080p PC at 70cm → ~23 arcmin", () => {
    expect(pixelsToArcmin(17, pc1080p24)).toBeCloseTo(23.1, 0);
  });
  test("sizeForArcmin round-trips subtense", () => {
    const cm = sizeForArcmin(20, 36);
    expect(subtenseArcmin(cm, 36)).toBeCloseTo(20, 6);
  });
});

describe("aspect + physical size", () => {
  test("2560×1440 reduces to 16:9", () => {
    expect(aspectFromResolution({ w: 2560, h: 1440 })).toEqual({ w: 16, h: 9 });
  });
  test("1280×800 reduces to 16:10", () => {
    expect(aspectFromResolution({ w: 1280, h: 800 })).toEqual({ w: 16, h: 10 });
  });
  test("27\" 16:9 panel is ~59.8 × 33.6 cm", () => {
    const s = physicalSizeCm(27, { w: 16, h: 9 });
    expect(s.widthCm).toBeCloseTo(59.77, 1);
    expect(s.heightCm).toBeCloseTo(33.62, 1);
  });
});

describe("device angles", () => {
  test("27\" 1440p at 70cm: ~46.2° horizontal, ~55 PPD", () => {
    const a = deviceAngles(monitor1440);
    expect(a.horizontalDeg).toBeCloseTo(46.2, 0);
    expect(a.ppd).toBeCloseTo(55.4, 0);
  });
});

describe("curved panels", () => {
  const g9flat = dev({
    diagonalIn: 49,
    distanceCm: 70,
    resolution: { w: 5120, h: 1440 },
    aspect: { w: 32, h: 9 },
  });
  const g9curved = { ...g9flat, curvatureR: 1000 };

  test("no curvature → identical to flat subtense", () => {
    expect(deviceAngles({ ...g9flat, curvatureR: 0 }).horizontalDeg).toBeCloseTo(
      deviceAngles(g9flat).horizontalDeg,
      10,
    );
  });

  test("a 1000R 49\" super-ultrawide at 70cm looks wider than flat", () => {
    const flat = deviceAngles(g9flat).horizontalDeg;
    const curved = deviceAngles(g9curved).horizontalDeg;
    expect(curved).toBeGreaterThan(flat);
    // The wrap effect is substantial at this size/distance, not noise.
    expect(curved - flat).toBeGreaterThan(5);
  });

  test("vertical subtense is unaffected by curvature", () => {
    expect(deviceAngles(g9curved).verticalDeg).toBeCloseTo(
      deviceAngles(g9flat).verticalDeg,
      10,
    );
  });

  test("curvature carries into the host simulation width", () => {
    const host = monitor1440;
    expect(simulatedSizeOnHostPx(g9curved, host).widthPx).toBeGreaterThan(
      simulatedSizeOnHostPx(g9flat, host).widthPx,
    );
    expect(simulatedSizeOnHostPx(g9curved, host).heightPx).toBeCloseTo(
      simulatedSizeOnHostPx(g9flat, host).heightPx,
      6,
    );
  });
});

describe("simulation on host (the core overlay math)", () => {
  test("a device simulated on itself fills its own resolution exactly", () => {
    const sim = simulatedSizeOnHostPx(monitor1440, monitor1440);
    expect(sim.widthPx).toBeCloseTo(2560, 6);
    expect(sim.heightPx).toBeCloseTo(1440, 6);
  });

  test("Switch on a 27\" 1440p host at 70cm → ~1143px wide", () => {
    const sim = simulatedSizeOnHostPx(switchStd, monitor1440);
    expect(sim.widthPx).toBeCloseTo(1143, 0);
    // Handheld held close looks bigger than its physical size projected at
    // the monitor: 13.7cm panel → ~26.7cm on the host panel.
    expect(sim.widthCmOnHost).toBeCloseTo(26.69, 1);
  });

  test("moving the target closer makes it larger on the host", () => {
    const near = dev({ diagonalIn: 40, distanceCm: 150 });
    const far = dev({ diagonalIn: 40, distanceCm: 300 });
    const host = monitor1440;
    expect(simulatedSizeOnHostPx(near, host).widthPx).toBeGreaterThan(
      simulatedSizeOnHostPx(far, host).widthPx,
    );
  });

  test("image scale: 1080p capture as Switch content on 1440p host", () => {
    const sim = simulatedSizeOnHostPx(switchStd, monitor1440);
    // Image reference height 1080 maps onto the simulated screen height.
    expect(imageScaleOnHost(1080, switchStd, monitor1440)).toBeCloseTo(
      sim.heightPx / 1080,
      6,
    );
  });
});
