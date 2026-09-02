import type { KeyframeLine } from "./types";

/**
 * The OCR result for `drawGenerated("gradient")` (stores/media-store.ts),
 * captured once and shipped as a static constant instead of scanned live.
 * The gradient card is a deterministic canvas draw — fixed gradient,
 * fixed six-line label ladder, fixed 1920×1080 — so its detections never
 * change; recomputing them on every first run buys nothing and costs a
 * real scan (warm ~200ms, or the ~1.5s cold-start tax if seeding happens
 * to be the session's first OCR call).
 *
 * Captured by actually running "Detect Text Size" against the real
 * seeded card and reading the result back out of IndexedDB
 * (wiki/research/ocr-cost.md) — not estimated. Line ids are stable
 * strings rather than the random UUIDs that run produced, so this file
 * stays deterministic across regenerations. Coordinates rounded to 1e-6
 * (sub-pixel at 1920×1080); OCR misreads text like "17px" as "47px" and
 * "13px" as "3px" on the two smallest lines — that's what the real
 * engine produced, kept verbatim rather than hand-corrected, since
 * shipping anything else would mean this constant no longer matches
 * what a live scan of the same card actually returns.
 */
export const GRADIENT_SEED_SCAN: { lines: KeyframeLine[]; medianPx: number } =
  {
    medianPx: 23,
    lines: [
      {
        id: "gradient-seed-0",
        text: "48px — The quick brown fox jumps over the lazy dog",
        confidence: 95,
        box: { x: 0.031771, y: 0.060185, w: 0.628646, h: 0.041667 },
        groupId: 0,
        sizePx: 45,
      },
      {
        id: "gradient-seed-1",
        text: "36px — The quick brown fox jumps over the lazy dog",
        confidence: 95,
        box: { x: 0.031771, y: 0.148148, w: 0.471354, h: 0.030556 },
        groupId: 1,
        sizePx: 33,
      },
      {
        id: "gradient-seed-2",
        text: "28px — The quick brown fox jumps over the lazy dog",
        confidence: 95,
        box: { x: 0.03125, y: 0.213889, w: 0.367188, h: 0.024074 },
        groupId: 2,
        sizePx: 26,
      },
      {
        id: "gradient-seed-3",
        text: "22px — The quick brown fox jumps over the lazy dog",
        confidence: 95,
        box: { x: 0.03125, y: 0.264815, w: 0.288542, h: 0.018519 },
        groupId: 3,
        sizePx: 20,
      },
      {
        id: "gradient-seed-4",
        text: "47px — The quick brown fox jumps over the lazy dog",
        confidence: 93,
        box: { x: 0.031771, y: 0.30463, w: 0.222396, h: 0.013889 },
        groupId: 4,
        sizePx: 15,
      },
      {
        id: "gradient-seed-5",
        text: "3px — The quick brown fox jumps over the lazy dog",
        confidence: 88,
        box: { x: 0.031771, y: 0.335185, w: 0.169792, h: 0.012037 },
        groupId: 5,
        sizePx: 13,
      },
    ],
  };
