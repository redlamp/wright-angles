"use client";

import { useEffect, useMemo, type ReactNode } from "react";
import { CanvasTexture, RepeatWrapping, SRGBColorSpace, TextureLoader, VideoTexture, type Texture } from "three";
import { useLoader, useThree } from "@react-three/fiber";
import type { GifEngine } from "@/lib/playback-engine";
import type { MediaCrop } from "@/lib/types";

/**
 * Every screen surface faces +Z, away from the viewer at -Z, who therefore
 * sees back faces. Mirror U once on the shared texture so content reads
 * correctly from the viewer's side (instead of rotating every screen).
 */
/** Module-level so the react-compiler lint permits the mutation. */
function markTextureDirty(tex: Texture) {
  tex.needsUpdate = true;
}

/**
 * The crop composes with the U-mirror via repeat/offset (sampled uv' =
 * uv·repeat + offset). Three's UV origin is bottom-left while the crop is
 * y-down, so the crop's vertical window [y, y+h] sits at v ∈
 * [1−y−h, 1−y]: repeat.y = h, offset.y = 1−y−h. Mirrored U must run
 * right-to-left across the window [x, x+w]: u' = (x+w) − u·w, i.e.
 * repeat.x = −w, offset.x = x+w (no crop: −1 / 1, exactly today's mirror).
 */
function initScreenTexture(tex: Texture, crop?: MediaCrop) {
  const c = crop ?? { x: 0, y: 0, w: 1, h: 1 };
  tex.colorSpace = SRGBColorSpace;
  tex.wrapS = RepeatWrapping;
  tex.repeat.set(-c.w, c.h);
  tex.offset.set(c.x + c.w, 1 - c.y - c.h);
  tex.needsUpdate = true;
}

function useScreenTexture(tex: Texture, crop?: MediaCrop) {
  // useMemo, NOT useEffect: effects run after paint, so a freshly
  // loaded/created texture could render a frame (or more, on a busy
  // main thread) with default repeat/offset — i.e. WITHOUT the
  // U-mirror, which reads as a flipped image from the front (Taylor's
  // "sometimes backwards" bug). Applying during render guarantees the
  // mirror is in place before the first frame samples the texture.
  useMemo(() => initScreenTexture(tex, crop), [tex, crop]);
}

/**
 * Per-device screen textures. The base texture wears the plain media
 * (source) crop; each DISTINCT fit-derived crop gets ONE clone (clones
 * share the pixel upload via texture.source — only repeat/offset differ
 * per Texture object), so N devices on two crops cost two textures, not
 * N. Devices whose fit is a no-op resolve to the base.
 */
export interface ScreenTextures {
  forDevice: (deviceId: string) => Texture;
  /** Base + clones — engine-driven screens mark ALL of them dirty. */
  all: Texture[];
}

function useCropTextures(
  base: Texture,
  mediaCrop: MediaCrop | undefined,
  fitCrops: Record<string, MediaCrop> | undefined,
): ScreenTextures {
  useScreenTexture(base, mediaCrop);
  const clones = useMemo(() => {
    const byDevice = new Map<string, Texture>();
    const made: Texture[] = [];
    if (fitCrops) {
      const byKey = new Map<string, Texture>();
      for (const [devId, crop] of Object.entries(fitCrops)) {
        const key = `${crop.x},${crop.y},${crop.w},${crop.h}`;
        let t = byKey.get(key);
        if (!t) {
          t = base.clone();
          initScreenTexture(t, crop);
          byKey.set(key, t);
          made.push(t);
        }
        byDevice.set(devId, t);
      }
    }
    return { byDevice, made };
  }, [base, fitCrops]);
  useEffect(
    () => () => {
      for (const t of clones.made) t.dispose();
    },
    [clones],
  );
  return useMemo(
    () => ({
      forDevice: (deviceId: string) => clones.byDevice.get(deviceId) ?? base,
      all: [base, ...clones.made],
    }),
    [base, clones],
  );
}

export function ImageScreens({
  url,
  crop,
  fitCrops,
  children,
}: {
  url: string;
  crop?: MediaCrop;
  fitCrops?: Record<string, MediaCrop>;
  children: (texs: ScreenTextures) => ReactNode;
}) {
  const tex = useLoader(TextureLoader, url);
  const texs = useCropTextures(tex, crop, fitCrops);
  // useCropTextures already disposes its own clones; the BASE texture
  // (r3f's cache, keyed by url) is this component's to dispose — on
  // unmount, and again whenever url changes (the old texture's own
  // cleanup, since `tex` and `url` change together). Clearing the r3f
  // loader cache alongside the dispose stops a later re-visit to the
  // same url handing back an already-disposed texture.
  useEffect(() => {
    return () => {
      tex.dispose();
      useLoader.clear(TextureLoader, url);
    };
  }, [tex, url]);
  return <>{children(texs)}</>;
}

/** Screens driven by the playback engine's master video element. */
export function EngineVideoScreens({
  video,
  crop,
  fitCrops,
  children,
}: {
  video: HTMLVideoElement;
  crop?: MediaCrop;
  fitCrops?: Record<string, MediaCrop>;
  children: (texs: ScreenTextures) => ReactNode;
}) {
  const tex = useMemo(() => new VideoTexture(video), [video]);
  const texs = useCropTextures(tex, crop, fitCrops);
  useEffect(() => () => tex.dispose(), [tex]);
  // Demand frameloop: request a render per decoded video frame — no
  // frames while paused, native cadence while playing. (VideoTexture
  // clones each pull the current video frame when rendered, so the
  // per-device textures stay in lockstep without extra marking.)
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    let handle = 0;
    let alive = true;
    const onFrame = () => {
      if (!alive) return;
      invalidate();
      handle = video.requestVideoFrameCallback(onFrame);
    };
    handle = video.requestVideoFrameCallback(onFrame);
    return () => {
      alive = false;
      video.cancelVideoFrameCallback(handle);
    };
  }, [video, invalidate]);
  return <>{children(texs)}</>;
}

/** Screens mirroring the GIF engine's frame canvas. */
export function EngineGifScreens({
  engine,
  crop,
  fitCrops,
  children,
}: {
  engine: GifEngine;
  crop?: MediaCrop;
  fitCrops?: Record<string, MediaCrop>;
  children: (texs: ScreenTextures) => ReactNode;
}) {
  const tex = useMemo(() => new CanvasTexture(engine.canvas), [engine]);
  const texs = useCropTextures(tex, crop, fitCrops);
  useEffect(() => () => tex.dispose(), [tex]);
  // Demand frameloop: each decoded GIF frame marks every screen texture
  // (base + per-device clones) dirty and requests exactly one render.
  const invalidate = useThree((s) => s.invalidate);
  useEffect(
    () =>
      engine.subscribe(() => {
        for (const t of texs.all) markTextureDirty(t);
        invalidate();
      }),
    [engine, texs, invalidate],
  );
  return <>{children(texs)}</>;
}
