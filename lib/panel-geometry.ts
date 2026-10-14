/**
 * Fitting a floating panel's rect into the viewport (WCAG 1.4.10
 * Reflow). At 200% zoom the CSS viewport shrinks to ~640×400 and a
 * panel persisted on a big monitor (or the 860 px Workbench default)
 * would run off the edge with its tabs and fields unreachable. Pure so
 * the clamp is unit-tested; the panel derives its rendered geometry
 * from the stored one through `fitPanelRect`, so the persisted size
 * comes back intact once the window is large again.
 */

export interface PanelRect {
  x: number;
  y: number;
  width: number;
  /** Full panel height (title bar included); omit when unknown. */
  height?: number;
}

export interface Viewport {
  width: number;
  height: number;
}

/** Gap kept between a fitted panel and the viewport edge, px. */
export const PANEL_MARGIN = 8;

/**
 * Cap a panel's width/height to what the viewport can show and slide
 * it so the whole rect lies inside, `margin` from every edge. A rect
 * that already fits is returned unchanged (same values). Width never
 * drops below `minWidth` unless the viewport itself is narrower.
 * Top/left win when the viewport is too small for even the capped rect,
 * so the title bar (the drag handle) always stays on screen.
 */
export function fitPanelRect(
  rect: PanelRect,
  viewport: Viewport,
  { margin = PANEL_MARGIN, minWidth = 0 }: { margin?: number; minWidth?: number } = {},
): Required<PanelRect> {
  const availW = Math.max(0, viewport.width - 2 * margin);
  const availH = Math.max(0, viewport.height - 2 * margin);
  const width = Math.min(availW, Math.max(Math.min(minWidth, availW), rect.width));
  const height = Math.min(availH, rect.height ?? 0);
  const x = Math.max(margin, Math.min(rect.x, viewport.width - margin - width));
  const y = Math.max(margin, Math.min(rect.y, viewport.height - margin - height));
  return { x, y, width, height };
}

/**
 * Tallest content area (below a `headerH` title bar) a panel at `y`
 * can show without its bottom edge leaving the viewport.
 */
export function maxContentHeight(
  y: number,
  viewportHeight: number,
  headerH: number,
  margin = PANEL_MARGIN,
): number {
  return Math.max(0, viewportHeight - margin - y - headerH);
}
