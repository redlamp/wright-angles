import { describe, expect, test } from "bun:test";
import {
  activeKeyframe,
  addKeyframe,
  keyframeAt,
  nextKeyframeTime,
  prevKeyframeTime,
  removeKeyframe,
  withScan,
} from "./scan-keyframes";
import type { KeyframeLine, ScanKeyframe } from "./types";

const line = (text: string): KeyframeLine => ({
  id: text,
  text,
  confidence: 90,
  box: { x: 0.1, y: 0.1, w: 0.3, h: 0.05 },
});

describe("add/remove", () => {
  test("adds sorted and unscanned", () => {
    const list = addKeyframe(addKeyframe([], 8), 2);
    expect(list.map((k) => k.timeSec)).toEqual([2, 8]);
    expect(list[0].lines).toBeNull();
  });
  test("re-adding within EPS is a no-op", () => {
    const list = addKeyframe([], 2);
    expect(addKeyframe(list, 2.05)).toBe(list);
  });
  test("remove matches within EPS only", () => {
    const list = addKeyframe(addKeyframe([], 2), 8);
    expect(removeKeyframe(list, 2.04).map((k) => k.timeSec)).toEqual([8]);
    expect(removeKeyframe(list, 5).length).toBe(2);
  });
});

describe("withScan", () => {
  test("attaches to an existing keyframe, preserving its exact time", () => {
    const list = withScan(addKeyframe([], 2), 2.05, [line("a")], 20);
    expect(list.length).toBe(1);
    expect(list[0].timeSec).toBe(2);
    expect(list[0].lines?.[0].text).toBe("a");
    expect(list[0].medianPx).toBe(20);
  });
  test("creates the keyframe when scanning a bare time", () => {
    const list = withScan([], 4, [line("b")], 18);
    expect(list[0].timeSec).toBe(4);
  });
});

describe("navigation + persistence rule", () => {
  const list: ScanKeyframe[] = withScan(
    withScan(addKeyframe([], 10), 2, [line("early")], 20),
    6,
    [line("mid")],
    22,
  );

  test("scan persists until the NEXT marker", () => {
    expect(activeKeyframe(list, 0)).toBeNull();
    expect(activeKeyframe(list, 2)?.lines?.[0].text).toBe("early");
    expect(activeKeyframe(list, 5.9)?.lines?.[0].text).toBe("early");
    expect(activeKeyframe(list, 6.1)?.lines?.[0].text).toBe("mid");
    // Past an unscanned marker the governing keyframe is that marker
    // (blank), not the previous scan.
    expect(activeKeyframe(list, 11)?.lines).toBeNull();
  });

  test("prev/next skip the marker under the playhead", () => {
    expect(prevKeyframeTime(list, 6)).toBe(2);
    expect(nextKeyframeTime(list, 6)).toBe(10);
    expect(prevKeyframeTime(list, 1)).toBeNull();
    expect(nextKeyframeTime(list, 10.01)).toBeNull();
  });

  test("keyframeAt finds within EPS", () => {
    expect(keyframeAt(list, 6.05)?.timeSec).toBe(6);
    expect(keyframeAt(list, 6.2)).toBeNull();
  });
});
