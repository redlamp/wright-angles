"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlignCenterVerticalIcon,
  DownloadIcon,
  ImageIcon,
  LayersIcon,
  PencilRulerIcon,
  PictureInPicture2Icon,
  WallpaperIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { CvdChip } from "@/components/cvd-filters";
import { GifView, VideoMirror } from "@/components/media-view";
import { useDeviceStore } from "@/stores/device-store";
import { useMediaStore } from "@/stores/media-store";
import { usePlaybackStore } from "@/stores/playback-store";
import { useSettingsStore } from "@/stores/settings-store";
import {
  useAnnotationStore,
  type DeviceHover,
} from "@/stores/annotation-store";
import { useUiStore } from "@/stores/ui-store";
import {
  boxMetricsOnDevice,
  formatDistance,
  simulatedSizeOnHostPx,
} from "@/lib/display-math";
import { deviceFitCrop, fitBox, fitModeOf } from "@/lib/fit";
import { boxMetricsInCrop } from "@/lib/box-metrics";
import { legibilityColor } from "@/lib/legibility";
import { deviceViewScale } from "@/lib/view-scale";
import { isAnimatedItem } from "@/lib/playback-engine";
import { activeKeyframe } from "@/lib/scan-keyframes";
import { groupColor } from "@/lib/text-groups";
import {
  FULL_CROP,
  boxInCrop,
  cropDims,
  cropScaleOf,
  isFullFrame,
  viewBoxOf,
} from "@/lib/media-crop";
import type {
  Device,
  FitMode,
  HighlightBox,
  MediaCrop,
  MediaItem,
} from "@/lib/types";

/**
 * Where the window's client area sits on the physical screen, in CSS px.
 * screenX/screenY are virtual-desktop coordinates; availLeft/availTop
 * (Chromium) locate this monitor in that space. Browser chrome is
 * estimated from the outer/inner delta (borders split left/right, the
 * rest is the title/tab bar). Polled — there is no window-move event.
 */
type ScreenViewport = {
  clientX: number;
  clientY: number;
  screenW: number;
  screenH: number;
} | null;

export function useScreenViewport() {
  const [vp, setVp] = useState<ScreenViewport>(null);
  // Mirrors the last value OUTSIDE React state so "did it move" can be
  // computed synchronously, in plain code — not by reading a variable an
  // updater function assigns as a side effect, which only works when
  // React happens to run that updater eagerly (it isn't a guaranteed
  // contract of setState).
  const vpRef = useRef<ScreenViewport>(null);

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
      const prev = vpRef.current;
      const unchanged =
        prev &&
        prev.clientX === next.clientX &&
        prev.clientY === next.clientY &&
        prev.screenW === next.screenW &&
        prev.screenH === next.screenH;
      if (!unchanged) {
        const moved = prev !== null;
        vpRef.current = next;
        setVp(next);
        if (moved) lastMoveAt = performance.now();
      }
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
  crop,
  mode,
  w,
  h,
  children,
}: {
  item: MediaItem;
  /** The crop to show — the owning device's EFFECTIVE crop. */
  crop: MediaCrop;
  /** The owning device's fit mode — stretch fills the whole rect. */
  mode: FitMode;
  w: number;
  h: number;
  children: React.ReactNode;
}) {
  const eff = cropDims(item, crop);
  const area = fitBox(mode, eff.width, eff.height, w, h);
  return (
    <div
      className="absolute overflow-hidden"
      style={{ left: area.x, top: area.y, width: area.w, height: area.h }}
    >
      <div className="absolute" style={cropScaleOf(crop)}>
        {children}
      </div>
    </div>
  );
}

/**
 * Debug-overlays menu chip (plan topic 10): safe areas, contrast
 * badges, pixel loupe. Session-only toggles with app-wide parity.
 */
