"use client";

import { useCallback, useEffect, useState } from "react";
import { useSettingsStore } from "@/stores/settings-store";
import { useUiStore } from "@/stores/ui-store";
import { Kbd } from "@/components/onboarding/views-step";

/** The toolbar's 2D/3D switch (components/sidebar.tsx). */
const TARGET = '[data-tour="view-toggle"]';
/** Let the onboarding dialog's exit settle before measuring. */
const SHOW_DELAY_MS = 600;
const WIDTH = 264;
const GUTTER = 16;
const GAP = 10;

interface Anchor {
  /** Horizontal center of the target, viewport px. */
  cx: number;
  /** Bottom edge of the target, viewport px. */
  bottom: number;
}

function measure(): Anchor | null {
  const el = document.querySelector(TARGET);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  return { cx: r.left + r.width / 2, bottom: r.bottom };
}

/**
 * One-time coach mark pointing at the "2D | 3D" toggle, shown after
 * onboarding closes. Dismissed (and remembered in settings) on any
 * click, Escape, or a view switch. If the toggle isn't in the DOM it
 * stays silent and unseen.
 */
export function ViewToggleCoach({ armed }: { armed: boolean }) {
  const seen = useSettingsStore((s) => s.viewToggleCoachSeen);
  const setSeen = useSettingsStore((s) => s.setViewToggleCoachSeen);
  const [anchor, setAnchor] = useState<Anchor | null>(null);

  const dismiss = useCallback(() => {
    setAnchor(null);
    setSeen(true);
  }, [setSeen]);

  useEffect(() => {
    if (!armed || seen) return;
    const t = window.setTimeout(() => setAnchor(measure()), SHOW_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [armed, seen]);

  const open = anchor !== null;
  useEffect(() => {
    if (!open) return;
    const reposition = () => {
      const next = measure();
      if (next) setAnchor(next);
      else dismiss();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    // Captured so the click that dismisses still does its own job.
    const onPointer = () => dismiss();
    const unsubscribe = useUiStore.subscribe((s, prev) => {
      if (s.viewMode !== prev.viewMode) dismiss();
    });
    window.addEventListener("resize", reposition);
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer, true);
    return () => {
      unsubscribe();
      window.removeEventListener("resize", reposition);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer, true);
    };
  }, [open, dismiss]);

  if (!anchor) return null;
  const vw = window.innerWidth;
  const left = Math.min(
    Math.max(anchor.cx - WIDTH / 2, GUTTER),
    Math.max(GUTTER, vw - GUTTER - WIDTH),
  );
  const arrowLeft = Math.min(Math.max(anchor.cx - left, 14), WIDTH - 14);

  return (
    <div
      role="status"
      aria-live="polite"
      className="panel-frame fixed z-200 rounded-lg border border-border p-3 text-sm shadow-lg motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-1"
      style={{ top: anchor.bottom + GAP, left, width: WIDTH }}
    >
      {/* Arrow: a rotated square tucked under the top edge. */}
      <span
        aria-hidden
        className="panel-frame absolute -top-[6px] size-3 rotate-45 border-t border-l border-border"
        style={{ left: arrowLeft - 6 }}
      />
      <p className="font-medium">Switch views here</p>
      <p className="mt-1 leading-4.5 text-muted-foreground">
        2D shows your image at every device&apos;s true relative size; 3D
        puts the same screens in a room. Shortcut: <Kbd>V</Kbd>
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        Click anywhere or press Esc to dismiss.
      </p>
    </div>
  );
}
