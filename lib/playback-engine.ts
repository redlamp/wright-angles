"use client";

import type { MediaItem } from "./types";
import { usePlaybackStore } from "@/stores/playback-store";

/**
 * One engine owns real playback time for the active animated media; all
 * rendered copies (2D rects, 3D textures, panel preview) follow it via
 * the playback store. Videos: a hidden master <video> element. GIFs:
 * WebCodecs ImageDecoder frames drawn to a master canvas (a plain <img>
 * can't pause/seek, and three.js only ever samples a GIF's first frame).
 */

export const isAnimatedItem = (
  item: Pick<MediaItem, "kind" | "type"> | null | undefined,
): boolean => !!item && (item.kind === "video" || item.type === "image/gif");

export interface VideoEngine {
  kind: "video";
  video: HTMLVideoElement;
  dispose(): void;
}

export interface GifEngine {
  kind: "gif";
  canvas: HTMLCanvasElement;
  /** Bumped whenever a new frame lands on the canvas. */
  stamp: number;
  /** Notifies followers after each new frame. */
  subscribe(cb: () => void): () => void;
  dispose(): void;
}

export type PlaybackEngine = VideoEngine | GifEngine;

let current: { id: string; engine: PlaybackEngine | null } | null = null;

export function getEngine(): PlaybackEngine | null {
  return current?.engine ?? null;
}

export function disposeEngine() {
  current?.engine?.dispose();
  current = null;
  usePlaybackStore.getState().reset();
}

/** Swap the engine when the active media changes. */
export async function ensureEngine(
  item: MediaItem,
  playUrl: string | undefined,
): Promise<void> {
  if (current?.id === item.id) return;
  disposeEngine();
  if (!isAnimatedItem(item) || !playUrl) return;
  // Claim the slot synchronously so a rapid second call can't race.
  const claim = { id: item.id, engine: null as PlaybackEngine | null };
  current = claim;
  const store = usePlaybackStore.getState();
  if (item.kind === "video") {
    claim.engine = createVideoEngine(playUrl);
    store.setAnimated(true);
    bumpEngineNonce();
  } else if ("ImageDecoder" in window) {
    const engine = await createGifEngine(playUrl);
    if (current !== claim) {
      // Superseded while decoding.
      engine?.dispose();
      return;
    }
    if (engine) {
      claim.engine = engine;
      store.setAnimated(true);
      bumpEngineNonce();
    }
  }
  // No ImageDecoder support → GIFs stay native-animated in 2D, static
  // in 3D, with no transport (graceful degradation).
}

const bumpEngineNonce = () => usePlaybackStore.getState().bumpEngine();

function createVideoEngine(url: string): VideoEngine {
  const store = usePlaybackStore;
  const video = document.createElement("video");
  video.src = url;
  video.muted = true;
  video.playsInline = true;
  video.loop = store.getState().loop;
  video.preload = "auto";

  const onMeta = () => store.getState().reportDuration(video.duration || null);
  const onTime = () => store.getState().reportTime(video.currentTime);
  const onEnded = () => {
    if (!store.getState().loop) store.getState().setPlaying(false);
  };
  video.addEventListener("loadedmetadata", onMeta);
  video.addEventListener("timeupdate", onTime);
  video.addEventListener("ended", onEnded);

  let lastSeekNonce = store.getState().seekNonce;
  const unsub = store.subscribe((s, prev) => {
    if (s.playing !== prev.playing) {
      if (s.playing) void video.play().catch(() => {});
      else video.pause();
    }
    if (s.loop !== prev.loop) video.loop = s.loop;
    if (s.seekNonce !== lastSeekNonce) {
      lastSeekNonce = s.seekNonce;
      video.currentTime = s.seekTime;
    }
  });

  if (store.getState().playing) void video.play().catch(() => {});

  return {
    kind: "video",
    video,
    dispose() {
      unsub();
      video.pause();
      video.removeEventListener("loadedmetadata", onMeta);
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("ended", onEnded);
      video.removeAttribute("src");
      video.load();
    },
  };
}