function OverlaysChip() {
  const showSafeAreas = useAnnotationStore((s) => s.showSafeAreas);
  const setShowSafeAreas = useAnnotationStore((s) => s.setShowSafeAreas);
  const showContrast = useAnnotationStore((s) => s.showContrast);
  const setShowContrast = useAnnotationStore((s) => s.setShowContrast);
  const loupeOn = useAnnotationStore((s) => s.loupeOn);
  const setLoupeOn = useAnnotationStore((s) => s.setLoupeOn);
  const anyOn = showSafeAreas || showContrast || loupeOn;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex h-7 items-center gap-1 rounded-md px-2.5 font-mono text-sm transition-colors",
          anyOn
            ? "bg-white/25 text-white"
            : "bg-black/50 text-white/60 hover:text-white",
        )}
        title="Debug overlays: safe areas, contrast badges, pixel loupe"
      >
        <LayersIcon className="size-3" />
        overlays
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuCheckboxItem
          checked={showSafeAreas}
          onCheckedChange={setShowSafeAreas}
        >
          TV safe areas (93% / 90%)
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={showContrast}
          onCheckedChange={setShowContrast}
        >
          Contrast badges on scanned text
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={loupeOn}
          onCheckedChange={setLoupeOn}
        >
          Pixel loupe
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * SMPTE ST 2046-1 safe-area frames, relative to the DISPLAY (not the
 * media): action-safe 93%, title-safe 90%. Overlaid per device rect so
 * TV-bound UI can be judged against every screen at once.
 */
function SafeAreas({ large }: { large: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-0">
      <div
        className="absolute border border-dashed border-white/50"
        style={{ inset: "3.5%" }}
      >
        {large ? (
          <span className="absolute top-0 left-1 font-mono text-sm text-white/50">
            action 93%
          </span>
        ) : null}
      </div>
      <div
        className="absolute border border-dashed border-[#f5a524]/60"
        style={{ inset: "5%" }}
      >
        {large ? (
          <span className="absolute bottom-0 left-1 font-mono text-sm text-[#f5a524]/70">
            title 90%
          </span>
        ) : null}
      </div>
    </div>
  );
}

const LOUPE_SIZE = 176;
const LOUPE_ZOOM = 8;

/**
 * Pixel loupe (plan 10.2): follows the cursor over This Device's rect
 * and magnifies the source image 8×, pixel grid on top, with a readout
 * of the source coordinate and what one source pixel subtends on This
 * Device. Static images only — video would need per-frame capture.
 */
function PixelLoupe({
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

/** Module-level mutator (react-compiler convention): view hover state. */
const setDeviceHover = (h: DeviceHover | null) =>
  useAnnotationStore.getState().setDeviceHover(h);


/**
 * Highlight boxes over one device rect. Coordinates are normalized to
 * the media's content area — wherever this device's fit mode puts it in
 * the rect (`fitBox`) — so the same box lands on the same pixels of the
 * image on every device, stretched panels included.
 */
function BoxLayer({
  rectW,
  rectH,
  media,
  boxes,
  worstByBox,
  groupById,
  isHost,
  deviceId,
  crop,
  mode,
}: {
  rectW: number;
  rectH: number;
  media: MediaItem;
  /** Measure boxes + active-keyframe lines, full-image normalized. */
  boxes: HighlightBox[];
  /** null = no visible device's fit shows this box; render it muted. */
  worstByBox: Map<string, number | null>;
  /** Text-block ids for the global Groups color mode. */
  groupById: Map<string, number>;
  isHost: boolean;
  /** Owning rect's device — box hovers feed the inspector with it. */
  deviceId: string;
  /** The owning device's rendered crop (source crop, fit-reframed). */
  crop: MediaCrop;
  /** The owning device's fit mode — boxes must land where IT draws. */
  mode: FitMode;
}) {
  const selectedBoxId = useAnnotationStore((s) => s.selectedBoxId);
  const selectBox = useAnnotationStore((s) => s.selectBox);
  const colorMode = useAnnotationStore((s) => s.scanColorMode);
  const eff = cropDims(media, crop);
  const area = fitBox(mode, eff.width, eff.height, rectW, rectH);
  if (!area.w) return null;
  return (
    <>
      {boxes.map((b) => {
        // Boxes stay normalized to the full image; render them through
        // the crop window (clipped; hidden when fully outside).
        const cb = boxInCrop(b, crop);
        if (!cb) return null;
        const gid = groupById.get(b.id);
        const color =
          colorMode === "group" && gid !== undefined
            ? groupColor(gid)
            : legibilityColor(worstByBox.get(b.id) ?? null);
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
              // All rects' boxes are hoverable (inspector details);
              // only the host's are clickable.
              pointerEvents: "auto",
            }}
            onClick={
              isHost
                ? (e) => {
                    e.stopPropagation();
                    selectBox(selected ? null : b.id);
                  }
                : undefined
            }
            onPointerEnter={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              const s = e.currentTarget.parentElement?.getBoundingClientRect();
              setDeviceHover({
                deviceId,
                box: {
                  id: b.id,
                  label: b.label,
                  srcPx: Math.round(b.h * media.height),
                  hFull: b.h,
                  groupId: groupById.get(b.id),
                  bounds: {
                    left: r.left,
                    top: r.top,
                    right: r.right,
                    bottom: r.bottom,
                  },
                  screen: s
                    ? {
                        left: s.left,
                        top: s.top,
                        right: s.right,
                        bottom: s.bottom,
                      }
                    : undefined,
                },
              });
            }}
            onPointerLeave={() => setDeviceHover({ deviceId, box: null })}
          />
        );
      })}
    </>
  );
}

