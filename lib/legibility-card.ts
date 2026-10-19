/**
 * The legibility test card, drawn to match the Figma "Reference Image"
 * frame (Wright Angles file, Reference Image page): a four-corner color
 * field under safe-area frames, contrast swatches and pixel-pitch tiles
 * on dark panels, and Snellen and tumbling E charts on the right
 * (lib/optotype-chart.ts). Everything is baked into the image; the
 * per-device reading comes from the charts' pinned measure boxes.
 *
 * Layout figures are card pixels at 1920 × 1080, the only size the card
 * is drawn at. The swatch and tile geometry is pure and tested; drawing
 * needs a canvas context, and loadCardFonts needs `document.fonts`.
 */
import {
  AAA_NORMAL,
  AA_LARGE,
  AA_NORMAL,
  contrastRatio,
  grayForContrast,
  relativeLuminance,
  type ContrastSide,
} from "@/lib/contrast";
import { drawOptotypeCharts } from "@/lib/optotype-chart";

const FAMILY = "Barlow, sans-serif";

/** Swatch ratios, strongest first, with the threshold each one marks. */
export const CONTRAST_SWATCHES: { ratio: number; label: string }[] = [
  { ratio: AAA_NORMAL, label: "AAA" },
  { ratio: AA_NORMAL, label: "AA" },
  { ratio: AA_LARGE, label: "AA large" },
  { ratio: 2, label: "fails" },
  { ratio: 1.5, label: "fails" },
];

/** Light on dark, grey on grey, dark on light. Mid gray can't reach
 * 7:1 with any gray, so that tile shows the darkest text and its ratio. */
const SWATCH_ROWS: { bg: number; side: ContrastSide }[] = [
  { bg: 32, side: "either" },
  { bg: 128, side: "darker" },
  { bg: 232, side: "either" },
];

export interface Swatch {
  bg: number;
  fg: number;
  label: string;
}

export function contrastSwatchRows(): Swatch[][] {
  const lum = (v: number) => relativeLuminance(v, v, v);
  return SWATCH_ROWS.map(({ bg, side }) =>
    CONTRAST_SWATCHES.map(({ ratio, label }) => {
      const reached = grayForContrast(lum(bg), ratio, side);
      const fg = reached ?? (side === "lighter" ? 255 : 0);
      const actual = contrastRatio(lum(fg), lum(bg)).toFixed(2);
      return { bg, fg, label: reached === null ? `${actual}:1 max` : `${actual}:1 ${label}` };
    }),
  );
}

/** Line widths of the pixel-pitch tiles, left to right. */
export const PITCH_WIDTHS = [1, 2, 3, 4] as const;
const TILE = 128;

export type Rect = [x: number, y: number, w: number, h: number];

/**
 * Black rects for one 128px pixel-pitch tile (white ground) with `w`-px
 * lines: stripes, columns, a checker and concentric squares, one per
 * quadrant, each holding whole lines only. 3 doesn't divide 64, so the
 * 3px tile uses 63px quadrants inside a 1px border that is black on the
 * top and left edges, as in the Figma tile.
 */
export function pitchTileRects(w: number): Rect[] {
  const pad = 64 % w === 0 ? 0 : 1;
  const Q = (TILE - 2 * pad) / 2;
  const n = Math.floor(Q / w);
  const rects: Rect[] = [];
  if (pad) rects.push([0, 0, TILE, 1], [0, 0, 1, TILE - 1]);
  const at = (qx: number, qy: number) => [pad + qx * Q, pad + qy * Q];
  const [hx, hy] = at(0, 0);
  const [vx, vy] = at(1, 0);
  const [mx, my] = at(0, 1);
  const [sx, sy] = at(1, 1);
  for (let i = 1; i < n; i += 2) {
    rects.push([hx, hy + i * w, Q, w]);
    rects.push([vx + i * w, vy, w, Q]);
  }
  // Checker: a cell is black when exactly one of its row/column is odd.
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if ((i % 2 === 1) !== (j % 2 === 1)) rects.push([mx + j * w, my + i * w, w, w]);
    }
  }
  for (let a = w; Q - 2 * a >= w; a += 2 * w) {
    const s = Q - 2 * a;
    rects.push(
      [sx + a, sy + a, s, w],
      [sx + a, sy + a + s - w, s, w],
      [sx + a, sy + a, w, s],
      [sx + a + s - w, sy + a, w, s],
    );
  }
  return rects;
}

/** Load the Barlow faces the card uses so the first draw isn't a fallback. */
export async function loadCardFonts(): Promise<void> {
  if (typeof document === "undefined" || !document.fonts) return;
  await Promise.all(
    ["500 18px", "600 26px", "700 24px"].map((f) =>
      document.fonts.load(`${f} Barlow`).catch(() => []),
    ),
  );
}

