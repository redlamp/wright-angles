/**
 * Corner geometry for the calibration card's resize handles: which
 * corner pins while another is dragged, where the dragged corner sits,
 * which way a corner drag grows the card, and the box a corner drag
 * produces. Pure math in stage-canvas CSS pixels.
 */

import { CARD_ASPECT, CARD_DIAGONAL_RATIO } from "./calibration";

export type Edge = "left" | "right" | "top" | "bottom";
export type Corner = "tl" | "tr" | "bl" | "br";

export type Box = { width: number; left: number; top: number };

/** The corner OPPOSITE the one being dragged — it pins, exactly like an
 * edge drag pins its opposite edge. */
export function pinnedCorner(corner: Corner, box: Box, heightPx: number) {
  switch (corner) {
    case "br":
      return { x: box.left, y: box.top };
    case "tl":
      return { x: box.left + box.width, y: box.top + heightPx };
    case "tr":
      return { x: box.left, y: box.top + heightPx };
    case "bl":
      return { x: box.left + box.width, y: box.top };
  }
}

/** The corner actually being dragged, same coordinate space. */
export function draggedCorner(corner: Corner, box: Box, heightPx: number) {
  switch (corner) {
    case "br":
      return { x: box.left + box.width, y: box.top + heightPx };
    case "tl":
      return { x: box.left, y: box.top };
    case "tr":
      return { x: box.left + box.width, y: box.top };
    case "bl":
      return { x: box.left, y: box.top + heightPx };
  }
}

/** Unit vector, in canvas coordinates, pointing from a corner's pin
 * toward where dragging that corner GROWS the card — along the card's
 * own diagonal, not necessarily 45°, since the card isn't square. */
export function growthDir(corner: Corner) {
  const x = 1 / CARD_DIAGONAL_RATIO;
  const y = CARD_ASPECT / CARD_DIAGONAL_RATIO;
  switch (corner) {
    case "br":
      return { x, y };
    case "tl":
      return { x: -x, y: -y };
    case "tr":
      return { x, y: -y };
    case "bl":
      return { x: -x, y };
  }
}

/** Box position for a corner drag: pin stays put, the card fills the
 * rectangle from the pin to (width, height) in the corner's quadrant. */
export function boxFromCorner(
  corner: Corner,
  pin: { x: number; y: number },
  width: number,
  height: number,
): Box {
  switch (corner) {
    case "br":
      return { width, left: pin.x, top: pin.y };
    case "tl":
      return { width, left: pin.x - width, top: pin.y - height };
    case "tr":
      return { width, left: pin.x, top: pin.y - height };
    case "bl":
      return { width, left: pin.x - width, top: pin.y };
  }
}
