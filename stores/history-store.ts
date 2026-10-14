"use client";

import { create } from "zustand";
import {
  dropScope,
  emptyHistory,
  record,
  redo,
  undo,
  type History,
  type HistoryEntry,
} from "@/lib/history";

/**
 * App-wide undo/redo: ONE linear history across the stores that opt in
 * (device-store, media-store), over the pure lib/history.ts. Each store
 * registers a domain that knows how to put a snapshot back — through
 * that store's own persistence path — and records its edits as
 * before/after snapshots scoped "<domain>" or "<domain>:<id>".
 *
 * The history itself is session-only module state (never persisted);
 * the zustand store below only mirrors what the UI shows.
 */

interface Domain {
  /** Apply a snapshot; false when its target is gone (entry skipped). */
  restore: (scope: string, snapshot: unknown) => boolean;
  same?: (a: unknown, b: unknown) => boolean;
}

const domains = new Map<string, Domain>();
const domainOf = (scope: string) => domains.get(scope.split(":")[0]);

let history: History<unknown> = emptyHistory();
let restoring = false;
let untracked = 0;

interface HistoryUiState {
  canUndo: boolean;
  canRedo: boolean;
  /** Last undo/redo, for the transient status line; nonce re-triggers it. */
  message: { text: string; nonce: number } | null;
}

export const useHistoryStore = create<HistoryUiState>()(() => ({
  canUndo: false,
  canRedo: false,
  message: null,
}));

function sync(text?: string) {
  useHistoryStore.setState((s) => ({
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    message:
      text === undefined
        ? s.message
        : { text, nonce: (s.message?.nonce ?? 0) + 1 },
  }));
}

export function registerHistoryDomain(name: string, domain: Domain) {
  domains.set(name, domain);
}

/** True while an undo/redo is writing snapshots back into the stores. */
export const isRestoringHistory = () => restoring;

/**
 * Record one edit. Inside withoutHistory() the edit isn't undoable and
 * instead invalidates its scope's entries, whose snapshots it just made
 * stale (an OCR pass rewriting an item's boxes).
 */
export function recordChange(entry: Omit<HistoryEntry<unknown>, "at">) {
  if (restoring) return;
  if (untracked > 0) history = dropScope(history, entry.scope);
  else {
    history = record(
      history,
      { ...entry, at: Date.now() },
      { same: domainOf(entry.scope)?.same },
    );
  }
  sync();
}

/** Run synchronous store edits that must not become undo steps. */
export function withoutHistory<R>(fn: () => R): R {
  untracked++;
  try {
    return fn();
  } finally {
    untracked--;
  }
}

function apply(entry: HistoryEntry<unknown>, side: "before" | "after") {
  const domain = domainOf(entry.scope);
  if (!domain) return false;
  restoring = true;
  try {
    return domain.restore(entry.scope, entry[side]);
  } finally {
    restoring = false;
  }
}

/**
 * Undo the newest step; returns its label, or null when there is
 * nothing (left) to undo. Entries whose target has since gone (a
 * deleted media item) are discarded on the way.
 */
export function undoHistory(): string | null {
  for (let step = undo(history); step; step = undo(history)) {
    history = step.history;
    if (apply(step.entry, "before")) {
      sync(`Undid: ${step.entry.label}`);
      return step.entry.label;
    }
    history = { ...history, future: history.future.slice(1) };
  }
  sync();
  return null;
}

/** Redo the next undone step; returns its label, or null. */
export function redoHistory(): string | null {
  for (let step = redo(history); step; step = redo(history)) {
    history = step.history;
    if (apply(step.entry, "after")) {
      sync(`Redid: ${step.entry.label}`);
      return step.entry.label;
    }
    history = { ...history, past: history.past.slice(0, -1) };
  }
  sync();
  return null;
}
