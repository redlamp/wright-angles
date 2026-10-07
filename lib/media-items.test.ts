import { describe, expect, test } from "bun:test";
import type { HighlightBox, KeyframeLine, MediaItem } from "./types";
import {
  addItemBox,
  clearItemDetection,
  compareLibraryOrder,
  hydratedActiveId,
  omitKey,
  removeItem,
  removeItemBox,
  renameItem,
  reorderItems,
  setItemCrop,
  setItemReferenceHeight,
  setItemScan,
  setItemScanKeyframes,
  updateItemBox,
} from "./media-items";

const item = (id: string, extra: Partial<MediaItem> = {}): MediaItem => ({
  id,
  name: id.toUpperCase(),
  type: "image/png",
  kind: "image",
  width: 1920,
  height: 1080,
  referenceHeight: 1080,
  addedAt: 1_700_000_000_000,
  ...extra,
});

const box = (id: string, extra: Partial<HighlightBox> = {}): HighlightBox => ({
  id,
  x: 0.1,
  y: 0.2,
  w: 0.3,
  h: 0.05,
  ...extra,
});

const line: KeyframeLine = {
  id: "l1",
  text: "Hello",
  confidence: 90,
  box: { x: 0, y: 0, w: 0.5, h: 0.1 },
};

const ids = (items: MediaItem[]) => items.map((i) => i.id);

/** Per-item updaters must not touch other items or the input array. */
function expectOthersUntouched(
  before: MediaItem[],
  after: MediaItem[],
  changedId: string,
) {
  expect(after).not.toBe(before);
  expect(after.length).toBe(before.length);
  after.forEach((it, idx) => {
    if (it.id !== changedId) expect(it).toBe(before[idx]);
  });
}

describe("compareLibraryOrder", () => {
  test("manual sortIndex wins; unordered items append in addedAt order", () => {
    const items = [
      item("late", { addedAt: 2_000 }),
      item("b", { sortIndex: 1, addedAt: 9_000 }),
      item("early", { addedAt: 1_000 }),
      item("a", { sortIndex: 0, addedAt: 9_999 }),
    ];
    expect(ids([...items].sort(compareLibraryOrder))).toEqual([
      "a",
      "b",
      "early",
      "late",
    ]);
  });

  test("never-reordered library keeps insertion (addedAt) order", () => {
    const items = [item("c", { addedAt: 3 }), item("a", { addedAt: 1 }), item("b", { addedAt: 2 })];
    expect(ids([...items].sort(compareLibraryOrder))).toEqual(["a", "b", "c"]);
  });
});

describe("hydratedActiveId", () => {
  const items = [item("a"), item("b")];

  test("an already-set selection wins", () => {
    expect(hydratedActiveId("x", "b", items)).toBe("x");
  });

  test("a remembered id that still exists beats the first item", () => {
    expect(hydratedActiveId(null, "b", items)).toBe("b");
  });

  test("a remembered id that no longer exists falls back to the first item", () => {
    expect(hydratedActiveId(null, "gone", items)).toBe("a");
  });

  test("nothing remembered → first item; empty library → null", () => {
    expect(hydratedActiveId(null, null, items)).toBe("a");
    expect(hydratedActiveId(null, null, [])).toBeNull();
    expect(hydratedActiveId(null, "a", [])).toBeNull();
  });
});

describe("renameItem", () => {
  test("renames only the matching item", () => {
    const before = [item("a"), item("b")];
    const after = renameItem(before, "b", "New");
    expect(after[1].name).toBe("New");
    expect(before[1].name).toBe("B");
    expectOthersUntouched(before, after, "b");
  });

  test("unknown id leaves every item untouched", () => {
    const before = [item("a")];
    const after = renameItem(before, "zzz", "New");
    expect(after[0]).toBe(before[0]);
  });
});

