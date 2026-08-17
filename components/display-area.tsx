"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DownloadIcon, PencilRulerIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { GifView, VideoMirror } from "@/components/media-view";
import { useDeviceStore } from "@/stores/device-store";
import { useMediaStore } from "@/stores/media-store";
import { useSettingsStore } from "@/stores/settings-store";
import { useAnnotationStore } from "@/stores/annotation-store";
import { useUiStore } from "@/stores/ui-store";
import {
  ACUITY,
  boxMetricsOnDevice,
  simulatedSizeOnHostPx,
} from "@/lib/display-math";
import { containFit } from "@/lib/fit";
import {
  boxInCrop,
  cropOf,
  cropScaleStyle,
  effectiveDims,
  viewBoxStyle,
} from "@/lib/media-crop";
import type { Device, HighlightBox, MediaItem } from "@/lib/types";

/**
 * Where the window's client area sits on the physical screen, in CSS px.
 * screenX/screenY are virtual-desktop coordinates; availLeft/availTop
 * (Chromium) locate this monitor in that space. Browser chrome is
 * estimated from the outer/inner delta (borders split left/right, the
 * rest is the title/tab bar). Polled — there is no window-move event.
 */
function useScreenViewport() {
  const [vp, setVp] = useState<{
    clientX: number;
    clientY: number;
    screenW: number;
    screenH: number;
  } | null>(null);

  useEffect(() => {
    // Adaptive cadence: idle at 2Hz, but the moment the window moves,
    // poll at ~30fps until it has been still for a beat. There is no
    // window-move event, so change detection IS the drag sensor.
    const IDLE_MS = 500;
    const FAST_MS = 33;
    const SETTLE_MS = 700;
    let timer = 0;
    let lastMoveAt = -Infinity;
    let stopped = false;

    const read = () => {
      if (stopped) return;
      // Resize also calls read; clearing first keeps a single timer chain.
      window.clearTimeout(timer);
      const chromeX = Math.max(0, (window.outerWidth - window.innerWidth) / 2);
      const chromeY = Math.max(
        0,
        window.outerHeight - window.innerHeight - chromeX,
      );
      const s = window.screen as Screen & {
        availLeft?: number;
        availTop?: number;
      };
      const next = {
        clientX: window.screenX + chromeX - (s.availLeft ?? 0),
        clientY: window.screenY + chromeY - (s.availTop ?? 0),
        screenW: s.width,
        screenH: s.height,
      };
      let moved = false;
      setVp((prev) => {
        if (
          prev &&
          prev.clientX === next.clientX &&
          prev.clientY === next.clientY &&
          prev.screenW === next.screenW &&
          prev.screenH === next.screenH
        ) {
          return prev;
        }
        moved = prev !== null;
        return next;
      });
      if (moved) lastMoveAt = performance.now();
      const fast = performance.now() - lastMoveAt < SETTLE_MS;
      timer = window.setTimeout(read, fast ? FAST_MS : IDLE_MS);
    };

    read();
    window.addEventListener("resize", read);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      window.removeEventListener("resize", read);
    };
  }, []);

  return vp;
}

/**
 * Wrapper-based CSS crop for media elements that take no style prop
 * (SyncedVideo, the GIF follower canvas — object-view-box needs an inline
 * style): the effective region contain-fit into the rect becomes a clip
 * box, with the full-frame element oversized and offset behind it.
 */
