import type { KeyframeLine, ScanKeyframe } from "./types";

/**
 * Pure helpers for OCR keyframes on timeline media (plan topic 9).
 * Keyframes are kept sorted by time; two times within EPS are the same
 * keyframe (a half-step of the transport slider, so re-adding at the
 * playhead replaces rather than stacking).
 */
export const KEYFRAME_EPS = 0.075;

const sorted = (list: ScanKeyframe[]) =>
  [...list].sort((a, b) => a.timeSec - b.timeSec);

export const keyframeAt = (
  list: ScanKeyframe[],
  timeSec: number,
): ScanKeyframe | null =>
  list.find((k) => Math.abs(k.timeSec - timeSec) <= KEYFRAME_EPS) ?? null;

/** Add a keyframe (unscanned); adding on top of an existing one is a no-op. */
export function addKeyframe(
  list: ScanKeyframe[],
  timeSec: number,
): ScanKeyframe[] {
  if (keyframeAt(list, timeSec)) return list;
  return sorted([...list, { timeSec, lines: null }]);
}

export function removeKeyframe(
  list: ScanKeyframe[],
  timeSec: number,
): ScanKeyframe[] {
  return list.filter((k) => Math.abs(k.timeSec - timeSec) > KEYFRAME_EPS);
}

/** Attach a scan to the keyframe at `timeSec` (creating it if absent). */
export function withScan(
  list: ScanKeyframe[],
  timeSec: number,
  lines: KeyframeLine[],
  medianPx: number,
): ScanKeyframe[] {
  const existing = keyframeAt(list, timeSec);
  const rest = existing ? removeKeyframe(list, timeSec) : list;
  return sorted([
    ...rest,
    { timeSec: existing?.timeSec ?? timeSec, lines, medianPx },
  ]);
}

/**
 * The keyframe governing the playhead: the LAST one at or before `t`
 * (its scan persists until the next marker). Nothing before the first
 * keyframe.
 */
export function activeKeyframe(
  list: ScanKeyframe[],
  t: number,
): ScanKeyframe | null {
  let best: ScanKeyframe | null = null;
  for (const k of sorted(list)) {
    if (k.timeSec <= t + KEYFRAME_EPS) best = k;
    else break;
  }
  return best;
}

/** Marker strictly before the playhead (for `<`), else null. */
export function prevKeyframeTime(
  list: ScanKeyframe[],
  t: number,
): number | null {
  let best: number | null = null;
  for (const k of sorted(list)) {
    if (k.timeSec < t - KEYFRAME_EPS) best = k.timeSec;
    else break;
  }
  return best;
}

/** Marker strictly after the playhead (for `>`), else null. */
export function nextKeyframeTime(
  list: ScanKeyframe[],
  t: number,
): number | null {
  for (const k of sorted(list)) {
    if (k.timeSec > t + KEYFRAME_EPS) return k.timeSec;
  }
  return null;
}
