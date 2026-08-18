"use client";

import { getEngine } from "./playback-engine";
import { usePlaybackStore } from "@/stores/playback-store";

/**
 * Capture the playback engine's CURRENT frame as an object URL the OCR
 * pipeline can consume (Tesseract takes a URL; the engine already holds
 * the single decoded frame — video element or GIF canvas).
 */
export async function captureCurrentFrame(): Promise<{
  url: string;
  revoke: () => void;
} | null> {
  const engine = getEngine();
  if (!engine) return null;
  const canvas = document.createElement("canvas");
  const g = canvas.getContext("2d");
  if (!g) return null;
  if (engine.kind === "video") {
    const v = engine.video;
    if (!v.videoWidth) return null;
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    g.drawImage(v, 0, 0);
  } else {
    if (!engine.canvas.width) return null;
    canvas.width = engine.canvas.width;
    canvas.height = engine.canvas.height;
    g.drawImage(engine.canvas, 0, 0);
  }
  const blob = await new Promise<Blob | null>((r) =>
    canvas.toBlob(r, "image/png"),
  );
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  return { url, revoke: () => URL.revokeObjectURL(url) };
}

/**
 * Pause, seek to `timeSec`, wait for that frame to actually decode, then
 * capture it. Videos resolve on the seeked event; GIFs on the engine's
 * next frame notification. Both fall back to a timeout so a seek to the
 * current position (which may fire nothing) still captures.
 */
export async function captureFrameAt(timeSec: number): Promise<{
  url: string;
  revoke: () => void;
} | null> {
  const store = usePlaybackStore.getState();
  store.setPlaying(false);
  const engine = getEngine();
  if (!engine) return null;

  const settled =
    engine.kind === "video"
      ? new Promise<void>((res) => {
          const done = () => {
            engine.video.removeEventListener("seeked", done);
            clearTimeout(timer);
            res();
          };
          const timer = setTimeout(done, 1500);
          engine.video.addEventListener("seeked", done);
        })
      : new Promise<void>((res) => {
          const un = engine.subscribe(() => {
            un();
            clearTimeout(timer);
            res();
          });
          const timer = setTimeout(() => {
            un();
            res();
          }, 500);
        });

  store.seek(timeSec);
  await settled;
  return captureCurrentFrame();
}
