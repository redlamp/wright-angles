import { describe, expect, test } from "bun:test";
import {
  OPTOTYPE_ROW_PX,
  optotypeBoxes,
  optotypeChartLayout,
} from "./optotype-chart";

const W = 1920;
const H = 1080;

describe("optotypeChartLayout", () => {
  const panels = optotypeChartLayout(W, H);

  test("two panels, side by side inside title safe", () => {
    expect(panels.map((p) => p.chart)).toEqual(["snellen", "tumbling-e"]);
    const [s, e] = panels;
    expect(s.x + s.w).toBeLessThan(e.x);
    for (const p of panels) {
      expect(p.x).toBeGreaterThanOrEqual(W * 0.05);
      expect(p.x + p.w).toBeLessThanOrEqual(W * 0.95);
      expect(p.y).toBeGreaterThanOrEqual(H * 0.05);
      expect(p.y + p.h).toBeLessThanOrEqual(H * 0.95);
    }
  });

  test("every row fits its panel, largest first, without overlap", () => {
    for (const p of panels) {
      expect(p.rows.map((r) => r.px)).toEqual([...OPTOTYPE_ROW_PX]);
      let prevBottom = p.y;
      for (const r of p.rows) {
        const n = r.glyphs.length;
        expect(n).toBeGreaterThanOrEqual(1);
        expect(n).toBeLessThanOrEqual(5);
        expect(r.y).toBeGreaterThan(prevBottom);
        expect(r.x).toBeGreaterThan(p.x);
        expect(r.x + n * r.px + (n - 1) * r.gap).toBeLessThanOrEqual(p.x + p.w);
        prevBottom = r.y + r.px;
      }
      expect(prevBottom).toBeLessThanOrEqual(p.y + p.h);
    }
  });

  test("rows sit on whole pixels so the 5 × 5 grid stays crisp", () => {
    for (const r of panels.flatMap((p) => p.rows)) {
      expect(Number.isInteger(r.x)).toBe(true);
      expect(Number.isInteger(r.y)).toBe(true);
      expect(r.px % 5).toBe(0);
    }
  });

  test("tumbling E rows use all four directions", () => {
    const dirs = new Set(
      panels[1].rows.flatMap((r) => r.glyphs as number[]),
    );
    expect([...dirs].sort()).toEqual([0, 1, 2, 3]);
  });
});

describe("optotypeBoxes", () => {
  const boxes = optotypeBoxes(W, H);

  test("one stable, labeled box per row of each chart", () => {
    expect(boxes).toHaveLength(OPTOTYPE_ROW_PX.length * 2);
    expect(boxes[0]).toMatchObject({
      id: "optotype-snellen-100",
      label: "Snellen 100px",
    });
    expect(new Set(boxes.map((b) => b.id)).size).toBe(boxes.length);
  });

  test("box height is the letter height", () => {
    const e20 = boxes.find((b) => b.id === "optotype-tumbling-e-20")!;
    expect(e20.h * H).toBeCloseTo(20, 6);
  });
});
