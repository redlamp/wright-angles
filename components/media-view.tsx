"use client";

import { useEffect, useRef } from "react";
import {
  BookmarkMinusIcon,
  BookmarkPlusIcon,
  PauseIcon,
  PlayIcon,
  RepeatIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getEngine } from "@/lib/playback-engine";
import { cropOf } from "@/lib/media-crop";
import {
  addKeyframe,
  keyframeAt,
  removeKeyframe,
} from "@/lib/scan-keyframes";
import type { MediaItem } from "@/lib/types";
import { useMediaStore } from "@/stores/media-store";
import { usePlaybackStore } from "@/stores/playback-store";
import { Slider } from "@/components/ui/slider";

/**
 * Follower elements for the active animated media: they take play/pause/
 * loop/seek from the playback store (whose engine owns real time) so 2D
 * rects, the panel preview, and the 3D texture stay in sync.
 */

export function SyncedVideo({
  src,
  className,
}: {
  src: string;
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const playing = usePlaybackStore((s) => s.playing);
  const loop = usePlaybackStore((s) => s.loop);
  const seekNonce = usePlaybackStore((s) => s.seekNonce);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (playing) void v.play().catch(() => {});
    else v.pause();
  }, [playing]);
  useEffect(() => {
    if (ref.current) ref.current.loop = loop;
  }, [loop]);
  useEffect(() => {
    const v = ref.current;
    if (v) v.currentTime = usePlaybackStore.getState().seekTime;
  }, [seekNonce]);
  // Transient drift correction against the master's reported time.
  useEffect(
    () =>
      usePlaybackStore.subscribe((s, prev) => {
        if (s.timeSec === prev.timeSec) return;
        const v = ref.current;
        if (v && Math.abs(v.currentTime - s.timeSec) > 0.35) {
          v.currentTime = s.timeSec;
        }
      }),
    [],
  );

  return (
    <video
      ref={ref}
      src={src}
      autoPlay
      muted
      playsInline
      loop={loop}
      className={className}
    />
  );
}

/**
 * Animated GIF view: mirrors the engine's frame canvas so pause/seek
 * work (a native <img> can't). Falls back to the plain animating <img>
 * when no engine exists (e.g. no ImageDecoder support).
 */
export function GifView({
  url,
  alt,
  className,
}: {
  url: string;
  alt?: string;
  className?: string;
}) {
  // Re-resolve the engine when it (re)initializes.
  usePlaybackStore((s) => s.engineNonce);
  const engine = getEngine();
  const gif = engine?.kind === "gif" ? engine : null;
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!gif) return;
    const draw = () => {
      const c = ref.current;
      if (!c) return;
      if (c.width !== gif.canvas.width || c.height !== gif.canvas.height) {
        c.width = gif.canvas.width;
        c.height = gif.canvas.height;
      }
      c.getContext("2d")!.drawImage(gif.canvas, 0, 0);
    };
    draw();
    return gif.subscribe(draw);
  }, [gif]);

  if (!gif) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={alt ?? ""} draggable={false} className={className} />;
  }
  return <canvas ref={ref} className={className} />;
}

/**
 * Video view that mirrors the playback engine's single master decode to
 * a canvas (crop applied at draw time), instead of running one <video>
 * decoder per device rect. requestVideoFrameCallback keeps mirrors in
 * lockstep with the master and fires on seek-while-paused too.
 */
export function VideoMirror({
  item,
  className,
}: {
  item: MediaItem;
  className?: string;
}) {
  usePlaybackStore((s) => s.engineNonce);
  const engine = getEngine();
  const video = engine?.kind === "video" ? engine.video : null;
  const ref = useRef<HTMLCanvasElement>(null);
  const crop = cropOf(item);
  const { x: cx, y: cy, w: cw, h: ch } = crop;

  useEffect(() => {
    if (!video) return;
    let alive = true;
    let handle = 0;
    const draw = () => {
      const c = ref.current;
      if (!c || !video.videoWidth) return;
      const sx = cx * video.videoWidth;
      const sy = cy * video.videoHeight;
      const sw = Math.max(1, Math.round(cw * video.videoWidth));
      const sh = Math.max(1, Math.round(ch * video.videoHeight));
      if (c.width !== sw || c.height !== sh) {
        c.width = sw;
        c.height = sh;
      }
      c.getContext("2d")!.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh);
    };
    const loop = () => {
      if (!alive) return;
      draw();
      handle = video.requestVideoFrameCallback(loop);
    };
    draw();
    handle = video.requestVideoFrameCallback(loop);
    return () => {
      alive = false;
      video.cancelVideoFrameCallback(handle);
    };
  }, [video, cx, cy, cw, ch]);

  if (!video) return null;
  return <canvas ref={ref} className={className} />;
}

