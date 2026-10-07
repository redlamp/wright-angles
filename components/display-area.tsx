"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { GifView, VideoMirror } from "@/components/media-view";
import {
  useScreenViewport,
} from "@/components/display-area/use-screen-viewport";
import { CropFrame, SafeAreas } from "@/components/display-area/overlays";
import { PixelLoupe } from "@/components/display-area/pixel-loupe";
import { useHostArea } from "@/components/display-area/use-host-area";
import { exportViewPng } from "@/components/display-area/export-view";
import { BoxLayer, setDeviceHover } from "@/components/display-area/box-layer";
import { useOverlayBoxes } from "@/components/display-area/use-overlay-boxes";
import { AnnotationLayer } from "@/components/display-area/annotation-layer";
import {
  ScaleReadouts,
  ViewActions,
} from "@/components/display-area/view-chrome";
import { useDeviceStore } from "@/stores/device-store";
import { useMediaStore } from "@/stores/media-store";
import { useSettingsStore } from "@/stores/settings-store";
import { useAnnotationStore } from "@/stores/annotation-store";
import { useUiStore } from "@/stores/ui-store";
import { formatDistance, simulatedSizeOnHostPx } from "@/lib/display-math";
import { deviceFitCrop, fitModeOf } from "@/lib/fit";
import { deviceViewScale } from "@/lib/view-scale";
import { zoomWarningPct } from "@/lib/browser-zoom";
import { cropDims, isFullFrame, viewBoxOf } from "@/lib/media-crop";
import type { Device } from "@/lib/types";

export { useScreenViewport };

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

  const { ref, area, dpr } = useHostArea();

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

  const { overlayBoxes, groupById, worstByBox } = useOverlayBoxes(
    activeItem,
    thisDevice,
    devices,
  );

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

  /** Browser zoom off 100%, as a percent — see lib/browser-zoom. */
  const zoomPct = useMemo(
    () => (vp ? zoomWarningPct(vp.screenW, dpr, thisDevice.resolution.w) : null),
    [vp, dpr, thisDevice.resolution.w],
  );

  const exportView = useCallback(
    () =>
      exportViewPng({
        thisDevice,
        devices,
        activeUrl,
        activeItem,
        displayFill,
        unit,
      }),
    [thisDevice, devices, activeUrl, activeItem, displayFill, unit],
  );

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
      <AnnotationLayer
        rects={rects}
        activeItem={activeItem}
        eff={eff}
        crop={crop}
        thisDevice={thisDevice}
        center={center}
        drawMode={drawMode}
        addBox={addBox}
        selectBox={selectBox}
      />

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
      <ScaleReadouts
        zoomPct={zoomPct}
        scalePct={scalePct}
        viewportActive={viewportActive}
      />
      {/* data-ui-chrome: pan/select gestures must never start here —
          select/menu triggers aren't <button>s, so the generic guard
          can't see them (the click-through device-select bug). */}
      <ViewActions
        activeItem={activeItem}
        drawMode={drawMode}
        setDrawMode={setDrawMode}
        displayCenter={displayCenter}
        setDisplayCenter={setDisplayCenter}
        setPanOffset={setPanOffset}
        viewportActive={viewportActive}
        setDisplayMode={setDisplayMode}
        exportView={exportView}
      />
    </div>
  );
}
