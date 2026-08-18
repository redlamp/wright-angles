"use client";

import { useEffect, useState } from "react";
import {
  estimateTextContrast,
  type ContrastEstimate,
} from "@/lib/contrast";

/** Session cache: `${itemId}:${lineId}` → estimate (null = flat/failed). */
const cache = new Map<string, ContrastEstimate | null>();

const EMPTY: ReadonlyMap<string, ContrastEstimate | null> = new Map();

export interface ContrastLine {
  id: string;
  /** Full-image normalized box. */
  box: { x: number; y: number; w: number; h: number };
}

/**
 * Text/background contrast estimates for scanned boxes (plan 10.1):
 * one image decode, one small canvas sample per box, Otsu split in
 * lib/contrast. Static images only — video keyframes would need a
 * seek+capture per line. Results cache for the session, keyed by
 * item + line, so toggling the badges is free after the first pass.
 */
export function useContrastMap(
  itemId: string,
  url: string | undefined,
  intrinsic: { width: number; height: number },
  lines: ContrastLine[],
  enabled: boolean,
): ReadonlyMap<string, ContrastEstimate | null> {
  const [estimates, setEstimates] = useState<
    ReadonlyMap<string, ContrastEstimate | null>
  >(EMPTY);

  useEffect(() => {
    if (!enabled || !url || lines.length === 0) return;
    const wanted = lines.filter((l) => !cache.has(`${itemId}:${l.id}`));
    const publish = () =>
      setEstimates(
        new Map(
          lines.map((l) => [l.id, cache.get(`${itemId}:${l.id}`) ?? null]),
        ),
      );
    if (wanted.length === 0) {
      publish();
      return;
    }
    let alive = true;
    const img = new Image();
    img.src = url;
    img
      .decode()
      .then(() => {
        if (!alive) return;
        const canvas = document.createElement("canvas");
        const g = canvas.getContext("2d", { willReadFrequently: true });
        if (!g) return;
        for (const l of wanted) {
          const sx = l.box.x * intrinsic.width;
          const sy = l.box.y * intrinsic.height;
          const sw = Math.max(1, l.box.w * intrinsic.width);
          const sh = Math.max(1, l.box.h * intrinsic.height);
          // Downsample long lines; the estimator needs tone, not detail.
          const scale = Math.min(1, 128 / sw, 64 / sh);
          canvas.width = Math.max(8, Math.round(sw * scale));
          canvas.height = Math.max(4, Math.round(sh * scale));
          g.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
          const data = g.getImageData(0, 0, canvas.width, canvas.height).data;
          cache.set(`${itemId}:${l.id}`, estimateTextContrast(data));
        }
        publish();
      })
      .catch(() => {
        if (!alive) return;
        for (const l of wanted) cache.set(`${itemId}:${l.id}`, null);
        publish();
      });
    return () => {
      alive = false;
    };
  }, [itemId, url, intrinsic.width, intrinsic.height, lines, enabled]);

  return enabled ? estimates : EMPTY;
}
