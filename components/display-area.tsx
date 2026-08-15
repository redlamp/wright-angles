"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DownloadIcon, PencilRulerIcon } from "lucide-react";
import { useDeviceStore } from "@/stores/device-store";
import { useMediaStore } from "@/stores/media-store";
import { useSettingsStore } from "@/stores/settings-store";
import { useAnnotationStore } from "@/stores/annotation-store";
import {
  ACUITY,
  boxMetricsOnDevice,
  simulatedSizeOnHostPx,
} from "@/lib/display-math";
import { containFit } from "@/lib/fit";
import type { Device, HighlightBox, MediaItem } from "@/lib/types";

const boxBandColor = (worstArcmin: number) =>
  worstArcmin >= ACUITY.comfortableTextArcmin
    ? "#46a758"
    : worstArcmin >= ACUITY.minCriticalTextArcmin
      ? "#f5a524"
      : "#e5484d";

/**
 * Highlight boxes over one device rect. Coordinates are normalized to
 * the media's content area (object-contain within the rect), so the
 * same box lands on the same pixels of the image on every device.
 */
function BoxLayer({
  rectW,
  rectH,
  media,
  worstByBox,
  isHost,
}: {
  rectW: number;
  rectH: number;
  media: MediaItem;
  worstByBox: Map<string, number>;
  isHost: boolean;
}) {
  const selectedBoxId = useAnnotationStore((s) => s.selectedBoxId);
  const selectBox = useAnnotationStore((s) => s.selectBox);
  const area = containFit(media.width, media.height, rectW, rectH);
  if (!area.w) return null;
  return (
    <>
      {(media.boxes ?? []).map((b) => {
        const color = boxBandColor(worstByBox.get(b.id) ?? 99);
        const selected = b.id === selectedBoxId;
        return (
          <div
            key={b.id}
            role={isHost ? "button" : undefined}
            className="absolute"
            style={{
              left: area.x + b.x * area.w,
              top: area.y + b.y * area.h,
              width: b.w * area.w,
              height: b.h * area.h,
              border: `${selected && isHost ? 2 : 1}px solid ${color}`,
              boxShadow: selected && isHost ? `0 0 0 1px ${color}55` : undefined,
              cursor: isHost ? "pointer" : undefined,
              pointerEvents: isHost ? "auto" : "none",
            }}
            onClick={
              isHost
                ? (e) => {
                    e.stopPropagation();
                    selectBox(selected ? null : b.id);
                  }
                : undefined
            }
          />
        );
      })}
    </>
  );
}

/**
 * The 2D overlay: every visible device rendered at equal angular size,
 * mapped through This Device's panel.
 *
 * Mapping chain: device → simulatedSizeOnHostPx (This-Device pixels) → CSS
 * px via k = containFit(area, This Device resolution). When the app runs
 * fullscreen at native resolution, k = 1/devicePixelRatio and the overlay
 * is physically 1:1 on the user's actual panel.
 */
