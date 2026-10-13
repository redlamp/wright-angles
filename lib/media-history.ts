/**
 * The undoable slice of a media item: the cheap metadata edits (name,
 * reference height, crop, measure boxes and the detection behind them).
 * Blobs, import and deletion are deliberately out of scope — deletion
 * keeps its confirm dialog. Pure; stores/media-store.ts records and
 * restores these through stores/history-store.ts.
 */
import type { MediaItem } from "@/lib/types";

const UNDO_FIELDS = [
  "name",
  "referenceHeight",
  "crop",
  "boxes",
  "scan",
  "scanKeyframes",
] as const;

export type MediaUndoFields = Pick<MediaItem, (typeof UNDO_FIELDS)[number]>;

/** The item's undoable fields, or null when the id isn't in the list. */
export function pickUndoFields(
  items: MediaItem[],
  id: string,
): MediaUndoFields | null {
  const item = items.find((i) => i.id === id);
  if (!item) return null;
  const out: Partial<MediaUndoFields> = {};
  for (const k of UNDO_FIELDS) {
    if (item[k] !== undefined) Object.assign(out, { [k]: item[k] });
  }
  return out as MediaUndoFields;
}

export const sameUndoFields = (a: MediaUndoFields, b: MediaUndoFields) =>
  UNDO_FIELDS.every(
    (k) => a[k] === b[k] || JSON.stringify(a[k]) === JSON.stringify(b[k]),
  );

/**
 * Put a snapshot back on its item. Fields absent from the snapshot are
 * dropped from the item (a restored "no crop" persists crop-free, like
 * setItemCrop's clear). Every other item is untouched by reference.
 */
export const restoreUndoFields = (
  items: MediaItem[],
  id: string,
  fields: MediaUndoFields,
) =>
  items.map((i) => {
    if (i.id !== id) return i;
    const next = { ...i };
    for (const k of UNDO_FIELDS) delete (next as Partial<MediaItem>)[k];
    return { ...next, ...fields };
  });
