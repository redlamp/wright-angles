"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { MediaCrop, MediaItem } from "@/lib/types";
import {
  ASPECT_PRESETS,
  aspectCrop,
  cropOf,
  cropsEqual,
  dragCrop,
  isFullFrame,
  type CropHandle,
} from "@/lib/media-crop";
import { useMediaStore } from "@/stores/media-store";
import { usePlaybackStore } from "@/stores/playback-store";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SectionLabel } from "./shared";

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
export function CropOverlayFrame({
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

  const stored = cropOf(item);
  const crop = draft ?? stored;
  const hasWindow = draft ? true : !!item.crop;
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
      base: stored,
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
      {hasWindow ? (
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
 * The crop row: None · standard aspect ratios · Custom. The highlight
 * derives from the stored crop alone: None for no (or effectively
 * full-frame) crop; an aspect button when the crop equals that preset's
 * largest centered window; Custom for anything else — including a preset
 * freely adjusted on the overlay until it no longer matches.
 *
 * SOURCE crop only (decision-media-crop-vs-device-fit): one window per
 * item, applied everywhere. How a panel of a different shape presents
 * that content is the device's own `fit` mode, edited in the Device
 * Manager and the device hover card — not here.
 */
export function CropSection({ item }: { item: MediaItem }) {
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
  const value =
    presets.find((p) => p.active)?.label ?? (noCrop ? "none" : "custom");

  const applyChoice = (v: string | null) => {
    if (v === null) return;
    if (v === "none") {
      setCrop(item.id, undefined);
      return;
    }
    if (v === "custom") {
      pauseIfAnimated();
      if (noCrop) {
        // Start a centered ~80% window.
        setCrop(item.id, { x: 0.1, y: 0.1, w: 0.8, h: 0.8 });
      } else {
        // Entering Custom FROM a preset (Taylor): keep the window
        // where it is, nudged a hair (0.4%) off the preset match
        // so Custom takes the highlight and edits are freeform.
        setCrop(item.id, {
          ...current,
          w: current.w * 0.996,
          h: current.h * 0.996,
        });
      }
      return;
    }
    const preset = presets.find((p) => p.label === v);
    if (preset) setCrop(item.id, preset.wholeFrame ? undefined : preset.crop);
  };

  return (
    <div className="flex h-9 items-center justify-between gap-2">
      <SectionLabel>Crop</SectionLabel>
      <Select value={value} onValueChange={applyChoice}>
        <SelectTrigger size="sm" aria-label="Crop aspect">
          <SelectValue>
            {value === "none"
              ? "None"
              : value === "custom"
                ? "Custom"
                : presets.find((p) => p.active)?.wholeFrame
                  ? `${value} (native)`
                  : value}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">None — full frame</SelectItem>
          {presets.map(({ label, wholeFrame }) => (
            <SelectItem key={label} value={label}>
              {label}
              {wholeFrame ? " (native)" : ""}
            </SelectItem>
          ))}
          <SelectItem value="custom">Custom — drag on the preview</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
