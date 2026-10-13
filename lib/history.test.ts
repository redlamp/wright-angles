import { describe, expect, test } from "bun:test";
import {
  COALESCE_MS,
  dropScope,
  emptyHistory,
  record,
  redo,
  undo,
  type History,
  type HistoryEntry,
} from "./history";

const e = (
  before: number,
  after: number,
  at: number,
  extra: Partial<HistoryEntry<number>> = {},
): HistoryEntry<number> => ({
  label: `${before}→${after}`,
  scope: "s",
  before,
  after,
  at,
  ...extra,
});

const same = (a: number, b: number) => a === b;

describe("record / undo / redo", () => {
  test("undo on empty history is null; so is redo", () => {
    expect(undo(emptyHistory())).toBeNull();
    expect(redo(emptyHistory())).toBeNull();
  });

  test("undo returns the newest entry and moves it to future", () => {
    let h = record(emptyHistory<number>(), e(0, 1, 0));
    h = record(h, e(1, 2, 1000));
    const u = undo(h)!;
    expect(u.entry.before).toBe(1);
    expect(u.history.past).toHaveLength(1);
    expect(u.history.future).toHaveLength(1);
    const r = redo(u.history)!;
    expect(r.entry.after).toBe(2);
    expect(r.history).toEqual(h);
  });

  test("walks all the way back and forward again", () => {
    let h: History<number> = emptyHistory();
    for (let i = 0; i < 5; i++) h = record(h, e(i, i + 1, i * 1000));
    const undone: number[] = [];
    for (let s = undo(h); s; s = undo(h)) {
      undone.push(s.entry.before);
      h = s.history;
    }
    expect(undone).toEqual([4, 3, 2, 1, 0]);
    const redone: number[] = [];
    for (let s = redo(h); s; s = redo(h)) {
      redone.push(s.entry.after);
      h = s.history;
    }
    expect(redone).toEqual([1, 2, 3, 4, 5]);
  });

  test("a new record clears the redo stack", () => {
    let h = record(emptyHistory<number>(), e(0, 1, 0));
    h = undo(h)!.history;
    expect(h.future).toHaveLength(1);
    h = record(h, e(0, 7, 5000));
    expect(h.future).toHaveLength(0);
    expect(h.past.map((x) => x.after)).toEqual([7]);
  });

  test("caps the past at the limit, dropping the oldest", () => {
    let h: History<number> = emptyHistory();
    for (let i = 0; i < 10; i++) h = record(h, e(i, i + 1, i * 1000), { limit: 3 });
    expect(h.past.map((x) => x.before)).toEqual([7, 8, 9]);
  });

  test("default limit is 100", () => {
    let h: History<number> = emptyHistory();
    for (let i = 0; i < 150; i++) h = record(h, e(i, i + 1, i * 1000));
    expect(h.past).toHaveLength(100);
    expect(h.past[0].before).toBe(50);
  });
});

describe("coalescing", () => {
  test("same key within the window merges into one entry", () => {
    let h = record(emptyHistory<number>(), e(0, 1, 0, { key: "k" }));
    h = record(h, e(1, 2, 200, { key: "k" }));
    h = record(h, e(2, 3, 400, { key: "k" }));
    expect(h.past).toHaveLength(1);
    expect(h.past[0]).toMatchObject({ before: 0, after: 3, at: 400 });
  });

  test("the window slides with each update (a long drag stays one step)", () => {
    let h: History<number> = emptyHistory();
    for (let i = 0; i < 20; i++) {
      h = record(h, e(i, i + 1, i * (COALESCE_MS - 1), { key: "k" }));
    }
    expect(h.past).toHaveLength(1);
    expect(h.past[0]).toMatchObject({ before: 0, after: 20 });
  });

  test("a pause longer than the window starts a new step", () => {
    let h = record(emptyHistory<number>(), e(0, 1, 0, { key: "k" }));
    h = record(h, e(1, 2, COALESCE_MS + 1, { key: "k" }));
    expect(h.past).toHaveLength(2);
  });

  test("custom window", () => {
    let h = record(emptyHistory<number>(), e(0, 1, 0, { key: "k" }));
    h = record(h, e(1, 2, 900, { key: "k" }), { coalesceMs: 1000 });
    expect(h.past).toHaveLength(1);
  });

  test("different keys, different scopes, or no key never merge", () => {
    let h = record(emptyHistory<number>(), e(0, 1, 0, { key: "a" }));
    h = record(h, e(1, 2, 10, { key: "b" }));
    h = record(h, e(2, 3, 20, { key: "b", scope: "other" }));
    h = record(h, e(3, 4, 30));
    h = record(h, e(4, 5, 40));
    expect(h.past).toHaveLength(5);
  });

  test("an undo in between breaks the run", () => {
    let h = record(emptyHistory<number>(), e(0, 1, 0, { key: "k" }));
    h = record(h, e(1, 2, 1000, { key: "k" }));
    h = undo(h)!.history;
    h = record(h, e(1, 5, 1100, { key: "k" }));
    expect(h.past.map((x) => [x.before, x.after])).toEqual([
      [0, 1],
      [1, 5],
    ]);
  });

  test("a merge that nets to no change is dropped (with `same`)", () => {
    let h = record(emptyHistory<number>(), e(0, 1, 0, { key: "k" }), { same });
    h = record(h, e(1, 0, 100, { key: "k" }), { same });
    expect(h.past).toHaveLength(0);
  });

  test("without `same`, a net no-op merge is kept", () => {
    let h = record(emptyHistory<number>(), e(0, 1, 0, { key: "k" }));
    h = record(h, e(1, 0, 100, { key: "k" }));
    expect(h.past).toHaveLength(1);
  });
});

describe("dropScope", () => {
  test("removes a scope's entries from both stacks", () => {
    let h = record(emptyHistory<number>(), e(0, 1, 0, { scope: "a" }));
    h = record(h, e(1, 2, 1000, { scope: "b" }));
    h = record(h, e(2, 3, 2000, { scope: "a" }));
    h = undo(h)!.history;
    const d = dropScope(h, "a");
    expect(d.past.map((x) => x.scope)).toEqual(["b"]);
    expect(d.future).toHaveLength(0);
  });

  test("returns the same history when nothing matches", () => {
    const h = record(emptyHistory<number>(), e(0, 1, 0));
    expect(dropScope(h, "zzz")).toBe(h);
  });

  test("inputs are never mutated", () => {
    const h = record(emptyHistory<number>(), e(0, 1, 0, { key: "k" }));
    const snapshot = JSON.stringify(h);
    record(h, e(1, 2, 10, { key: "k" }));
    undo(h);
    dropScope(h, "s");
    expect(JSON.stringify(h)).toBe(snapshot);
  });
});
