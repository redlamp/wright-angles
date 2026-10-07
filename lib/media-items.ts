/**
 * Pure state transitions over the media library (stores/media-store.ts).
 * Each takes plain data and returns new data; the store wraps them with
 * the side effects (IndexedDB writes, object URLs, localStorage).
 *
 * Per-item updaters map over the whole list and leave every other item
 * (and an unknown id) untouched by reference.
 */
import type {
  HighlightBox,
  KeyframeLine,
  MediaCrop,
  MediaItem,
  ScanKeyframe,
} from "@/lib/types";

/**
 * Library sort for hydrated records. Manual order wins; items never
 * reordered keep insertion order (sortIndex is a small int, addedAt an
 * epoch — unordered items sort after every manually placed one, i.e.
 * append).
 */
export const compareLibraryOrder = (a: MediaItem, b: MediaItem) =>
  (a.sortIndex ?? a.addedAt) - (b.sortIndex ?? b.addedAt);

/**
 * Active id after hydration: an already-set selection, else the
 * remembered one (if it still exists), else the first item. The
 * remembered selection wins over "first item" — a refresh must not hop
 * back to whatever sorts first.
 */
export function hydratedActiveId(
  current: string | null,
  remembered: string | null,
  items: MediaItem[],
): string | null {
  const rememberedValid =
    remembered !== null && items.some((i) => i.id === remembered)
      ? remembered
      : null;
  return current ?? rememberedValid ?? items[0]?.id ?? null;
}

export const renameItem = (items: MediaItem[], id: string, name: string) =>
  items.map((i) => (i.id === id ? { ...i, name } : i));

export const addItemBox = (
  items: MediaItem[],
  mediaId: string,
  box: HighlightBox,
) =>
  items.map((i) =>
    i.id === mediaId ? { ...i, boxes: [...(i.boxes ?? []), box] } : i,
  );

export const updateItemBox = (
  items: MediaItem[],
  mediaId: string,
  boxId: string,
  patch: Partial<HighlightBox>,
) =>
  items.map((i) =>
    i.id === mediaId
      ? {
          ...i,
          boxes: (i.boxes ?? []).map((b) =>
            b.id === boxId ? { ...b, ...patch } : b,
          ),
        }
      : i,
  );

export const removeItemBox = (
  items: MediaItem[],
  mediaId: string,
  boxId: string,
) =>
  items.map((i) =>
    i.id === mediaId
      ? { ...i, boxes: (i.boxes ?? []).filter((b) => b.id !== boxId) }
      : i,
  );

export const setItemReferenceHeight = (
  items: MediaItem[],
  id: string,
  referenceHeight: number,
) => items.map((i) => (i.id === id ? { ...i, referenceHeight } : i));

export const setItemCrop = (
  items: MediaItem[],
  id: string,
  crop: MediaCrop | undefined,
) =>
  items.map((i) => {
    if (i.id !== id) return i;
    if (!crop) {
      // Drop the key entirely so cleared items persist crop-free.
      const rest = { ...i };
      delete rest.crop;
      return rest;
    }
    return { ...i, crop };
  });

/**
 * Move an item to a library position (clamped to the list). The array
 * order becomes the persisted manual order: every item gets its new
 * index as sortIndex. null when the id isn't in the list.
 */
export function reorderItems(
  items: MediaItem[],
  id: string,
  toIndex: number,
): MediaItem[] | null {
  const from = items.findIndex((i) => i.id === id);
  if (from < 0) return null;
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(toIndex, next.length)), 0, moved);
  return next.map((i, idx) => ({ ...i, sortIndex: idx }));
}

/** Drop ALL boxes, scan keyframes and the one-shot scan from an item. */
export const clearItemDetection = (items: MediaItem[], id: string) =>
  items.map((i) => {
    if (i.id !== id) return i;
    const rest = { ...i };
    delete rest.boxes;
    delete rest.scanKeyframes;
    delete rest.scan;
    return rest;
  });

export const setItemScan = (
  items: MediaItem[],
  id: string,
  scan: { lines: KeyframeLine[]; medianPx: number } | undefined,
) =>
  items.map((i) => {
    if (i.id !== id) return i;
    if (!scan) {
      const rest = { ...i };
      delete rest.scan;
      return rest;
    }
    return { ...i, scan };
  });

/** Replace the item's keyframe list; empty/undefined drops the key. */
export const setItemScanKeyframes = (
  items: MediaItem[],
  id: string,
  scanKeyframes: ScanKeyframe[] | undefined,
) =>
  items.map((i) => {
    if (i.id !== id) return i;
    if (!scanKeyframes || scanKeyframes.length === 0) {
      const rest = { ...i };
      delete rest.scanKeyframes;
      return rest;
    }
    return { ...i, scanKeyframes };
  });

/**
 * Library after removing an item: the remaining items, and the active id
 * (falls back to the first remaining item when the active one is
 * removed, null when none are left).
 */
export function removeItem(
  items: MediaItem[],
  activeId: string | null,
  id: string,
): { items: MediaItem[]; activeId: string | null } {
  const remaining = items.filter((i) => i.id !== id);
  return {
    items: remaining,
    activeId: activeId === id ? (remaining[0]?.id ?? null) : activeId,
  };
}

/** Shallow copy of a URL map without one key. */
export function omitKey(
  map: Record<string, string>,
  id: string,
): Record<string, string> {
  const next = { ...map };
  delete next[id];
  return next;
}
