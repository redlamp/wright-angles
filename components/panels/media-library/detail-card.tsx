"use client";

import { useEffect, useRef, useState } from "react";
import { Trash2Icon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useOcrQueueStore } from "@/stores/ocr-queue-store";
import type { MediaItem } from "@/lib/types";
import { aspectFromResolution } from "@/lib/display-math";
import { formatTimecode } from "@/lib/units";
import { effectiveDims } from "@/lib/media-crop";
import { useMediaStore } from "@/stores/media-store";
import { usePlaybackStore } from "@/stores/playback-store";
import { isAnimatedItem } from "@/lib/playback-engine";
import { activeKeyframe } from "@/lib/scan-keyframes";
import {
  clearCurrentKeyframeScan,
  detectTextForItem,
  scanKeyframeAt,
} from "@/lib/scan-actions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAnnotationStore } from "@/stores/annotation-store";
import { useSettingsStore, type DisplayFill } from "@/stores/settings-store";
import {
  GifView,
  SyncedVideo,
  TransportControls,
} from "@/components/media-view";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { SectionLabel } from "./shared";
import { CropOverlayFrame, CropSection } from "./crop";
import { ScanBoxesOverlay } from "./scan-results";
import { type ScanRun, TextDetectionSection } from "./text-detection";

const REFERENCE_CHOICES = [720, 1080, 1440, 2160];

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


/** Keyed by item id at the callsite so the armed/scan state resets on switch. */
export function DetailCard({ item }: { item: MediaItem }) {
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
  // The active item can be mid-auto-scan (its turn in the import batch)
  // without the manual button ever having been clicked — fold that into
  // the same "running" signal so the button reads Detecting/disabled
  // either way, rather than looking idle while a scan is genuinely
  // in flight underneath it.
  const autoScanStatus = useOcrQueueStore(
    (s) => s.queue.find((q) => q.id === item.id)?.status ?? null,
  );
  const autoScanning =
    autoScanStatus === "running" || autoScanStatus === "queued";
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

  // DetailCard is keyed by item.id (MediaLibraryContent), so switching
  // the active item unmounts this instance outright while a detect()/
  // scanAll() may still be mid-await — guard every setState after an
  // await so a finishing scan for an item the user has since left
  // doesn't write into a component that's gone. The scan itself (it
  // persists straight to the store, keyed by item.id) still runs to
  // completion either way.
  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const detect = async () => {
    if (scanRunning) return;
    setScanRunning(true);
    setScanFailed(false);
    try {
      await detectTextForItem(item.id);
      if (aliveRef.current) setShowScanBoxes(true);
    } catch (err) {
      console.warn("Text detection failed:", err);
      if (aliveRef.current) setScanFailed(true);
    } finally {
      if (aliveRef.current) setScanRunning(false);
    }
  };

  const scanAll = async () => {
    if (scanRunning) return;
    setScanRunning(true);
    setScanFailed(false);
    try {
      const pending = freshKeyframes().filter((k) => !k.lines);
      for (let i = 0; i < pending.length; i++) {
        if (aliveRef.current) {
          setBatchNote(`Scanning keyframe ${i + 1} of ${pending.length}…`);
        }
        await scanKeyframeAt(item.id, pending[i].timeSec);
      }
      if (aliveRef.current) setShowScanBoxes(true);
    } catch (err) {
      console.warn("Batch text detection failed:", err);
      if (aliveRef.current) setScanFailed(true);
    } finally {
      if (aliveRef.current) {
        setBatchNote(null);
        setScanRunning(false);
      }
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
            ? `Keyframe ${formatTimecode(kf.timeSec)} · ${kf.lines.length} line${
                kf.lines.length === 1 ? "" : "s"
              } · median ${Math.round(kf.medianPx ?? 0)} px — shown until the next marker`
            : `Keyframe ${formatTimecode(kf.timeSec)} — not scanned yet`
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
      {/* Deleting confirms in a dialog, not an inline row (Taylor). */}
      <Dialog open={armed} onOpenChange={setArmed}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove from library?</DialogTitle>
            <DialogDescription>
              “{item.name}” and its boxes, crop, and scans will be deleted
              from this browser. This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setArmed(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setArmed(false);
                void remove(item.id);
              }}
            >
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
          <SelectTrigger size="sm">
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

      <TextDetectionSection
        item={item}
        scan={effectiveScan}
        running={scanRunning || autoScanning}
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

    </div>
  );
}

export function DisplayFillRow() {
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
