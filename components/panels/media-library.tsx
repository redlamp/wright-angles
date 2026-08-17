"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CornerDownRightIcon,
  EyeIcon,
  EyeOffIcon,
  FolderDownIcon,
  LayoutGridIcon,
  ListIcon,
  ScanTextIcon,
  SparklesIcon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Device, MediaCrop, MediaItem } from "@/lib/types";
import {
  ACUITY,
  aspectFromResolution,
  boxMetricsOnDevice,
} from "@/lib/display-math";
import {
  ASPECT_PRESETS,
  aspectCrop,
  boxInCrop,
  cropOf,
  cropsEqual,
  dragCrop,
  effectiveDims,
  isFullFrame,
  type CropHandle,
} from "@/lib/media-crop";
import { useDeviceStore } from "@/stores/device-store";
import { GENERATED_KINDS, useMediaStore } from "@/stores/media-store";
import { usePlaybackStore } from "@/stores/playback-store";
import { isAnimatedItem } from "@/lib/playback-engine";
import { activeKeyframe } from "@/lib/scan-keyframes";
import { groupColor } from "@/lib/text-groups";
import {
  clearCurrentKeyframeScan,
  detectTextForItem,
  scanKeyframeAt,
} from "@/lib/scan-actions";
import { ConfirmButton } from "@/components/ui/confirm-button";
import {
  useAnnotationStore,
  type ScanColorMode,
} from "@/stores/annotation-store";
import { useSettingsStore, type DisplayFill } from "@/stores/settings-store";
import { useUiStore } from "@/stores/ui-store";
import {
  GifView,
  SyncedVideo,
  TransportControls,
} from "@/components/media-view";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const REFERENCE_CHOICES = [720, 1080, 1440, 2160];

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

type ViewMode = "grid" | "list";
type SortMode = "added-asc" | "added-desc" | "name";

const SORT_LABELS: Record<SortMode, string> = {
  "added-desc": "Newest first",
  "added-asc": "Oldest first",
  name: "By name",
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
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
  const [sort, setSort] = useState<SortMode>("added-desc");

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
          <SelectTrigger size="sm" className="w-32" aria-label="Sort by">
            {/* base-ui SelectValue renders the raw value unless given
                children — show the human label, untruncated. */}
            <SelectValue>{SORT_LABELS[sort]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(SORT_LABELS) as SortMode[]).map((k) => (
              <SelectItem key={k} value={k}>
                {SORT_LABELS[k]}
              </SelectItem>
            ))}
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
        <p className="px-2.5 pb-2.5 text-base text-muted-foreground">
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
              <span className="min-w-0 flex-1 truncate text-base" title={item.name}>
                {item.name}
              </span>
              <span className="shrink-0 font-mono text-sm text-muted-foreground">
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

/** Crop interaction pauses animated media; the user resumes manually. */
function pauseIfAnimated() {
  const playback = usePlaybackStore.getState();
  if (playback.animated && playback.playing) playback.setPlaying(false);
}

const CROP_HANDLES: { id: CropHandle; className: string }[] = [
  { id: "nw", className: "top-0 left-0 cursor-nwse-resize" },
  { id: "n", className: "top-0 left-1/2 cursor-ns-resize" },
  { id: "ne", className: "top-0 left-full cursor-nesw-resize" },
  { id: "e", className: "top-1/2 left-full cursor-ew-resize" },
  { id: "se", className: "top-full left-full cursor-nwse-resize" },
  { id: "s", className: "top-full left-1/2 cursor-ns-resize" },
  { id: "sw", className: "top-full left-0 cursor-nesw-resize" },
  { id: "w", className: "top-1/2 left-0 cursor-ew-resize" },
];

/**
 * Direct-manipulation crop editor drawn OVER the full-frame media in the
 * Active Media preview — rendered whenever a crop is in place, so the
 * window is always draggable and resizable right where the media shows.
 * Drags update a local draft for smooth feedback and commit through the
 * same setCrop path the preset buttons use on release; releasing at an
 * effectively full-frame window clears the crop. The host contain-fits
 * the intrinsic frame inside the flex-centered aspect-video box so the
 * percentage-positioned window lines up with image pixels.
 */
