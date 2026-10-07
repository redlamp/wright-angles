"use client";

import { useMemo } from "react";
import { usePlaybackStore } from "@/stores/playback-store";
import { boxMetricsInCrop } from "@/lib/box-metrics";
import { isAnimatedItem } from "@/lib/playback-engine";
import { activeKeyframe } from "@/lib/scan-keyframes";
import type { Device, HighlightBox, MediaItem } from "@/lib/types";

/**
 * The boxes the world overlays draw for the active item (persisted boxes
 * plus the active keyframe's lines), their text-group ids, and each
 * box's worst-case legibility across every visible device.
 */
export function useOverlayBoxes(
  activeItem: MediaItem | null,
  thisDevice: Device,
  devices: Device[],
) {
  // Timeline media contributes its ACTIVE keyframe's detected lines to
  // the world overlays (they behave like read-only measure boxes and
  // follow the playhead until the next marker).
  const animatedActive = activeItem ? isAnimatedItem(activeItem) : false;
  const timeSec = usePlaybackStore((s) => (animatedActive ? s.timeSec : 0));
  const overlayBoxes = useMemo<HighlightBox[]>(() => {
    if (!activeItem) return [];
    const base = activeItem.boxes ?? [];
    if (!animatedActive || !activeItem.scanKeyframes) return base;
    const kf = activeKeyframe(activeItem.scanKeyframes, timeSec);
    if (!kf?.lines) return base;
    return [
      ...base,
      ...kf.lines.map((l) => ({ id: l.id, label: l.text, ...l.box })),
    ];
  }, [activeItem, animatedActive, timeSec]);

  // Text-block ids from the persisted scan + keyframes, for the global
  // Groups color mode in the world views.
  const groupById = useMemo(() => {
    const map = new Map<string, number>();
    if (!activeItem) return map;
    for (const l of activeItem.scan?.lines ?? [])
      if (l.groupId !== undefined) map.set(l.id, l.groupId);
    for (const k of activeItem.scanKeyframes ?? [])
      for (const l of k.lines ?? [])
        if (l.groupId !== undefined) map.set(l.id, l.groupId);
    return map;
  }, [activeItem]);

  // Worst-case legibility per box across every visible device — the
  // "will this text survive everywhere" verdict that colors the box.
  // Keyframe lines measure with their group-corrected size when it
  // exists (descender-aware).
  const worstByBox = useMemo(() => {
    const map = new Map<string, number | null>();
    if (!activeItem) return map;
    const devs = [
      ...(thisDevice.visible ? [thisDevice] : []),
      ...devices.filter((d) => d.visible),
    ];
    const kfSize = new Map<string, number>();
    for (const k of activeItem.scanKeyframes ?? [])
      for (const l of k.lines ?? [])
        if (l.sizePx) kfSize.set(l.id, l.sizePx / activeItem.height);
    for (const b of overlayBoxes) {
      const hNorm = kfSize.get(b.id) ?? b.h;
      // Each device measures through ITS rendered crop (source crop
      // reframed by the device's fit mode): that region is what lands
      // on the panel, so the box height re-normalizes against it. A
      // device whose fit crops the box away doesn't show it, so it
      // can't drag the worst-case verdict either — and when EVERY
      // visible device crops it away, the box has no verdict at all
      // (null), not an infinitely-good one.
      let worst: number | null = null;
      for (const d of devs) {
        const m = boxMetricsInCrop(b, hNorm, activeItem, d);
        if (!m) continue;
        worst = worst === null ? m.arcmin : Math.min(worst, m.arcmin);
      }
      map.set(b.id, worst);
    }
    return map;
  }, [activeItem, overlayBoxes, thisDevice, devices]);

  return { overlayBoxes, groupById, worstByBox };
}