interface GifFrame {
  bitmap: ImageBitmap;
  startSec: number;
  durSec: number;
}

async function createGifEngine(url: string): Promise<GifEngine | null> {
  const store = usePlaybackStore;
  try {
    const data = await (await fetch(url)).arrayBuffer();
    // ImageDecoder is Chromium's WebCodecs image API; typed loosely since
    // the TS dom lib may lag it.
    const DecoderCtor = (
      window as unknown as {
        ImageDecoder: new (init: { data: ArrayBuffer; type: string }) => {
          tracks: {
            ready: Promise<void>;
            selectedTrack: { frameCount: number } | null;
          };
          decode(opts: {
            frameIndex: number;
          }): Promise<{ image: VideoFrame }>;
          close(): void;
        };
      }
    ).ImageDecoder;
    const decoder = new DecoderCtor({ data, type: "image/gif" });
    await decoder.tracks.ready;
    const frameCount = decoder.tracks.selectedTrack?.frameCount ?? 0;
    if (frameCount === 0) {
      decoder.close();
      return null;
    }

    const frames: GifFrame[] = [];
    let t = 0;
    for (let i = 0; i < frameCount; i++) {
      const { image } = await decoder.decode({ frameIndex: i });
      // GIF frame delays arrive in microseconds; 0 means "browser
      // default", conventionally ~100ms.
      const durSec = image.duration ? image.duration / 1e6 : 0.1;
      const bitmap = await createImageBitmap(image);
      image.close();
      frames.push({ bitmap, startSec: t, durSec });
      t += durSec;
    }
    decoder.close();
    const duration = t;

    const canvas = document.createElement("canvas");
    canvas.width = frames[0].bitmap.width;
    canvas.height = frames[0].bitmap.height;
    const g = canvas.getContext("2d")!;

    const listeners = new Set<() => void>();
    let stamp = 0;
    let frameIdx = -1;
    let clock = 0;
    let raf = 0;
    let lastTs = 0;
    let lastReport = 0;
    let disposed = false;

    const drawAt = (timeSec: number) => {
      const wrapped = Math.min(timeSec, duration - 1e-4);
      let idx = frames.length - 1;
      for (let i = 0; i < frames.length; i++) {
        if (wrapped < frames[i].startSec + frames[i].durSec) {
          idx = i;
          break;
        }
      }
      if (idx !== frameIdx) {
        frameIdx = idx;
        g.clearRect(0, 0, canvas.width, canvas.height);
        g.drawImage(frames[idx].bitmap, 0, 0);
        engine.stamp = ++stamp;
        listeners.forEach((cb) => cb());
      }
    };

    let lastSeekNonce = store.getState().seekNonce;
    const tick = (ts: number) => {
      if (disposed) return;
      const s = store.getState();
      if (s.seekNonce !== lastSeekNonce) {
        lastSeekNonce = s.seekNonce;
        clock = Math.min(Math.max(0, s.seekTime), duration);
        drawAt(clock);
      }
      if (s.playing) {
        const dt = lastTs ? (ts - lastTs) / 1000 : 0;
        clock += dt;
        if (clock >= duration) {
          if (s.loop) clock %= duration;
          else {
            clock = duration;
            s.setPlaying(false);
          }
        }
        drawAt(clock);
        if (ts - lastReport > 200) {
          lastReport = ts;
          s.reportTime(clock);
        }
      }
      lastTs = ts;
      raf = requestAnimationFrame(tick);
    };

    store.getState().reportDuration(duration);
    drawAt(0);
    raf = requestAnimationFrame(tick);

    const engine: GifEngine = {
      kind: "gif",
      canvas,
      stamp,
      subscribe(cb) {
        listeners.add(cb);
        return () => listeners.delete(cb);
      },
      dispose() {
        disposed = true;
        cancelAnimationFrame(raf);
        listeners.clear();
        frames.forEach((f) => f.bitmap.close());
      },
    };
    return engine;
  } catch {
    return null;
  }
}
