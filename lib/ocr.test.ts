import { describe, expect, test } from "bun:test";
import {
  bboxToFullImage,
  cropRectPx,
  isMeasurableLine,
  largestByArea,
  medianHeightPx,
  splitWordsAtGaps,
  wordsBbox,
  type DetectedLine,
  type OcrWord,
} from "./ocr";

const intrinsic = { width: 1920, height: 1080 };

describe("cropRectPx", () => {
  test("no crop → full frame", () => {
    expect(cropRectPx(intrinsic)).toEqual({ x: 0, y: 0, w: 1920, h: 1080 });
  });

  test("bottom 16:9 of a 1920×1112 capture", () => {
    const tall = { width: 1920, height: 1112 };
    const h = 1080 / 1112;
    const rect = cropRectPx(tall, { x: 0, y: 1 - h, w: 1, h });
    expect(rect).toEqual({ x: 0, y: 32, w: 1920, h: 1080 });
  });

  test("rounding never overruns the frame", () => {
    const rect = cropRectPx(intrinsic, { x: 0.5, y: 0.5, w: 0.5001, h: 0.5001 });
    expect(rect.x + rect.w).toBeLessThanOrEqual(1920);
    expect(rect.y + rect.h).toBeLessThanOrEqual(1080);
  });
});

describe("bboxToFullImage", () => {
  test("full-frame rect: plain normalization", () => {
    const box = bboxToFullImage(
      { x0: 192, y0: 108, x1: 384, y1: 135 },
      { x: 0, y: 0, w: 1920, h: 1080 },
      intrinsic,
    );
    expect(box.x).toBeCloseTo(0.1, 10);
    expect(box.y).toBeCloseTo(0.1, 10);
    expect(box.w).toBeCloseTo(0.1, 10);
    expect(box.h).toBeCloseTo(0.025, 10);
  });

  test("cropped rect: offset by the crop origin", () => {
    // A line at the top-left of a crop window starting at (480, 270).
    const box = bboxToFullImage(
      { x0: 0, y0: 0, x1: 100, y1: 20 },
      { x: 480, y: 270, w: 960, h: 540 },
      intrinsic,
    );
    expect(box.x).toBeCloseTo(480 / 1920, 10);
    expect(box.y).toBeCloseTo(270 / 1080, 10);
    expect(box.w).toBeCloseTo(100 / 1920, 10);
    expect(box.h).toBeCloseTo(20 / 1080, 10);
  });
});

describe("isMeasurableLine", () => {
  const bbox = { x0: 0, y0: 0, x1: 100, y1: 20 };

  test("keeps a confident, tall-enough, non-blank line", () => {
    expect(isMeasurableLine({ text: "Menu", confidence: 90, bbox })).toBe(true);
  });

  test("drops low confidence", () => {
    expect(isMeasurableLine({ text: "Menu", confidence: 54.9, bbox })).toBe(
      false,
    );
  });

  test("drops lines under 6px tall", () => {
    expect(
      isMeasurableLine({
        text: "Menu",
        confidence: 90,
        bbox: { x0: 0, y0: 0, x1: 100, y1: 5 },
      }),
    ).toBe(false);
  });

  test("drops whitespace-only text", () => {
    expect(isMeasurableLine({ text: "  \n", confidence: 90, bbox })).toBe(
      false,
    );
  });
});

const line = (x: number, w: number, h: number): DetectedLine => ({
  text: "t",
  confidence: 90,
  box: { x, y: 0, w, h },
});

describe("largestByArea", () => {
  test("returns everything when under the cap", () => {
    const lines = [line(0, 0.1, 0.02), line(0.2, 0.1, 0.02)];
    expect(largestByArea(lines, 24)).toEqual(lines);
  });

  test("keeps the largest, preserving original order", () => {
    const small = line(0, 0.05, 0.01);
    const big = line(0.1, 0.4, 0.05);
    const mid = line(0.2, 0.2, 0.03);
    expect(largestByArea([small, big, mid], 2)).toEqual([big, mid]);
  });
});

describe("medianHeightPx", () => {
  test("empty run → 0", () => {
    expect(medianHeightPx([], intrinsic)).toBe(0);
  });

  test("odd count → middle value in intrinsic pixels", () => {
    const lines = [line(0, 0.1, 10 / 1080), line(0, 0.1, 22 / 1080), line(0, 0.1, 40 / 1080)];
    expect(medianHeightPx(lines, intrinsic)).toBeCloseTo(22, 6);
  });

  test("even count → mean of the middle two", () => {
    const lines = [line(0, 0.1, 10 / 1080), line(0, 0.1, 20 / 1080)];
    expect(medianHeightPx(lines, intrinsic)).toBeCloseTo(15, 6);
  });
});

const word = (x0: number, x1: number, text = "w"): OcrWord => ({
  text,
  bbox: { x0, y0: 100, x1, y1: 120 },
});

describe("splitWordsAtGaps", () => {
  test("normal word spacing stays one run", () => {
    // 20px-tall line; gaps of 8px are well under 2× line height.
    const words = [word(0, 30), word(38, 70), word(78, 110)];
    expect(splitWordsAtGaps(words, 20)).toEqual([words]);
  });

  test("a cross-column gap splits the line", () => {
    // Two UI columns read as one Tesseract line: 500px of dead space
    // between x=110 and x=610 with a 20px line height.
    const left = [word(0, 50, "Save"), word(58, 110, "changes")];
    const right = [word(610, 680, "Cancel")];
    expect(splitWordsAtGaps([...left, ...right], 20)).toEqual([left, right]);
  });

  test("splits at every qualifying gap", () => {
    const runs = splitWordsAtGaps(
      [word(0, 30), word(200, 230), word(400, 430)],
      20,
    );
    expect(runs.length).toBe(3);
  });

  test("sorts by x before splitting", () => {
    const a = word(0, 50);
    const b = word(600, 660);
    expect(splitWordsAtGaps([b, a], 20)).toEqual([[a], [b]]);
  });

  test("a gap of exactly the threshold does not split", () => {
    // Gap = 40 = 2 × 20; the split requires strictly greater.
    const words = [word(0, 30), word(70, 100)];
    expect(splitWordsAtGaps(words, 20)).toEqual([words]);
  });

  test("empty input → no runs", () => {
    expect(splitWordsAtGaps([], 20)).toEqual([]);
  });
});

describe("wordsBbox", () => {
  test("tight bbox around a run", () => {
    const words: OcrWord[] = [
      { text: "a", bbox: { x0: 10, y0: 105, x1: 40, y1: 118 } },
      { text: "b", bbox: { x0: 48, y0: 100, x1: 90, y1: 122 } },
    ];
    expect(wordsBbox(words)).toEqual({ x0: 10, y0: 100, x1: 90, y1: 122 });
  });
});
