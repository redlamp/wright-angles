"use client";

import { useMemo, useState } from "react";
import {
  ArrowDownAZIcon,
  ClockArrowDownIcon,
  ClockArrowUpIcon,
  GripVerticalIcon,
  LayoutGridIcon,
  ListIcon,
  LoaderCircleIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useOcrQueueStore } from "@/stores/ocr-queue-store";
import type { MediaItem } from "@/lib/types";
import { useMediaStore } from "@/stores/media-store";
import { MEDIA_DRAG_MIME, SectionLabel } from "./shared";

type ViewMode = "grid" | "list";
type SortMode = "custom" | "added-asc" | "added-desc" | "name";

const SORT_MODES: {
  mode: SortMode;
  label: string;
  icon: typeof GripVerticalIcon;
}[] = [
  { mode: "custom", label: "Custom order", icon: GripVerticalIcon },
  { mode: "added-desc", label: "Newest first", icon: ClockArrowDownIcon },
  { mode: "added-asc", label: "Oldest first", icon: ClockArrowUpIcon },
  { mode: "name", label: "By name", icon: ArrowDownAZIcon },
];

/**
 * Per-item auto-scan progress (plan: "per-item progress state while a
 * scan runs"). A component of its own, not an inline expression in the
 * list's `.map()`, so the store subscription is a proper per-item hook
 * call rather than one taken conditionally inside a loop. Silent for the
 * manual "Detect Text Size" flow — that already has its own "Detecting…"
 * button label; this badge is specifically the auto-scan queue.
 */
function ScanStatusBadge({
  itemId,
  variant,
}: {
  itemId: string;
  variant: "grid" | "list";
}) {
  const status = useOcrQueueStore(
    (s) => s.queue.find((q) => q.id === itemId)?.status ?? null,
  );
  if (status !== "queued" && status !== "running") return null;
  const icon = (
    <LoaderCircleIcon
      className={cn("size-3", status === "running" && "animate-spin")}
    />
  );
  const title =
    status === "running" ? "Detecting text…" : "Queued for text detection";
  if (variant === "grid") {
    return (
      <span
        className="pointer-events-none absolute top-1 right-1 flex size-4 items-center justify-center rounded-full bg-black/70 text-white"
        title={title}
      >
        {icon}
      </span>
    );
  }
  return (
    <span
      className="shrink-0 text-muted-foreground"
      title={title}
    >
      {icon}
    </span>
  );
}

