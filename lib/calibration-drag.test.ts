import { describe, expect, test } from "bun:test";
import {
  CARD_ASPECT,
  heightFromWidthPx,
  widthFromDiagonalPx,
} from "./calibration";
import {
  boxFromCorner,
  draggedCorner,
  growthDir,
  pinnedCorner,
  type Box,
  type Corner,
} from "./calibration-drag";

const CORNERS: Corner[] = ["tl", "tr", "bl", "br"];
const box: Box = { width: 300, left: 40, top: 70 };
const heightPx = heightFromWidthPx(box.width);

/** Simulate one corner-drag frame the way CalibrationPanel does: move
 * the dragged corner by (dx, dy), project onto the growth diagonal,
 * rebuild the box from the pin. */
function dragCorner(corner: Corner, dx: number, dy: number): Box {
  const pin = pinnedCorner(corner, box, heightPx);
  const start = draggedCorner(corner, box, heightPx);
  const dir = growthDir(corner);
  const diagonalPx =
    (start.x + dx - pin.x) * dir.x + (start.y + dy - pin.y) * dir.y;
  const width = widthFromDiagonalPx(diagonalPx);
  return boxFromCorner(corner, pin, width, heightFromWidthPx(width));
}

describe("pinnedCorner / draggedCorner", () => {
  test("pin and dragged corner are diagonally opposite", () => {
    for (const corner of CORNERS) {
      const pin = pinnedCorner(corner, box, heightPx);
      const drag = draggedCorner(corner, box, heightPx);
      expect(Math.abs(drag.x - pin.x)).toBeCloseTo(box.width, 9);
      expect(Math.abs(drag.y - pin.y)).toBeCloseTo(heightPx, 9);
    }
  });

  test("each corner maps to its own box corner", () => {
    const right = box.left + box.width;
    const bottom = box.top + heightPx;
    expect(draggedCorner("tl", box, heightPx)).toEqual({ x: box.left, y: box.top });
    expect(draggedCorner("tr", box, heightPx)).toEqual({ x: right, y: box.top });
    expect(draggedCorner("bl", box, heightPx)).toEqual({ x: box.left, y: bottom });
    expect(draggedCorner("br", box, heightPx)).toEqual({ x: right, y: bottom });
    expect(pinnedCorner("tl", box, heightPx)).toEqual({ x: right, y: bottom });
    expect(pinnedCorner("br", box, heightPx)).toEqual({ x: box.left, y: box.top });
  });
});

describe("growthDir", () => {
  test("unit length along the card's own diagonal", () => {
    for (const corner of CORNERS) {
      const d = growthDir(corner);
      expect(Math.hypot(d.x, d.y)).toBeCloseTo(1, 9);
      expect(Math.abs(d.y / d.x)).toBeCloseTo(CARD_ASPECT, 9);
    }
  });

  test("points from the pin toward the dragged corner", () => {
    const signs = { tl: [-1, -1], tr: [1, -1], bl: [-1, 1], br: [1, 1] };
    for (const corner of CORNERS) {
      const d = growthDir(corner);
      expect([Math.sign(d.x), Math.sign(d.y)]).toEqual(signs[corner]);
      const pin = pinnedCorner(corner, box, heightPx);
      const drag = draggedCorner(corner, box, heightPx);
      expect(Math.sign(drag.x - pin.x)).toBe(Math.sign(d.x));
      expect(Math.sign(drag.y - pin.y)).toBe(Math.sign(d.y));
    }
  });

  test("projected pin→corner distance is the card's diagonal", () => {
    for (const corner of CORNERS) {
      const pin = pinnedCorner(corner, box, heightPx);
      const drag = draggedCorner(corner, box, heightPx);
      const d = growthDir(corner);
      const projected = (drag.x - pin.x) * d.x + (drag.y - pin.y) * d.y;
      expect(projected).toBeCloseTo(Math.hypot(box.width, heightPx), 9);
    }
  });
});

describe("boxFromCorner", () => {
  test("round-trips the current box from its own pin", () => {
    for (const corner of CORNERS) {
      const pin = pinnedCorner(corner, box, heightPx);
      const rebuilt = boxFromCorner(corner, pin, box.width, heightPx);
      expect(rebuilt.width).toBe(box.width);
      expect(rebuilt.left).toBeCloseTo(box.left, 9);
      expect(rebuilt.top).toBeCloseTo(box.top, 9);
    }
  });

  test("pinned corner stays fixed while the dragged corner grows/shrinks", () => {
    for (const corner of CORNERS) {
      const pin = pinnedCorner(corner, box, heightPx);
      const d = growthDir(corner);
      for (const amount of [-60, 25, 120]) {
        const next = dragCorner(corner, d.x * amount, d.y * amount);
        const nextH = heightFromWidthPx(next.width);
        const nextPin = pinnedCorner(corner, next, nextH);
        expect(nextPin.x).toBeCloseTo(pin.x, 9);
        expect(nextPin.y).toBeCloseTo(pin.y, 9);
        // Moving along the growth direction grows; against it shrinks.
        expect(Math.sign(next.width - box.width)).toBe(Math.sign(amount));
      }
    }
  });

  test("movement perpendicular to the diagonal doesn't resize", () => {
    for (const corner of CORNERS) {
      const d = growthDir(corner);
      const next = dragCorner(corner, -d.y * 50, d.x * 50);
      expect(next.width).toBeCloseTo(box.width, 9);
      expect(next.left).toBeCloseTo(box.left, 9);
      expect(next.top).toBeCloseTo(box.top, 9);
    }
  });
});
