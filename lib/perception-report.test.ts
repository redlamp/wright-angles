import { describe, expect, test } from "bun:test";
import type { KeyframeLine, MediaItem } from "./types";
import { buildTextEntries, lineThumb, ratioNote } from "./perception-report";

const item = (over: Partial<MediaItem> = {}): MediaItem => ({
  id: "m1",
  name: "shot.png",
  type: "image/png",
  kind: "image",
  width: 1920,
  height: 1080,
  referenceHeight: 1080,
  addedAt: 0,
  ...over,
});

const line = (over: Partial<KeyframeLine> = {}): KeyframeLine => ({
  id: "l1",
  text: "NEW GAME",
  confidence: 90,
  box: { x: 0.1, y: 0.2, w: 0.3, h: 0.02 },
  ...over,
});

describe("ratioNote", () => {
  test("bigger than the host reads roomier", () => {
    expect(ratioNote(1.5)).toMatch(/roomier/);
    expect(ratioNote(1.031)).toMatch(/roomier/);
  });

  test("the ±3% band around 1 (inclusive) is a near-1:1 reference", () => {
    for (const r of [1, 0.97, 1.03, 0.99])
      expect(ratioNote(r)).toMatch(/near-1:1/);
  });

  test("moderately smaller shrinks", () => {
    expect(ratioNote(0.96)).toMatch(/shrinks/);
    expect(ratioNote(0.5)).toMatch(/shrinks/);
  });

  test("under half size says small text is invisible", () => {
    expect(ratioNote(0.49)).toMatch(/invisible/);
    expect(ratioNote(0)).toMatch(/invisible/);
  });
});

describe("buildTextEntries", () => {
  test("an item with no boxes or keyframes yields nothing", () => {
    expect(buildTextEntries(item())).toEqual([]);
    expect(buildTextEntries(item({ boxes: [], scanKeyframes: [] }))).toEqual(
      [],
    );
  });

  test("measure boxes become removable entries with source px height", () => {
    const [e] = buildTextEntries(
      item({
        boxes: [{ id: "b1", x: 0.1, y: 0.2, w: 0.3, h: 0.025, label: "Title" }],
      }),
    );
    expect(e).toEqual({
      id: "b1",
      label: "Title",
      h: 0.025,
      srcH: 27, // 0.025 × 1080
      kfTime: null,
      removable: true,
      box: { x: 0.1, y: 0.2, w: 0.3, h: 0.025 },
    });
  });

  test("labels are trimmed; missing or blank ones fall back to the 1-based index", () => {
    const entries = buildTextEntries(
      item({
        boxes: [
          { id: "a", x: 0, y: 0, w: 0.1, h: 0.1, label: "  Menu  " },
          { id: "b", x: 0, y: 0, w: 0.1, h: 0.1 },
          { id: "c", x: 0, y: 0, w: 0.1, h: 0.1, label: "   " },
        ],
      }),
    );
    expect(entries.map((e) => e.label)).toEqual(["Menu", "Box 2", "Box 3"]);
  });

  test("a box entry's rect carries only x/y/w/h", () => {
    const [e] = buildTextEntries(
      item({ boxes: [{ id: "b", x: 0.1, y: 0.2, w: 0.3, h: 0.4, label: "x" }] }),
    );
    expect(Object.keys(e.box).sort()).toEqual(["h", "w", "x", "y"]);
  });

  test("keyframe lines use the group-corrected sizePx when present", () => {
    const [e] = buildTextEntries(
      item({
        scanKeyframes: [{ timeSec: 2.5, lines: [line({ sizePx: 54, id: "k" })] }],
      }),
    );
    expect(e.id).toBe("k");
    expect(e.label).toBe("NEW GAME");
    expect(e.h).toBeCloseTo(54 / 1080, 10);
    expect(e.srcH).toBe(54);
    expect(e.kfTime).toBe(2.5);
    expect(e.removable).toBe(false);
    expect(e.box).toEqual({ x: 0.1, y: 0.2, w: 0.3, h: 0.02 });
  });

  test("keyframe lines without sizePx fall back to the ink box height", () => {
    const [e] = buildTextEntries(
      item({
        scanKeyframes: [
          { timeSec: 0, lines: [line({ box: { x: 0, y: 0, w: 1, h: 0.0213 } })] },
        ],
      }),
    );
    expect(e.h).toBe(0.0213);
    expect(e.srcH).toBe(23); // round(0.0213 × 1080 = 23.004)
    expect(e.kfTime).toBe(0);
  });

  test("unscanned keyframes (lines: null) contribute nothing", () => {
    expect(
      buildTextEntries(item({ scanKeyframes: [{ timeSec: 1, lines: null }] })),
    ).toEqual([]);
  });

  test("boxes come first, then keyframe lines in keyframe order", () => {
    const entries = buildTextEntries(
      item({
        boxes: [{ id: "b1", x: 0, y: 0, w: 0.1, h: 0.1 }],
        scanKeyframes: [
          { timeSec: 1, lines: [line({ id: "k1a" }), line({ id: "k1b" })] },
          { timeSec: 2, lines: null },
          { timeSec: 3, lines: [line({ id: "k3a" })] },
        ],
      }),
    );
    expect(entries.map((e) => [e.id, e.kfTime])).toEqual([
      ["b1", null],
      ["k1a", 1],
      ["k1b", 1],
      ["k3a", 3],
    ]);
  });

  test("the one-shot image scan is not listed (its boxes already are)", () => {
    expect(
      buildTextEntries(item({ scan: { lines: [line()], medianPx: 20 } })),
    ).toEqual([]);
  });
});

describe("lineThumb", () => {
  test("scales the padded region to the max height and maps it to the origin", () => {
    // A 400×40 px line at (100, 200) in a 1920×1080 image.
    const box = { x: 100 / 1920, y: 200 / 1080, w: 400 / 1920, h: 40 / 1080 };
    const t = lineThumb(box, 1920, 1080, 960, 24, 0.25)!;
    // Padded region: 420 × 60 px starting at (90, 190) — height-limited.
    const s = 24 / 60;
    expect(t.height).toBeCloseTo(24);
    expect(t.width).toBeCloseTo(420 * s);
    expect(t.bgWidth).toBeCloseTo(1920 * s);
    expect(t.bgHeight).toBeCloseTo(1080 * s);
    expect(t.bgX).toBeCloseTo(-90 * s);
    expect(t.bgY).toBeCloseTo(-190 * s);
  });

  test("long lines are clipped at the max width, not shrunk", () => {
    const t = lineThumb({ x: 0.1, y: 0.5, w: 0.8, h: 0.02 }, 1920, 1080, 96, 24)!;
    expect(t.width).toBeCloseTo(96);
    expect(t.height).toBeCloseTo(24);
  });

  test("padding clamps at the image edge", () => {
    const t = lineThumb({ x: 0, y: 0, w: 0.5, h: 0.1 }, 1000, 1000, 1000, 1000)!;
    expect(t.bgX).toBeCloseTo(0);
    expect(t.bgY).toBeCloseTo(0);
  });

  test("degenerate input returns null", () => {
    expect(lineThumb({ x: 0, y: 0, w: 0, h: 0.1 }, 100, 100, 10, 10)).toBeNull();
    expect(lineThumb({ x: 0, y: 0, w: 0.1, h: 0.1 }, 0, 100, 10, 10)).toBeNull();
  });
});
