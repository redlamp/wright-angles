/**
 * WCAG contrast math plus a text-vs-background estimator for scanned
 * text boxes (plan 10.1). Pure — pixel sampling happens in the view
 * layer; this module only sees number arrays.
 */

/** sRGB channel (0–255) → linear component. */
export function linearChannel(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

/** WCAG relative luminance from 8-bit sRGB. */
export function relativeLuminance(r: number, g: number, b: number): number {
  return (
    0.2126 * linearChannel(r) +
    0.7152 * linearChannel(g) +
    0.0722 * linearChannel(b)
  );
}

/** WCAG contrast ratio between two relative luminances (1–21). */
export function contrastRatio(l1: number, l2: number): number {
  const [lo, hi] = l1 < l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

export interface ContrastEstimate {
  ratio: number;
  /** Mean relative luminance of the darker / lighter class. */
  darkLum: number;
  lightLum: number;
}

const BINS = 32;

/**
 * Estimate the text/background contrast inside a sampled text box.
 * RGBA pixel data → per-pixel luminance → Otsu threshold splits the
 * two ink classes → ratio of the class means. Which class is "text"
 * doesn't matter for the ratio. Returns null for degenerate samples
 * (empty, or effectively one flat color — nothing to contrast).
 */
export function estimateTextContrast(
  rgba: ArrayLike<number>,
): ContrastEstimate | null {
  const n = Math.floor(rgba.length / 4);
  if (n < 16) return null;
  const lums = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    lums[i] = relativeLuminance(rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2]);
  }

  // Otsu over a fixed-bin histogram of luminance.
  const hist = new Array<number>(BINS).fill(0);
  for (let i = 0; i < n; i++) {
    hist[Math.min(BINS - 1, Math.floor(lums[i] * BINS))]++;
  }
  let sumAll = 0;
  for (let b = 0; b < BINS; b++) sumAll += b * hist[b];
  let wBg = 0;
  let sumBg = 0;
  let bestVar = -1;
  let threshold = BINS / 2;
  for (let b = 0; b < BINS; b++) {
    wBg += hist[b];
    if (wBg === 0) continue;
    const wFg = n - wBg;
    if (wFg === 0) break;
    sumBg += b * hist[b];
    const meanBg = sumBg / wBg;
    const meanFg = (sumAll - sumBg) / wFg;
    const between = wBg * wFg * (meanBg - meanFg) ** 2;
    if (between > bestVar) {
      bestVar = between;
      threshold = b + 1;
    }
  }

  const cut = threshold / BINS;
  let darkSum = 0;
  let darkN = 0;
  let lightSum = 0;
  let lightN = 0;
  for (let i = 0; i < n; i++) {
    if (lums[i] < cut) {
      darkSum += lums[i];
      darkN++;
    } else {
      lightSum += lums[i];
      lightN++;
    }
  }
  // One-sided split = flat sample; no text/background distinction.
  if (darkN < n * 0.02 || lightN < n * 0.02) return null;
  const darkLum = darkSum / darkN;
  const lightLum = lightSum / lightN;
  return { ratio: contrastRatio(darkLum, lightLum), darkLum, lightLum };
}

/** WCAG AA verdicts for the estimate. */
export const AA_NORMAL = 4.5;
export const AA_LARGE = 3;
