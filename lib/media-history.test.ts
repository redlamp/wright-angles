import { describe, expect, test } from "bun:test";
import {
  pickUndoFields,
  restoreUndoFields,
  sameUndoFields,
} from "./media-history";
import { clearItemDetection, removeItemBox, setItemCrop } from "./media-items";
import type { MediaItem } from "./types";

const item = (id: string, patch: Partial<MediaItem> = {}): MediaItem => ({
  id,
  name: `${id}.png`,
  type: "image/png",
  kind: "image",
  width: 1920,
  height: 1080,
  referenceHeight: 1080,
  addedAt: 1,
  ...patch,
});

const box = { id: "b1", x: 0.1, y: 0.1, w: 0.2, h: 0.05 };
const items = [
  item("a", { boxes: [box], crop: { x: 0, y: 0, w: 0.5, h: 0.5 } }),
  item("b"),
];

describe("media undo fields", () => {
  test("pick takes only the undoable fields, null for unknown ids", () => {
    expect(pickUndoFields(items, "a")).toEqual({
      name: "a.png",
      referenceHeight: 1080,
      crop: { x: 0, y: 0, w: 0.5, h: 0.5 },
      boxes: [box],
    });
    expect(pickUndoFields(items, "zzz")).toBeNull();
  });

  test("round trip: an edit restored from its before snapshot", () => {
    const before = pickUndoFields(items, "a")!;
    const edited = clearItemDetection(setItemCrop(items, "a", undefined), "a");
    expect(edited[0].crop).toBeUndefined();
    expect(edited[0].boxes).toBeUndefined();
    const restored = restoreUndoFields(edited, "a", before);
    expect(restored[0]).toEqual(items[0]);
  });

  test("restoring drops fields the snapshot lacks (no stray crop key)", () => {
    const after = pickUndoFields(setItemCrop(items, "a", undefined), "a")!;
    const restored = restoreUndoFields(items, "a", after);
    expect("crop" in restored[0]).toBe(false);
  });

  test("restore leaves other items and non-undo fields alone", () => {
    const withSort = [{ ...items[0], sortIndex: 3 }, items[1]];
    const restored = restoreUndoFields(withSort, "a", { name: "x", referenceHeight: 720 });
    expect(restored[1]).toBe(items[1]);
    expect(restored[0]).toMatchObject({ sortIndex: 3, width: 1920, name: "x" });
  });

  test("sameUndoFields is by value", () => {
    const x = pickUndoFields(items, "a")!;
    const y = pickUndoFields(removeItemBox(items, "a", "nope"), "a")!;
    expect(sameUndoFields(x, y)).toBe(true);
    const z = pickUndoFields(removeItemBox(items, "a", "b1"), "a")!;
    expect(sameUndoFields(x, z)).toBe(false);
  });
});
