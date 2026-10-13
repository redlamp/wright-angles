import { describe, expect, test } from "bun:test";
import { tweenProgress, tweenStep } from "./motion";

describe("tweenProgress", () => {
  test("runs linearly and clamps to [0, 1]", () => {
    expect(tweenProgress(0, 0.5, false)).toBe(0);
    expect(tweenProgress(0.25, 0.5, false)).toBe(0.5);
    expect(tweenProgress(2, 0.5, false)).toBe(1);
    expect(tweenProgress(-1, 0.5, false)).toBe(0);
  });
  test("reduced motion jumps to the end state", () => {
    expect(tweenProgress(0, 1.1, true)).toBe(1);
  });
  test("a zero duration is already done", () => {
    expect(tweenProgress(0, 0, false)).toBe(1);
  });
});

describe("tweenStep", () => {
  test("clamps a post-idle delta to one frame", () => {
    expect(tweenStep(5, 0.5, false)).toBeCloseTo(1 / 30 / 0.5);
    expect(tweenStep(0.01, 0.5, false)).toBeCloseTo(0.02);
  });
  test("reduced motion steps the whole way", () => {
    expect(tweenStep(0.001, 0.5, true)).toBe(1);
  });
});
