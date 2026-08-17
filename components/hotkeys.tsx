"use client";

import { useEffect, useState } from "react";
import { useUiStore, type PanelId } from "@/stores/ui-store";
import { useViewerStore } from "@/stores/viewer-store";

/**
 * Global hotkeys (plan 4.x, keys confirmed by Taylor 2026-08-17).
 * Suppressed while typing in any form field so panels never toggle
 * mid-rename. Tab intentionally repurposes focus-traversal for the
 * 2D/3D flip — the app is pointer-first and Taylor chose the tradeoff.
 */

const PANEL_KEYS: Record<string, PanelId> = {
  m: "media",
  d: "devices",
  p: "report",
  c: "table",
  s: "settings",
};

const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement &&
  (t.tagName === "INPUT" ||
    t.tagName === "TEXTAREA" ||
    t.tagName === "SELECT" ||
    t.isContentEditable);

/** Rows for the cheat-sheet overlay; `soon` = mapped but not built yet. */
const CHEAT_ROWS: { keys: string; does: string; soon?: boolean }[] = [
  { keys: "M / D / P / C / S", does: "Toggle Media · Devices · Perception · Comparison · Settings" },
  { keys: "Tab", does: "Switch between 2D and 3D view" },
  { keys: "1 / 2 / 3", does: "Stance: Standing · On a couch · At a desk" },
  { keys: "Q / W / E", does: "Input: Handheld · Gamepad · Mouse & KB" },
  { keys: "Drag", does: "Pan the 2D composition (click selects)" },
  { keys: "Double-click", does: "Recenter the 2D composition" },
  { keys: "Esc", does: "Deselect / close this sheet" },
  { keys: "X", does: "Crop the active media", soon: true },
  { keys: "O", does: "OCR overlay", soon: true },
  { keys: "?", does: "This cheat sheet" },
];

export function Hotkeys() {
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      const ui = useUiStore.getState();
      const viewer = useViewerStore.getState();

      if (e.key === "Tab") {
        e.preventDefault();
        ui.setViewMode(ui.viewMode === "2d" ? "3d" : "2d");
        return;
      }
      if (e.key === "?") {
        e.preventDefault();
        setSheetOpen((v) => !v);
        return;
      }
      if (e.key === "Escape") {
        // The sheet first; otherwise clear the app-wide device selection.
        // (display-area's own Escape handling for measure boxes runs too.)
        setSheetOpen((open) => {
          if (!open && ui.selectedDeviceId) ui.selectDevice(null);
          return false;
        });
        return;
      }

      const key = e.key.toLowerCase();
      const panel = PANEL_KEYS[key];
      if (panel) {
        ui.togglePanel(panel);
        return;
      }
      if (key === "1") viewer.setScenario("standing");
      else if (key === "2") viewer.setScenario("couch");
      else if (key === "3") viewer.setScenario("desk");
      else if (key === "q") viewer.setInputType("handheld");
      else if (key === "w") viewer.setInputType("gamepad");
      else if (key === "e") viewer.setInputType("keyboard");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!sheetOpen) return null;
  return (
    <div
      className="fixed inset-0 z-300 flex items-center justify-center bg-black/50"
      onClick={() => setSheetOpen(false)}
    >
      <div
        className="panel-frame w-96 rounded-lg border border-border p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-baseline justify-between">
          <span className="text-sm font-medium">Keyboard shortcuts</span>
          <span className="text-xs text-muted-foreground">Esc to close</span>
        </div>
        <table className="w-full text-sm">
          <tbody>
            {CHEAT_ROWS.map((r) => (
              <tr key={r.keys} className={r.soon ? "text-muted-foreground/60" : ""}>
                <td className="py-1 pr-3 whitespace-nowrap font-mono text-xs">
                  {r.keys}
                </td>
                <td className="py-1 text-xs">
                  {r.does}
                  {r.soon ? " (soon)" : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
