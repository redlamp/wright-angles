"use client";

import { useEffect, useState } from "react";
import {
  redoHistory,
  undoHistory,
  useHistoryStore,
} from "@/stores/history-store";

/** Input types with no text of their own to undo (sliders, toggles). */
const NON_TEXT_INPUTS = new Set([
  "range",
  "checkbox",
  "radio",
  "button",
  "submit",
  "reset",
  "color",
  "file",
  "image",
]);

/**
 * Text entry keeps the browser's native undo; a focused slider or
 * checkbox has none, so app undo still applies there.
 */
const isTextEntry = (t: EventTarget | null) =>
  t instanceof HTMLElement &&
  ((t instanceof HTMLInputElement && !NON_TEXT_INPUTS.has(t.type)) ||
    t.tagName === "TEXTAREA" ||
    t.isContentEditable);

const MESSAGE_MS = 1600;

/**
 * Undo/redo hotkeys over stores/history-store.ts: Ctrl/Cmd+Z undoes,
 * Ctrl/Cmd+Shift+Z and Ctrl+Y redo. Shows a transient "Undid: …" line.
 */
export function UndoHotkeys() {
  const message = useHistoryStore((s) => s.message);
  const [shown, setShown] = useState<number | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || isTextEntry(e.target)) {
        return;
      }
      const key = e.key.toLowerCase();
      const isUndo = key === "z" && !e.shiftKey;
      const isRedo = (key === "z" && e.shiftKey) || (key === "y" && e.ctrlKey);
      if (!isUndo && !isRedo) return;
      e.preventDefault();
      if (isUndo) undoHistory();
      else redoHistory();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!message) return;
    const raf = requestAnimationFrame(() => setShown(message.nonce));
    const t = window.setTimeout(() => setShown(null), MESSAGE_MS);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(t);
    };
  }, [message]);

  const visible = message !== null && shown === message.nonce;
  // The live region stays mounted so screen readers hear each update.
  return (
    <div role="status" aria-live="polite">
      {visible ? (
        <div className="pointer-events-none absolute bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-md border bg-popover px-3 py-1.5 text-xs text-popover-foreground shadow-md">
          {message.text}
        </div>
      ) : null}
    </div>
  );
}
