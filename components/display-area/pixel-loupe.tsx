"use client";

import { useEffect, useRef, useState } from "react";
import { boxMetricsOnDevice } from "@/lib/display-math";
import { fitBox, fitModeOf } from "@/lib/fit";
import { cropDims } from "@/lib/media-crop";
import type { Device, MediaCrop, MediaItem } from "@/lib/types";

const LOUPE_SIZE = 176;
const LOUPE_ZOOM = 8;

/**
 * Pixel loupe (plan 10.2): follows the cursor over This Device's rect
 * and magnifies the source image 8×, pixel grid on top, with a readout
 * of the source coordinate and what one source pixel subtends on This
 * Device. Static images only — video would need per-frame capture.
 */
export function PixelLoupe({
  containerRef,
  center,
  hostW,
  hostH,
  item,
  crop,
  url,
  thisDevice,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>;
  center: { x: number; y: number };
  hostW: number;
  hostH: number;
  item: MediaItem;
  /** This Device's effective crop (the loupe rides the host rect). */
  crop: MediaCrop;
  url: string;
  thisDevice: Device;
}) {
  const [pt, setPt] = useState<{
    x: number;
    y: number;
    cw: number;
    ch: number;
  } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    let alive = true;
    const img = new Image();
    img.src = url;
    img
      .decode()
      .then(() => {
        if (alive) imgRef.current = img;
      })
      .catch(() => {});
    return () => {
      alive = false;
      imgRef.current = null;
    };
  }, [url]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      setPt({
        x: e.clientX - r.left,
        y: e.clientY - r.top,
        cw: r.width,
        ch: r.height,
      });
    };
    const leave = () => setPt(null);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    return () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
    };
  }, [containerRef]);

  const eff = cropDims(item, crop);
  // The loupe rides This Device's rect, so it samples through This
  // Device's fit — a stretched host draws content edge to edge.
  const area = fitBox(
    fitModeOf(thisDevice),
    eff.width,
    eff.height,
    hostW,
    hostH,
  );
  let sx = -1;
  let sy = -1;
  if (pt && area.w) {
    const u = (pt.x - (center.x - hostW / 2) - area.x) / area.w;
    const v = (pt.y - (center.y - hostH / 2) - area.y) / area.h;
    if (u >= 0 && u <= 1 && v >= 0 && v <= 1) {
      sx = (crop.x + u * crop.w) * item.width;
      sy = (crop.y + v * crop.h) * item.height;
    }
  }
  const active = sx >= 0;

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const g = canvas.getContext("2d");
    if (!g) return;
    const win = LOUPE_SIZE / LOUPE_ZOOM;
    g.imageSmoothingEnabled = false;
    g.fillStyle = "#111";
    g.fillRect(0, 0, LOUPE_SIZE, LOUPE_SIZE);
    g.drawImage(
      img,
      sx - win / 2,
      sy - win / 2,
      win,
      win,
      0,
      0,
      LOUPE_SIZE,
      LOUPE_SIZE,
    );
    // Grid aligned to whole source pixels.
    g.strokeStyle = "rgba(255,255,255,0.18)";
    g.lineWidth = 1;
    const xOff = (Math.ceil(sx - win / 2) - (sx - win / 2)) * LOUPE_ZOOM;
    const yOff = (Math.ceil(sy - win / 2) - (sy - win / 2)) * LOUPE_ZOOM;
    g.beginPath();
    for (let x = xOff; x <= LOUPE_SIZE; x += LOUPE_ZOOM) {
      g.moveTo(x + 0.5, 0);
      g.lineTo(x + 0.5, LOUPE_SIZE);
    }
    for (let y = yOff; y <= LOUPE_SIZE; y += LOUPE_ZOOM) {
      g.moveTo(0, y + 0.5);
      g.lineTo(LOUPE_SIZE, y + 0.5);
    }
    g.stroke();
    // Crosshair on the sampled pixel.
    g.strokeStyle = "#f5a524";
    g.strokeRect(
      LOUPE_SIZE / 2 - LOUPE_ZOOM / 2 + 0.5,
      LOUPE_SIZE / 2 - LOUPE_ZOOM / 2 + 0.5,
      LOUPE_ZOOM - 1,
      LOUPE_ZOOM - 1,
    );
  }, [active, sx, sy]);

  if (!pt || !active) return null;
  const left =
    pt.x + 18 + LOUPE_SIZE > pt.cw ? pt.x - 18 - LOUPE_SIZE : pt.x + 18;
  const top =
    pt.y + 18 + LOUPE_SIZE + 24 > pt.ch
      ? pt.y - 18 - LOUPE_SIZE - 24
      : pt.y + 18;
  const arcminPerPx = boxMetricsOnDevice(
    1 / item.height / crop.h,
    eff,
    thisDevice,
  ).arcmin;
  return (
    <div
      className="pointer-events-none absolute z-40 overflow-hidden rounded-md border border-white/30 bg-black/80 shadow-lg"
      style={{ left, top, width: LOUPE_SIZE }}
    >
      <canvas
        ref={canvasRef}
        width={LOUPE_SIZE}
        height={LOUPE_SIZE}
        className="block"
      />
      <div className="px-1.5 py-0.5 font-mono text-sm leading-4.5 text-white/70">
        {Math.floor(sx)}, {Math.floor(sy)} px · 1 px ≈{" "}
        {arcminPerPx.toFixed(2)}′
      </div>
    </div>
  );
}