const fmtTime = (t: number) => {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
};

/**
 * Play/pause · playhead (with OCR keyframe markers) · loop, for the
 * active video or animated GIF. Markers are user-placed scan points
 * (plan topic 9): amber = scanned, hollow = placed but unscanned;
 * clicking one seeks there and pauses.
 */
export function TransportControls() {
  const animated = usePlaybackStore((s) => s.animated);
  const playing = usePlaybackStore((s) => s.playing);
  const loop = usePlaybackStore((s) => s.loop);
  const timeSec = usePlaybackStore((s) => s.timeSec);
  const durationSec = usePlaybackStore((s) => s.durationSec);
  const setPlaying = usePlaybackStore((s) => s.setPlaying);
  const setLoop = usePlaybackStore((s) => s.setLoop);
  const seek = usePlaybackStore((s) => s.seek);

  const items = useMediaStore((s) => s.items);
  const activeId = useMediaStore((s) => s.activeId);
  const setScanKeyframes = useMediaStore((s) => s.setScanKeyframes);
  const item = items.find((i) => i.id === activeId) ?? null;
  const keyframes = item?.scanKeyframes ?? [];
  const atMarker = item ? keyframeAt(keyframes, timeSec) : null;

  if (!animated) return null;

  return (
    <div className="panel-inset flex items-center gap-2 rounded-md px-2 pt-1.5 pb-3">
      <button
        type="button"
        aria-label={playing ? "Pause" : "Play"}
        className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        onClick={() => setPlaying(!playing)}
      >
        {playing ? (
          <PauseIcon className="size-4" />
        ) : (
          <PlayIcon className="size-4" />
        )}
      </button>
      <div className="relative min-w-0 flex-1">
        <Slider
          min={0}
          max={Math.max(0.1, durationSec ?? 0.1)}
          step={0.05}
          value={Math.min(timeSec, durationSec ?? timeSec)}
          onValueChange={(v) => seek(Array.isArray(v) ? v[0] : v)}
        />
        {durationSec
          ? keyframes.map((k) => (
              <button
                key={k.timeSec}
                type="button"
                aria-label={`OCR keyframe at ${fmtTime(k.timeSec)}`}
                title={`OCR keyframe · ${fmtTime(k.timeSec)}${k.lines ? ` · ${k.lines.length} lines` : " · not scanned"}`}
                className={cn(
                  "absolute top-full size-2 -translate-x-1/2 rotate-45 border border-[#f5a524]",
                  k.lines ? "bg-[#f5a524]" : "bg-transparent",
                )}
                style={{ left: `${(k.timeSec / durationSec) * 100}%` }}
                onClick={() => {
                  setPlaying(false);
                  seek(k.timeSec);
                }}
              />
            ))
          : null}
      </div>
      <span className="shrink-0 font-mono text-xs text-muted-foreground">
        {fmtTime(timeSec)}
        {durationSec ? ` / ${fmtTime(durationSec)}` : ""}
      </span>
      <button
        type="button"
        aria-label="Loop"
        aria-pressed={loop}
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-md transition-colors",
          loop
            ? "bg-foreground text-background"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
        onClick={() => setLoop(!loop)}
      >
        <RepeatIcon className="size-4" />
      </button>
      {item ? (
        <button
          type="button"
          aria-label={
            atMarker
              ? "Remove the OCR keyframe at the playhead"
              : "Add an OCR keyframe at the playhead"
          }
          title={
            atMarker
              ? "Remove the OCR keyframe at the playhead"
              : "Mark this frame for text detection"
          }
          className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          onClick={() => {
            setPlaying(false);
            setScanKeyframes(
              item.id,
              atMarker
                ? removeKeyframe(keyframes, timeSec)
                : addKeyframe(keyframes, timeSec),
            );
          }}
        >
          {atMarker ? (
            <BookmarkMinusIcon className="size-4" />
          ) : (
            <BookmarkPlusIcon className="size-4" />
          )}
        </button>
      ) : null}
    </div>
  );
}
