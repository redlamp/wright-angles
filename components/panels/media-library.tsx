"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FolderDownIcon,
  ImageIcon,
  LayoutGridIcon,
  ListIcon,
  SparklesIcon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { MediaItem } from "@/lib/types";
import { aspectFromResolution } from "@/lib/display-math";
import { GENERATED_KINDS, useMediaStore } from "@/stores/media-store";
import { useSettingsStore, type DisplayFill } from "@/stores/settings-store";
import { FloatingPanel } from "./floating-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const REFERENCE_CHOICES = [720, 1080, 1440, 2160];

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

type ViewMode = "grid" | "list";
type SortMode = "added-asc" | "added-desc" | "name";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
      {children}
    </span>
  );
}

/**
 * Sample images are a gitignored dev convenience: a manifest at
 * `public/reference/manifest.json` listing image filenames. If it isn't
 * there (any error, non-200, or empty), the action simply never appears.
 */
function normalizeManifest(data: unknown): string[] {
  if (!Array.isArray(data)) return [];
  return data
    .map((entry) => {
      if (typeof entry === "string") return entry;
      if (entry && typeof entry === "object") {
        const file = (entry as { file?: unknown }).file;
        if (typeof file === "string") return file;
      }
      return null;
    })
    .filter((n): n is string => !!n);
}

