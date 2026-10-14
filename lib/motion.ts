/**
 * Reduced-motion helpers. Pure (no React, no DOM): the media-query
 * subscription lives in components/use-reduced-motion.ts.
 */

/** The OS/browser "reduce motion" preference. */
export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/**
 * Linear progress t∈[0,1] of a timed tween `elapsed` seconds in. With
 * reduced motion preferred the tween is already over: callers land on
 * the end state on the very first frame.
 */
export function tweenProgress(
  elapsed: number,
  duration: number,
  reduced: boolean,
): number {
  if (reduced || duration <= 0) return 1;
  return Math.min(1, Math.max(0, elapsed / duration));
}

/**
 * Progress increment for a delta-driven crossfade. A demand frameloop's
 * first frame after idle carries a huge delta, so it's clamped to a
 * normal frame's worth; reduced motion steps the whole way at once.
 */
export function tweenStep(
  delta: number,
  duration: number,
  reduced: boolean,
): number {
  if (reduced || duration <= 0) return 1;
  return Math.min(delta, 1 / 30) / duration;
}
