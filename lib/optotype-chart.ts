/**
 * The legibility card's eye charts: a Snellen chart in Sloan-style
 * letters and a tumbling E chart, each row a fixed pixel height at the
 * card's authoring resolution. Rows don't name a Snellen fraction
 * because that depends on the viewer: each row is pinned as a measure
 * box instead, so the app reports its arc minutes per device like any
 * other text (a 5′ row is the 20/20 line, 10′ is 20/40, and so on).
 *
 * Every glyph sits on a 5 × 5 grid with 1-unit strokes, the optotype
 * convention. The layout is pure; the draw functions need only a 2D
 * canvas context.
 */
import type { HighlightBox } from "./types";

/** Row letter heights in px at 1080p, largest first. Multiples of 5
 * keep the 5 × 5 grid on whole pixels. */
export const OPTOTYPE_ROW_PX = [100, 80, 60, 45, 35, 25, 20, 15, 10, 5] as const;

/** Sloan rows (the ten Sloan letters), read left to right. */
const SLOAN_ROWS = [
  "HV", "ZDK", "NROS", "CHDZ", "KVONS",
  "RDHCV", "OSZKN", "VCRHD", "ZNSKO", "DCVRH",
];

export type ChartKind = "snellen" | "tumbling-e";

export interface OptotypeRow {
  chart: ChartKind;
  px: number;
  /** Left edge of the first glyph, top edge of the row (card px). */
  x: number;
  y: number;
  /** Gap between glyphs. */
  gap: number;
  /** Sloan letters, or E rotations in quarter turns (0 = opening right). */
  glyphs: string[] | number[];
}

export interface ChartPanel {
  chart: ChartKind;
  title: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rows: OptotypeRow[];
}

const LABEL_COL = 64;
const TITLE_H = 79;

function panelRows(chart: ChartKind, px0: number, py0: number, pw: number) {
  const rows: OptotypeRow[] = [];
  const area = pw - LABEL_COL - 16;
  let y = py0 + TITLE_H;
  OPTOTYPE_ROW_PX.forEach((px, i) => {
    // Snellen spacing is one letter width; tightened to 0.6 so the
    // big rows still hold two or more glyphs.
    const gap = Math.max(2, Math.round(px * 0.6));
    const count = Math.max(1, Math.min(5, Math.floor((area + gap) / (px + gap))));
    const rowW = count * px + (count - 1) * gap;
    const x = Math.round(px0 + LABEL_COL + (area - rowW) / 2);
    const glyphs =
      chart === "snellen"
        ? SLOAN_ROWS[i].slice(0, count).split("")
        : Array.from({ length: count }, (_, j) => (i * 3 + j * 5 + 1) % 4);
    rows.push({ chart, px, x, y, gap, glyphs });
    y += px + Math.max(14, Math.round(px * 0.6));
  });
  return rows;
}

/** Both chart panels for a `W` × `H` card, side by side on its right
 * (positions from the Figma Reference Image frame at 1080p). */
export function optotypeChartLayout(W: number, H: number): ChartPanel[] {
  const s = H / 1080;
  const top = Math.round(215 * s);
  const right = Math.round(W - 128 * s);
  const pw = Math.round(392 * s);
  const ph = Math.round(747 * s);
  const gap = Math.round(16 * s);
  const ex = right - pw;
  const sx = ex - gap - pw;
  return [
    { chart: "snellen", title: "Snellen (Sloan letters)", x: sx, y: top, w: pw, h: ph, rows: panelRows("snellen", sx, top, pw) },
    { chart: "tumbling-e", title: "Tumbling E", x: ex, y: top, w: pw, h: ph, rows: panelRows("tumbling-e", ex, top, pw) },
  ];
}

const CHART_LABEL: Record<ChartKind, string> = {
  snellen: "Snellen",
  "tumbling-e": "Tumbling E",
};

/**
 * One measure box per row, spanning its glyphs at full letter height,
 * normalized to the card. Ids are stable so a regenerated card's boxes
 * match an earlier one's.
 */
export function optotypeBoxes(W: number, H: number): HighlightBox[] {
  return optotypeChartLayout(W, H).flatMap((p) =>
    p.rows.map((r) => {
      const n = r.glyphs.length;
      return {
        id: `optotype-${r.chart}-${r.px}`,
        label: `${CHART_LABEL[r.chart]} ${r.px}px`,
        x: r.x / W,
        y: r.y / H,
        w: (n * r.px + (n - 1) * r.gap) / W,
        h: r.px / H,
      };
    }),
  );
}