type Ctx = CanvasRenderingContext2D;

const grayCss = (v: number) => `rgb(${v},${v},${v})`;

/** Text placed by its Figma box top: Barlow's ascent is 1 em, so the
 * baseline sits one font size below. */
function text(g: Ctx, s: string, weight: number, size: number, color: string, x: number, top: number) {
  g.font = `${weight} ${size}px ${FAMILY}`;
  g.fillStyle = color;
  g.fillText(s, x, top + size);
}

function panel(g: Ctx, x: number, y: number, w: number, h: number, color: string) {
  g.fillStyle = color;
  g.beginPath();
  g.roundRect(x, y, w, h, 4);
  g.fill();
}

/** Red rises top to bottom, green left to right, combined with lighten
 * over black: black, green, red and yellow corners. */
function drawBackground(g: Ctx, W: number, H: number) {
  g.fillStyle = "#000";
  g.fillRect(0, 0, W, H);
  const red = g.createLinearGradient(0, 0, 0, H);
  red.addColorStop(0, "rgba(255,0,0,0)");
  red.addColorStop(1, "rgba(255,0,0,1)");
  g.fillStyle = red;
  g.fillRect(0, 0, W, H);
  const green = g.createLinearGradient(0, 0, W, 0);
  green.addColorStop(0, "rgba(0,255,0,0)");
  green.addColorStop(1, "rgba(0,255,0,1)");
  g.globalCompositeOperation = "lighten";
  g.fillStyle = green;
  g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = "source-over";
}

function drawSafeAreas(g: Ctx) {
  // SMPTE ST 2046-1 action-safe 93% and title-safe 90%; 2px strokes
  // just outside each box.
  g.setLineDash([16, 10]);
  g.lineWidth = 2;
  g.strokeStyle = "#9a9a9a";
  g.strokeRect(66, 37, 1788, 1006);
  g.strokeStyle = "#f5a524";
  g.strokeRect(95, 53, 1730, 974);
  g.setLineDash([]);
  g.fontVariantCaps = "all-small-caps";
  text(g, "action safe 93% (67 × 38 px)", 500, 18, "#9a9a9a", 75, 17);
  text(g, "title safe 90% (96 × 54 px)", 500, 18, "#f5a524", 104, 60);
  g.fontVariantCaps = "normal";
}

function drawContrast(g: Ctx) {
  panel(g, 128, 215, 838, 511, "rgba(0,0,0,0.8)");
  text(g, "Contrast vs WCAG / XAG floors", 600, 26, "#e5e5e5", 144, 231);
  contrastSwatchRows().forEach((row, ri) =>
    row.forEach((s, i) => {
      const x = 144 + i * 164;
      const y = 278 + ri * 148;
      g.fillStyle = grayCss(s.bg);
      g.fillRect(x, y, 150, 104);
      text(g, "Aa", 600, 44, grayCss(s.fg), x + 14, y + 10);
      text(g, "Body 18px", 500, 18, grayCss(s.fg), x + 14, y + 66);
      text(g, s.label, 500, 17, grayCss(189), x, y + 110);
    }),
  );
}

function drawPixelPitch(g: Ctx) {
  panel(g, 128, 742, 580, 220, "rgba(0,0,0,0.8)");
  text(g, "Pixel Pitch", 600, 26, "#fff", 144, 758);
  PITCH_WIDTHS.forEach((w, i) => {
    const x = 144 + i * 140;
    const y = 791;
    g.fillStyle = "#000";
    g.fillRect(x - 2, y - 2, TILE + 4, TILE + 4);
    g.fillStyle = "#fff";
    g.fillRect(x, y, TILE, TILE);
    g.fillStyle = "#000";
    for (const [rx, ry, rw, rh] of pitchTileRects(w)) g.fillRect(x + rx, y + ry, rw, rh);
    g.textAlign = "center";
    text(g, `${w}x${w}`, 700, 24, "#fff", x + TILE / 2, 925);
    g.textAlign = "start";
  });
}

export function drawLegibilityCard(g: Ctx, W: number, H: number) {
  drawBackground(g, W, H);
  drawSafeAreas(g);
  text(g, "Legibility card", 600, 44, "#f2f2f2", 134, 102);
  text(
    g,
    `${W} × ${H} · eye-chart rows are measure boxes: their arc minutes show per device`,
    500, 20, "#9a9a9a", 134, 157,
  );
  drawContrast(g);
  drawPixelPitch(g);
  drawOptotypeCharts(g, W, H);
}