// Cycle label corners so tightly nested rects stay readable — shared by
// the in-stack label and the focused-chrome overlay's copy, so a device's
// label doesn't jump to a different corner the moment it's focused.
const LABEL_CORNER_CLASSES = [
  "top-0 left-0 -translate-y-full pb-0.5",
  "top-0 right-0 translate-y-0 pt-0.5 pr-1.5 text-right",
  "bottom-0 left-0 translate-y-full pt-0.5",
  "bottom-0 right-0 translate-y-0 pb-0.5 pr-1.5 text-right",
];

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
  const unit = useSettingsStore((s) => s.unit);

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
    const updateDpr = () => setDpr(window.devicePixelRatio || 1);
    updateDpr();
    // `resize` alone misses a DPR change with no size change — dragging
    // the window to a different-DPI monitor, most commonly. A
    // matchMedia query on the CURRENT ratio fires once that ratio no
    // longer matches; re-arm it on the new ratio each time so it keeps
    // tracking indefinitely, not just the first crossing.
    let mq: MediaQueryList | null = null;
    const onDprChange = () => {
      updateDpr();
      armDprWatch();
    };
    const armDprWatch = () => {
      mq?.removeEventListener("change", onDprChange);
      mq = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
      mq.addEventListener("change", onDprChange);
    };
    armDprWatch();
    window.addEventListener("resize", updateDpr);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", updateDpr);
      mq?.removeEventListener("change", onDprChange);
    };
  }, []);

  const activeItem = items.find((i) => i.id === activeId) ?? null;
  const activeUrl = activeItem ? objectUrls[activeItem.id] : null;
  const activeVideoUrl =
    activeItem?.kind === "video" ? videoUrls[activeItem.id] : null;
  // All fit math below runs on the rendered (source-cropped, then
  // fit-reframed) dims. The host pair drives the annotation layer +
  // loupe (This Device's rect); other rects derive their own fit crop
  // inline. Memoized so the react-compiler can keep the manual memos
  // below — it can't see into the helpers to prove they don't mutate
  // activeItem.
  const { eff, crop } = useMemo(() => {
    if (!activeItem) return { eff: null, crop: null };
    const c = deviceFitCrop(activeItem, thisDevice);
    return { eff: cropDims(activeItem, c), crop: c };
  }, [activeItem, thisDevice]);

  const drawMode = useAnnotationStore((s) => s.drawMode);
  const setDrawMode = useAnnotationStore((s) => s.setDrawMode);
  const showTextBoxes = useAnnotationStore((s) => s.showTextBoxes);
  const showSafeAreas = useAnnotationStore((s) => s.showSafeAreas);
  const loupeOn = useAnnotationStore((s) => s.loupeOn);
  const selectedBoxId = useAnnotationStore((s) => s.selectedBoxId);
  const selectBox = useAnnotationStore((s) => s.selectBox);
  const addBox = useMediaStore((s) => s.addBox);
  const removeBox = useMediaStore((s) => s.removeBox);
  const [draft, setDraft] = useState<HighlightBox | null>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);

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
  // First paint in viewport mode: until the screen-position poll
  // returns (one effect tick), k falls back to fit scale — rendering
  // that frame reads as a scale snap at boot. Hold invisible instead.
  const vpBooting = displayMode === "viewport" && vp === null;

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
  const k = useMemo(
    () =>
      deviceViewScale(
        thisDevice.resolution.w,
        thisDevice.resolution.h,
        area.w,
        area.h,
        viewportActive && vp ? vp.screenW : null,
      ),
    [
      area.w,
      area.h,
      viewportActive,
      vp,
      thisDevice.resolution.w,
      thisDevice.resolution.h,
    ],
  );

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

  /**
   * Browser-zoom estimate (plan 11.1). screen.width is in CSS px and
   * ignores page zoom while devicePixelRatio scales with it, so with
   * This Device set to this screen's real panel their product over the
   * native width reads the zoom factor. >±2% off earns a warning —
   * zoomed rendering breaks every physical-scale promise.
   */
  const zoomPct = useMemo(() => {
    if (!vp) return null;
    const pct = Math.round(
      ((vp.screenW * dpr) / thisDevice.resolution.w) * 100,
    );
    return Math.abs(pct - 100) > 2 ? pct : null;
  }, [vp, dpr, thisDevice.resolution.w]);

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
        // Draw only this device's rendered crop window (source crop
        // reframed by its fit mode; full frame when neither applies).
        const c = activeItem ? deviceFitCrop(activeItem, d) : FULL_CROP;
        const sw = c.w * img.naturalWidth;
        const sh = c.h * img.naturalHeight;
        // Same fitBox the on-screen rect uses, so the export is the
        // screenshot it claims to be — a stretched device fills its rect.
        const a = fitBox(fitModeOf(d), sw, sh, w, h);
        g.drawImage(
          img,
          c.x * img.naturalWidth,
          c.y * img.naturalHeight,
          sw,
          sh,
          x + a.x,
          y + a.y,
          a.w,
          a.h,
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
      const label = `${d.label} · ${formatDistance(d.distanceCm, unit)}`;
      g.fillText(label, x + 8, y > 30 ? y - 8 : y + 26);
    }

    g.fillStyle = "rgba(255,255,255,0.55)";
    g.font = `${Math.max(13, Math.round(W / 110))}px monospace`;
    g.fillText(
      `Wright Angles — host: ${host.label} ${W}×${H} @ ${formatDistance(host.distanceCm, unit)}`,
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
    // Deferred: revoking synchronously after click() can beat Firefox/
    // Safari to actually starting the download.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [thisDevice, devices, activeUrl, activeItem, displayFill, unit]);

  /**
   * Topmost device rect (highest z = last in draw order) under a point.
   * Focus doesn't change this: it raises only the focused device's OWN
   * chrome (outline/ring/label) above the stack, never its fill, so the
   * fill layers below stay in plain area-sorted order and this stays
   * accurate without needing to know who's focused.
   */
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

  /**
   * Ignore pan/select gestures that start on interactive elements.
   * Two traps here (both shipped as "clicking a button selects a
   * device"): base-ui select/menu triggers don't render as <button>,
   * so the toolbar opts out wholesale via data-ui-chrome; and clicks
   * landing on lucide SVG icons have an SVGElement target, which is
   * NOT an HTMLElement — the guard must accept any Element, or every
   * icon-only button falls through to the canvas and gets its pointer
   * captured out from under it.
   */
  const onInteractive = (t: EventTarget | null) => {
    if (!(t instanceof Element)) return true;
    // Portaled popups (base-ui select/menu) bubble through the REACT
    // tree while their DOM target lives under document.body — anything
    // whose DOM position is outside this container is popup UI.
    if (ref.current && !ref.current.contains(t)) return true;
    return (
      t.closest('button,[role="button"],[role="combobox"],[data-ui-chrome]') !==
      null
    );
  };

  return (
    <div
      ref={ref}
      className={cn(
        "absolute inset-0 overflow-hidden bg-[oklch(0.16_0_0)] touch-none",
        panning && "cursor-grabbing",
        vpBooting && "invisible",
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
      onPointerCancel={() => {
        // The gesture was interrupted (browser gesture takeover, a
        // window losing focus mid-drag, …) — just clear the drag, never
        // treat it as a click-select.
        panDrag.current = null;
        setPanning(false);
      }}
      onLostPointerCapture={() => {
        // Capture can be lost without either pointerup or pointercancel
        // firing (e.g. another element steals it) — same treatment:
        // clear the drag, no click-select.
        panDrag.current = null;
        setPanning(false);
      }}
      onDoubleClick={(e) => {
        if (drawMode || onInteractive(e.target)) return;
        setPanOffset({ x: 0, y: 0 });
      }}
    >
      {rects.map(({ device, w, h }, i) => {
        // This rect's rendered crop — the media's source crop, reframed
        // by this device's fit mode. Everything drawn inside maps
        // through it.
        const dCrop = activeItem ? deviceFitCrop(activeItem, device) : null;
        // This rect's fit mode drives both the CSS object-fit of the
        // media element and the geometry every overlay inside measures
        // against — they have to be the same answer.
        const dMode = fitModeOf(device);
        const objectFit =
          dMode === "stretch" ? "object-fill" : "object-contain";
        // The focused device's OWN chrome (outline, ring, label) draws in
        // the overlay pass below instead of here — see there for why.
        // Its fill stays exactly here, at its plain sorted position.
        const isFocused = device.id === selectedDeviceId;
        return (
        <div
          key={device.id}
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={{
            left: center.x,
            top: center.y,
            width: w,
            height: h,
            // Plain area-descending sort, unaffected by focus (biggest
            // device bottom, so a smaller nested one is legible on top
            // by default) — see the overlay pass below for how focus is
            // expressed instead.
            zIndex: i + 1,
          }}
          // Same inspector-feeding hover as the 3D rects. enter/leave
          // (not over/out): descendants — boxes — must not re-fire it.
          onPointerEnter={() =>
            setDeviceHover({ deviceId: device.id, box: null })
          }
          onPointerLeave={() => setDeviceHover(null)}
        >
          <div
            className="absolute inset-0 bg-black"
            style={{
              // Suppressed on the focused device: its outline moves to
              // the overlay pass, which draws above the whole stack
              // instead of wherever the area sort put this fill. Drawing
              // it here too would double the alpha where the overlay's
              // copy sits directly on top of it.
              outline: isFocused ? undefined : `2px solid ${device.color}`,
              outlineOffset: -1,
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
              // One master decode; each rect mirrors it (its rendered
              // crop applied at draw time, so no wrapper needed).
              <VideoMirror
                item={activeItem}
                crop={dCrop ?? undefined}
                className={cn("size-full select-none", objectFit)}
              />
            ) : activeItem?.type === "image/gif" && activeUrl ? (
              dCrop && !isFullFrame(dCrop) ? (
                <CropFrame
                  item={activeItem}
                  crop={dCrop}
                  mode={dMode}
                  w={w}
                  h={h}
                >
                  <GifView url={activeUrl} className="size-full select-none" />
                </CropFrame>
              ) : (
                <GifView
                  url={activeUrl}
                  className={cn("size-full select-none", objectFit)}
                />
              )
            ) : activeUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={activeUrl}
                alt=""
                draggable={false}
                style={viewBoxOf(dCrop ?? undefined)}
                className={cn("size-full select-none", objectFit)}
              />
            ) : null}
            {/* Boxes live INSIDE each rect so a nested device naturally
                covers the ones beneath it — tied to the device they're
                on (Taylor 2026-08-17). Only the host's are clickable. */}
            {activeItem && dCrop && overlayBoxes.length > 0 && showTextBoxes ? (
              <BoxLayer
                rectW={w}
                rectH={h}
                media={activeItem}
                boxes={overlayBoxes}
                worstByBox={worstByBox}
                groupById={groupById}
                isHost={!!device.isThis && !drawMode}
                deviceId={device.id}
                crop={dCrop}
                mode={dMode}
              />
            ) : null}
            {showSafeAreas ? <SafeAreas large={w > 320} /> : null}
          </div>
          {/* Suppressed on the focused device — its copy is in the
              overlay pass below, above the whole stack. */}
          {isFocused ? null : (
            <span
              className={cn(
                "absolute px-1 font-mono text-sm leading-4 whitespace-nowrap",
                LABEL_CORNER_CLASSES[i % 4],
              )}
              style={{ color: device.color }}
            >
              {device.label} · {formatDistance(device.distanceCm, unit)}
            </span>
          )}
        </div>
        );
      })}

      {/* Focused-device chrome overlay: raises just the readable parts
          (outline, ring, label) of the focused rect above the ENTIRE
          stack, while its fill and media stay at their plain sorted
          z-position above. Focusing the biggest device must not paint
          over every smaller one nested inside it (Taylor 2026-08-20) —
          so unlike deviceAt/hover, which read the real fill stack, this
          is a second, pointer-events-none pass that never affects what
          a click or hover actually lands on. */}
      {(() => {
        const fi = rects.findIndex((r) => r.device.id === selectedDeviceId);
        if (fi === -1) return null;
        const { device, w, h } = rects[fi];
        return (
          <div
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
            style={{
              left: center.x,
              top: center.y,
              width: w,
              height: h,
              zIndex: rects.length + 1,
            }}
          >
            <div
              className="absolute inset-0"
              style={{
                outline: `2px solid ${device.color}`,
                outlineOffset: -1,
                // Selection affordance: a soft ring just outside the
                // rect's own outline (shared selection with the table
                // and 3D view).
                boxShadow: `0 0 0 4px ${device.color}59`,
              }}
            />
            <span
              className={cn(
                "absolute px-1 font-mono text-sm leading-4 whitespace-nowrap",
                LABEL_CORNER_CLASSES[fi % 4],
              )}
              style={{ color: device.color }}
            >
              {device.label} · {formatDistance(device.distanceCm, unit)}
            </span>
          </div>
        );
      })()}

      {/* Host annotation layer sits above every device rect so drawing
          and box selection are never blocked by nested rects. */}
      {(() => {
        const hostRect = rects.find((r) => r.device.isThis);
        if (!activeItem || !eff || !crop || !hostRect) return null;
        // The layer overlays This Device's rect, so it maps through
        // This Device's fit — same geometry its BoxLayer uses.
        const hostMode = fitModeOf(thisDevice);
        const area = fitBox(
          hostMode,
          eff.width,
          eff.height,
          hostRect.w,
          hostRect.h,
        );
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
                  const a = fitBox(
                    hostMode,
                    eff.width,
                    eff.height,
                    r.width,
                    r.height,
                  );
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
                  const a = fitBox(
                    hostMode,
                    eff.width,
                    eff.height,
                    r.width,
                    r.height,
                  );
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
        <div className="absolute inset-0 flex items-center justify-center text-base text-white/40">
          No visible devices — toggle one on in the Device Manager.
        </div>
      ) : null}

      {(() => {
        const host = rects.find((r) => r.device.isThis);
        return loupeOn &&
          host &&
          activeItem &&
          crop &&
          activeItem.kind === "image" &&
          activeItem.type !== "image/gif" &&
          activeUrl ? (
          <PixelLoupe
            containerRef={ref}
            center={center}
            hostW={host.w}
            hostH={host.h}
            item={activeItem}
            crop={crop}
            url={activeUrl}
            thisDevice={thisDevice}
          />
        ) : null;
      })()}


      {/* Readouts stay bottom-right; action buttons live top-right. */}
      <div className="absolute right-2 bottom-2 z-40 flex flex-col items-end gap-1">
        {zoomPct !== null ? (
          <div
            className="rounded-md bg-[#f5a524]/90 px-2 py-1 font-mono text-sm text-black"
            title="Browser zoom (or a This Device resolution that doesn't match this screen) breaks the 1:1 physical-scale promise. Set zoom to 100% — or fix This Device — for true sizes."
          >
            ⚠ browser zoom ≈ {zoomPct}% — sizes are not true
          </div>
        ) : null}
        {scalePct !== null ? (
          <div className="rounded-md bg-black/50 px-2 py-1 font-mono text-sm text-white/60">
            {viewportActive
              ? scalePct >= 99 && scalePct <= 101
                ? "1:1 physical scale · drag to pan"
                : `${scalePct}% — This Device res ≠ this screen's native res`
              : scalePct === 100
                ? "1:1 physical scale"
                : `${scalePct}% scale — viewport mode for 1:1`}
          </div>
        ) : null}
      </div>
      {/* data-ui-chrome: pan/select gestures must never start here —
          select/menu triggers aren't <button>s, so the generic guard
          can't see them (the click-through device-select bug). */}
      <div
        data-ui-chrome
        className="absolute top-2 right-2 z-40 flex items-center gap-1.5"
      >
          {activeItem ? (
            <button
              type="button"
              title={
                drawMode
                  ? "Done drawing boxes (Esc)"
                  : "Draw measurement boxes on the image"
              }
              className={cn(
                "flex h-7 w-28 items-center justify-center gap-1 rounded-md font-mono text-sm transition-colors",
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
          <OverlaysChip />
          <CvdChip className="rounded-md border-0 bg-black/50 font-mono text-sm text-white/60 hover:text-white dark:bg-black/50 dark:hover:bg-black/50" />
          <button
            type="button"
            title={
              displayCenter === "screen"
                ? "Locked to your monitor: content anchors to the physical screen's center, so moving the window pans across it. Click to center in the window instead."
                : "Centered in this window. Click to lock the content to your monitor's physical center instead."
            }
            className="flex h-7 w-9 items-center justify-center rounded-md bg-black/50 text-white/60 transition-colors hover:text-white"
            onClick={() => {
              setDisplayCenter(displayCenter === "screen" ? "window" : "screen");
              setPanOffset({ x: 0, y: 0 });
            }}
          >
            {displayCenter === "screen" ? (
              <PictureInPicture2Icon className="size-3.5" />
            ) : (
              <AlignCenterVerticalIcon className="size-3.5" />
            )}
          </button>
          <button
            type="button"
            title={
              viewportActive
                ? "Window is a true-scale viewport into This Device's screen. Click for fit-to-window."
                : "Whole composition shrunk to fit the window. Click for the true-scale viewport."
            }
            className="flex h-7 w-9 items-center justify-center rounded-md bg-black/50 text-white/60 transition-colors hover:text-white"
            onClick={() => setDisplayMode(viewportActive ? "fit" : "viewport")}
          >
            {viewportActive ? (
              <ImageIcon className="size-3.5" />
            ) : (
              <WallpaperIcon className="size-3.5" />
            )}
          </button>
          <button
            type="button"
            title="Export this view as a PNG reference image"
            className="flex h-7 w-32 items-center justify-center gap-1 rounded-md bg-black/50 font-mono text-sm text-white/60 transition-colors hover:text-white"
            onClick={() => void exportView()}
          >
            <DownloadIcon className="size-3" /> export view
          </button>
      </div>
    </div>
  );
}