function CropFrame({
  item,
  w,
  h,
  children,
}: {
  item: MediaItem;
  w: number;
  h: number;
  children: React.ReactNode;
}) {
  const eff = effectiveDims(item);
  const area = containFit(eff.width, eff.height, w, h);
  return (
    <div
      className="absolute overflow-hidden"
      style={{ left: area.x, top: area.y, width: area.w, height: area.h }}
    >
      <div className="absolute" style={cropScaleStyle(item)}>
        {children}
      </div>
    </div>
  );
}

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
  const crop = cropOf(media);
  const eff = effectiveDims(media);
  const area = containFit(eff.width, eff.height, rectW, rectH);
  if (!area.w) return null;
  return (
    <>
      {(media.boxes ?? []).map((b) => {
        // Boxes stay normalized to the full image; render them through
        // the crop window (clipped; hidden when fully outside).
        const cb = boxInCrop(b, crop);
        if (!cb) return null;
        const color = boxBandColor(worstByBox.get(b.id) ?? 99);
        const selected = b.id === selectedBoxId;
        return (
          <div
            key={b.id}
            role={isHost ? "button" : undefined}
            className="absolute"
            style={{
              left: area.x + cb.x * area.w,
              top: area.y + cb.y * area.h,
              width: cb.w * area.w,
              height: cb.h * area.h,
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
  // All contain-fit math below runs on the cropped (effective) dims.
  // Memoized so the react-compiler can keep the manual memos below —
  // it can't see into the helpers to prove they don't mutate activeItem.
  const { eff, crop, imgViewBox } = useMemo(
    () =>
      activeItem
        ? {
            eff: effectiveDims(activeItem),
            crop: cropOf(activeItem),
            imgViewBox: viewBoxStyle(activeItem),
          }
        : { eff: null, crop: null, imgViewBox: undefined },
    [activeItem],
  );

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
    const c = cropOf(activeItem);
    const dims = effectiveDims(activeItem);
    const devs = [
      ...(thisDevice.visible ? [thisDevice] : []),
      ...devices.filter((d) => d.visible),
    ];
    for (const b of activeItem.boxes ?? []) {
      let worst = Infinity;
      for (const d of devs) {
        // The cropped region is what contain-fits onto each device, so
        // the box height re-normalizes against the crop (b.h/c.h of
        // dims.height = the box's unchanged source-pixel height).
        worst = Math.min(
          worst,
          boxMetricsOnDevice(b.h / c.h, dims, d).arcmin,
        );
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

  const displayMode = useSettingsStore((s) => s.displayMode);
  const setDisplayMode = useSettingsStore((s) => s.setDisplayMode);
  const displayCenter = useSettingsStore((s) => s.displayCenter);
  const setDisplayCenter = useSettingsStore((s) => s.setDisplayCenter);
  const panOffset = useUiStore((s) => s.panOffset);
  const setPanOffset = useUiStore((s) => s.setPanOffset);
  const selectedDeviceId = useUiStore((s) => s.selectedDeviceId);
  const vp = useScreenViewport();
  const viewportActive = displayMode === "viewport" && vp !== null;

  // Left mouse selects on click, pans on drag (plan 4.3; Space-pan
  // dropped). A small movement threshold separates the two.
  const selectDevice = useUiStore((s) => s.selectDevice);
  const panDrag = useRef<{
    startX: number;
    startY: number;
    baseX: number;
    baseY: number;
    panning: boolean;
  } | null>(null);
  const [panning, setPanning] = useState(false);

  // Scale: CSS px per This-Device pixel. Viewport mode maps This Device's
  // panel exactly onto the physical screen (the window shows the slice it
  // covers); fit mode shrinks the whole panel into the window.
  const k = useMemo(() => {
    if (!area.w || !area.h) return 0;
    if (viewportActive && vp) return vp.screenW / thisDevice.resolution.w;
    return Math.min(
      area.w / thisDevice.resolution.w,
      area.h / thisDevice.resolution.h,
    );
  }, [
    area.w,
    area.h,
    viewportActive,
    vp,
    thisDevice.resolution.w,
    thisDevice.resolution.h,
  ]);

  // Composition center in client coordinates: the physical screen's
  // center ("screen" center mode, viewport only) or the window's center,
  // plus the user's manual pan.
  const baseCenter =
    viewportActive && vp && displayCenter === "screen"
      ? { x: vp.screenW / 2 - vp.clientX, y: vp.screenH / 2 - vp.clientY }
      : { x: area.w / 2, y: area.h / 2 };
  const center = {
    x: baseCenter.x + panOffset.x,
    y: baseCenter.y + panOffset.y,
  };

  const rects = useMemo(() => {
    if (!k) return [];
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
  }, [k, thisDevice, devices]);

  /** Physical-truth percentage: 100 = one device px per native screen px. */
  const scalePct = useMemo(
    () => (k ? Math.round(k * dpr * 100) : null),
    [k, dpr],
  );

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
        // Draw only the crop window (full frame when no crop).
        const c = crop ?? { x: 0, y: 0, w: 1, h: 1 };
        const sw = c.w * img.naturalWidth;
        const sh = c.h * img.naturalHeight;
        const s = Math.min(w / sw, h / sh);
        const iw = sw * s;
        const ih = sh * s;
        g.drawImage(
          img,
          c.x * img.naturalWidth,
          c.y * img.naturalHeight,
          sw,
          sh,
          x + (w - iw) / 2,
          y + (h - ih) / 2,
          iw,
          ih,
        );
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
  }, [thisDevice, devices, activeUrl, crop, displayFill]);

  /** Topmost device rect (highest z = last in draw order) under a point. */
  const deviceAt = (clientX: number, clientY: number) => {
    const el = ref.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const px = clientX - r.left;
    const py = clientY - r.top;
    let hit: string | null = null;
    for (const { device, w, h } of rects) {
      if (
        Math.abs(px - center.x) <= w / 2 &&
        Math.abs(py - center.y) <= h / 2
      ) {
        hit = device.id; // later entries draw on top; keep the last hit
      }
    }
    return hit;
  };

  /** Ignore pan/select gestures that start on interactive elements. */
  const onInteractive = (t: EventTarget | null) =>
    t instanceof HTMLElement && t.closest('button,[role="button"]') !== null;

  return (
    <div
      ref={ref}
      className={cn(
        "absolute inset-0 overflow-hidden bg-[oklch(0.16_0_0)] touch-none",
        panning && "cursor-grabbing",
      )}
      onPointerDown={(e) => {
        if (e.button !== 0 || drawMode || onInteractive(e.target)) return;
        panDrag.current = {
          startX: e.clientX,
          startY: e.clientY,
          baseX: panOffset.x,
          baseY: panOffset.y,
          panning: false,
        };
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        const p = panDrag.current;
        if (!p) return;
        const dx = e.clientX - p.startX;
        const dy = e.clientY - p.startY;
        if (!p.panning && Math.hypot(dx, dy) > 4) {
          p.panning = true;
          setPanning(true);
        }
        if (p.panning) setPanOffset({ x: p.baseX + dx, y: p.baseY + dy });
      }}
      onPointerUp={(e) => {
        const p = panDrag.current;
        panDrag.current = null;
        setPanning(false);
        if (!p) return;
        if (!p.panning) {
          // A stationary click: select the device under the cursor
          // (toggles off when it's already the selection).
          const hit = deviceAt(e.clientX, e.clientY);
          selectDevice(hit === selectedDeviceId ? null : hit);
        }
      }}
      onDoubleClick={(e) => {
        if (drawMode || onInteractive(e.target)) return;
        setPanOffset({ x: 0, y: 0 });
      }}
    >
      {rects.map(({ device, w, h }, i) => (
        <div
          key={device.id}
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={{
            left: center.x,
            top: center.y,
            width: w,
            height: h,
            zIndex: i + 1,
          }}
        >
          <div
            className="absolute inset-0 bg-black"
            style={{
              outline: `2px solid ${device.color}`,
              outlineOffset: -1,
              // Selection affordance: a soft ring just outside the rect's
              // own outline (shared selection with the table and 3D view).
              boxShadow:
                device.id === selectedDeviceId
                  ? `0 0 0 4px ${device.color}59`
                  : undefined,
              // Fill also backs the letterbox bars when content doesn't
              // cover the panel (16:9 image on a 32:9 display).
              background:
                displayFill === "device-color"
                  ? device.color
                  : activeUrl
                    ? "black"
                    : `${device.color}0d`,
            }}
          >
            {activeVideoUrl && activeItem ? (
              // One master decode; each rect mirrors it (crop applied at
              // draw time, so no wrapper needed).
              <VideoMirror
                item={activeItem}
                className="size-full object-contain select-none"
              />
            ) : activeItem?.type === "image/gif" && activeUrl ? (
              activeItem.crop ? (
                <CropFrame item={activeItem} w={w} h={h}>
                  <GifView url={activeUrl} className="size-full select-none" />
                </CropFrame>
              ) : (
                <GifView
                  url={activeUrl}
                  className="size-full object-contain select-none"
                />
              )
            ) : activeUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={activeUrl}
                alt=""
                draggable={false}
                style={imgViewBox}
                className="size-full object-contain select-none"
              />
            ) : null}
            {activeItem && !device.isThis ? (
              <BoxLayer
                rectW={w}
                rectH={h}
                media={activeItem}
                worstByBox={worstByBox}
                isHost={false}
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

      {/* Host annotation layer sits above every device rect so drawing
          and box selection are never blocked by nested rects. */}
      {(() => {
        const hostRect = rects.find((r) => r.device.isThis);
        if (!activeItem || !eff || !crop || !hostRect) return null;
        const area = containFit(eff.width, eff.height, hostRect.w, hostRect.h);
        // Draft is kept in full-image coords like persisted boxes; render
        // it through the crop window like BoxLayer does.
        const draftCb = draft ? boxInCrop(draft, crop) : null;
        return (
          <div
            // Above every device rect (z 1..n), below the app chrome
            // (sidebar z-30, panels z-40+), so UI stays clickable while
            // drawing.
            className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-1/2"
            style={{
              left: center.x,
              top: center.y,
              width: hostRect.w,
              height: hostRect.h,
            }}
          >
            <div className="[&>div]:pointer-events-auto">
              <BoxLayer
                rectW={hostRect.w}
                rectH={hostRect.h}
                media={activeItem}
                worstByBox={worstByBox}
                isHost={!drawMode}
              />
            </div>
            {draftCb ? (
              <div
                className="pointer-events-none absolute border border-dashed border-white/80"
                style={{
                  left: area.x + draftCb.x * area.w,
                  top: area.y + draftCb.y * area.h,
                  width: draftCb.w * area.w,
                  height: draftCb.h * area.h,
                }}
              />
            ) : null}
            {drawMode ? (
              <div
                className="pointer-events-auto absolute inset-0 cursor-crosshair touch-none"
                onPointerDown={(e) => {
                  const r = e.currentTarget.getBoundingClientRect();
                  const a = containFit(eff.width, eff.height, r.width, r.height);
                  if (!a.w) return;
                  // Screen → crop space → full-image coords (boxes are
                  // stored against the full intrinsic image).
                  dragStart.current = {
                    x: crop.x + ((e.clientX - r.left - a.x) / a.w) * crop.w,
                    y: crop.y + ((e.clientY - r.top - a.y) / a.h) * crop.h,
                  };
                  e.currentTarget.setPointerCapture(e.pointerId);
                }}
                onPointerMove={(e) => {
                  if (!dragStart.current) return;
                  const r = e.currentTarget.getBoundingClientRect();
                  const a = containFit(eff.width, eff.height, r.width, r.height);
                  if (!a.w) return;
                  const clamp = (v: number) => Math.min(1, Math.max(0, v));
                  const nx =
                    crop.x + clamp((e.clientX - r.left - a.x) / a.w) * crop.w;
                  const ny =
                    crop.y + clamp((e.clientY - r.top - a.y) / a.h) * crop.h;
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
        );
      })()}

      {rects.length === 0 ? (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-white/40">
          No visible devices — toggle one on in the Device Manager.
        </div>
      ) : null}


      <div className="absolute right-2 bottom-2 z-40 flex flex-col items-end gap-1">
        {scalePct !== null ? (
          <div className="rounded-md bg-black/50 px-2 py-1 font-mono text-[10px] text-white/60">
            {viewportActive
              ? scalePct >= 99 && scalePct <= 101
                ? "1:1 physical scale · drag to pan"
                : `${scalePct}% — This Device res ≠ this screen's native res`
              : scalePct === 100
                ? "1:1 physical scale"
                : `${scalePct}% scale — viewport mode for 1:1`}
          </div>
        ) : null}
        <div className="flex items-center gap-1.5">
          {activeItem ? (
            <button
              type="button"
              title={
                drawMode
                  ? "Done drawing boxes (Esc)"
                  : "Draw measurement boxes on the image"
              }
              className={cn(
                "flex h-6 w-24 items-center justify-center gap-1 rounded-md font-mono text-[10px] transition-colors",
                drawMode
                  ? "bg-white/25 text-white"
                  : "bg-black/50 text-white/60 hover:text-white",
              )}
              onClick={() => setDrawMode(!drawMode)}
            >
              <PencilRulerIcon className="size-3" />
              {drawMode ? "done" : "measure"}
            </button>
          ) : null}
          <button
            type="button"
            title="Center the composition on the physical screen or in this window"
            className="h-6 w-28 rounded-md bg-black/50 font-mono text-[10px] text-white/60 transition-colors hover:text-white"
            onClick={() => {
              setDisplayCenter(displayCenter === "screen" ? "window" : "screen");
              setPanOffset({ x: 0, y: 0 });
            }}
          >
            {displayCenter === "screen" ? "center · screen" : "center · window"}
          </button>
          <button
            type="button"
            title={
              viewportActive
                ? "Window is a true-scale viewport into This Device's screen. Click for fit-to-window."
                : "Whole composition shrunk to fit the window. Click for the true-scale viewport."
            }
            className="h-6 w-20 rounded-md bg-black/50 font-mono text-[10px] text-white/60 transition-colors hover:text-white"
            onClick={() => setDisplayMode(viewportActive ? "fit" : "viewport")}
          >
            {viewportActive ? "viewport" : "fit"}
          </button>
          <button
            type="button"
            title="Export this view as a PNG reference image"
            className="flex h-6 w-28 items-center justify-center gap-1 rounded-md bg-black/50 font-mono text-[10px] text-white/60 transition-colors hover:text-white"
            onClick={() => void exportView()}
          >
            <DownloadIcon className="size-3" /> export view
          </button>
        </div>
      </div>
    </div>
  );
}
