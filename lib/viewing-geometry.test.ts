import { describe, expect, test } from "bun:test";
import {
  TILT_LIMIT_DEG,
  autoOrientOf,
  autoTiltDeg,
  centerYFor,
  degToRad,
  eyeLevelForScenario,
  heldGripFor,
  resolvedTiltDeg,
  storedTiltDeg,
} from "./viewing-geometry";
import { physicalSizeCm } from "./display-math";
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

describe("heldGripFor", () => {
  const deck = dev({
    id: "deck",
    category: "handheld",
    deviceName: "Valve Steam Deck",
    diagonalIn: 7.4,
    aspect: { w: 16, h: 10 },
    distanceCm: 36,
  });
  const switch2 = dev({
    id: "sw",
    category: "handheld",
    deviceName: "Nintendo Switch 2",
    diagonalIn: 7.9,
    distanceCm: 40,
  });
  const monitor = dev({ id: "mon", category: "monitor" });

  test("nothing hand-held visible leaves the pose alone", () => {
    expect(heldGripFor([monitor], "desk", 120)).toBeNull();
    expect(heldGripFor([], "desk", 120)).toBeNull();
  });

  test("ignores monitors, TVs and projectors", () => {
    const grip = heldGripFor([monitor, deck], "desk", 120);
    expect(grip?.distanceCm).toBe(36);
  });

  test("picks the LOWEST handheld when several are visible", () => {
    // Deck 20cm below the eye line, Switch level with it.
    const low = { ...deck, heightOffsetCm: { desk: -20 } };
    const grip = heldGripFor([switch2, low], "desk", 120);
    expect(grip?.distanceCm).toBe(36);
    expect(grip?.centerY).toBe(100);
  });

  test("grips the CHASSIS, not the screen", () => {
    // Steam Deck body is 29.8cm wide; half of that, less the inset the
    // hand wraps by. The 7.4in 16:10 screen is far narrower.
    const grip = heldGripFor([deck], "desk", 120)!;
    expect(grip.halfGripCm).toBeCloseTo(29.8 / 2 - 2, 5);
    const screenHalf =
      physicalSizeCm(deck.diagonalIn, deck.aspect).widthCm / 2;
    expect(grip.halfGripCm).toBeGreaterThan(screenHalf);
  });

  test("falls back to screen plus bezel for an unknown chassis", () => {
    const generic = dev({ category: "tablet", diagonalIn: 11, deviceName: undefined });
    const grip = heldGripFor([generic], "desk", 120)!;
    const w = physicalSizeCm(11, { w: 16, h: 9 }).widthCm;
    expect(grip.halfGripCm).toBeCloseTo((w + 3) / 2 - 2, 5);
  });

  test("never closes the hands tighter than the minimum", () => {
    const tiny = dev({ category: "phone", diagonalIn: 1, deviceName: undefined });
    expect(heldGripFor([tiny], "desk", 120)!.halfGripCm).toBe(6);
  });

  test("two handhelds at the same height: the nearer one is held", () => {
    // Untouched devices share a stance's default offset, so an exact tie
    // is ordinary, not a corner case. Deck at 36cm, Switch at 40cm.
    const grip = heldGripFor([switch2, deck], "desk", 120)!;
    expect(grip.distanceCm).toBe(36);
    // Order of the list must not decide it.
    expect(heldGripFor([deck, switch2], "desk", 120)!.distanceCm).toBe(36);
  });

  test("height still beats nearness", () => {
    // The Switch sits lower, even though the Deck is closer.
    const lowSwitch = { ...switch2, heightOffsetCm: { desk: -20 } };
    const grip = heldGripFor([deck, lowSwitch], "desk", 120)!;
    expect(grip.distanceCm).toBe(40);
  });

  test("the wrist hangs below the screen centre, by chassis height", () => {
    // Deck chassis is 11.7cm tall: 15% of that, plus the wrist's own
    // 3cm below the palm. A wrist level with the centre read as holding
    // the thing by its top edge.
    const grip = heldGripFor([deck], "desk", 120)!;
    expect(grip.centerY).toBe(120);
    expect(grip.wristY).toBeCloseTo(120 - (11.7 * 0.15 + 3), 5);
    expect(grip.wristY).toBeLessThan(grip.centerY);
  });

  test("a taller chassis drops the wrist further", () => {
    const lite = heldGripFor(
      [dev({ category: "handheld", deviceName: "Nintendo Switch Lite" })],
      "desk",
      120,
    )!;
    const deckGrip = heldGripFor([deck], "desk", 120)!;
    // Switch Lite body 9.1cm vs the Deck's 11.7 — the smaller device is
    // gripped closer to its middle, in absolute cm.
    expect(lite.centerY - lite.wristY).toBeLessThan(
      deckGrip.centerY - deckGrip.wristY,
    );
  });

  test("the grip follows the eye line through a stance change", () => {
    const g1 = heldGripFor([deck], "desk", 120)!;
    const g2 = heldGripFor([deck], "couch", 90)!;
    expect(g1.centerY).toBe(120);
    expect(g2.centerY).toBe(90);
  });
});

describe("degToRad", () => {
  test("converts the angles the scene actually uses", () => {
    expect(degToRad(0)).toBe(0);
    expect(degToRad(180)).toBeCloseTo(Math.PI, 10);
    expect(degToRad(-45)).toBeCloseTo(-Math.PI / 4, 10);
  });
});
