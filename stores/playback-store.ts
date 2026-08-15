"use client";

import { create } from "zustand";

/**
 * Shared transport state for the active animated media (video or GIF).
 * A single engine (lib/playback-engine) owns real time; every rendered
 * copy — 2D rects, the 3D texture, the panel preview — follows it.
 * Deliberately not persisted.
 */
interface PlaybackState {
  /** Whether the active media is animated (video or animated GIF). */
  animated: boolean;
  playing: boolean;
  loop: boolean;
  timeSec: number;
  durationSec: number | null;
  /** Bumped on every user seek; engines watch it. */
  seekNonce: number;
  seekTime: number;
  /** Bumped when the engine identity changes; followers re-resolve it. */
  engineNonce: number;
  bumpEngine: () => void;
  setAnimated: (v: boolean) => void;
  setPlaying: (v: boolean) => void;
  setLoop: (v: boolean) => void;
  seek: (t: number) => void;
  /** Engine-only: report playback progress. */
  reportTime: (t: number) => void;
  reportDuration: (d: number | null) => void;
  reset: () => void;
}

export const usePlaybackStore = create<PlaybackState>()((set) => ({
  animated: false,
  playing: true,
  loop: true,
  timeSec: 0,
  durationSec: null,
  seekNonce: 0,
  seekTime: 0,
  engineNonce: 0,
  bumpEngine: () => set((s) => ({ engineNonce: s.engineNonce + 1 })),
  setAnimated: (animated) => set({ animated }),
  setPlaying: (playing) => set({ playing }),
  setLoop: (loop) => set({ loop }),
  seek: (t) =>
    set((s) => ({ seekNonce: s.seekNonce + 1, seekTime: t, timeSec: t })),
  reportTime: (timeSec) => set({ timeSec }),
  reportDuration: (durationSec) => set({ durationSec }),
  reset: () =>
    set({
      animated: false,
      playing: true,
      loop: true,
      timeSec: 0,
      durationSec: null,
      seekTime: 0,
    }),
}));
