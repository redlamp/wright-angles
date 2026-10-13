import { CARD_W_MM } from "@/lib/calibration";

/** Real ID-1 cards have a 3.18mm corner radius; scale it with the card. */
export const CORNER_R_RATIO = 3.18 / CARD_W_MM;

/** Room around the measured shape on the stage, so the anchor guide and
 * the end handles stay grabbable without touching the stage wall. */
export const STAGE_PAD_PX = 40;

/** Margin kept between the dialog and the viewport edge, on top of the
 * dialog's own padding: caps the visible stage window. */
export const DIALOG_MARGIN_PX = 96;

/**
 * Non-stage chrome inside the dialog while measuring: header with its
 * illustration, an optional pre-check notice, the fine-adjust row and
 * the footer, plus gaps and padding. A rough reservation, not exact;
 * the DialogContent's own max-height is the hard guarantee.
 */
export const RESERVED_CHROME_PX = 330;
export const MIN_STAGE_VIEWPORT_PX = 180;

/**
 * The drag range, as multiples of the seeded scale. Generous on purpose:
 * the seed comes from a configured diagonal that may be badly wrong, and
 * the true size must stay reachable however small the window is.
 */
export const RANGE_MIN = 0.4;
export const RANGE_MAX = 3;

/** Width of the non-measuring steps (method, known size, result). */
export const NARROW_STEP = "w-[min(30rem,calc(100vw-4rem))]";

/** Below this width the card's own label no longer fits inside it. */
export const LABEL_MIN_PX = 170;

/** The anchor guide's stroke colour: a hue, so it never reads as part
 * of the (foreground-filled) card it frames. 3:1+ on both themes. */
export const GUIDE_COLOR = "text-sky-700 dark:text-sky-400";

/** Inches to one decimal, dropping a trailing ".0" (27″, 26.8″). */
export function fmtIn(v: number): string {
  const r = Math.round(v * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

/** Focus ring for this panel's custom controls: full foreground with a
 * background-coloured gap, so it clears 3:1 against the page AND the
 * solid card fill it can overlap. */
export const FOCUS_RING =
  "outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background";
