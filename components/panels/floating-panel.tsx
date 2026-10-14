"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { XIcon, type LucideIcon } from "lucide-react";
import {
  PANEL_MARGIN,
  fitPanelRect,
  maxContentHeight,
} from "@/lib/panel-geometry";
import { useUiStore, type PanelId } from "@/stores/ui-store";
import { useViewportSize } from "@/components/use-viewport-size";

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
const MIN_H = 200;
/** Title bar (h-8) plus the content's top border. */
const HEADER_H = 33;

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
  /** Content height before the user resizes (viewport-clamped). */
  defaultHeight?: number;
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
  defaultHeight,
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

  // Rendered size is the stored size capped to the viewport (Reflow,
  // WCAG 1.4.10: at 200% zoom the viewport is ~640x400). The store keeps
  // the uncapped value, so a big window gets its persisted size back.
  const vp = useViewportSize();
  const { width } = fitPanelRect(
    { x: 0, y: 0, width: storedWidth ?? defaultWidth },
    vp,
    { minWidth: MIN_W },
  );
  // Un-dragged panels open top-center, just under the rail (Taylor
  // 2026-08-18).
  const pos = stored ??
    defaultPosition ?? {
      x: Math.max(PANEL_MARGIN, Math.round((vp.width - width) / 2)),
      y: 56,
    };
  // Content never runs past the bottom edge: height-resizable panels
  // shrink to fit, the rest scroll inside the cap.
  const maxContentH = maxContentHeight(pos.y, vp.height, HEADER_H);
  const wantedH = resizableHeight
    ? (storedHeight ??
      (defaultHeight !== undefined
        ? Math.min(defaultHeight, vp.height - 120)
        : undefined))
    : undefined;
  const height =
    wantedH === undefined ? undefined : Math.min(maxContentH, wantedH);
  const resize = useRef<{
    edge: "left" | "right" | "bottom" | "corner";
    startX: number;
    startY: number;
    startW: number;
    startH: number;
    startPosX: number;
  } | null>(null);

  /** `room`: px left toward the viewport edge being dragged. */
  const clampW = (w: number, room: number) => {
    const cap =
      maxWidth === "none"
        ? window.innerWidth - 2 * PANEL_MARGIN
        : (maxWidth ?? MAX_W);
    // A panel dragged past the edge still gets its minimum width.
    return Math.min(cap, Math.max(MIN_W, room), Math.max(MIN_W, w));
  };

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
      // Grow only up to the right margin, so the viewport fit never
      // shoves the panel left mid-drag.
      const room = window.innerWidth - PANEL_MARGIN - r.startPosX;
      setPanelWidth(id, clampW(r.startW + dx, room));
    }
    if (r.edge === "bottom" || r.edge === "corner") {
      setPanelHeight(id, clampH(r.startH + dy));
    }
    if (r.edge === "left") {
      // Left edge: right edge stays put, so x shifts with the size change.
      const w = clampW(r.startW - dx, r.startPosX + r.startW - PANEL_MARGIN);
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
  // top, not under the panel that launched it. Render-time adjustment
  // (not an effect): the open frame already paints with the new z.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setZ(nextZ());
  }

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

  // Keep the whole panel inside the viewport (Reflow): a stored position
  // can come from a much wider monitor or a 100%-zoom session. Checked
  // on open, on window resize, after a store rehydrate and when the
  // rendered width changes — NOT on every position change: a deliberate
  // drag past the edge keeps its looser drag clamp and must not snap
  // back mid-drag. Layout effect, so the fix lands before first paint.
  useLayoutEffect(() => {
    if (!open) return;
    const clamp = () => {
      const cur = useUiStore.getState().panelPositions[id];
      if (!cur) return;
      // Slide only as far as needed to show the title bar plus a usable
      // strip of content; the content height cap handles the rest.
      const content =
        ref.current?.querySelector("[data-panel-content]")?.scrollHeight ??
        0;
      const f = fitPanelRect(
        { ...cur, width, height: HEADER_H + Math.min(content, MIN_H) },
        vp,
      );
      if (f.x !== cur.x || f.y !== cur.y) {
        setPanelPosition(id, { x: f.x, y: f.y });
      }
    };
    clamp();
    return useUiStore.persist.onFinishHydration(clamp);
  }, [id, open, vp, width, setPanelPosition]);

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
        onPointerCancel={onHeaderPointerUp}
      >
        <Icon className="size-3.5 text-muted-foreground" />
        <span className="text-base font-medium">{title}</span>
        {headerNote ? (
          <span className="min-w-0 flex-1 truncate px-2 text-center text-sm text-muted-foreground">
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
        className={
          height !== undefined
            ? "overflow-hidden border-t border-border"
            : "overflow-y-auto border-t border-border"
        }
        style={height !== undefined ? { height } : { maxHeight: maxContentH }}
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
        onPointerCancel={onResizeUp}
      />
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={`Resize ${title} (right edge)`}
        className="absolute top-0 bottom-0 -right-1 w-2 cursor-ew-resize touch-none"
        onPointerDown={(e) => onResizeDown(e, "right")}
        onPointerMove={onResizeMove}
        onPointerUp={onResizeUp}
        onPointerCancel={onResizeUp}
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
            onPointerCancel={onResizeUp}
          />
          <div
            role="separator"
            aria-label={`Resize ${title} (corner)`}
            className="absolute -right-1 -bottom-1 size-3.5 cursor-nwse-resize touch-none"
            onPointerDown={(e) => onResizeDown(e, "corner")}
            onPointerMove={onResizeMove}
            onPointerUp={onResizeUp}
            onPointerCancel={onResizeUp}
          />
        </>
      ) : null}
    </div>
  );
}
