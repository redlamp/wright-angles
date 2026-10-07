"use client";

import { LoaderCircleIcon, TriangleAlertIcon } from "lucide-react";
import { batchLabel } from "@/lib/ocr-queue";
import { useOcrQueueStore } from "@/stores/ocr-queue-store";
import { useMediaStore } from "@/stores/media-store";

/**
 * Lightweight batch indicator for auto-scan-on-import ("a ten-image
 * import doesn't look frozen"): a status line plus "Cancel", which
 * aborts the scan in progress and drops the rest of the batch.
 */
export function AutoScanBanner() {
  const queue = useOcrQueueStore((s) => s.queue);
  const cancelRemaining = useOcrQueueStore((s) => s.cancelRemaining);
  const label = batchLabel(queue);
  if (!label) return null;
  const cancellable = queue.some(
    (q) => q.status === "queued" || q.status === "running",
  );
  return (
    <div className="flex h-8 items-center justify-between gap-2 border-t border-border px-2.5 text-sm text-muted-foreground">
      <span className="flex items-center gap-1.5 truncate">
        <LoaderCircleIcon className="size-3.5 shrink-0 animate-spin" />
        {label}
      </span>
      {cancellable ? (
        <button
          type="button"
          className="shrink-0 underline-offset-2 hover:text-foreground hover:underline"
          onClick={cancelRemaining}
        >
          Cancel
        </button>
      ) : null}
    </div>
  );
}

/**
 * "N files couldn't be read: a.heic, b.tiff" — addFiles() no longer
 * swallows decode failures; this is where they surface. Dismissible,
 * same shape as AutoScanBanner.
 */
export function ImportErrorsBanner() {
  const errors = useMediaStore((s) => s.lastImportErrors);
  const clearImportErrors = useMediaStore((s) => s.clearImportErrors);
  if (errors.length === 0) return null;
  return (
    <div className="flex h-8 items-center justify-between gap-2 border-t border-border px-2.5 text-sm text-[#e5484d]">
      <span className="flex items-center gap-1.5 truncate">
        <TriangleAlertIcon className="size-3.5 shrink-0" />
        {errors.length === 1
          ? `1 file couldn't be read: ${errors[0]}`
          : `${errors.length} files couldn't be read: ${errors.join(", ")}`}
      </span>
      <button
        type="button"
        aria-label="Dismiss"
        className="shrink-0 underline-offset-2 hover:text-foreground hover:underline"
        onClick={clearImportErrors}
      >
        Dismiss
      </button>
    </div>
  );
}
