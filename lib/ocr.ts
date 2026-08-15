/**
 * Fully local OCR: finds the text lines in a media item so the UI can turn
 * them into measurement boxes. The Tesseract worker, wasm core, and English
 * traineddata are all vendored under `public/ocr/` (see its README) — no
 * CDN, no remote calls, per `decision-local-only-media.md`.
 *
 * This module needs the DOM (canvas + Web Worker), so unlike the math
 * modules it is browser-only; the coordinate-mapping helpers are kept pure
 * and unit-tested without wasm. Tesseract itself is dynamically imported
 * inside the run so no worker code loads during prerender.
 */

import type { MediaCrop } from "./types";

export interface DetectedLine {
  text: string;
  /** Tesseract line confidence, 0–100. */
  confidence: number;
  /** Normalized to the FULL intrinsic image (0–1, y-down). */
  box: { x: number; y: number; w: number; h: number };
}

/** Tesseract pixel bbox, relative to the recognized (cropped) canvas. */
export interface PixelBbox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface PixelRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Intrinsic {
  width: number;
  height: number;
}

/** Lines below either bar are noise, not measurable UI text. */
export const MIN_CONFIDENCE = 55;
export const MIN_LINE_HEIGHT_PX = 6;

/**
 * Integer pixel rect of the crop window against the intrinsic image —
 * the region drawn to the OCR canvas, and the offset that maps result
 * bboxes back to full-image coords. Full frame when no crop.
 */
export function cropRectPx(intrinsic: Intrinsic, crop?: MediaCrop): PixelRect {
  if (!crop) return { x: 0, y: 0, w: intrinsic.width, h: intrinsic.height };
  const x = Math.round(crop.x * intrinsic.width);
  const y = Math.round(crop.y * intrinsic.height);
  return {
    x,
    y,
    w: Math.max(1, Math.min(Math.round(crop.w * intrinsic.width), intrinsic.width - x)),
    h: Math.max(1, Math.min(Math.round(crop.h * intrinsic.height), intrinsic.height - y)),
  };
}

/**
 * A bbox in cropped-canvas pixels → full-image normalized coords: offset
 * by the crop origin, then divide by the intrinsic dims (boxes stay
 * normalized to the FULL image so they never shift when the crop changes).
 */
export function bboxToFullImage(
  bbox: PixelBbox,
  rect: PixelRect,
  intrinsic: Intrinsic,
): DetectedLine["box"] {
  return {
    x: (rect.x + bbox.x0) / intrinsic.width,
    y: (rect.y + bbox.y0) / intrinsic.height,
    w: (bbox.x1 - bbox.x0) / intrinsic.width,
    h: (bbox.y1 - bbox.y0) / intrinsic.height,
  };
}

/** Filter: confident, at least a few pixels tall, and not whitespace. */
export function isMeasurableLine(line: {
  text: string;
  confidence: number;
  bbox: PixelBbox;
}): boolean {
  return (
    line.confidence >= MIN_CONFIDENCE &&
    line.bbox.y1 - line.bbox.y0 >= MIN_LINE_HEIGHT_PX &&
    line.text.trim().length > 0
  );
}

/** The `n` largest lines by box area, in reading order among the kept. */
export function largestByArea(
  lines: DetectedLine[],
  n: number,
): DetectedLine[] {
  if (lines.length <= n) return lines;
  const kept = new Set(
    [...lines].sort((a, b) => b.box.w * b.box.h - a.box.w * a.box.h).slice(0, n),
  );
  return lines.filter((l) => kept.has(l));
}

/** Median line height in intrinsic pixels; 0 for an empty run. */
export function medianHeightPx(
  lines: DetectedLine[],
  intrinsic: Intrinsic,
): number {
  if (lines.length === 0) return 0;
  const hs = lines.map((l) => l.box.h * intrinsic.height).sort((a, b) => a - b);
  const mid = Math.floor(hs.length / 2);
  return hs.length % 2 ? hs[mid] : (hs[mid - 1] + hs[mid]) / 2;
}

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

let inflight: Promise<DetectedLine[]> | null = null;

/**
 * Run OCR over the (cropped region of the) image and return the text
 * lines as full-image-normalized boxes. One run at a time: a concurrent
 * call joins the in-flight promise (callers disable their trigger while
 * running, so differing arguments aren't a real case). The worker is
 * spawned and terminated per run — simplicity over pooling; the wasm and
 * traineddata are cached by the browser/IndexedDB between runs.
 */
export function detectTextLines(
  imageUrl: string,
  intrinsic: Intrinsic,
  crop?: MediaCrop,
): Promise<DetectedLine[]> {
  inflight ??= runDetection(imageUrl, intrinsic, crop).finally(() => {
    inflight = null;
  });
  return inflight;
}

async function runDetection(
  imageUrl: string,
  intrinsic: Intrinsic,
  crop?: MediaCrop,
): Promise<DetectedLine[]> {
  // Draw the crop window at 1:1 intrinsic pixels, so result bboxes are in
  // intrinsic-pixel units offset by the rect origin.
  const rect = cropRectPx(intrinsic, crop);
  const img = new Image();
  img.src = imageUrl;
  await img.decode();
  const canvas = document.createElement("canvas");
  canvas.width = rect.w;
  canvas.height = rect.h;
  canvas
    .getContext("2d")!
    .drawImage(img, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h);

  // Dynamic import: client-only, and only when detection actually runs.
  const { createWorker, OEM, PSM } = await import("tesseract.js");
  const worker = await createWorker("eng", OEM.LSTM_ONLY, {
    workerPath: `${BASE_PATH}/ocr/worker.min.js`,
    corePath: `${BASE_PATH}/ocr/tesseract-core-simd-lstm.js`,
    langPath: `${BASE_PATH}/ocr/lang`,
    // The split core fetches its .wasm relative to the worker's URL, so
    // the worker must run from the real /ocr/ path, not a blob: URL.
    workerBlobURL: false,
  });
  try {
    await worker.setParameters({
      // Full layout analysis — the library default (SINGLE_BLOCK) assumes
      // one uniform text block, which screenshots aren't.
      tessedit_pageseg_mode: PSM.AUTO,
      // Canvas images carry no DPI; silences "Invalid resolution 0 dpi".
      user_defined_dpi: "96",
    });
    // v6+ returns only `text` by default; structured lines live on
    // blocks → paragraphs → lines.
    const { data } = await worker.recognize(canvas, {}, { blocks: true });
    return (data.blocks ?? [])
      .flatMap((block) => block.paragraphs)
      .flatMap((para) => para.lines)
      .filter(isMeasurableLine)
      .map((line) => ({
        text: line.text.trim(),
        confidence: line.confidence,
        box: bboxToFullImage(line.bbox, rect, intrinsic),
      }));
  } finally {
    await worker.terminate();
  }
}
