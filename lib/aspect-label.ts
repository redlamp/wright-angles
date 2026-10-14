/**
 * Human-readable aspect ratio for a pixel resolution, assuming square
 * pixels (so the ratio of pixel counts is the ratio of the panel's
 * sides). Exact small ratios read as-is ("16:9", "16:10"); awkward
 * reductions such as 1366×768 (683:384) read as the nearest common
 * ratio when within 2% ("≈16:9"), otherwise as a decimal ("2.35:1").
 */

import { aspectFromResolution } from "./display-math";
import type { Resolution } from "./types";

const COMMON: { label: string; ratio: number }[] = [
  { label: "1:1", ratio: 1 },
  { label: "5:4", ratio: 5 / 4 },
  { label: "4:3", ratio: 4 / 3 },
  { label: "3:2", ratio: 3 / 2 },
  { label: "16:10", ratio: 16 / 10 },
  { label: "16:9", ratio: 16 / 9 },
  { label: "19.5:9", ratio: 19.5 / 9 },
  { label: "21:9", ratio: 64 / 27 },
  { label: "32:9", ratio: 32 / 9 },
];

/** Largest reduced term still read as an exact ratio. */
const MAX_EXACT_TERM = 32;
const NEAR = 0.02;

export function aspectLabel(res: Resolution): string {
  if (!(res.w > 0 && res.h > 0)) return "";
  // Portrait panels: label by the landscape ratio, keep the order.
  const portrait = res.h > res.w;
  const long = portrait ? res.h : res.w;
  const short = portrait ? res.w : res.h;
  const flip = (l: string) => (portrait ? l.split(":").reverse().join(":") : l);

  const reduced = aspectFromResolution({ w: long, h: short });
  if (reduced.w <= MAX_EXACT_TERM && reduced.h <= MAX_EXACT_TERM) {
    return flip(`${reduced.w}:${reduced.h}`);
  }
  const ratio = long / short;
  const near = COMMON.find((c) => Math.abs(ratio / c.ratio - 1) <= NEAR);
  if (near) return `≈${flip(near.label)}`;
  const dec = `${(Math.round(ratio * 100) / 100).toString()}:1`;
  return portrait ? `1:${(Math.round(ratio * 100) / 100).toString()}` : dec;
}
