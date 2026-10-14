"use client";

import { useEffect, useRef, useState } from "react";
import {
  imageFilesFromClipboard,
  isTextEntryTarget,
} from "@/lib/clipboard-import";
import { useMediaStore } from "@/stores/media-store";

/**
 * Import files and select the newest one: the user just brought it in
 * to look at it. Resolves to the ids that made it into the library.
 */
export async function importAndActivate(
  files: FileList | File[],
): Promise<string[]> {
  const { addFiles, setActive } = useMediaStore.getState();
  const ids = await addFiles(files);
  if (ids.length > 0) setActive(ids[ids.length - 1]);
  return ids;
}

/** How long the paste status line stays up. */
const STATUS_MS = 2600;

/**
 * App-wide paste-to-import: a screenshot on the clipboard goes straight
 * into the library (Ctrl/Cmd+V anywhere outside a text field). Renders
 * only a transient status line.
 */
export function PasteImport({
  enabled = true,
  onImported,
}: {
  /** Off while something else owns the screen (most onboarding steps). */
  enabled?: boolean;
  /** Called with the new ids after a successful paste import. */
  onImported?: (ids: string[]) => void;
}) {
  const [status, setStatus] = useState<string | null>(null);
  const timer = useRef<number | null>(null);
  // Latest callback without re-binding the listener on every render.
  const onImportedRef = useRef(onImported);
  useEffect(() => {
    onImportedRef.current = onImported;
  }, [onImported]);

  useEffect(() => {
    if (!enabled) return;
    const flash = (text: string) => {
      setStatus(text);
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        timer.current = null;
        setStatus(null);
      }, STATUS_MS);
    };
    const onPaste = (e: ClipboardEvent) => {
      if (e.defaultPrevented || !e.clipboardData) return;
      if (isTextEntryTarget(e.target as HTMLElement | null)) return;
      const files = imageFilesFromClipboard(e.clipboardData.items, new Date());
      // Text, links, anything not an image: leave the paste alone.
      if (files.length === 0) return;
      e.preventDefault();
      flash("Importing pasted image…");
      void importAndActivate(files).then((ids) => {
        if (ids.length === 0) {
          flash("Couldn't read the pasted image");
          return;
        }
        flash(
          ids.length === 1
            ? "Pasted image added to the library"
            : `${ids.length} pasted images added to the library`,
        );
        onImportedRef.current?.(ids);
      });
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [enabled]);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed top-16 left-1/2 z-310 -translate-x-1/2"
    >
      {status ? (
        <div className="panel-frame rounded-md border border-border px-3 py-1.5 text-sm shadow-md motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-1">
          {status}
        </div>
      ) : null}
    </div>
  );
}
