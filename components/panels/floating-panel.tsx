"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { XIcon, type LucideIcon } from "lucide-react";
import { useUiStore, type PanelId } from "@/stores/ui-store";

/** Shared z-order: the most recently touched panel floats to the top. */
let zCursor = 40;

interface FloatingPanelProps {
  id: PanelId;
  title: string;
  icon: LucideIcon;
  defaultPosition: { x: number; y: number };
  width?: number;
  children: React.ReactNode;
}

export function FloatingPanel({
  id,
  title,
  icon: Icon,
  defaultPosition,
  width = 320,
  children,
}: FloatingPanelProps) {
  const open = useUiStore((s) => s.openPanels[id]);
  const stored = useUiStore((s) => s.panelPositions[id]);
  const setPanelPosition = useUiStore((s) => s.setPanelPosition);
  const togglePanel = useUiStore((s) => s.togglePanel);

  const pos = stored ?? defaultPosition;
  const ref = useRef<HTMLDivElement>(null);
  // Stable initial z so server and client render identically; panels
  // stack by DOM order until first interaction.
  const [z, setZ] = useState(40);
  const drag = useRef<{ dx: number; dy: number } | null>(null);

  const bringToFront = useCallback(() => setZ(++zCursor), []);

  const onHeaderPointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Buttons inside the header (close) handle their own clicks.
      if ((e.target as HTMLElement).closest("button")) return;
      drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [pos.x, pos.y],
  );

  const onHeaderPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!drag.current) return;
      const el = ref.current;
      const w = el?.offsetWidth ?? width;
      const x = Math.min(
        Math.max(e.clientX - drag.current.dx, 8 - w + 48),
        window.innerWidth - 48,
      );
      const y = Math.min(
        Math.max(e.clientY - drag.current.dy, 8),
        window.innerHeight - 40,
      );
      setPanelPosition(id, { x, y });
    },
    [id, setPanelPosition, width],
  );

  const onHeaderPointerUp = useCallback(() => {
    drag.current = null;
  }, []);

  // Keep panels reachable if the window shrinks below a stored position.
  useEffect(() => {
    if (!stored) return;
    const onResize = () => {
      const x = Math.min(stored.x, window.innerWidth - 48);
      const y = Math.min(stored.y, window.innerHeight - 40);
      if (x !== stored.x || y !== stored.y) setPanelPosition(id, { x, y });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [id, setPanelPosition, stored]);

  if (!open) return null;

  return (
    <div
      ref={ref}
      className="panel-frame fixed rounded-lg border border-border"
      style={{ left: pos.x, top: pos.y, width, zIndex: z }}
      onPointerDown={bringToFront}
    >
      <div
        className="flex h-8 cursor-grab touch-none items-center gap-2 px-2.5 select-none active:cursor-grabbing"
        onPointerDown={onHeaderPointerDown}
        onPointerMove={onHeaderPointerMove}
        onPointerUp={onHeaderPointerUp}
      >
        <Icon className="size-3.5 text-muted-foreground" />
        <span className="flex-1 text-sm font-medium">{title}</span>
        <button
          type="button"
          aria-label={`Close ${title}`}
          className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          onClick={() => togglePanel(id)}
        >
          <XIcon className="size-3.5" />
        </button>
      </div>
      <div className="border-t border-border">{children}</div>
    </div>
  );
}