function useSampleManifest(): string[] | null {
  const [names, setNames] = useState<string[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${BASE_PATH}/reference/manifest.json`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const list = normalizeManifest(await res.json());
        if (!cancelled && list.length > 0) setNames(list);
      } catch {
        // No samples available — the action stays hidden.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return names;
}

/**
 * One slim row: import, generated test images, samples. Dropping files
 * anywhere on the app window already imports them, so no dropzone.
 */
function Toolbar() {
  const addFiles = useMediaStore((s) => s.addFiles);
  const addGenerated = useMediaStore((s) => s.addGenerated);
  const items = useMediaStore((s) => s.items);
  const inputRef = useRef<HTMLInputElement>(null);
  const samples = useSampleManifest();
  const [loadingSamples, setLoadingSamples] = useState(false);

  const loadSamples = useCallback(async () => {
    if (!samples || loadingSamples) return;
    setLoadingSamples(true);
    try {
      const existing = new Set(items.map((i) => i.name));
      const wanted = samples.filter((n) => !existing.has(n));
      const files: File[] = [];
      for (const name of wanted) {
        try {
          const path = name.split("/").map(encodeURIComponent).join("/");
          const res = await fetch(`${BASE_PATH}/reference/${path}`);
          if (!res.ok) continue;
          const blob = await res.blob();
          files.push(new File([blob], name, { type: blob.type || "image/png" }));
        } catch {
          // Skip any file that fails to load.
        }
      }
      if (files.length > 0) await addFiles(files);
    } finally {
      setLoadingSamples(false);
    }
  }, [samples, loadingSamples, items, addFiles]);

  return (
    <div className="flex items-center gap-1.5 p-2.5">
      <Button
        variant="secondary"
        size="sm"
        className="flex-1"
        title="Import images or videos (or drop them anywhere in the window)"
        onClick={() => inputRef.current?.click()}
      >
        <UploadIcon className="size-4" /> Import
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files?.length) void addFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground"
              title="Add a generated test image"
            >
              <SparklesIcon className="size-4" /> Test
            </Button>
          }
        />
        <DropdownMenuContent className="w-44">
          {GENERATED_KINDS.map((k) => (
            <DropdownMenuItem
              key={k.kind}
              onClick={() => void addGenerated(k.kind)}
            >
              {k.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {samples ? (
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground"
          title="Import the local sample screenshots"
          disabled={loadingSamples}
          onClick={() => void loadSamples()}
        >
          <FolderDownIcon className="size-4" />
          {loadingSamples ? "…" : "Samples"}
        </Button>
      ) : null}
    </div>
  );
}

function LibraryList() {
  const items = useMediaStore((s) => s.items);
  const objectUrls = useMediaStore((s) => s.objectUrls);
  const activeId = useMediaStore((s) => s.activeId);
  const setActive = useMediaStore((s) => s.setActive);

  const [view, setView] = useState<ViewMode>("grid");
  const [sort, setSort] = useState<SortMode>("added-asc");

  const sorted = useMemo(() => {
    const arr = [...items];
    if (sort === "name") {
      arr.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      arr.sort((a, b) =>
        sort === "added-asc" ? a.addedAt - b.addedAt : b.addedAt - a.addedAt,
      );
    }
    return arr;
  }, [items, sort]);

  return (
    <div className="border-t border-border">
      <div className="flex items-center gap-1.5 px-2.5 pt-2 pb-1.5">
        <div className="min-w-0 flex-1">
          <SectionLabel>Library · {items.length}</SectionLabel>
        </div>
        <Select value={sort} onValueChange={(v) => setSort(v as SortMode)}>
          <SelectTrigger size="sm" className="w-26" aria-label="Sort by">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="added-asc">Added ↑</SelectItem>
            <SelectItem value="added-desc">Added ↓</SelectItem>
            <SelectItem value="name">Name</SelectItem>
          </SelectContent>
        </Select>
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
        <p className="px-2.5 pb-2.5 text-sm text-muted-foreground">
          No media yet. Drop images or videos anywhere in the window.
        </p>
      ) : view === "grid" ? (
        <div className="grid grid-cols-3 gap-1.5 px-2.5 pb-2.5">
          {sorted.map((item) => (
            <button
              key={item.id}
              type="button"
              className={cn(
                "block aspect-video w-full overflow-hidden rounded-md bg-black/40",
                item.id === activeId
                  ? "ring-2 ring-ring"
                  : "opacity-80 hover:opacity-100",
              )}
              title={item.name}
              onClick={() => setActive(item.id)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={objectUrls[item.id]}
                alt={item.name}
                className="size-full object-cover"
              />
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-0.5 px-2.5 pb-2.5">
          {sorted.map((item) => (
            <button
              key={item.id}
              type="button"
              className={cn(
                "flex h-9 w-full items-center gap-2 rounded-md px-1.5 text-left transition-colors",
                item.id === activeId
                  ? "panel-inset ring-1 ring-ring ring-inset"
                  : "hover:bg-muted/50",
              )}
              onClick={() => setActive(item.id)}
            >
              <span className="block h-6 w-10 shrink-0 overflow-hidden rounded bg-black/40">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={objectUrls[item.id]}
                  alt=""
                  className="size-full object-cover"
                />
              </span>
              <span className="min-w-0 flex-1 truncate text-sm" title={item.name}>
                {item.name}
              </span>
              <span className="shrink-0 font-mono text-xs text-muted-foreground">
                {item.width}×{item.height}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Keyed by item id at the callsite so drafts reset when the item changes. */
function NameField({ item }: { item: MediaItem }) {
  const rename = useMediaStore((s) => s.rename);
  const [draft, setDraft] = useState(item.name);

  const commit = () => {
    if (draft.trim() && draft.trim() !== item.name) rename(item.id, draft);
  };

  return (
    <Input
      aria-label="Media name"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") setDraft(item.name);
      }}
    />
  );
}

/** Keyed by item id at the callsite so the armed state resets on switch. */
function DetailCard({ item }: { item: MediaItem }) {
  const objectUrl = useMediaStore((s) => s.objectUrls[item.id]);
  const remove = useMediaStore((s) => s.remove);
  const setReferenceHeight = useMediaStore((s) => s.setReferenceHeight);
  const [armed, setArmed] = useState(false);
  const aspect = aspectFromResolution({ w: item.width, h: item.height });

  return (
    <div className="space-y-2.5 p-2.5">
      <SectionLabel>Active media</SectionLabel>
      <div className="panel-inset flex aspect-video items-center justify-center overflow-hidden rounded-md bg-black/40">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={objectUrl}
          alt={item.name}
          className="size-full object-contain"
        />
      </div>

      <NameField key={item.id} item={item} />

      {/* Measurements: what the simulation actually uses. */}
      <div className="panel-inset space-y-0.5 rounded-md px-2.5 py-2 font-mono text-xs leading-5 text-muted-foreground">
        <div>
          {item.width}×{item.height}px native · {aspect.w}:{aspect.h}
          {item.kind === "video" && item.duration
            ? ` · ${Math.round(item.duration)}s`
            : ""}
        </div>
        <div>
          shown as {item.referenceHeight}p content
          {item.referenceHeight !== item.height ? " (scaled)" : ""}
        </div>
      </div>

      <label className="flex h-9 items-center justify-between gap-2 text-sm text-muted-foreground">
        Reference size
        <Select
          value={String(item.referenceHeight)}
          onValueChange={(v) => setReferenceHeight(item.id, Number(v))}
        >
          <SelectTrigger size="sm" className="w-30">
            <SelectValue>
              {item.referenceHeight}p
              {item.referenceHeight === item.height ? " (native)" : ""}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {[...new Set([item.height, ...REFERENCE_CHOICES])]
              .sort((a, b) => a - b)
              .map((h) => (
                <SelectItem key={h} value={String(h)}>
                  {h}p{h === item.height ? " (native)" : ""}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </label>

      {armed ? (
        <div className="flex gap-2">
          <button
            type="button"
            className="h-8 flex-1 rounded-md bg-destructive text-sm text-white transition-opacity hover:opacity-90"
            onClick={() => void remove(item.id)}
          >
            Really remove
          </button>
          <button
            type="button"
            className="ctl-quiet h-8 flex-1 text-sm"
            onClick={() => setArmed(false)}
          >
            Cancel
          </button>
        </div>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-center text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={() => setArmed(true)}
        >
          <Trash2Icon className="size-4" /> Remove from library…
        </Button>
      )}
    </div>
  );
}

function DisplayFillRow() {
  const displayFill = useSettingsStore((s) => s.displayFill);
  const setDisplayFill = useSettingsStore((s) => s.setDisplayFill);

  return (
    <div className="flex items-center justify-between gap-2 border-t border-border px-2.5 py-2">
      <SectionLabel>Empty fill</SectionLabel>
      <div className="panel-inset flex h-8 items-center gap-0.5 rounded-md p-0.5">
        {(
          [
            { value: "black", label: "Black" },
            { value: "device-color", label: "Key color" },
          ] as { value: DisplayFill; label: string }[]
        ).map((o) => (
          <button
            key={o.value}
            type="button"
            className={cn(
              "h-full rounded-[6px] px-2.5 text-xs transition-colors",
              o.value === displayFill
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => setDisplayFill(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function MediaLibraryPanel() {
  const items = useMediaStore((s) => s.items);
  const activeId = useMediaStore((s) => s.activeId);
  const active = items.find((i) => i.id === activeId);

  return (
    <FloatingPanel
      id="media"
      title="Media Library"
      icon={ImageIcon}
      defaultPosition={{ x: 420, y: 16 }}
      width={360}
    >
      {/* Container query: widen the panel past 30rem and the detail
          column sits beside the library instead of below it. */}
      <div className="@container">
        <div className="grid max-h-[calc(100vh-8rem)] overflow-x-clip overflow-y-auto @[30rem]:grid-cols-2 @[30rem]:divide-x @[30rem]:divide-border">
          <div className="min-w-0">
            <Toolbar />
            <LibraryList />
          </div>
          <div className="min-w-0 border-t border-border @[30rem]:border-t-0">
            {active ? (
              <DetailCard key={active.id} item={active} />
            ) : (
              <p className="p-2.5 text-sm text-muted-foreground">
                Select something in the library to see its details.
              </p>
            )}
            <DisplayFillRow />
            <p className="px-2.5 py-1.5 text-xs text-muted-foreground/70">
              Media is stored in your browser only — never uploaded.
            </p>
          </div>
        </div>
      </div>
    </FloatingPanel>
  );
}
