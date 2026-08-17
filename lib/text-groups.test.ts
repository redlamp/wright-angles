import { describe, expect, test } from "bun:test";
import { groupTextLines } from "./text-groups";

const INTRINSIC = { width: 1920, height: 1080 };
/** px helpers → normalized boxes. */
const box = (xPx: number, yPx: number, wPx: number, hPx: number) => ({
  x: xPx / 1920,
  y: yPx / 1080,
  w: wPx / 1920,
  h: hPx / 1080,
});

describe("groupTextLines", () => {
  test("a word-wrapped paragraph forms one group", () => {
    // Three left-aligned lines, 24px tall, ~10px spacing.
    const lines = [
      box(100, 100, 600, 24),
      box(100, 134, 580, 24),
      box(100, 168, 320, 24),
    ];
    const r = groupTextLines(lines, INTRINSIC);
    expect(new Set(r.groupOf).size).toBe(1);
    expect(r.groups[0].count).toBe(3);
  });

  test("descender-less line inherits the group's tallest height", () => {
    // Middle line is all-caps: ink box only 19px vs 24px full lines.
    const lines = [
      box(100, 100, 600, 24),
      box(100, 134, 500, 19),
      box(100, 168, 560, 24),
    ];
    const r = groupTextLines(lines, INTRINSIC);
    expect(new Set(r.groupOf).size).toBe(1);
    expect(r.groups[0].sizePx).toBeCloseTo(24, 5);
  });

  test("a distant headline stays its own group with its own size", () => {
    const lines = [
      box(100, 80, 800, 48), // headline
      box(100, 400, 600, 24), // body far below
      box(100, 434, 600, 24),
    ];
    const r = groupTextLines(lines, INTRINSIC);
    expect(r.groups.length).toBe(2);
    const headlineGroup = r.groups[r.groupOf[0]];
    expect(headlineGroup.count).toBe(1);
    expect(headlineGroup.sizePx).toBeCloseTo(48, 5);
  });

  test("adjacent but different-size lines do not merge", () => {
    const lines = [
      box(100, 100, 600, 40), // subhead
      box(100, 150, 600, 22), // body right below
    ];
    const r = groupTextLines(lines, INTRINSIC);
    expect(r.groups.length).toBe(2);
  });

  test("side-by-side columns at the same height stay separate", () => {
    const lines = [
      box(100, 100, 400, 24),
      box(1100, 100, 400, 24), // second column, no x overlap, far left edge
      box(100, 134, 400, 24),
    ];
    const r = groupTextLines(lines, INTRINSIC);
    expect(r.groupOf[0]).toBe(r.groupOf[2]);
    expect(r.groupOf[1]).not.toBe(r.groupOf[0]);
  });

  test("one merged overgrown box cannot inflate the group size", () => {
    const lines = [
      box(100, 100, 600, 24),
      box(100, 134, 600, 24),
      box(100, 168, 600, 30), // slightly-merged ink, within ratio gate
      box(100, 210, 600, 24),
    ];
    const r = groupTextLines(lines, INTRINSIC);
    expect(new Set(r.groupOf).size).toBe(1);
    // Cap = 1.4 × median(24,24,30,24 → 24) = 33.6 ≥ 30 → size 30 here;
    // the cap engages when an outlier exceeds 1.4× the median.
    expect(r.groups[0].sizePx).toBeLessThanOrEqual(1.4 * 24);
  });

  test("union box spans all members", () => {
    const lines = [box(100, 100, 600, 24), box(100, 134, 300, 24)];
    const r = groupTextLines(lines, INTRINSIC);
    const g = r.groups[0];
    expect(g.box.y).toBeCloseTo(100 / 1080, 6);
    expect(g.box.h).toBeCloseTo((134 + 24 - 100) / 1080, 6);
  });
});