describe("box updaters", () => {
  test("addItemBox appends, creating the list when absent", () => {
    const before = [item("a"), item("b", { boxes: [box("1")] })];
    let after = addItemBox(before, "a", box("x"));
    expect(after[0].boxes).toEqual([box("x")]);
    expectOthersUntouched(before, after, "a");
    after = addItemBox(after, "b", box("2"));
    expect(after[1].boxes!.map((b) => b.id)).toEqual(["1", "2"]);
    expect(before[1].boxes!.length).toBe(1);
  });

  test("updateItemBox patches only the matching box", () => {
    const before = [item("a", { boxes: [box("1"), box("2")] })];
    const after = updateItemBox(before, "a", "2", { label: "Title", w: 0.9 });
    expect(after[0].boxes![1]).toEqual(box("2", { label: "Title", w: 0.9 }));
    expect(after[0].boxes![0]).toBe(before[0].boxes![0]);
    expect(before[0].boxes![1].label).toBeUndefined();
  });

  test("updateItemBox with an unknown box id keeps the boxes as-is", () => {
    const before = [item("a", { boxes: [box("1")] })];
    const after = updateItemBox(before, "a", "nope", { label: "x" });
    expect(after[0].boxes).toEqual([box("1")]);
  });

  test("updateItemBox on an item without boxes yields an empty list", () => {
    const after = updateItemBox([item("a")], "a", "1", { label: "x" });
    expect(after[0].boxes).toEqual([]);
  });

  test("removeItemBox drops only the matching box", () => {
    const before = [item("a", { boxes: [box("1"), box("2")] }), item("b")];
    const after = removeItemBox(before, "a", "1");
    expect(after[0].boxes!.map((b) => b.id)).toEqual(["2"]);
    expectOthersUntouched(before, after, "a");
  });

  test("box updaters on an unknown media id touch nothing", () => {
    const before = [item("a", { boxes: [box("1")] })];
    expect(addItemBox(before, "zzz", box("2"))[0]).toBe(before[0]);
    expect(updateItemBox(before, "zzz", "1", { w: 1 })[0]).toBe(before[0]);
    expect(removeItemBox(before, "zzz", "1")[0]).toBe(before[0]);
  });
});

describe("setItemReferenceHeight", () => {
  test("sets the matching item's reference height", () => {
    const before = [item("a"), item("b")];
    const after = setItemReferenceHeight(before, "a", 2160);
    expect(after[0].referenceHeight).toBe(2160);
    expectOthersUntouched(before, after, "a");
  });
});

describe("setItemCrop", () => {
  const crop = { x: 0.1, y: 0.1, w: 0.5, h: 0.5 };

  test("sets a crop", () => {
    const after = setItemCrop([item("a")], "a", crop);
    expect(after[0].crop).toEqual(crop);
  });

  test("clearing drops the key entirely (not crop: undefined)", () => {
    const before = [item("a", { crop })];
    const after = setItemCrop(before, "a", undefined);
    expect("crop" in after[0]).toBe(false);
    expect(before[0].crop).toEqual(crop);
  });

  test("unknown id is a no-op", () => {
    const before = [item("a", { crop })];
    expect(setItemCrop(before, "zzz", undefined)[0]).toBe(before[0]);
  });
});

describe("reorderItems", () => {
  const lib = () => [item("a"), item("b"), item("c"), item("d")];

  test("moves an item and stamps every item's sortIndex with its position", () => {
    const after = reorderItems(lib(), "a", 2)!;
    expect(ids(after)).toEqual(["b", "c", "a", "d"]);
    expect(after.map((i) => i.sortIndex)).toEqual([0, 1, 2, 3]);
  });

  test("moving to the start and to the end", () => {
    expect(ids(reorderItems(lib(), "c", 0)!)).toEqual(["c", "a", "b", "d"]);
    expect(ids(reorderItems(lib(), "a", 3)!)).toEqual(["b", "c", "d", "a"]);
  });

  test("out-of-range targets clamp to the ends", () => {
    expect(ids(reorderItems(lib(), "b", 99)!)).toEqual(["a", "c", "d", "b"]);
    expect(ids(reorderItems(lib(), "c", -5)!)).toEqual(["c", "a", "b", "d"]);
  });

  test("moving to its own index keeps order but still persists sortIndex", () => {
    const after = reorderItems(lib(), "b", 1)!;
    expect(ids(after)).toEqual(["a", "b", "c", "d"]);
    expect(after.map((i) => i.sortIndex)).toEqual([0, 1, 2, 3]);
  });

  test("does not mutate the input", () => {
    const before = lib();
    reorderItems(before, "a", 3);
    expect(ids(before)).toEqual(["a", "b", "c", "d"]);
    expect(before.every((i) => i.sortIndex === undefined)).toBe(true);
  });

  test("unknown id returns null", () => {
    expect(reorderItems(lib(), "zzz", 0)).toBeNull();
    expect(reorderItems([], "a", 0)).toBeNull();
  });
});

