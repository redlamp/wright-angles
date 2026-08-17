/**
 * Text-line grouping for OCR results (plan 7.1–7.2).
 *
 * OCR measures a line's VISIBLE INK. A line without descenders (or
 * all-caps) reports a shorter box than its true font size, so its
 * arc-minute verdict comes out too small. Neighbouring lines that read
 * as one block — word-wrapped paragraphs, list rows — almost always
 * share one font size, so the group's tallest plausible line (the one
 * whose ink spans ascender to descender) is the best size estimate for
 * every member.
 *
 * Boxes are normalized to the full image (y-down), heights in px come
 * from box.h × intrinsic height.
 */

interface NormBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface TextGroup {
  id: number;
  /** Group font-size estimate in source px (descender-aware). */
  sizePx: number;
  count: number;
  /** Union of member boxes (normalized). */
  box: NormBox;
}

export interface GroupingResult {
  /** groupOf[i] = group id for lines[i]. */
  groupOf: number[];
  groups: TextGroup[];
}

/** Vertical gap between lines must stay under this × line height. */
const MAX_GAP_FACTOR = 0.9;
/** Heights within this ratio count as the same font size. */
const MAX_HEIGHT_RATIO = 1.35;
/** Left edges within this × height read as the same column. */
const MAX_LEFT_SHIFT_FACTOR = 1.5;
/** Guard: one merged/overgrown box must not inflate the group size. */
const MAX_SIZE_OVER_MEDIAN = 1.4;

const median = (values: number[]): number => {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

const xOverlap = (a: NormBox, b: NormBox): number => {
  const lo = Math.max(a.x, b.x);
  const hi = Math.min(a.x + a.w, b.x + b.w);
  return Math.max(0, hi - lo);
};

/** Would `line` continue the block ending in `prev` (same font size)? */
function continues(prev: NormBox, line: NormBox, intrinsicH: number): boolean {
  const hA = prev.h * intrinsicH;
  const hB = line.h * intrinsicH;
  const ratio = Math.max(hA, hB) / Math.max(1e-6, Math.min(hA, hB));
  if (ratio > MAX_HEIGHT_RATIO) return false;
  // Wrap/line spacing: the next line starts within a line-height below.
  const gapPx = (line.y - (prev.y + prev.h)) * intrinsicH;
  if (gapPx < -0.5 * Math.min(hA, hB)) return false; // overlapping = other column artifacts
  if (gapPx > MAX_GAP_FACTOR * Math.max(hA, hB)) return false;
  // Same column: ranges overlap, or left edges align (ragged-right wrap).
  const overlap = xOverlap(prev, line);
  const leftShiftPx = Math.abs(line.x - prev.x) * intrinsicH; // vs height scale
  return (
    overlap >= 0.2 * Math.min(prev.w, line.w) ||
    leftShiftPx <= MAX_LEFT_SHIFT_FACTOR * Math.max(hA, hB)
  );
}

/**
 * Cluster lines into blocks and estimate one font size per block: the
 * tallest member, capped at 1.4× the member median so a merged box
 * can't inflate the whole group. Single lines keep their own height —
 * there is no context to correct with.
 */
export function groupTextLines(
  boxes: NormBox[],
  intrinsic: { width: number; height: number },
): GroupingResult {
  const order = boxes
    .map((box, i) => ({ box, i }))
    .sort((a, b) => a.box.y - b.box.y || a.box.x - b.box.x);

  const groupOf = new Array<number>(boxes.length).fill(-1);
  interface Open {
    id: number;
    members: number[];
    last: NormBox;
  }
  const open: Open[] = [];
  let nextId = 0;
  for (const { box, i } of order) {
    const host = open.find((g) => continues(g.last, box, intrinsic.height));
    if (host) {
      host.members.push(i);
      host.last = box;
      groupOf[i] = host.id;
    } else {
      const g = { id: nextId++, members: [i], last: box };
      open.push(g);
      groupOf[i] = g.id;
    }
  }

  const groups: TextGroup[] = [];
  for (let id = 0; id < nextId; id++) {
    const members = boxes.filter((_, i) => groupOf[i] === id);
    const heights = members.map((b) => b.h * intrinsic.height);
    const cap = MAX_SIZE_OVER_MEDIAN * median(heights);
    const sizePx = Math.min(Math.max(...heights), cap);
    const x0 = Math.min(...members.map((b) => b.x));
    const y0 = Math.min(...members.map((b) => b.y));
    const x1 = Math.max(...members.map((b) => b.x + b.w));
    const y1 = Math.max(...members.map((b) => b.y + b.h));
    groups.push({
      id,
      sizePx,
      count: members.length,
      box: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 },
    });
  }
  return { groupOf, groups };
}
