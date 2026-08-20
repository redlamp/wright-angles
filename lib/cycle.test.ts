import { describe, expect, test } from "bun:test";
import { cycleId } from "./cycle";

const items = [{ id: "a" }, { id: "b" }, { id: "c" }];

describe("cycleId", () => {
  test("empty list returns null regardless of direction", () => {
    expect(cycleId([], "a", 1)).toBeNull();
    expect(cycleId([], null, -1)).toBeNull();
  });

  test("steps forward and wraps from the last item to the first", () => {
    expect(cycleId(items, "a", 1)).toBe("b");
    expect(cycleId(items, "c", 1)).toBe("a");
  });

  test("steps backward and wraps from the first item to the last", () => {
    expect(cycleId(items, "b", -1)).toBe("a");
    expect(cycleId(items, "a", -1)).toBe("c");
  });

  test("no current selection: forward starts at the first item", () => {
    expect(cycleId(items, null, 1)).toBe("a");
  });

  test("no current selection: backward starts at the last item", () => {
    expect(cycleId(items, null, -1)).toBe("c");
  });

  test("a stale id not present in the list is treated like no selection", () => {
    expect(cycleId(items, "gone", 1)).toBe("a");
    expect(cycleId(items, "gone", -1)).toBe("c");
  });

  test("a single-item list always returns that item", () => {
    const one = [{ id: "solo" }];
    expect(cycleId(one, "solo", 1)).toBe("solo");
    expect(cycleId(one, "solo", -1)).toBe("solo");
    expect(cycleId(one, null, 1)).toBe("solo");
  });
});
