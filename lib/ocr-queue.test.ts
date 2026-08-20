import { describe, expect, test } from "bun:test";
import {
  batchLabel,
  cancelQueued,
  enqueueScans,
  finishScan,
  isBatchActive,
  nextQueued,
  pruneSettled,
  startScan,
  type ScanQueueItem,
} from "./ocr-queue";

describe("enqueueScans", () => {
  test("appends new ids as queued", () => {
    expect(enqueueScans([], ["a", "b"])).toEqual([
      { id: "a", status: "queued" },
      { id: "b", status: "queued" },
    ]);
  });

  test("ignores ids already present, regardless of status", () => {
    const queue: ScanQueueItem[] = [{ id: "a", status: "running" }];
    expect(enqueueScans(queue, ["a", "b"])).toEqual([
      { id: "a", status: "running" },
      { id: "b", status: "queued" },
    ]);
  });

  test("empty ids is a no-op (same array, not a copy)", () => {
    const queue: ScanQueueItem[] = [{ id: "a", status: "queued" }];
    expect(enqueueScans(queue, [])).toBe(queue);
  });
});

describe("startScan / finishScan", () => {
  test("startScan flips only the targeted id to running", () => {
    const queue: ScanQueueItem[] = [
      { id: "a", status: "queued" },
      { id: "b", status: "queued" },
    ];
    expect(startScan(queue, "a")).toEqual([
      { id: "a", status: "running" },
      { id: "b", status: "queued" },
    ]);
  });

  test("finishScan(ok=true) marks done, ok=false marks error", () => {
    const queue: ScanQueueItem[] = [{ id: "a", status: "running" }];
    expect(finishScan(queue, "a", true)).toEqual([
      { id: "a", status: "done" },
    ]);
    expect(finishScan(queue, "a", false)).toEqual([
      { id: "a", status: "error" },
    ]);
  });
});

describe("cancelQueued", () => {
  test("drops queued entries, keeps running/done/error", () => {
    const queue: ScanQueueItem[] = [
      { id: "a", status: "done" },
      { id: "b", status: "running" },
      { id: "c", status: "queued" },
      { id: "d", status: "error" },
    ];
    expect(cancelQueued(queue)).toEqual([
      { id: "a", status: "done" },
      { id: "b", status: "running" },
      { id: "d", status: "error" },
    ]);
  });
});

describe("nextQueued", () => {
  test("returns the first queued id, FIFO", () => {
    const queue: ScanQueueItem[] = [
      { id: "a", status: "done" },
      { id: "b", status: "queued" },
      { id: "c", status: "queued" },
    ];
    expect(nextQueued(queue)).toBe("b");
  });

  test("null when nothing is queued", () => {
    expect(nextQueued([{ id: "a", status: "running" }])).toBeNull();
    expect(nextQueued([])).toBeNull();
  });
});

describe("isBatchActive", () => {
  test("true with a queued or running entry", () => {
    expect(isBatchActive([{ id: "a", status: "queued" }])).toBe(true);
    expect(isBatchActive([{ id: "a", status: "running" }])).toBe(true);
  });

  test("false once everything is done/error, or empty", () => {
    expect(isBatchActive([{ id: "a", status: "done" }])).toBe(false);
    expect(isBatchActive([{ id: "a", status: "error" }])).toBe(false);
    expect(isBatchActive([])).toBe(false);
  });
});

describe("batchLabel", () => {
  test("null for an inactive (empty or fully settled) queue", () => {
    expect(batchLabel([])).toBeNull();
    expect(batchLabel([{ id: "a", status: "done" }])).toBeNull();
  });

  test("counts the running item as its 1-based position", () => {
    const queue: ScanQueueItem[] = [
      { id: "a", status: "done" },
      { id: "b", status: "running" },
      { id: "c", status: "queued" },
    ];
    expect(batchLabel(queue)).toBe("Detecting text — 2 of 3…");
  });

  test("before the runner has ticked (all queued), position 1", () => {
    const queue: ScanQueueItem[] = [
      { id: "a", status: "queued" },
      { id: "b", status: "queued" },
    ];
    expect(batchLabel(queue)).toBe("Detecting text — 1 of 2…");
  });
});

describe("pruneSettled", () => {
  test("clears a fully settled queue", () => {
    expect(
      pruneSettled([
        { id: "a", status: "done" },
        { id: "b", status: "error" },
      ]),
    ).toEqual([]);
  });

  test("leaves an active queue untouched", () => {
    const queue: ScanQueueItem[] = [{ id: "a", status: "running" }];
    expect(pruneSettled(queue)).toBe(queue);
  });
});
