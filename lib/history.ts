/**
 * Generic undo/redo history over before/after snapshots. Pure: every
 * function takes a history and returns a new one; the stores
 * (stores/history-store.ts) own applying snapshots and the side effects.
 *
 * Each entry belongs to a `scope` (e.g. "devices", "media:<id>") so a
 * change made OUTSIDE history (an OCR pass rewriting an item's boxes)
 * can drop the entries it invalidated without touching the rest.
 *
 * Rapid continuous edits (a slider drag, typing into a field) coalesce:
 * a record with the same `key` as the newest entry, within
 * `coalesceMs` of that entry's LAST update, extends it instead of
 * adding a step — one Ctrl+Z undoes the whole drag.
 */

export interface HistoryEntry<T> {
  /** Shown in the "Undid: …" status ("Distance (Steam Deck)"). */
  label: string;
  scope: string;
  /** Coalescing key; entries without one never merge. */
  key?: string;
  before: T;
  after: T;
  /** Time (ms) of the entry's most recent update. */
  at: number;
}

export interface History<T> {
  /** Oldest first; the last entry is the next undo. */
  past: HistoryEntry<T>[];
  /** Nearest first; the first entry is the next redo. */
  future: HistoryEntry<T>[];
}

export interface RecordOptions<T> {
  /** Maximum undo steps kept (oldest dropped). */
  limit?: number;
  /** Merge window for same-key records, in ms. */
  coalesceMs?: number;
  /** Snapshot equality: a merged entry that nets to no change is dropped. */
  same?: (a: T, b: T) => boolean;
}

export const HISTORY_LIMIT = 100;
export const COALESCE_MS = 500;

export const emptyHistory = <T>(): History<T> => ({ past: [], future: [] });

/** Push a change; clears the redo stack. */
export function record<T>(
  h: History<T>,
  entry: HistoryEntry<T>,
  opts: RecordOptions<T> = {},
): History<T> {
  const limit = Math.max(1, opts.limit ?? HISTORY_LIMIT);
  const window = opts.coalesceMs ?? COALESCE_MS;
  const last = h.past[h.past.length - 1];
  let past: HistoryEntry<T>[];
  if (
    last &&
    entry.key !== undefined &&
    last.key === entry.key &&
    last.scope === entry.scope &&
    entry.at - last.at <= window &&
    // An undo/redo since the last record breaks the run: future is
    // non-empty exactly then.
    h.future.length === 0
  ) {
    const merged = { ...entry, before: last.before };
    past = h.past.slice(0, -1);
    if (!opts.same?.(merged.before, merged.after)) past.push(merged);
  } else {
    past = [...h.past, entry];
  }
  if (past.length > limit) past = past.slice(past.length - limit);
  return { past, future: [] };
}

/** Step back: the entry whose `before` should be applied, or null. */
export function undo<T>(
  h: History<T>,
): { history: History<T>; entry: HistoryEntry<T> } | null {
  const entry = h.past[h.past.length - 1];
  if (!entry) return null;
  return {
    entry,
    history: { past: h.past.slice(0, -1), future: [entry, ...h.future] },
  };
}

/** Step forward: the entry whose `after` should be applied, or null. */
export function redo<T>(
  h: History<T>,
): { history: History<T>; entry: HistoryEntry<T> } | null {
  const entry = h.future[0];
  if (!entry) return null;
  return {
    entry,
    history: { past: [...h.past, entry], future: h.future.slice(1) },
  };
}

/** Remove every entry (both stacks) in a scope. */
export function dropScope<T>(h: History<T>, scope: string): History<T> {
  const keep = (e: HistoryEntry<T>) => e.scope !== scope;
  if (h.past.every(keep) && h.future.every(keep)) return h;
  return { past: h.past.filter(keep), future: h.future.filter(keep) };
}
