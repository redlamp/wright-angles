"use client";

import { create } from "zustand";
import {
  cancelQueued,
  enqueueScans,
  finishScan,
  nextQueued,
  pruneSettled,
  startScan,
  type ScanQueueItem,
} from "@/lib/ocr-queue";
import { detectTextForItem, scanFirstFrame } from "@/lib/scan-actions";
import { isAnimatedItem } from "@/lib/playback-engine";
import { keyframeAt } from "@/lib/scan-keyframes";
import { useMediaStore } from "./media-store";

/**
 * Runs the auto-scan-on-import batch: `stores/media-store.ts`'s
 * `addFiles` enqueues every newly imported item once the whole batch
 * resolves, and this store works the queue one item at a time, exposing
 * per-item status (for the library row) and a "Detecting text — N of
 * M…" label (for a lightweight batch indicator). The queue bookkeeping
 * itself is pure (`lib/ocr-queue.ts`); this file is just the runner loop
 * plus the DOM-touching call into the OCR pipeline.
 *
 * Only one scan runs at a time — `lib/ocr.ts` already enforces that with
 * a module-level single-flight lock, so this loop mirrors it rather than
 * fighting it, and it's what lets the UI show which item is running.
 */
interface OcrQueueState {
  queue: ScanQueueItem[];
  /** True while the runner loop is actively working the queue. */
  running: boolean;
  /** Queue newly imported items for auto-scan; starts the runner if idle. */
  enqueue: (ids: string[]) => void;
  /** Drop every not-yet-started item. The in-flight scan finishes on its
   * own — aborting it needs the worker reference, which lib/ocr.ts
   * doesn't expose today (follow-up, not this task). */
  cancelRemaining: () => void;
}

// Per-item status is read via `useOcrQueueStore((s) => s.queue.find(...))`
// at the callsite (media-library.tsx) rather than a `statusOf` method —
// a method call in a selector doesn't establish a reactive subscription
// the way selecting the underlying state does.
export const useOcrQueueStore = create<OcrQueueState>()((set) => ({
  queue: [],
  running: false,

  enqueue: (ids) => {
    if (ids.length === 0) return;
    set((s) => ({ queue: enqueueScans(s.queue, ids) }));
    void runLoop();
  },

  cancelRemaining: () => set((s) => ({ queue: cancelQueued(s.queue) })),
}));

/** Serial runner: pops the next queued id, scans it, records the
 * outcome, repeats until the queue has nothing left to start. A second
 * call while one is already running is a no-op — `enqueue` fires it
 * after every batch, but only one loop instance should ever be walking
 * the queue. */
async function runLoop(): Promise<void> {
  if (useOcrQueueStore.getState().running) return;
  useOcrQueueStore.setState({ running: true });
  try {
    for (;;) {
      const id = nextQueued(useOcrQueueStore.getState().queue);
      if (!id) break;
      useOcrQueueStore.setState((s) => ({ queue: startScan(s.queue, id) }));
      const ok = await runOneScan(id);
      useOcrQueueStore.setState((s) => ({
        queue: finishScan(s.queue, id, ok),
      }));
    }
  } finally {
    useOcrQueueStore.setState((s) => ({
      running: false,
      queue: pruneSettled(s.queue),
    }));
  }
}

async function runOneScan(id: string): Promise<boolean> {
  const item = useMediaStore.getState().items.find((i) => i.id === id);
  if (!item) return false; // Removed from the library before its turn came up.
  // Already scanned (e.g. the seeded gradient, or a re-enqueue race) —
  // per the requirement, don't rescan something already cached. For
  // timeline media that means specifically a t=0 keyframe WITH lines —
  // a bare unscanned marker at another time isn't this scan's job.
  const alreadyScanned = isAnimatedItem(item)
    ? !!keyframeAt(item.scanKeyframes ?? [], 0)?.lines
    : !!item.scan;
  if (alreadyScanned) return true;
  try {
    if (isAnimatedItem(item)) {
      await scanFirstFrame(id);
    } else {
      await detectTextForItem(id);
    }
    return true;
  } catch (err) {
    console.warn("Auto text detection failed:", err);
    return false;
  }
}