type Ctx = CanvasRenderingContext2D;

/** Sloan-style letter strokes on the 5 × 5 grid (stroke width 1). */
function sloanPath(g: Ctx, letter: string) {
  const line = (pts: [number, number][]) => {
    g.moveTo(...pts[0]);
    for (const p of pts.slice(1)) g.lineTo(...p);
  };
  const gapAngle = Math.asin(0.5 / 2);
  switch (letter) {
    case "C":
      g.arc(2.5, 2.5, 2, gapAngle, Math.PI * 2 - gapAngle);
      break;
    case "O":
      g.arc(2.5, 2.5, 2, 0, Math.PI * 2);
      break;
    case "D":
      g.moveTo(0.5, 0.5);
      g.lineTo(2.5, 0.5);
      g.arc(2.5, 2.5, 2, -Math.PI / 2, Math.PI / 2);
      g.lineTo(0.5, 4.5);
      g.closePath();
      break;
    case "H":
      line([[0.5, 0], [0.5, 5]]);
      line([[4.5, 0], [4.5, 5]]);
      line([[0.5, 2.5], [4.5, 2.5]]);
      break;
    case "K":
      line([[0.5, 0], [0.5, 5]]);
      line([[4.8, -0.1], [0.9, 3.1]]);
      line([[2.1, 2.0], [4.9, 5.2]]);
      break;
    case "N":
      line([[0.5, 5], [0.5, 0.2], [4.5, 4.8], [4.5, 0]]);
      break;
    case "R":
      g.moveTo(0.5, 5);
      g.lineTo(0.5, 0.5);
      g.lineTo(3, 0.5);
      g.arc(3, 1.75, 1.25, -Math.PI / 2, Math.PI / 2);
      g.lineTo(0.5, 3);
      line([[2.6, 3], [4.8, 5.2]]);
      break;
    case "S":
      g.moveTo(4.4, 1.3);
      g.bezierCurveTo(4.0, 0.1, 0.6, 0.1, 0.6, 1.4);
      g.bezierCurveTo(0.6, 2.6, 4.4, 2.3, 4.4, 3.6);
      g.bezierCurveTo(4.4, 4.9, 0.9, 4.9, 0.6, 3.7);
      break;
    case "V":
      line([[0.3, -0.2], [2.5, 4.9], [4.7, -0.2]]);
      break;
    case "Z":
      line([[0, 0.5], [4.5, 0.5], [0.5, 4.5], [5, 4.5]]);
      break;
  }
}

/** Draw one optotype into the `px` cell at (x, y). */
function drawGlyph(g: Ctx, chart: ChartKind, glyph: string | number, x: number, y: number, px: number) {
  const u = px / 5;
  g.save();
  g.translate(x, y);
  g.scale(u, u);
  g.beginPath();
  g.rect(0, 0, 5, 5);
  g.clip();
  if (chart === "tumbling-e") {
    // Spine on the left, three bars opening right; rotated in quarter turns.
    g.translate(2.5, 2.5);
    g.rotate((Number(glyph) * Math.PI) / 2);
    g.translate(-2.5, -2.5);
    g.fillRect(0, 0, 1, 5);
    g.fillRect(0, 0, 5, 1);
    g.fillRect(0, 2, 5, 1);
    g.fillRect(0, 4, 5, 1);
  } else {
    g.lineWidth = 1;
    g.lineCap = "butt";
    g.lineJoin = "miter";
    g.beginPath();
    sloanPath(g, String(glyph));
    g.stroke();
  }
  g.restore();
}

/** Black-on-white chart panels, the clinical presentation. */
export function drawOptotypeCharts(g: Ctx, W: number, H: number) {
  const family = "Barlow, sans-serif";
  for (const p of optotypeChartLayout(W, H)) {
    g.fillStyle = "#f4f4f4";
    g.beginPath();
    g.roundRect(p.x, p.y, p.w, p.h, 4);
    g.fill();
    g.fillStyle = "#333";
    g.font = `600 26px ${family}`;
    g.fillText(p.title, p.x + 16, p.y + 38);
    for (const r of p.rows) {
      g.fillStyle = "#333";
      g.font = `500 14px ${family}`;
      g.fillText(`${r.px}px`, p.x + 16, r.y + r.px / 2 + 7);
      g.fillStyle = "#000";
      g.strokeStyle = "#000";
      r.glyphs.forEach((glyph, j) =>
        drawGlyph(g, r.chart, glyph, r.x + j * (r.px + r.gap), r.y, r.px),
      );
    }
  }
}