export function LibraryList() {
  const items = useMediaStore((s) => s.items);
  const objectUrls = useMediaStore((s) => s.objectUrls);
  const activeId = useMediaStore((s) => s.activeId);
  const setActive = useMediaStore((s) => s.setActive);
  const reorderItem = useMediaStore((s) => s.reorderItem);

  const [view, setView] = useState<ViewMode>("list");
  const [sort, setSort] = useState<SortMode>("custom");
  /** Drop target while dragging a tile: index + which side. */
  const [dropAt, setDropAt] = useState<{ idx: number; after: boolean } | null>(
    null,
  );

  const sorted = useMemo(() => {
    const arr = [...items];
    if (sort === "name") {
      arr.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sort !== "custom") {
      arr.sort((a, b) =>
        sort === "added-asc" ? a.addedAt - b.addedAt : b.addedAt - a.addedAt,
      );
    }
    // Custom: the store order IS the manual order.
    return arr;
  }, [items, sort]);

  /** Tile drag handlers (shared by grid and list): reorder, don't
   * re-import — the custom MIME keeps the window drop zone out of it. */
  const dragProps = (item: MediaItem, idx: number, axis: "x" | "y") => ({
    draggable: true,
    onDragStart: (e: React.DragEvent) => {
      e.dataTransfer.setData(MEDIA_DRAG_MIME, item.id);
      e.dataTransfer.effectAllowed = "move";
    },
    onDragOver: (e: React.DragEvent) => {
      if (!e.dataTransfer.types.includes(MEDIA_DRAG_MIME)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      const r = e.currentTarget.getBoundingClientRect();
      const after =
        axis === "x"
          ? e.clientX > r.left + r.width / 2
          : e.clientY > r.top + r.height / 2;
      setDropAt({ idx, after });
    },
    onDrop: (e: React.DragEvent) => {
      const id = e.dataTransfer.getData(MEDIA_DRAG_MIME);
      setDropAt(null);
      if (!id || id === item.id) return;
      e.preventDefault();
      e.stopPropagation();
      // Reorder against the STORE order; adjust for the removal shift.
      const r = e.currentTarget.getBoundingClientRect();
      const after =
        axis === "x"
          ? e.clientX > r.left + r.width / 2
          : e.clientY > r.top + r.height / 2;
      const storeItems = useMediaStore.getState().items;
      const targetIdx = storeItems.findIndex((i) => i.id === item.id);
      const fromIdx = storeItems.findIndex((i) => i.id === id);
      if (targetIdx < 0 || fromIdx < 0) return;
      let to = targetIdx + (after ? 1 : 0);
      if (fromIdx < to) to -= 1;
      reorderItem(id, to);
      setSort("custom");
    },
    onDragEnd: () => setDropAt(null),
  });

  const dropEdge = (idx: number, axis: "x" | "y") =>
    dropAt?.idx === idx
      ? {
          boxShadow:
            axis === "x"
              ? `inset ${dropAt.after ? "-3px" : "3px"} 0 0 var(--ring)`
              : `inset 0 ${dropAt.after ? "-3px" : "3px"} 0 var(--ring)`,
        }
      : undefined;

  return (
    <div className="border-t border-border">
      <div className="flex items-center gap-1.5 px-2.5 pt-2 pb-1.5">
        <div className="min-w-0 flex-1 truncate whitespace-nowrap">
          <SectionLabel>Library · {items.length}</SectionLabel>
        </div>
        <div className="panel-inset flex items-center gap-0.5 rounded-md p-0.5">
          {SORT_MODES.map(({ mode, label, icon: Icon }) => (
            <button
              key={mode}
              type="button"
              aria-label={label}
              aria-pressed={sort === mode}
              title={label}
              className={cn(
                "flex size-7 items-center justify-center rounded-[6px] transition-colors",
                sort === mode
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setSort(mode)}
            >
              <Icon className="size-4" />
            </button>
          ))}
        </div>
        <div className="panel-inset flex items-center gap-0.5 rounded-md p-0.5">
          {(
            [
              { mode: "grid", icon: LayoutGridIcon, label: "Grid view" },
              { mode: "list", icon: ListIcon, label: "List view" },
            ] as const
          ).map(({ mode, icon: Icon, label }) => (
            <button
              key={mode}
              type="button"
              aria-label={label}
              aria-pressed={view === mode}
              className={cn(
                "flex size-7 items-center justify-center rounded-[6px] transition-colors",
                view === mode
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setView(mode)}
            >
              <Icon className="size-4" />
            </button>
          ))}
        </div>
      </div>

      {items.length === 0 ? (
        <p className="px-2.5 pb-2.5 text-base text-muted-foreground">
          No media yet. Drop images or videos anywhere in the window.
        </p>
      ) : view === "grid" ? (
        <div className="grid grid-cols-3 gap-1.5 px-2.5 pb-2.5">
          {sorted.map((item, idx) => (
            <button
              key={item.id}
              type="button"
              className={cn(
                "relative block aspect-video w-full overflow-hidden rounded-md bg-black/40",
                item.id === activeId
                  ? "ring-2 ring-ring"
                  : "opacity-80 hover:opacity-100",
              )}
              style={dropEdge(idx, "x")}
              title={item.name}
              onClick={() => setActive(item.id)}
              {...dragProps(item, idx, "x")}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={objectUrls[item.id]}
                alt={item.name}
                draggable={false}
                className="size-full object-cover"
              />
              <ScanStatusBadge itemId={item.id} variant="grid" />
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-0.5 px-2.5 pb-2.5">
          {sorted.map((item, idx) => (
            <button
              key={item.id}
              type="button"
              className={cn(
                "flex h-12 w-full items-center gap-2.5 rounded-md px-1.5 text-left transition-colors",
                item.id === activeId
                  ? "panel-inset ring-1 ring-ring ring-inset"
                  : "hover:bg-muted/50",
              )}
              style={dropEdge(idx, "y")}
              onClick={() => setActive(item.id)}
              {...dragProps(item, idx, "y")}
            >
              <span className="block h-9 w-16 shrink-0 overflow-hidden rounded bg-black/40">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={objectUrls[item.id]}
                  alt=""
                  draggable={false}
                  className="size-full object-cover"
                />
              </span>
              <span className="min-w-0 flex-1 truncate text-base" title={item.name}>
                {item.name}
              </span>
              <ScanStatusBadge itemId={item.id} variant="list" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