function CropOverlayFrame({
  item,
  overlay,
  children,
}: {
  item: MediaItem;
  /** Extra full-frame-coordinate layers (e.g. detected-text boxes). */
  overlay?: React.ReactNode;
  children: React.ReactNode;
}) {
  const setCrop = useMediaStore((s) => s.setCrop);
  const [draft, setDraft] = useState<MediaCrop | null>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    handle: CropHandle;
    startX: number;
    startY: number;
    base: MediaCrop;
  } | null>(null);

  const crop = draft ?? cropOf(item);
  const wide = item.width / item.height >= 16 / 9;

  // The handle id rides on data-handle so one handler serves all nine
  // drag surfaces (a curried closure trips the react-compiler ref lint).
  const onDragStart = (e: React.PointerEvent<HTMLElement>) => {
    // Keep the drag from reaching the media or anything beneath it.
    e.stopPropagation();
    e.preventDefault();
    pauseIfAnimated();
    drag.current = {
      handle: (e.currentTarget.dataset.handle ?? "move") as CropHandle,
      startX: e.clientX,
      startY: e.clientY,
      base: cropOf(item),
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onDragMove = (e: React.PointerEvent<HTMLElement>) => {
    const d = drag.current;
    const host = hostRef.current;
    if (!d || !host || !e.currentTarget.hasPointerCapture(e.pointerId)) return;
    const r = host.getBoundingClientRect();
    if (!r.width || !r.height) return;
    setDraft(
      dragCrop(
        d.base,
        d.handle,
        (e.clientX - d.startX) / r.width,
        (e.clientY - d.startY) / r.height,
        null,
      ),
    );
  };
  const onDragEnd = () => {
    if (!drag.current) return;
    drag.current = null;
    if (draft) setCrop(item.id, isFullFrame(draft) ? undefined : draft);
    setDraft(null);
  };

  return (
    <div
      ref={hostRef}
      className="relative touch-none select-none"
      style={{
        aspectRatio: `${item.width} / ${item.height}`,
        ...(wide ? { width: "100%" } : { height: "100%" }),
      }}
    >
      {children}
      {/* The crop window; the oversized shadow is the outside scrim.
          Rendered only while a crop (or live drag) exists, so the frame
          doubles as a plain full-frame host for other overlays. */}
      {item.crop || draft ? (
        <div
          className="absolute cursor-move touch-none"
          style={{
            left: `${crop.x * 100}%`,
            top: `${crop.y * 100}%`,
            width: `${crop.w * 100}%`,
            height: `${crop.h * 100}%`,
            boxShadow: "0 0 0 100vmax rgba(0,0,0,0.6)",
            outline: "1px solid rgba(255,255,255,0.9)",
          }}
          data-handle="move"
          onPointerDown={onDragStart}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
          onPointerCancel={onDragEnd}
        >
          {CROP_HANDLES.map(({ id, className }) => (
            <div
              key={id}
              data-handle={id}
              className={cn(
                // A 16px hit target around a smaller visual knob.
                "absolute flex size-4 -translate-x-1/2 -translate-y-1/2 items-center justify-center",
                className,
              )}
              onPointerDown={onDragStart}
              onPointerMove={onDragMove}
              onPointerUp={onDragEnd}
              onPointerCancel={onDragEnd}
            >
              <div className="pointer-events-none size-2.5 rounded-[2px] border border-black/60 bg-white" />
            </div>
          ))}
        </div>
      ) : null}
      {overlay}
    </div>
  );
}

/**
 * One compact row: None · standard aspect ratios · Custom. The highlight
 * derives from the stored crop alone: None for no (or effectively
 * full-frame) crop; an aspect button when the crop equals that preset's
 * largest centered window; Custom for anything else — including a preset
 * freely adjusted on the overlay until it no longer matches.
 */
function CropSection({ item }: { item: MediaItem }) {
  const setCrop = useMediaStore((s) => s.setCrop);

  const current = cropOf(item);
  const noCrop = !item.crop || isFullFrame(current);
  const presets = ASPECT_PRESETS.map(({ label, ratio }) => {
    const crop = aspectCrop(ratio, item.width, item.height);
    // An exact-aspect image makes this preset the full frame: uncropped,
    // the button lights up to NAME the native shape (a 1920×1080 image
    // shows 16:9 active) and clicking it is a no-op.
    const wholeFrame = isFullFrame(crop);
    return {
      label,
      crop,
      wholeFrame,
      active: wholeFrame ? noCrop : !noCrop && cropsEqual(current, crop),
    };
  });
  const nativeMatch = presets.some((p) => p.wholeFrame);
  const noneActive = noCrop && !nativeMatch;
  const customActive = !noCrop && !presets.some((p) => p.active);

  return (
    <div className="space-y-1.5">
      <div className="flex h-5 items-center justify-between">
        <SectionLabel>Crop</SectionLabel>
      </div>
      <div className="flex flex-wrap gap-1">
        <Button
          variant={noneActive ? "default" : "secondary"}
          size="sm"
          className="h-6 px-1.5 text-sm"
          aria-pressed={noneActive}
          title="Show the full frame, uncropped"
          onClick={() => setCrop(item.id, undefined)}
        >
          None
        </Button>
        {presets.map(({ label, crop, wholeFrame, active }) => (
          <Button
            key={label}
            variant={active ? "default" : "secondary"}
            size="sm"
            className="h-6 px-1.5 text-sm"
            aria-pressed={active}
            title={
              wholeFrame
                ? `The image is natively ${label}`
                : `Largest centered ${label} window`
            }
            onClick={() =>
              setCrop(item.id, wholeFrame ? undefined : crop)
            }
          >
            {label}
          </Button>
        ))}
        <Button
          variant={customActive ? "default" : "secondary"}
          size="sm"
          className="h-6 px-1.5 text-sm"
          aria-pressed={customActive}
          title="Freeform crop — drag the window on the preview above"
          onClick={() => {
            pauseIfAnimated();
            if (noCrop) {
              // Start a centered ~80% window.
              setCrop(item.id, { x: 0.1, y: 0.1, w: 0.8, h: 0.8 });
            } else {
              // Entering Custom FROM a preset (Taylor): keep the window
              // where it is, nudged a hair (0.4%) off the preset match
              // so Custom takes the highlight and edits are freeform.
              const c = cropOf(item);
              setCrop(item.id, { ...c, w: c.w * 0.996, h: c.h * 0.996 });
            }
          }}
        >
          Custom…
        </Button>
      </div>
    </div>
  );
}

/**
 * Fully local OCR (vendored Tesseract, see public/ocr/README.md): each
 * detected text line becomes a regular HighlightBox, so it flows into the
 * 2D overlay and the Perception Report like a hand-drawn one. Keyed by
 * item id via DetailCard, so the last-run state resets on switch.
 */
interface ScanLine {
  id: string;
  text: string;
  confidence: number;
  box: { x: number; y: number; w: number; h: number };
  /** Text block (lib/text-groups); drives the shared size + tint. */
  groupId?: number;
  /** Descender-aware group font-size estimate in source px. */
  sizePx?: number;
}


const scanBandColor = (arcmin: number) =>
  arcmin >= ACUITY.comfortableTextArcmin
    ? "#46a758"
    : arcmin >= ACUITY.minCriticalTextArcmin
      ? "#f5a524"
      : "#e5484d";

/**
 * The useful data behind an OCR run: the image with each detected line
 * outlined and numbered, plus a per-line table (text, px height,
 * confidence, arcmin on This Device). Rows select their measure box.
 */
const scanLineColor = (
  line: ScanLine,
  mode: ScanColorMode,
  item: MediaItem,
  thisDevice: Device,
): string => {
  if (mode === "group") return groupColor(line.groupId);
  const crop = cropOf(item);
  const hNorm = line.sizePx ? line.sizePx / item.height : line.box.h;
  const arcmin = boxMetricsOnDevice(
    hNorm / crop.h,
    effectiveDims(item),
    thisDevice,
  ).arcmin;
  return scanBandColor(arcmin);
};

/**
 * Detected-line outlines drawn over the top media display, in full-frame
 * coordinates (rendered inside CropOverlayFrame's intrinsic-aspect host —
 * per Taylor, no second image area). Clicking an outline selects its
 * measure box, same as a list row.
 */
function ScanBoxesOverlay({
  lines,
  item,
}: {
  lines: ScanLine[];
  item: MediaItem;
}) {
  const colorMode = useAnnotationStore((s) => s.scanColorMode);
  const thisDevice = useDeviceStore((s) => s.thisDevice);
  const selectedBoxId = useAnnotationStore((s) => s.selectedBoxId);
  const selectBox = useAnnotationStore((s) => s.selectBox);
  return (
    <>
      {lines.map((line, i) => (
        <button
          key={line.id}
          type="button"
          aria-label={`Select detected line ${i + 1}`}
          className={cn(
            "absolute border hover:border-white/80",
            line.id === selectedBoxId && "z-10 border-2",
          )}
          style={{
            left: `${line.box.x * 100}%`,
            top: `${line.box.y * 100}%`,
            width: `${line.box.w * 100}%`,
            height: `${line.box.h * 100}%`,
            borderColor:
              line.id === selectedBoxId
                ? "#ffffff"
                : scanLineColor(line, colorMode, item, thisDevice),
          }}
          onClick={(e) => {
            e.stopPropagation();
            selectBox(line.id === selectedBoxId ? null : line.id);
          }}
        />
      ))}
    </>
  );
}

function ScanResults({
  item,
  lines,
}: {
  item: MediaItem;
  lines: ScanLine[];
}) {
  const colorMode = useAnnotationStore((s) => s.scanColorMode);
  const thisDevice = useDeviceStore((s) => s.thisDevice);
  const selectedBoxId = useAnnotationStore((s) => s.selectedBoxId);
  const selectBox = useAnnotationStore((s) => s.selectBox);
  const crop = cropOf(item);
  const eff = effectiveDims(item);
  // User-adjustable list height (session-local).
  const [listH, setListH] = useState(160);
  const resize = useRef<{ startY: number; base: number } | null>(null);

  const rows = lines
    .map((line, i) => {
      const inCrop = boxInCrop(line.box, crop);
      // Group-corrected height when available (descender-aware, plan
      // 7.2), else the raw ink box.
      const hNorm = line.sizePx ? line.sizePx / item.height : line.box.h;
      const arcmin = boxMetricsOnDevice(hNorm / crop.h, eff, thisDevice).arcmin;
      const shownPx = Math.round(line.sizePx ?? line.box.h * item.height);
      return { line, i, inCrop, arcmin, shownPx };
    })
    .filter((r) => r.inCrop !== null);

  return (
    <div className="space-y-1">
      <div className="space-y-0.5 overflow-y-auto" style={{ height: listH }}>
        {rows.map(({ line, i, arcmin, shownPx }) => (
          <button
            key={line.id}
            type="button"
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left transition-colors",
              line.id === selectedBoxId
                ? "panel-inset ring-1 ring-ring ring-inset"
                : "hover:bg-muted/50",
            )}
            onClick={() =>
              selectBox(line.id === selectedBoxId ? null : line.id)
            }
          >
            {/* Dot follows the color mode: block tint (7.3) or the
                legibility verdict band. */}
            <span
              className="size-2 shrink-0 rounded-full"
              title={
                colorMode === "group"
                  ? line.groupId !== undefined
                    ? `Text group ${line.groupId + 1} — size shared across the block`
                    : undefined
                  : "Legibility on This Device (ISO 16′ / 20′ bands)"
              }
              style={{
                background:
                  colorMode === "group"
                    ? groupColor(line.groupId)
                    : scanBandColor(arcmin),
              }}
            />
            <span className="w-5 shrink-0 font-mono text-sm text-muted-foreground">
              {i + 1}
            </span>
            <span
              className="min-w-0 flex-1 truncate text-base"
              title={line.text}
            >
              {line.text}
            </span>
            <span
              className="shrink-0 font-mono text-sm text-muted-foreground"
              title={
                line.sizePx
                  ? "Group-corrected font size (raw ink box may be shorter)"
                  : undefined
              }
            >
              {shownPx}px · {Math.round(line.confidence)}%
            </span>
            <span
              className="shrink-0 font-mono text-sm"
              style={{ color: scanBandColor(arcmin) }}
              title="Arc minutes on This Device (cap height, ISO bands 16'/20')"
            >
              {arcmin.toFixed(0)}′
            </span>
          </button>
        ))}
      </div>
      {/* Height grip: drag to grow/shrink the list (plan: adjustable). */}
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize detected text list"
        className="mx-auto h-1.5 w-16 cursor-ns-resize touch-none rounded-full bg-border transition-colors hover:bg-ring/60"
        onPointerDown={(e) => {
          resize.current = { startY: e.clientY, base: listH };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const r = resize.current;
          if (!r || !e.currentTarget.hasPointerCapture(e.pointerId)) return;
          setListH(
            Math.min(480, Math.max(80, r.base + (e.clientY - r.startY))),
          );
        }}
        onPointerUp={() => {
          resize.current = null;
        }}
      />
    </div>
  );
}

