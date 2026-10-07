import { CARD_W_MM } from "@/lib/calibration";

/** Real ID-1 cards have a 3.18mm corner radius; scale it with the card. */
export const CORNER_R_RATIO = 3.18 / CARD_W_MM;

/** Generous breathing room around the card so every edge/corner handle
 * stays grabbable and there's room to grow before hitting the dialog
 * wall. */
export const STAGE_PAD_PX = 56;

/** Margin kept between the dialog and the viewport edge, on top of the
 * dialog's own padding — used both to cap how wide the card's drag
 * range is allowed to get and to cap the visible stage window. */
export const DIALOG_MARGIN_PX = 96;

/**
 * Non-stage chrome inside the dialog when calibrating: header + optional
 * zoom warning + "I think the display is…" row + slider + the
 * implies/configured readout line + footer, plus the grid gaps and
 * padding between them. Kept as a single named budget rather than
 * measuring live, so this is a rough reservation, not exact — the
 * outer DialogContent's own max-height is the hard guarantee that the
 * dialog never exceeds the viewport even if this estimate runs short.
 */
export const RESERVED_CHROME_PX = 380;
export const MIN_STAGE_VIEWPORT_PX = 200;

/**
 * Below this width the full in-card label — name, "dimensions", the
 * measurements, and the cm/in toggle — can't fit at the app's normal
 * type size without wrapping into the card's own edges, so the whole
 * label drops rather than shrinking illegibly. That does mean the unit
 * toggle becomes unreachable below this width; the card being that
 * small means the user is already mid-drag toward a bigger one, so it
 * isn't the moment they'd reach for the toggle anyway.
 */
export const LABEL_MIN_PX = 190;
