"use client";

import type { MediaItem } from "@/lib/types";
import { idbGetMedia, idbPutMedia } from "@/lib/idb";
import {
  pickUndoFields,
  restoreUndoFields,
  sameUndoFields,
  type MediaUndoFields,
} from "@/lib/media-history";
import {
  recordChange,
  registerHistoryDomain,
  withoutHistory,
} from "@/stores/history-store";

/**
 * Media-store side effects for per-item metadata edits: the IndexedDB
 * metadata write and undo/redo (stores/history-store.ts). Split out of
 * stores/media-store.ts, which wires them into its actions.
 */

type ItemsGet = () => { items: MediaItem[] };
type ItemsSet = (
  fn: (s: { items: MediaItem[] }) => { items: MediaItem[] },
) => void;

/** Re-write one item's metadata beside its stored blob(s), by id — a
 * single-record read/write, not a scan of the whole library. */
export function persistItemMeta(item: MediaItem) {
  void idbGetMedia(item.id).then((rec) => {
    if (rec) void idbPutMedia(item.id, { ...rec, meta: item });
  });
}

/** Re-write an item's metadata beside its stored blob(s). */
export function persistMeta(get: ItemsGet, id: string) {
  const item = get().items.find((i) => i.id === id);
  if (item) persistItemMeta(item);
}

/**
 * One metadata edit on one item: apply, persist, and record it as an
 * undo step labelled `label`, coalescing on `key`. A null label is a
 * machine edit (OCR results): not undoable, and it drops the item's
 * older steps, whose snapshots it made stale.
 */
export function editItem(
  set: ItemsSet,
  get: ItemsGet,
  id: string,
  label: string | null,
  update: (items: MediaItem[]) => MediaItem[],
  key?: string,
) {
  const before = pickUndoFields(get().items, id);
  set((s) => ({ items: update(s.items) }));
  persistMeta(get, id);
  const after = pickUndoFields(get().items, id);
  if (!before || !after) return;
  const scope = `media:${id}`;
  if (label === null) {
    withoutHistory(() => recordChange({ scope, label: "", before, after }));
  } else if (!sameUndoFields(before, after)) {
    recordChange({ scope, label, key, before, after });
  }
}

/**
 * Undo/redo restores through the same IndexedDB metadata write as an
 * edit. A deleted item can't be restored to: its steps are skipped.
 */
export function registerMediaUndo(store: {
  getState: ItemsGet;
  setState: ItemsSet;
}) {
  registerHistoryDomain("media", {
    restore: (scope, snap) => {
      const id = scope.slice("media:".length);
      if (!store.getState().items.some((i) => i.id === id)) return false;
      store.setState((s) => ({
        items: restoreUndoFields(s.items, id, snap as MediaUndoFields),
      }));
      persistMeta(store.getState, id);
      return true;
    },
    same: (a, b) => sameUndoFields(a as MediaUndoFields, b as MediaUndoFields),
  });
}
