import { describe, expect, test } from "bun:test";
import {
  TILT_LIMIT_DEG,
  autoOrientOf,
  autoTiltDeg,
  centerYFor,
  degToRad,
  eyeLevelForScenario,
  resolvedTiltDeg,
  storedTiltDeg,
} from "./viewing-geometry";
import type { Device, DeviceCategory } from "./types";

const dev = (over: Partial<Device> = {}): Device => ({
  id: "d",
  label: "Test",
  category: "monitor",
  diagonalIn: 27,
  distanceCm: 70,
  resolution: { w: 2560, h: 1440 },
  aspect: { w: 16, h: 9 },
  color: "#fff",
  visible: true,
  ...over,
});

describe("auto-orient defaults by category", () => {
  test("held things track the gaze", () => {
    for (const c of ["handheld", "phone", "tablet"] as DeviceCategory[])
      expect(autoOrientOf(dev({ category: c }), "desk")).toBe(true);
  });

  test("furniture does not", () => {
    for (const c of ["monitor", "tv", "projector", "custom"] as DeviceCategory[])
      expect(autoOrientOf(dev({ category: c }), "desk")).toBe(false);
  });

  test("an explicit choice overrides the category either way", () => {
    expect(
      autoOrientOf(dev({ category: "handheld", autoOrient: { desk: false } }), "desk"),
    ).toBe(false);
    expect(
      autoOrientOf(dev({ category: "tv", autoOrient: { desk: true } }), "desk"),
    ).toBe(true);
  });

  test("the choice is per stance — other stances keep the category default", () => {
    const d = dev({ category: "handheld", autoOrient: { couch: false } });
    expect(autoOrientOf(d, "couch")).toBe(false);
    expect(autoOrientOf(d, "desk")).toBe(true);
    expect(autoOrientOf(d, "standing")).toBe(true);
  });
});

describe("centerYFor", () => {
  test("no offset sits dead on the eye line", () => {
    expect(centerYFor(dev(), "desk", 120)).toBe(120);
  });

  test("positive is above the gaze, negative below", () => {
    const d = dev({ heightOffsetCm: { desk: 25, couch: -40 } });
    expect(centerYFor(d, "desk", 120)).toBe(145);
    expect(centerYFor(d, "couch", 117)).toBe(77);
  });

  test("an offset follows the eye when the body height changes", () => {
    // The point of storing an offset rather than a floor height.
    const d = dev({ heightOffsetCm: { desk: 30 } });
    expect(centerYFor(d, "desk", 120) - 120).toBe(30);
    expect(centerYFor(d, "desk", 140) - 140).toBe(30);
  });

  test("a stance with no offset is level even when others are set", () => {
    const d = dev({ heightOffsetCm: { desk: 30 } });
    expect(centerYFor(d, "standing", 160)).toBe(160);
  });
});

describe("autoTiltDeg aims the face at the eye", () => {
  test("a screen level with the eye stays vertical", () => {
    expect(autoTiltDeg(120, 120, 70)).toBeCloseTo(0, 10);
  });

  test("a screen BELOW the eye tips its face up (positive)", () => {
    // Handheld in the lap: 40cm below the eye, held 36cm away.
    const deg = autoTiltDeg(80, 120, 36);
    expect(deg).toBeGreaterThan(0);
    expect(deg).toBeCloseTo((Math.atan2(40, 36) * 180) / Math.PI, 10);
  });

  test("a screen ABOVE the eye tips its face down (negative)", () => {
    expect(autoTiltDeg(160, 120, 300)).toBeLessThan(0);
  });

  test("45 degrees when the drop equals the distance", () => {
    expect(autoTiltDeg(0, 100, 100)).toBeCloseTo(45, 10);
  });

  test("a degenerate distance aims nowhere rather than a quarter turn", () => {
    expect(autoTiltDeg(80, 120, 0)).toBe(0);
  });
});

describe("resolvedTiltDeg", () => {
  test("auto-orienting ignores any stored tilt", () => {
    const d = dev({ category: "handheld", tilt: { desk: 30 } });
    expect(resolvedTiltDeg(d, "desk", 120, 120, 36)).toBeCloseTo(
      autoTiltDeg(120, 120, 36),
      10,
    );
  });

  test("manual uses the stance's own value", () => {
    const d = dev({ tilt: { desk: 8, couch: -12 } });
    expect(resolvedTiltDeg(d, "desk", 120, 120, 70)).toBe(8);
    expect(resolvedTiltDeg(d, "couch", 120, 120, 70)).toBe(-12);
  });

  test("a stance with no stored tilt is flat, not inherited", () => {
    const d = dev({ tilt: { desk: 8 } });
    expect(resolvedTiltDeg(d, "standing", 120, 120, 70)).toBe(0);
  });

  test("clamps a stray value instead of folding the panel", () => {
    const d = dev({ tilt: { desk: 400 } });
    expect(resolvedTiltDeg(d, "desk", 120, 120, 70)).toBe(TILT_LIMIT_DEG);
    const n = dev({ tilt: { desk: -400 } });
    expect(resolvedTiltDeg(n, "desk", 120, 120, 70)).toBe(-TILT_LIMIT_DEG);
  });

  test("does NOT clamp an auto angle — that geometry is real", () => {
    // A handheld in the lap needs ~48° to actually face you; pinning it
    // to the slider's limit would leave it pointing somewhere else.
    const d = dev({ category: "handheld" });
    const steep = resolvedTiltDeg(d, "desk", 80, 120, 36);
    expect(steep).toBeGreaterThan(TILT_LIMIT_DEG);
    expect(steep).toBeCloseTo(autoTiltDeg(80, 120, 36), 10);
  });
});

describe("storedTiltDeg", () => {
  test("reads the raw per-stance value, undefined when unset", () => {
    const d = dev({ tilt: { couch: -5 } });
    expect(storedTiltDeg(d, "couch")).toBe(-5);
    expect(storedTiltDeg(d, "desk")).toBeUndefined();
    expect(storedTiltDeg(dev(), "desk")).toBeUndefined();
  });
});

describe("eyeLevelForScenario", () => {
  test("matches the viewer store's constants for a 175cm body", () => {
    expect(eyeLevelForScenario("standing", 175)).toBeCloseTo(175 * 0.936, 10);
    expect(eyeLevelForScenario("desk", 175)).toBeCloseTo(175 * 0.45 + 45, 10);
    expect(eyeLevelForScenario("couch", 175)).toBeCloseTo(175 * 0.45 + 40, 10);
  });

  test("standing is the highest, couch the lowest", () => {
    const h = 175;
    expect(eyeLevelForScenario("standing", h)).toBeGreaterThan(
      eyeLevelForScenario("desk", h),
    );
    expect(eyeLevelForScenario("desk", h)).toBeGreaterThan(
      eyeLevelForScenario("couch", h),
    );
  });
});

describe("degToRad", () => {
  test("converts the angles the scene actually uses", () => {
    expect(degToRad(0)).toBe(0);
    expect(degToRad(180)).toBeCloseTo(Math.PI, 10);
    expect(degToRad(-45)).toBeCloseTo(-Math.PI / 4, 10);
  });
});
