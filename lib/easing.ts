/** Easing curves for the 3D scene's pose tweens. Pure (no React, no DOM). */

/** Cubic ease-in-out: t∈[0,1] → eased t∈[0,1]. */
export const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