interface ScanRun {
  lines: ScanLine[];
  medianPx: number;
}

/**
 * Header-row controls + result list for OCR. The scan state lives in
 * DetailCard (which also draws the boxes over the media display); this
 * section is the buttons, status line, and the per-line table.
 */
function TextDetectionSection({
  item,
  scan,
  running,
  failed,
  showBoxes,
  onToggleBoxes,
  onDetect,
  onClear,
  animated = false,
  unscannedCount = 0,
  onScanAll,
  note,
  onClearAll,
}: {
  item: MediaItem;
  scan: ScanRun | null;
  running: boolean;
  failed: boolean;
  showBoxes: boolean;
  onToggleBoxes: () => void;
  onDetect: () => void;
  /** Timeline media: clears the ACTIVE keyframe's scan (marker stays). */
  onClear: () => void;
  /** Timeline media: scans attach to keyframes instead of the item. */
  animated?: boolean;
  unscannedCount?: number;
  onScanAll?: () => void;
  /** Status line override (keyframe context / batch progress). */
  note?: string | null;
  onClearAll: () => void;
}) {
  const colorMode = useAnnotationStore((s) => s.scanColorMode);
  const setScanColorMode = useAnnotationStore((s) => s.setScanColorMode);
  const canScan = item.kind === "image" || animated;
  const hasLines = !!scan && scan.lines.length > 0;
  const hasAnyDetection =
    hasLines ||
    (item.boxes?.length ?? 0) > 0 ||
    (item.scanKeyframes?.length ?? 0) > 0;

  return (
    <div className="space-y-1.5">
      <div className="flex h-6 items-center justify-between gap-1">
        <span className="flex items-center gap-1.5">
          {/* Eye LEFT of the label, styled as a real button (Taylor). */}
          <button
            type="button"
            aria-pressed={showBoxes}
            title={
              showBoxes
                ? "Hide text boxes everywhere (2D, 3D, previews)"
                : "Show text boxes everywhere (2D, 3D, previews)"
            }
            className={cn(
              "panel-inset flex size-6 items-center justify-center rounded-md transition-colors",
              showBoxes
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
            onClick={onToggleBoxes}
          >
            {showBoxes ? (
              <EyeIcon className="size-3.5" />
            ) : (
              <EyeOffIcon className="size-3.5" />
            )}
          </button>
          <SectionLabel>Text detection</SectionLabel>
        </span>
        {/* Exact order + language per Taylor 2026-08-17 14:30:
            Clear All · Clear Current (timeline only) · Detect Text Size.
            Destructive actions in red. */}
        <span className="flex items-center gap-1">
          {hasAnyDetection ? (
            <ConfirmButton
              label="Clear All"
              title="Remove EVERY box and keyframe on this media — including ones from older sessions"
              onConfirm={onClearAll}
            />
          ) : null}
          {animated && hasLines ? (
            <ConfirmButton
              label="Clear Current"
              title="Clear the scan on the current keyframe (the marker stays)"
              onConfirm={onClear}
            />
          ) : null}
          {animated && unscannedCount > 0 && onScanAll ? (
            <Button
              variant="secondary"
              size="sm"
              className="h-6 px-1.5 text-sm"
              disabled={running}
              title="Scan every unscanned keyframe in order"
              onClick={onScanAll}
            >
              Scan all ({unscannedCount})
            </Button>
          ) : null}
          <Button
            variant="secondary"
            size="sm"
            className="h-6 px-1.5 text-sm"
            disabled={running || !canScan}
            title={
              animated
                ? "Pause here and scan this frame (adds an OCR keyframe at the playhead)"
                : canScan
                  ? "Find text lines with local OCR and add a measure box per line"
                  : "Text detection needs an image or timeline frame"
            }
            onClick={onDetect}
          >
            <ScanTextIcon className="size-3.5" />
            {running ? "Detecting…" : "Detect Text Size"}
          </Button>
        </span>
      </div>
      {failed ? (
        <p className="text-sm text-muted-foreground">
          Couldn&apos;t detect text — see console.
        </p>
      ) : null}
      <div className="flex items-center justify-between gap-2">
        {failed ? null : animated ? (
          note ? (
            <p className="min-w-0 flex-1 text-sm text-muted-foreground">
              {note}
            </p>
          ) : (
            <span className="flex-1" />
          )
        ) : scan ? (
          <p className="min-w-0 flex-1 text-sm text-muted-foreground">
            {scan.lines.length === 0
              ? "No text found."
              : `${scan.lines.length} text line${
                  scan.lines.length === 1 ? "" : "s"
                } → boxes · median ${Math.round(scan.medianPx)}px tall`}
          </p>
        ) : (
          <span className="flex-1" />
        )}
        {hasLines ? (
          <span className="panel-inset flex h-6 shrink-0 items-center gap-0.5 rounded-md p-0.5">
            {(
              [
                { id: "group", label: "Groups" },
                { id: "rating", label: "Sizes" },
              ] as const
            ).map((m) => (
              <button
                key={m.id}
                type="button"
                aria-pressed={colorMode === m.id}
                title={
                  m.id === "group"
                    ? "Color by text block"
                    : "Color by legibility verdict on This Device"
                }
                className={cn(
                  "h-full rounded-[5px] px-1.5 text-sm transition-colors",
                  colorMode === m.id
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setScanColorMode(m.id)}
              >
                {m.label}
              </button>
            ))}
          </span>
        ) : null}
      </div>
      {hasLines ? <ScanResults item={item} lines={scan.lines} /> : null}
      {hasLines ? <ScanFollowThrough /> : null}
    </div>
  );
}

/** Post-scan deep link (plan 5.5): the verdicts live one tab over.
 * CornerDownRight reads as in-app navigation, not an external link. */
function ScanFollowThrough() {
  const openWorkbenchTab = useUiStore((s) => s.openWorkbenchTab);
  return (
    <div className="flex gap-1">
      <Button
        variant="ghost"
        size="sm"
        className="h-6 px-1.5 text-sm text-muted-foreground hover:text-foreground"
        title="Switch to the Perception Report tab — measured text carries its read content"
        onClick={() => openWorkbenchTab("report")}
      >
        <CornerDownRightIcon className="size-3.5" />
        Perception Report
      </Button>
    </div>
  );
}


const fmtKfTime = (t: number) => {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
};

/** Keyed by item id at the callsite so the armed/scan state resets on switch. */
function DetailCard({ item }: { item: MediaItem }) {
  const objectUrl = useMediaStore((s) => s.objectUrls[item.id]);
  const videoUrl = useMediaStore((s) => s.videoUrls[item.id]);
  const remove = useMediaStore((s) => s.remove);
  const setReferenceHeight = useMediaStore((s) => s.setReferenceHeight);
  const [armed, setArmed] = useState(false);
  const eff = effectiveDims(item);
  const aspect = aspectFromResolution({ w: eff.width, h: eff.height });

  // OCR scan state lives here so the detected boxes can render over the
  // media display above (no second image area — Taylor 2026-08-17).
  // Images keep a one-shot scan; timeline media (video/GIF) scans attach
  // to user-placed keyframes and the ACTIVE keyframe's scan shows until
  // the playhead passes the next marker (plan topic 9).
  const [scanRunning, setScanRunning] = useState(false);
  const [scanFailed, setScanFailed] = useState(false);
  // Global eye state — shared with the Perception Report and the
  // 2D/3D world views (Taylor: parity of state across panels/views).
  const showScanBoxes = useAnnotationStore((s) => s.showTextBoxes);
  const setShowScanBoxes = useAnnotationStore((s) => s.setShowTextBoxes);
  const [batchNote, setBatchNote] = useState<string | null>(null);
  const clearDetection = useMediaStore((s) => s.clearDetection);

  const animated = isAnimatedItem(item);
  const timeSec = usePlaybackStore((s) => s.timeSec);
  const keyframes = item.scanKeyframes ?? [];
  const kf = animated ? activeKeyframe(keyframes, timeSec) : null;
  const unscannedCount = keyframes.filter((k) => !k.lines).length;
  // Persisted on the item, so returning to a scanned media shows its
  // detection again without re-running (Taylor 14:30 bug report).
  const effectiveScan: ScanRun | null = animated
    ? kf?.lines
      ? { lines: kf.lines, medianPx: kf.medianPx ?? 0 }
      : null
    : (item.scan ?? null);

  const freshKeyframes = () =>
    useMediaStore.getState().items.find((i) => i.id === item.id)
      ?.scanKeyframes ?? [];

  const detect = async () => {
    if (scanRunning) return;
    setScanRunning(true);
    setScanFailed(false);
    try {
      await detectTextForItem(item.id);
      setShowScanBoxes(true);
    } catch (err) {
      console.warn("Text detection failed:", err);
      setScanFailed(true);
    } finally {
      setScanRunning(false);
    }
  };

  const scanAll = async () => {
    if (scanRunning) return;
    setScanRunning(true);
    setScanFailed(false);
    try {
      const pending = freshKeyframes().filter((k) => !k.lines);
      for (let i = 0; i < pending.length; i++) {
        setBatchNote(`Scanning keyframe ${i + 1} of ${pending.length}…`);
        await scanKeyframeAt(item.id, pending[i].timeSec);
      }
      setShowScanBoxes(true);
    } catch (err) {
      console.warn("Batch text detection failed:", err);
      setScanFailed(true);
    } finally {
      setBatchNote(null);
      setScanRunning(false);
    }
  };

  const clearCurrent = () => clearCurrentKeyframeScan(item.id);

  const keyframeNote =
    batchNote ??
    (animated
      ? keyframes.length === 0
        ? "Mark frames on the timeline (bookmark button), then scan them."
        : kf
          ? kf.lines
            ? `Keyframe ${fmtKfTime(kf.timeSec)} · ${kf.lines.length} line${
                kf.lines.length === 1 ? "" : "s"
              } · median ${Math.round(kf.medianPx ?? 0)}px — shown until the next marker`
            : `Keyframe ${fmtKfTime(kf.timeSec)} — not scanned yet`
          : "Playhead is before the first keyframe."
      : null);

  return (
    <div className="space-y-2.5 p-2.5">
      <SectionLabel>Active media</SectionLabel>

      {/* Name row: rename inline, remove via the trashcan (5.1). */}
      <div className="flex items-center gap-1.5">
        <div className="min-w-0 flex-1">
          <NameField key={item.id} item={item} />
        </div>
        <button
          type="button"
          title="Remove from library"
          aria-label="Remove from library"
          className="flex size-8 shrink-0 items-center justify-center rounded-md text-destructive transition-colors hover:bg-destructive/10"
          onClick={() => setArmed(true)}
        >
          <Trash2Icon className="size-4" />
        </button>
      </div>
      {armed ? (
        <div className="flex gap-2">
          <button
            type="button"
            className="h-8 flex-1 rounded-md bg-destructive text-base text-white transition-opacity hover:opacity-90"
            onClick={() => void remove(item.id)}
          >
            Really remove
          </button>
          <button
            type="button"
            className="ctl-quiet h-8 flex-1 text-base"
            onClick={() => setArmed(false)}
          >
            Cancel
          </button>
        </div>
      ) : null}

      {/* Details grid (5.2): the same two cells for every media item —
          what the simulation displays vs what the file is. */}
      <div className="grid grid-cols-2 gap-1.5">
        <div className="panel-inset rounded-md px-2.5 py-1.5">
          <div className="text-sm tracking-wide text-muted-foreground uppercase">
            Display{item.crop ? " · cropped" : ""}
          </div>
          <div className="font-mono text-sm leading-5">
            {eff.width}×{eff.height} · {aspect.w}:{aspect.h}
            {item.kind === "video" && item.duration
              ? ` · ${Math.round(item.duration)}s`
              : ""}
          </div>
        </div>
        <div className="panel-inset rounded-md px-2.5 py-1.5">
          <div className="text-sm tracking-wide text-muted-foreground uppercase">
            Source
          </div>
          <div className="font-mono text-sm leading-5">
            {item.width}×{item.height}
          </div>
        </div>
      </div>

      <div className="panel-inset flex aspect-video items-center justify-center overflow-hidden rounded-md bg-black/40">
        {/* The one media display: full frame in an intrinsic-aspect host,
            with the crop window (when cropped) and the detected-text
            boxes (when scanned + shown) layered directly over it. */}
        <CropOverlayFrame
          item={item}
          overlay={
            showScanBoxes && effectiveScan && effectiveScan.lines.length > 0 ? (
              <ScanBoxesOverlay lines={effectiveScan.lines} item={item} />
            ) : null
          }
        >
          {item.kind === "video" && videoUrl ? (
            <SyncedVideo
              src={videoUrl}
              className="absolute inset-0 size-full"
            />
          ) : item.type === "image/gif" ? (
            <GifView
              url={objectUrl}
              alt={item.name}
              className="absolute inset-0 size-full"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={objectUrl}
              alt={item.name}
              draggable={false}
              className="absolute inset-0 size-full"
            />
          )}
        </CropOverlayFrame>
      </div>

      <TransportControls />

      <CropSection item={item} />

      <TextDetectionSection
        item={item}
        scan={effectiveScan}
        running={scanRunning}
        failed={scanFailed}
        showBoxes={showScanBoxes}
        onToggleBoxes={() => setShowScanBoxes(!showScanBoxes)}
        onDetect={() => void detect()}
        onClear={clearCurrent}
        animated={animated}
        unscannedCount={unscannedCount}
        onScanAll={() => void scanAll()}
        note={keyframeNote}
        onClearAll={() => clearDetection(item.id)}
      />

      <label className="flex h-9 items-center justify-between gap-2 text-base text-muted-foreground">
        <span className="flex items-center gap-1.5">
          Reference size
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger
                aria-label="What reference size means"
                className="flex size-4 cursor-help items-center justify-center rounded-full border border-muted-foreground/50 text-sm leading-none transition-colors hover:border-foreground/60 hover:text-foreground"
              >
                ?
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-60">
                Tells Wright Angles how large this content really is — one
                screen-height of the source device. Measurements and
                arc-minute readouts scale from it.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </span>
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
              "h-full rounded-[6px] px-2.5 text-sm transition-colors",
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

/** Media Library tab content (hosted by the workbench panel). */
export function MediaLibraryContent() {
  const items = useMediaStore((s) => s.items);
  const activeId = useMediaStore((s) => s.activeId);
  const active = items.find((i) => i.id === activeId);
  const splitPct = useUiStore((s) => s.mediaSplitPct);
  const setSplitPct = useUiStore((s) => s.setMediaSplitPct);

  const bodyRef = useRef<HTMLDivElement>(null);

  const detailColumn = (
    // Scrollbar always reserved so incoming content (scan lists, crop
    // rows) doesn't pop the layout width (Taylor 2026-08-17).
    <div className="min-h-0 min-w-0 overflow-y-scroll">
      {active ? (
        <DetailCard key={active.id} item={active} />
      ) : (
        <p className="p-2.5 text-base text-muted-foreground">
          Select something in the library to see its details.
        </p>
      )}
      <DisplayFillRow />
    </div>
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
        <div
          ref={bodyRef}
          className="grid min-h-0 flex-1 overflow-x-clip"
          style={{ gridTemplateColumns: `${splitPct}% 5px minmax(0, 1fr)` }}
        >
          {/* Library and active media scroll independently. */}
          <div className="min-h-0 min-w-0 overflow-y-auto">
            <Toolbar />
            <LibraryList />
          </div>
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize library columns"
            className="cursor-col-resize touch-none border-x border-border bg-transparent transition-colors hover:bg-ring/40"
            onPointerDown={(e) => {
              (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              if (!(e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) return;
              const host = bodyRef.current;
              if (!host) return;
              const r = host.getBoundingClientRect();
              setSplitPct(((e.clientX - r.left) / r.width) * 100);
            }}
          />
          {detailColumn}
        </div>
    </div>
  );
}
