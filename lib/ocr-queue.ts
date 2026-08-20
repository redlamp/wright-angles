/**
 * Pure batch-scan queue for auto-OCR-on-import. Import fires one scan per
 * newly added item (wiki/research/ocr-cost.md — no debounce needed, the
 * existing single-flight lock in `lib/ocr.ts` already serializes a
 * batch), but the UI still needs to know which item is running and how
 * many are left so a ten-image drop doesn't look frozen. This module is
 * the bookkeeping only; the runner that actually calls the OCR pipeline
 * lives in `stores/ocr-queue-store.ts` (needs zustand + the media store).
 */

export type ScanStatus = "queued" | "running" | "done" | "error";

export interface ScanQueueItem {
  id: string;
  status: ScanStatus;
}

/** Append new ids as queued; ids already present (any status) are left alone. */
export function enqueueScans(
  queue: ScanQueueItem[],
  ids: string[],
): ScanQueueItem[] {
  const existing = new Set(queue.map((q) => q.id));
  const fresh = ids
    .filter((id) => !existing.has(id))
    .map((id): ScanQueueItem => ({ id, status: "queued" }));
  return fresh.length > 0 ? [...queue, ...fresh] : queue;
}

export function startScan(queue: ScanQueueItem[], id: string): ScanQueueItem[] {
  return queue.map((q) => (q.id === id ? { ...q, status: "running" } : q));
}

export function finishScan(
  queue: ScanQueueItem[],
  id: string,
  ok: boolean,
): ScanQueueItem[] {
  return queue.map((q) =>
    q.id === id ? { ...q, status: ok ? "done" : "error" } : q,
  );
}

/**
 * Drop every entry still QUEUED — the "cancel remaining" affordance. A
 * RUNNING entry is left alone: aborting the in-flight `recognize()` needs
 * the caller to hold the live worker reference, which `lib/ocr.ts`
 * doesn't expose today (follow-up, not this task).
 */
export function cancelQueued(queue: ScanQueueItem[]): ScanQueueItem[] {
  return queue.filter((q) => q.status !== "queued");
}

/** The next id waiting to run, in FIFO order, or null when none are queued. */
export function nextQueued(queue: ScanQueueItem[]): string | null {
  return queue.find((q) => q.status === "queued")?.id ?? null;
}

/** True while the batch still has work outstanding (queued or running). */
export function isBatchActive(queue: ScanQueueItem[]): boolean {
  return queue.some((q) => q.status === "queued" || q.status === "running");
}

/**
 * "Scanning N of M…" while the batch is active, else null. N counts the
 * item currently running (or about to be, if the loop hasn't ticked yet)
 * as position `settled + 1`.
 */
export function batchLabel(queue: ScanQueueItem[]): string | null {
  if (!isBatchActive(queue)) return null;
  const total = queue.length;
  const settled = queue.filter(
    (q) => q.status === "done" || q.status === "error",
  ).length;
  return `Detecting text — ${Math.min(settled + 1, total)} of ${total}…`;
}

/** Once the batch is fully settled, drop it so the queue doesn't grow
 * across every import a session ever does. */
export function pruneSettled(queue: ScanQueueItem[]): ScanQueueItem[] {
  return isBatchActive(queue) ? queue : [];
}
