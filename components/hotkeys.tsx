"use client";

import { useEffect, useState } from "react";
import { cycleId } from "@/lib/cycle";
import {
  nextKeyframeTime,
  prevKeyframeTime,
} from "@/lib/scan-keyframes";
import { useDeviceStore } from "@/stores/device-store";
import { useMediaStore } from "@/stores/media-store";
import { usePlaybackStore } from "@/stores/playback-store";
import { useUiStore, type PanelId } from "@/stores/ui-store";
import { useViewerStore } from "@/stores/viewer-store";

/**
 * Global hotkeys (plan 4.x, keys confirmed by Taylor 2026-08-17).
 * Suppressed while typing in any form field so panels never toggle
 * mid-rename. Tab intentionally repurposes focus-traversal for the
 * 2D/3D flip — the app is pointer-first and Taylor chose the tradeoff.
 */

/** d/m/p drive the workbench tabs; c/s stay standalone panels. */
const TAB_KEYS: Record<string, "devices" | "media" | "report"> = {
  d: "devices",
  m: "media",
  p: "report",
};

const PANEL_KEYS: Record<string, PanelId> = {
  c: "table",
  s: "settings",
};

const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement &&
  (t.tagName === "INPUT" ||
    t.tagName === "TEXTAREA" ||
    t.tagName === "SELECT" ||
    t.isContentEditable);

// NumberStepper's ArrowUp/ArrowDown nudge and the Slider thumb's native
// <input type="range"> both land on an INPUT, so isTyping already keeps
// hotkeys off them. What it doesn't catch: an open Select listbox or
// DropdownMenu, whose options are plain elements (role="option" /
// "menuitem"), and a modal Dialog, where focus is trapped on its own
// buttons. All three render their popup body with a shadcn-style
// `data-slot="…-content"` wrapper (select-content, dropdown-menu-content,
// dropdown-menu-sub-content, dialog-content), so closest() on those
// catches "focus is inside an open overlay".
//
// Named one by one rather than matched on a `-content` suffix: shadcn
// hands that slot to plenty of INLINE bodies too (card-content,
// tabs-content, accordion-content). None are in the tree today, but a
// suffix match would silently kill every hotkey inside the first one
// anybody adds.
const OVERLAY_SLOTS = [
  "select-content",
  "dropdown-menu-content",
  "dropdown-menu-sub-content",
  "dialog-content",
]
  .map((slot) => `[data-slot="${slot}"]`)
  .join(",");

const isInOverlay = (t: EventTarget | null) =>
  t instanceof Element && t.closest(OVERLAY_SLOTS) !== null;

/** Rows for the cheat-sheet overlay; `soon` = mapped but not built yet. */
const CHEAT_ROWS: { keys: string; does: string; soon?: boolean }[] = [
  { keys: "D / M / P", does: "Workbench tabs: Devices · Media · Perception" },
  { keys: "C / S", does: "Toggle Comparison · Settings" },
  { keys: "Tab", does: "Switch between 2D and 3D view" },
  { keys: "1 / 2 / 3", does: "Stance: Standing · On a couch · At a desk" },
  { keys: "Q / W / E", does: "Input: Handheld · Gamepad · Mouse & KB" },
  { keys: "Drag", does: "Pan the 2D composition (click selects)" },
  { keys: "Double-click", does: "Recenter 2D · on the ground, reset the 3D camera" },
  { keys: "Esc", does: "Deselect / close this sheet" },
  { keys: "← / →", does: "Previous / next media in the library" },
  { keys: "↑ / ↓", does: "Focus previous / next visible device" },
  { keys: "Space", does: "Play / pause timeline media" },
  { keys: "< / >", does: "Previous / next OCR keyframe (and pause)" },
  { keys: "X", does: "Crop the active media (again clears the crop)" },
  { keys: "O", does: "OCR overlay", soon: true },
  { keys: "?", does: "This cheat sheet" },
];

export function Hotkeys() {
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        isTyping(e.target) ||
        isInOverlay(e.target) ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey
      )
        return;
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
      const tab = TAB_KEYS[key];
      if (tab) {
        ui.toggleWorkbenchTab(tab);
        return;
      }
      const panel = PANEL_KEYS[key];
      if (panel) {
        ui.togglePanel(panel);
        return;
      }
      // Arrow keys walk the media library (looping), 2D and 3D alike.
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        const media = useMediaStore.getState();
        const n = media.items.length;
        if (n === 0) return;
        e.preventDefault();
        const at = media.items.findIndex((i) => i.id === media.activeId);
        const step = e.key === "ArrowRight" ? 1 : -1;
        const next = media.items[(Math.max(0, at) + step + n) % n];
        media.setActive(next.id);
        return;
      }
      // Up/Down cycle the FOCUSED device (plan: one screen at a time),
      // reusing the same app-wide selection the 2D rect, table row, and
      // 3D rect already light up for — arrow-key focus and click-select
      // are the same mechanism, just two ways to move it. Visible devices
      // only, This Device included when it's on, in the same order
      // display-area.tsx builds its own device lists (This Device first,
      // then the rest, unsorted — cycling doesn't care about z-order).
      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        const { thisDevice, devices } = useDeviceStore.getState();
        const visible = [
          ...(thisDevice.visible ? [thisDevice] : []),
          ...devices.filter((d) => d.visible),
        ];
        if (visible.length === 0) return;
        e.preventDefault();
        const dir = e.key === "ArrowDown" ? 1 : -1;
        ui.selectDevice(cycleId(visible, ui.selectedDeviceId, dir));
        return;
      }

      // Transport keys act only when timeline media is active.
      const pb = usePlaybackStore.getState();
      if (e.key === " " && pb.animated) {
        e.preventDefault();
        pb.setPlaying(!pb.playing);
        return;
      }
      if ((e.key === "," || e.key === "<" || e.key === "." || e.key === ">") && pb.animated) {
        const media = useMediaStore.getState();
        const kfs =
          media.items.find((i) => i.id === media.activeId)?.scanKeyframes ??
          [];
        const back = e.key === "," || e.key === "<";
        const t = back
          ? prevKeyframeTime(kfs, pb.timeSec)
          : nextKeyframeTime(kfs, pb.timeSec);
        if (t !== null) {
          pb.setPlaying(false);
          pb.seek(t);
        }
        return;
      }

      if (key === "x") {
        // Toggle cropping on the active media: seed the freeform window
        // (pausing any playback, same as clicking Custom…), or clear an
        // existing crop back to None.
        const media = useMediaStore.getState();
        const item = media.items.find((i) => i.id === media.activeId);
        if (!item) return;
        if (item.crop) {
          media.setCrop(item.id, undefined);
        } else {
          const pb = usePlaybackStore.getState();
          if (pb.animated && pb.playing) pb.setPlaying(false);
          media.setCrop(item.id, { x: 0.1, y: 0.1, w: 0.8, h: 0.8 });
        }
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
          <span className="text-base font-medium">Keyboard shortcuts</span>
          <span className="text-sm text-muted-foreground">Esc to close</span>
        </div>
        <table className="w-full text-base">
          <tbody>
            {CHEAT_ROWS.map((r) => (
              <tr key={r.keys} className={r.soon ? "text-muted-foreground/60" : ""}>
                <td className="py-1 pr-3 whitespace-nowrap font-mono text-sm">
                  {r.keys}
                </td>
                <td className="py-1 text-sm">
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
