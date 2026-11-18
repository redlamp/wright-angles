import { describe, expect, test } from "bun:test";
import { solveTwoBone, type V3 } from "./limb-ik";

const dist = (a: V3, b: V3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const O = { x: 0, y: 0, z: 0 };

describe("solveTwoBone", () => {
  test("reachable target: segments keep their lengths and end on target", () => {
    const t = { x: 20, y: -10, z: 15 };
    const s = solveTwoBone(O, t, 26, 22, { x: 0, y: -1, z: 0 });
    expect(s.clamped).toBe(false);
    expect(dist(O, s.mid)).toBeCloseTo(26, 6);
    expect(dist(s.mid, s.end)).toBeCloseTo(22, 6);
    expect(dist(s.end, t)).toBeCloseTo(0, 6);
  });

  test("bends toward the pole", () => {
    const s = solveTwoBone(O, { x: 0, y: 0, z: 30 }, 26, 22, { x: 0, y: -1, z: 0 });
    expect(s.mid.y).toBeLessThan(0);
  });

  test("out of reach: points along the line, just short of straight", () => {
    const s = solveTwoBone(O, { x: 0, y: 0, z: 200 }, 26, 22, { x: 0, y: -1, z: 0 });
    expect(s.clamped).toBe(true);
    expect(s.end.x).toBeCloseTo(0, 6);
    expect(s.end.y).toBeCloseTo(0, 6);
    expect(s.end.z).toBeCloseTo(48 * 0.995, 6);
  });

  test("pole parallel to the chain still yields a finite elbow", () => {
    const s = solveTwoBone(O, { x: 0, y: -30, z: 0 }, 26, 22, { x: 0, y: -1, z: 0 });
    expect(Number.isFinite(s.mid.x + s.mid.y + s.mid.z)).toBe(true);
    expect(dist(O, s.mid)).toBeCloseTo(26, 6);
  });
});