describe("clearItemDetection", () => {
  test("drops boxes, scan keyframes and scan; keeps everything else", () => {
    const crop = { x: 0, y: 0, w: 1, h: 1 };
    const before = [
      item("a", {
        boxes: [box("1")],
        scanKeyframes: [{ timeSec: 1, lines: null }],
        scan: { lines: [line], medianPx: 20 },
        crop,
      }),
      item("b", { boxes: [box("2")] }),
    ];
    const after = clearItemDetection(before, "a");
    expect("boxes" in after[0]).toBe(false);
    expect("scanKeyframes" in after[0]).toBe(false);
    expect("scan" in after[0]).toBe(false);
    expect(after[0].crop).toEqual(crop);
    expect(before[0].boxes).toEqual([box("1")]);
    expectOthersUntouched(before, after, "a");
  });
});

describe("setItemScan", () => {
  const scan = { lines: [line], medianPx: 22 };

  test("sets the scan", () => {
    expect(setItemScan([item("a")], "a", scan)[0].scan).toEqual(scan);
  });

  test("undefined drops the key", () => {
    const after = setItemScan([item("a", { scan })], "a", undefined);
    expect("scan" in after[0]).toBe(false);
  });

  test("unknown id is a no-op", () => {
    const before = [item("a", { scan })];
    expect(setItemScan(before, "zzz", undefined)[0]).toBe(before[0]);
  });
});

describe("setItemScanKeyframes", () => {
  const kfs = [
    { timeSec: 0, lines: [line], medianPx: 18 },
    { timeSec: 2.5, lines: null },
  ];

  test("replaces the keyframe list", () => {
    const before = [item("a", { scanKeyframes: [{ timeSec: 9, lines: null }] })];
    expect(setItemScanKeyframes(before, "a", kfs)[0].scanKeyframes).toEqual(kfs);
  });

  test("undefined and empty both drop the key", () => {
    const before = [item("a", { scanKeyframes: kfs })];
    expect("scanKeyframes" in setItemScanKeyframes(before, "a", undefined)[0]).toBe(false);
    expect("scanKeyframes" in setItemScanKeyframes(before, "a", [])[0]).toBe(false);
  });

  test("unknown id is a no-op", () => {
    const before = [item("a", { scanKeyframes: kfs })];
    expect(setItemScanKeyframes(before, "zzz", [])[0]).toBe(before[0]);
  });
});

describe("removeItem", () => {
  const lib = () => [item("a"), item("b"), item("c")];

  test("removing a non-active item keeps the selection", () => {
    expect(removeItem(lib(), "c", "a")).toEqual({
      items: [item("b"), item("c")],
      activeId: "c",
    });
  });

  test("removing the active item falls back to the first remaining item", () => {
    const r = removeItem(lib(), "b", "b");
    expect(ids(r.items)).toEqual(["a", "c"]);
    expect(r.activeId).toBe("a");
    expect(removeItem(lib(), "a", "a").activeId).toBe("b");
  });

  test("removing the last item clears the selection", () => {
    expect(removeItem([item("a")], "a", "a")).toEqual({ items: [], activeId: null });
  });

  test("no selection stays no selection", () => {
    expect(removeItem(lib(), null, "a").activeId).toBeNull();
  });

  test("unknown id keeps every item and the selection", () => {
    const before = lib();
    const r = removeItem(before, "b", "zzz");
    expect(r.items).toEqual(before);
    expect(r.activeId).toBe("b");
  });
});

describe("omitKey", () => {
  test("copies the map without the key", () => {
    const map = { a: "blob:a", b: "blob:b" };
    const out = omitKey(map, "a");
    expect(out).toEqual({ b: "blob:b" });
    expect(map).toEqual({ a: "blob:a", b: "blob:b" });
  });

  test("missing key returns an equal copy, not the same object", () => {
    const map = { a: "blob:a" };
    const out = omitKey(map, "zzz");
    expect(out).toEqual(map);
    expect(out).not.toBe(map);
  });
});
