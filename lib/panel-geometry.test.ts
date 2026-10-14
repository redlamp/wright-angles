import { describe, expect, test } from "bun:test";
import { fitPanelRect, maxContentHeight } from "./panel-geometry";

const desktop = { width: 1440, height: 900 };
const zoomed = { width: 640, height: 400 };

describe("fitPanelRect", () => {
  test("a rect that already fits comes back unchanged", () => {
    const r = { x: 290, y: 56, width: 860, height: 700 };
    expect(fitPanelRect(r, desktop)).toEqual(r);
  });

  test("missing height is treated as zero (title-bar-only fit)", () => {
    expect(fitPanelRect({ x: 20, y: 30, width: 300 }, desktop)).toEqual({
      x: 20,
      y: 30,
      width: 300,
      height: 0,
    });
  });

  test("width caps to the viewport minus both margins", () => {
    const f = fitPanelRect({ x: 290, y: 56, width: 860 }, zoomed);
    expect(f.width).toBe(624);
    expect(f.x).toBe(8);
  });

  test("slides left so the right edge stays inside", () => {
    const f = fitPanelRect({ x: 1100, y: 56, width: 300 }, zoomed);
    expect(f.x + f.width).toBe(632);
    expect(f.x).toBe(332);
  });

  test("slides right out of a negative x", () => {
    expect(fitPanelRect({ x: -200, y: 56, width: 300 }, zoomed).x).toBe(8);
  });

  test("slides up so the bottom edge stays inside", () => {
    const f = fitPanelRect({ x: 8, y: 300, width: 300, height: 200 }, zoomed);
    expect(f.y).toBe(192);
    expect(f.y + f.height).toBe(392);
  });

  test("height caps to the viewport and top wins over bottom", () => {
    const f = fitPanelRect({ x: 8, y: 500, width: 300, height: 900 }, zoomed);
    expect(f).toEqual({ x: 8, y: 8, width: 300, height: 384 });
  });

  test("minWidth holds unless the viewport is narrower", () => {
    expect(
      fitPanelRect({ x: 0, y: 0, width: 100 }, desktop, { minWidth: 260 })
        .width,
    ).toBe(260);
    expect(
      fitPanelRect({ x: 0, y: 0, width: 100 }, { width: 200, height: 400 }, {
        minWidth: 260,
      }).width,
    ).toBe(184);
  });

  test("custom margin", () => {
    const f = fitPanelRect({ x: 900, y: 0, width: 860 }, zoomed, {
      margin: 0,
    });
    expect(f).toEqual({ x: 0, y: 0, width: 640, height: 0 });
  });

  test("degenerate viewport never yields negative sizes", () => {
    const f = fitPanelRect({ x: 5, y: 5, width: 300, height: 300 }, {
      width: 10,
      height: 10,
    });
    expect(f.width).toBe(0);
    expect(f.height).toBe(0);
  });
});

describe("maxContentHeight", () => {
  test("room below the title bar down to the bottom margin", () => {
    expect(maxContentHeight(56, 400, 33)).toBe(303);
  });

  test("never negative", () => {
    expect(maxContentHeight(390, 400, 33)).toBe(0);
  });
});
