"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { XIcon, type LucideIcon } from "lucide-react";
import { useUiStore, type PanelId } from "@/stores/ui-store";

/**
 * Shared z-order: the most recently touched panel floats to the top.
 * Capped below the portal layer (popups/dialogs render at z-300) so a
 * long session can never raise a panel above its own dropdowns.
 */
let zCursor = 40;
const Z_CAP = 250;
export const nextZ = () => (zCursor = Math.min(Z_CAP, zCursor + 1));

const MIN_W = 260;
const MAX_W = 640;

interface FloatingPanelProps {
  id: PanelId;
  title: string;
  icon: LucideIcon;
  /** Override for the shared default (top center, under the rail). */
  defaultPosition?: { x: number; y: number };
  width?: number;
  /** Resize cap; "none" allows growing to the viewport edge. */
  maxWidth?: number | "none";
  /** Extra controls rendered in the header, before the close button. */
  headerActions?: React.ReactNode;
  /** Small centered note in the title bar (e.g. the local-only promise). */
  headerNote?: string;
  /**
   * Allow dragging the bottom edge / corner to fix the content height
   * (children should fill with h-full and scroll internally).
   */
  resizableHeight?: boolean;
  children: React.ReactNode;
}

export function FloatingPanel({
  id,
  title,
  icon: Icon,
  defaultPosition,
  width: defaultWidth = 320,
  maxWidth,
  headerActions,
  headerNote,
  resizableHeight,
  children,
}: FloatingPanelProps) {
  const open = useUiStore((s) => s.openPanels[id]);
  const stored = useUiStore((s) => s.panelPositions[id]);
  const storedWidth = useUiStore((s) => s.panelWidths[id]);
  const storedHeight = useUiStore((s) => s.panelHeights[id]);
  const setPanelPosition = useUiStore((s) => s.setPanelPosition);
  const setPanelWidth = useUiStore((s) => s.setPanelWidth);
  const setPanelHeight = useUiStore((s) => s.setPanelHeight);
  const togglePanel = useUiStore((s) => s.togglePanel);

  const width = storedWidth ?? defaultWidth;
  const height = resizableHeight ? storedHeight : undefined;
  // Un-dragged panels open top-center, just under the rail (Taylor
  // 2026-08-18). Client-only render, so window is available here.
  const pos = stored ??
    defaultPosition ?? {
      x: Math.max(8, Math.round((window.innerWidth - width) / 2)),
      y: 56,
    };
  const resize = useRef<{
    edge: "left" | "right" | "bottom" | "corner";
    startX: number;
    startY: number;
    startW: number;
    startH: number;
    startPosX: number;
  } | null>(null);

  const clampW = (w: number) => {
    const cap =
      maxWidth === "none"
        ? window.innerWidth - 16
        : (maxWidth ?? MAX_W);
    return Math.min(cap, Math.max(MIN_W, w));
  };

  const MIN_H = 200;
  const clampH = (h: number) =>
    Math.min(window.innerHeight - pos.y - 48, Math.max(MIN_H, h));

  const onResizeDown = (
    e: React.PointerEvent,
    edge: "left" | "right" | "bottom" | "corner",
  ) => {
    resize.current = {
      edge,
      startX: e.clientX,
      startY: e.clientY,
      startW: width,
      // Measured so the first bottom-drag starts from the live height.
      startH:
        height ??
        (ref.current?.querySelector("[data-panel-content]")?.clientHeight ??
          MIN_H),
      startPosX: pos.x,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
  };

  const onResizeMove = (e: React.PointerEvent) => {
    const r = resize.current;
    if (!r) return;
    const dx = e.clientX - r.startX;
    const dy = e.clientY - r.startY;
    if (r.edge === "right" || r.edge === "corner") {
      setPanelWidth(id, clampW(r.startW + dx));
    }
    if (r.edge === "bottom" || r.edge === "corner") {
      setPanelHeight(id, clampH(r.startH + dy));
    }
    if (r.edge === "left") {
      // Left edge: right edge stays put, so x shifts with the size change.
      const w = clampW(r.startW - dx);
      setPanelWidth(id, w);
      setPanelPosition(id, { x: r.startPosX + (r.startW - w), y: pos.y });
    }
  };

  const onResizeUp = () => {
    resize.current = null;
  };
  const ref = useRef<HTMLDivElement>(null);
  // Stable initial z so server and client render identically; panels
  // stack by DOM order until first interaction.
  const [z, setZ] = useState(40);
  const drag = useRef<{ dx: number; dy: number } | null>(null);

  const bringToFront = useCallback(() => setZ(nextZ()), []);

  // Opening a panel raises it above everything else — a panel opened
  // FROM another panel (table from the Device Manager) must land on
  // top, not under the panel that launched it.
  useEffect(() => {
    if (open) setZ(nextZ());
  }, [open]);

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

  // Keep panels reachable: at least min(240, width) of the panel must
  // stay horizontally inside the viewport — checked at mount (a stored
  // position can come from a much wider monitor) and on window resize.
  // NOT on every position change: a deliberate drag past the edge is
  // allowed its looser drag clamp and must not snap back.
  useEffect(() => {
    const clamp = () => {
      const cur = useUiStore.getState().panelPositions[id];
      if (!cur) return;
      const w = ref.current?.offsetWidth ?? width;
      const visible = Math.min(240, w);
      const x = Math.min(
        Math.max(cur.x, visible - w),
        window.innerWidth - visible,
      );
      const y = Math.min(Math.max(cur.y, 8), window.innerHeight - 40);
      if (x !== cur.x || y !== cur.y) setPanelPosition(id, { x, y });
    };
    clamp();
    window.addEventListener("resize", clamp);
    return () => window.removeEventListener("resize", clamp);
  }, [id, setPanelPosition, width]);

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
        <span className="text-base font-medium">{title}</span>
        {headerNote ? (
          <span className="min-w-0 flex-1 truncate px-2 text-center text-sm text-muted-foreground/70">
            {headerNote}
          </span>
        ) : (
          <span className="flex-1" />
        )}
        {headerActions}
        <button
          type="button"
          aria-label={`Close ${title}`}
          className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          onClick={() => togglePanel(id)}
        >
          <XIcon className="size-3.5" />
        </button>
      </div>
      <div
        data-panel-content
        className="overflow-hidden border-t border-border"
        style={height !== undefined ? { height } : undefined}
      >
        {children}
      </div>
      {/* Edge resize handles: invisible strips, ew-resize cursor. */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={`Resize ${title} (left edge)`}
        className="absolute top-0 bottom-0 -left-1 w-2 cursor-ew-resize touch-none"
        onPointerDown={(e) => onResizeDown(e, "left")}
        onPointerMove={onResizeMove}
        onPointerUp={onResizeUp}
      />
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={`Resize ${title} (right edge)`}
        className="absolute top-0 bottom-0 -right-1 w-2 cursor-ew-resize touch-none"
        onPointerDown={(e) => onResizeDown(e, "right")}
        onPointerMove={onResizeMove}
        onPointerUp={onResizeUp}
      />
      {resizableHeight ? (
        <>
          <div
            role="separator"
            aria-orientation="horizontal"
            aria-label={`Resize ${title} (bottom edge)`}
            className="absolute right-2 -bottom-1 left-2 h-2 cursor-ns-resize touch-none"
            onPointerDown={(e) => onResizeDown(e, "bottom")}
            onPointerMove={onResizeMove}
            onPointerUp={onResizeUp}
          />
          <div
            role="separator"
            aria-label={`Resize ${title} (corner)`}
            className="absolute -right-1 -bottom-1 size-3.5 cursor-nwse-resize touch-none"
            onPointerDown={(e) => onResizeDown(e, "corner")}
            onPointerMove={onResizeMove}
            onPointerUp={onResizeUp}
          />
        </>
      ) : null}
    </div>
  );
}