export function DisplayArea() {
  const thisDevice = useDeviceStore((s) => s.thisDevice);
  const devices = useDeviceStore((s) => s.devices);
  const items = useMediaStore((s) => s.items);
  const objectUrls = useMediaStore((s) => s.objectUrls);
  const videoUrls = useMediaStore((s) => s.videoUrls);
  const activeId = useMediaStore((s) => s.activeId);
  const displayFill = useSettingsStore((s) => s.displayFill);

  const ref = useRef<HTMLDivElement>(null);
  const [area, setArea] = useState({ w: 0, h: 0 });
  const [dpr, setDpr] = useState(1);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setArea({
        w: entry.contentRect.width,
        h: entry.contentRect.height,
      });
    });
    ro.observe(el);
    setDpr(window.devicePixelRatio || 1);
    const onResize = () => setDpr(window.devicePixelRatio || 1);
    window.addEventListener("resize", onResize);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", onResize);
    };
  }, []);

  const activeItem = items.find((i) => i.id === activeId) ?? null;
  const activeUrl = activeItem ? objectUrls[activeItem.id] : null;
  const activeVideoUrl =
    activeItem?.kind === "video" ? videoUrls[activeItem.id] : null;

  const drawMode = useAnnotationStore((s) => s.drawMode);
  const setDrawMode = useAnnotationStore((s) => s.setDrawMode);
  const selectedBoxId = useAnnotationStore((s) => s.selectedBoxId);
  const selectBox = useAnnotationStore((s) => s.selectBox);
  const addBox = useMediaStore((s) => s.addBox);
  const removeBox = useMediaStore((s) => s.removeBox);
  const [draft, setDraft] = useState<HighlightBox | null>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);

  // Worst-case legibility per box across every visible device — the
  // "will this text survive everywhere" verdict that colors the box.
  const worstByBox = useMemo(() => {
    const map = new Map<string, number>();
    if (!activeItem) return map;
    const devs = [
      ...(thisDevice.visible ? [thisDevice] : []),
      ...devices.filter((d) => d.visible),
    ];
    for (const b of activeItem.boxes ?? []) {
      let worst = Infinity;
      for (const d of devs) {
        worst = Math.min(worst, boxMetricsOnDevice(b.h, activeItem, d).arcmin);
      }
      map.set(b.id, worst);
    }
    return map;
  }, [activeItem, thisDevice, devices]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (selectedBoxId) selectBox(null);
        else if (drawMode) setDrawMode(false);
      }
      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        selectedBoxId &&
        activeItem &&
        !(e.target instanceof HTMLInputElement)
      ) {
        removeBox(activeItem.id, selectedBoxId);
        selectBox(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedBoxId, drawMode, activeItem, removeBox, selectBox, setDrawMode]);

  const rects = useMemo(() => {
    if (!area.w || !area.h) return [];
    const k = Math.min(
      area.w / thisDevice.resolution.w,
      area.h / thisDevice.resolution.h,
    );
    const all: (Device & { isThis?: boolean })[] = [
      ...(thisDevice.visible ? [{ ...thisDevice, isThis: true }] : []),
      ...devices.filter((d) => d.visible),
    ];
    return all
      .map((d) => {
        const sim = d.isThis
          ? {
              widthPx: thisDevice.resolution.w,
              heightPx: thisDevice.resolution.h,
            }
          : simulatedSizeOnHostPx(d, thisDevice);
        return {
          device: d,
          w: sim.widthPx * k,
          h: sim.heightPx * k,
        };
      })
      .sort((a, b) => b.w * b.h - a.w * a.h);
  }, [area.w, area.h, thisDevice, devices]);

  const scalePct = useMemo(() => {
    if (!area.w || !area.h) return null;
    const k = Math.min(
      area.w / thisDevice.resolution.w,
      area.h / thisDevice.resolution.h,
    );
    return Math.round(k * dpr * 100);
  }, [area.w, area.h, dpr, thisDevice.resolution.w, thisDevice.resolution.h]);

  // Snapshot the composition at This Device's native resolution — a
  // shareable reference PNG of the comparison (poster frame for videos).
  const exportView = useCallback(async () => {
    const host = thisDevice;
    const W = host.resolution.w;
    const H = host.resolution.h;
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const g = c.getContext("2d")!;
    g.fillStyle = "#161616";
    g.fillRect(0, 0, W, H);

    const all: (Device & { isThis?: boolean })[] = [
      ...(host.visible ? [{ ...host, isThis: true }] : []),
      ...devices.filter((d) => d.visible),
    ];
    const rectList = all
      .map((d) => {
        const sim = d.isThis
          ? { widthPx: W, heightPx: H }
          : simulatedSizeOnHostPx(d, host);
        return { d, w: sim.widthPx, h: sim.heightPx };
      })
      .sort((a, b) => b.w * b.h - a.w * a.h);

    let img: HTMLImageElement | null = null;
    if (activeUrl) {
      img = new Image();
      img.src = activeUrl;
      await new Promise((res) => {
        img!.onload = res;
        img!.onerror = res;
      });
      if (!img.naturalWidth) img = null;
    }

    for (const { d, w, h } of rectList) {
      const x = (W - w) / 2;
      const y = (H - h) / 2;
      if (img) {
        g.fillStyle = "#000";
        g.fillRect(x, y, w, h);
        const s = Math.min(w / img.naturalWidth, h / img.naturalHeight);
        const iw = img.naturalWidth * s;
        const ih = img.naturalHeight * s;
        g.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
      } else {
        g.fillStyle =
          displayFill === "device-color" ? d.color : "rgba(0,0,0,0.5)";
        g.fillRect(x, y, w, h);
      }
      g.strokeStyle = d.color;
      g.lineWidth = Math.max(2, W / 800);
      g.strokeRect(x, y, w, h);
      g.fillStyle = d.color;
      g.font = `${Math.max(16, Math.round(W / 90))}px monospace`;
      const label = `${d.label} · ${Math.round(d.distanceCm)} cm`;
      g.fillText(label, x + 8, y > 30 ? y - 8 : y + 26);
    }

    g.fillStyle = "rgba(255,255,255,0.55)";
    g.font = `${Math.max(13, Math.round(W / 110))}px monospace`;
    g.fillText(
      `Wright Angles — host: ${host.label} ${W}×${H} @ ${Math.round(host.distanceCm)} cm`,
      16,
      H - 16,
    );

    const blob = await new Promise<Blob | null>((r) =>
      c.toBlob(r, "image/png"),
    );
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `wright-angles-view-${new Date().toISOString().slice(0, 10)}.png`;
    a.click();
    URL.revokeObjectURL(url);
  }, [thisDevice, devices, activeUrl, displayFill]);

  return (
    <div
      ref={ref}
      className="absolute inset-0 overflow-hidden bg-[oklch(0.16_0_0)]"
    >
      {rects.map(({ device, w, h }, i) => (
        <div
          key={device.id}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{ width: w, height: h, zIndex: i + 1 }}
        >
          <div
            className="absolute inset-0 bg-black"
            style={{
              outline: `2px solid ${device.color}`,
              outlineOffset: -1,
              background: activeUrl
                ? "black"
                : displayFill === "device-color"
                  ? device.color
                  : `${device.color}0d`,
            }}
          >
            {activeVideoUrl ? (
              <video
                src={activeVideoUrl}
                autoPlay
                muted
                loop
                playsInline
                className="size-full object-contain select-none"
              />
            ) : activeUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={activeUrl}
                alt=""
                draggable={false}
                className="size-full object-contain select-none"
              />
            ) : null}
            {activeItem ? (
              <BoxLayer
                rectW={w}
                rectH={h}
                media={activeItem}
                worstByBox={worstByBox}
                isHost={Boolean(device.isThis) && !drawMode}
              />
            ) : null}
            {activeItem && device.isThis && draft
              ? (() => {
                  const area = containFit(
                    activeItem.width,
                    activeItem.height,
                    w,
                    h,
                  );
                  return (
                    <div
                      className="pointer-events-none absolute border border-dashed border-white/80"
                      style={{
                        left: area.x + draft.x * area.w,
                        top: area.y + draft.y * area.h,
                        width: draft.w * area.w,
                        height: draft.h * area.h,
                      }}
                    />
                  );
                })()
              : null}
            {activeItem && device.isThis && drawMode ? (
              <div
                className="absolute inset-0 cursor-crosshair touch-none"
                onPointerDown={(e) => {
                  const r = e.currentTarget.getBoundingClientRect();
                  const area = containFit(
                    activeItem.width,
                    activeItem.height,
                    r.width,
                    r.height,
                  );
                  if (!area.w) return;
                  const nx = (e.clientX - r.left - area.x) / area.w;
                  const ny = (e.clientY - r.top - area.y) / area.h;
                  dragStart.current = { x: nx, y: ny };
                  e.currentTarget.setPointerCapture(e.pointerId);
                }}
                onPointerMove={(e) => {
                  if (!dragStart.current) return;
                  const r = e.currentTarget.getBoundingClientRect();
                  const area = containFit(
                    activeItem.width,
                    activeItem.height,
                    r.width,
                    r.height,
                  );
                  if (!area.w) return;
                  const clamp = (v: number) => Math.min(1, Math.max(0, v));
                  const nx = clamp((e.clientX - r.left - area.x) / area.w);
                  const ny = clamp((e.clientY - r.top - area.y) / area.h);
                  const s = dragStart.current;
                  setDraft({
                    id: "draft",
                    x: Math.min(s.x, nx),
                    y: Math.min(s.y, ny),
                    w: Math.abs(nx - s.x),
                    h: Math.abs(ny - s.y),
                  });
                }}
                onPointerUp={() => {
                  const d = draft;
                  dragStart.current = null;
                  setDraft(null);
                  if (d && d.w > 0.004 && d.h > 0.004) {
                    const id =
                      typeof crypto !== "undefined" && "randomUUID" in crypto
                        ? crypto.randomUUID()
                        : Math.random().toString(36).slice(2);
                    addBox(activeItem.id, { ...d, id });
                    selectBox(id);
                  }
                }}
              />
            ) : null}
          </div>
          {/* Cycle label corners so tightly nested rects stay readable. */}
          <span
            className={
              "absolute px-1 font-mono text-[10px] leading-4 whitespace-nowrap " +
              [
                "top-0 left-0 -translate-y-full pb-0.5",
                "top-0 right-0 translate-y-0 pt-0.5 pr-1.5 text-right",
                "bottom-0 left-0 translate-y-full pt-0.5",
                "bottom-0 right-0 translate-y-0 pb-0.5 pr-1.5 text-right",
              ][i % 4]
            }
            style={{ color: device.color }}
          >
            {device.label} · {Math.round(device.distanceCm)} cm
          </span>
        </div>
      ))}

      {rects.length === 0 ? (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-white/40">
          No visible devices — toggle one on in the Device Manager.
        </div>
      ) : null}

      <div className="absolute right-2 bottom-2 z-40 flex items-center gap-1.5">
        {activeItem ? (
          <button
            type="button"
            title={
              drawMode
                ? "Done drawing boxes (Esc)"
                : "Draw measurement boxes on the image"
            }
            className={
              "flex h-6 items-center gap-1 rounded-md px-2 font-mono text-[10px] transition-colors " +
              (drawMode
                ? "bg-white/25 text-white"
                : "bg-black/50 text-white/60 hover:text-white")
            }
            onClick={() => setDrawMode(!drawMode)}
          >
            <PencilRulerIcon className="size-3" />
            {drawMode ? "done" : "measure"}
          </button>
        ) : null}
        <button
          type="button"
          title="Export this view as a PNG reference image"
          className="flex h-6 items-center gap-1 rounded-md bg-black/50 px-2 font-mono text-[10px] text-white/60 transition-colors hover:text-white"
          onClick={() => void exportView()}
        >
          <DownloadIcon className="size-3" /> export view
        </button>
        {scalePct !== null ? (
          <div className="rounded-md bg-black/50 px-2 py-1 font-mono text-[10px] text-white/60">
            {scalePct === 100
              ? "1:1 physical scale"
              : `${scalePct}% scale — fullscreen at native res for 1:1`}
          </div>
        ) : null}
      </div>
    </div>
  );
}
